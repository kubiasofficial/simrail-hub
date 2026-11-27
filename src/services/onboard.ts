import {passengerStationLocation} from './passengerStationLocations';
import { isPassengerStop } from './passengerStops';
import { haversineM } from './geo';
import { parseSod } from '../adapters/trainsApi';
import type { StationCoord, Timetable, TimetablePoint, Train } from '../types/trains';

export type DelayClass = 'none' | 'ontime' | 'early' | 'late' | 'verylate';
export type Connection = 'live' | 'stale' | 'lost' | 'demo';

export const normName = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function findStation(name: string, stations: StationCoord[]): StationCoord | null {
  const n = normName(name);
  return passengerStationLocation(name,stations.find((s) => normName(s.name) === n) ?? null);
}

const DAY = 86400;
/** Rozdíl a−b v sekundách přes půlnoc, výsledek v intervalu (−12 h, +12 h]. */
export function diffSod(a: number, b: number): number {
  let d = (a - b) % DAY;
  if (d > DAY / 2) d -= DAY;
  if (d <= -DAY / 2) d += DAY;
  return d;
}
export const fmtSod = (s: number) => { const x = ((Math.round(s) % DAY) + DAY) % DAY; return `${String(Math.floor(x / 3600)).padStart(2, '0')}:${String(Math.floor((x % 3600) / 60)).padStart(2, '0')}`; };

const sched = (p: TimetablePoint, which: 'arrival' | 'departure') => parseSod(which === 'arrival' ? p.arrival ?? p.departure : p.departure ?? p.arrival);

export function delayClass(min: number | null): DelayClass {
  if (min === null) return 'none';
  if (min < 0) return 'early';
  if (min === 0) return 'ontime';
  return min <= 20 ? 'late' : 'verylate';
}

/** Zaznamenává skutečné časy průjezdu bodů jízdního řádu (API skutečné příjezdy neposkytuje). */
export class DelayTracker {
  private run: string | null = null;
  private lastIndex: number | null = null;
  private lastTime:number|null=null;
  private observed: { index: number; delaySec: number } | null = null;

  observe(runKey: string, index: number | null, nowSod: number | null, points: TimetablePoint[]): void {
    if (runKey !== this.run) { this.run = runKey; this.lastIndex = null; this.lastTime = null; this.observed = null; }
    if(nowSod===null||index===null||!Number.isInteger(index)||index<0||index>=points.length){this.observed=null;this.lastTime=null;this.lastIndex=null;return;}
    if((this.lastTime!==null&&Math.abs(diffSod(nowSod,this.lastTime))>120)||(index!==null&&this.lastIndex!==null&&index<this.lastIndex)){this.observed=null;this.lastIndex=null;}
    this.lastTime=nowSod;
    if (index === null) return;
    if (this.lastIndex !== null && index === this.lastIndex + 1 && nowSod !== null) {
      const p = points[index - 1];
      const s = p ? sched(p, 'departure') : null;
      if (s !== null) this.observed = { index: index - 1, delaySec: diffSod(nowSod, s) };
    }
    if(this.lastIndex!==null&&index>this.lastIndex+1)this.observed=null;
    this.lastIndex = index;
  }

  /** Zpoždění v celých minutách + zdroj hodnoty (pozorováno / odhad). */
  current(points: TimetablePoint[], index: number | null, nowSod: number | null): { min: number; kind: 'observed' | 'estimate' } | null {
    if(nowSod===null||index===null||!Number.isInteger(index)||index<0||index>=points.length)return null;
    if (this.observed) return { min: Math.round(this.observed.delaySec / 60), kind: 'observed' };
    // Before the first passage, expose only a lower bound: the target has not
    // been passed yet. Use departure at a scheduled stop so dwell is not delay.
    // Zero means no delay is proved yet, not a confirmed on-time arrival.
    const scheduled = sched(points[index], 'departure');
    if (scheduled === null) return null;
    return { min: Math.max(0, Math.floor(diffSod(nowSod, scheduled) / 60)), kind: 'estimate' };
  }
}

export interface RowModel {
  index: number; name: string; isStop: boolean | null; passengerStop: boolean;
  arrival: string | null; departure: string | null; estimated: string | null;
  status: 'passed' | 'target' | 'upcoming'; standing: boolean;
}
export interface OnboardModel {
  trainNumber: string; trainName: string | null; start: string | null; end: string | null;
  previous: string | null; current: string | null; next: string | null;
  rows: RowModel[];
  phase: 'standing' | 'moving' | 'standing-unknown' | 'unknown';
  speedKmh: number | null; lat: number; lon: number;
  delayMin: number | null; delayKind: 'observed' | 'estimate' | null; delayClass: DelayClass;
  distanceToNextStopM: number | null;
  distanceToCurrentStopM?:number|null;
  distanceToFollowingStopM: number | null;
  connection: Connection;
  /** Je dost dat pro automatická hlášení (jízdní řád + index)? */
  hasTimetable: boolean;
}

const hhmm = (s: string | null) => { const v = parseSod(s); return v === null ? null : fmtSod(v); };
const AT_STATION_M = 300;

export function computeOnboard(i: { train: Train; timetable: Timetable | null; stations: StationCoord[]; nowSod: number | null; tracker: DelayTracker; connection: Connection }): OnboardModel {
  const { train, timetable, stations, nowSod, tracker, connection } = i;
  const points = timetable?.points ?? [];
  const idx = train.timetableIndex !== null && Number.isInteger(train.timetableIndex) && train.timetableIndex >= 0 && train.timetableIndex < points.length ? train.timetableIndex : null;
  const clock = connection === 'live' || connection === 'demo' ? nowSod : null;
  tracker.observe(train.runId ?? train.number, idx, clock, points);
  const d = tracker.current(points, idx, clock);

  // Cílový bod pro cestující = pouze potvrzený PH od aktuálního indexu.
  const nextStopIdx = idx === null ? null : points.findIndex((p, k) => k >= idx && isPassengerStop(p));
  const nextStop = nextStopIdx !== null && nextStopIdx >= 0 ? points[nextStopIdx] : null;
  const st = nextStop ? findStation(nextStop.name, stations) : null;
  const dist = st ? haversineM(train.lat, train.lon, st.lat, st.lon) : null;

  const speed = train.speedKmh;
  let phase: OnboardModel['phase'] = 'unknown';
  let standingIdx:number|null=null,currentDistance:number|null=null;
  if(speed!==null){
    if(speed>1)phase='moving';
    else{
      // The API can advance its timetable index while the train still occupies a PH platform.
      // Consider only the immediate previous PH and next PH, and require measured proximity.
      const previous=idx===null?null:[...points].reverse().find(p=>p.index<idx&&isPassengerStop(p))??null;
      const candidates=[nextStop,previous].filter((p):p is TimetablePoint=>!!p).map(p=>{const coord=findStation(p.name,stations);return {point:p,distance:coord?haversineM(train.lat,train.lon,coord.lat,coord.lon):Infinity};}).filter(p=>p.distance<=AT_STATION_M).sort((a,b)=>a.distance-b.distance);
      const standing=candidates[0];standingIdx=standing?.point.index??null;
      if(standing)currentDistance=standing.distance;
      phase=standing?'standing':'standing-unknown';
    }
  }
  const targetIndex=standingIdx??idx;
  const delaySec = d ? d.min * 60 : null;

  const rows: RowModel[] = points.map((p, k) => {
    const arr = sched(p, 'arrival');
    return {
      index: k, name: p.name, isStop: p.isStop, passengerStop: isPassengerStop(p),
      arrival: hhmm(p.arrival), departure: hhmm(p.departure),
      estimated: idx !== null && k >= idx && arr !== null && delaySec !== null ? fmtSod(arr + delaySec) : null,
      status: targetIndex === null ? 'upcoming' : k < targetIndex ? 'passed' : k === targetIndex ? 'target' : 'upcoming',
      standing: standingIdx === k
    };
  });

  const stops = points.filter((p) => isPassengerStop(p));
  const prevStop = idx === null ? null : [...stops].reverse().find((p) => p.index < (standingIdx ?? idx)) ?? null;
  return {
    trainNumber: train.number, trainName: train.name,
    start: timetable?.startStation ?? train.startStation, end: timetable?.endStation ?? train.endStation,
    previous: prevStop?.name ?? null,
    current: standingIdx !== null ? points[standingIdx].name : null,
    next: standingIdx !== null ? (stops.find((p) => p.index > standingIdx) ?? null)?.name ?? null : nextStop?.name ?? null,
    rows, phase, speedKmh: speed, lat: train.lat, lon: train.lon,
    delayMin: d?.min ?? null, delayKind: d?.kind ?? null, delayClass: delayClass(d?.min ?? null),
    distanceToNextStopM: dist,
    distanceToCurrentStopM:currentDistance,
    distanceToFollowingStopM: (() => {
      const target = standingIdx !== null ? stops.find(p => p.index > standingIdx) : nextStop;
      const coord = target ? findStation(target.name, stations) : null;
      return coord ? haversineM(train.lat, train.lon, coord.lat, coord.lon) : null;
    })(), connection, hasTimetable: points.length > 0 && idx !== null
  };
}
