import { haversineM } from './geo';
import type { StationCoord, Timetable, TimetablePoint, Train } from '../types/trains';

/** DEMO trasa: vymyšlený jízdní řád, přibližné souřadnice měst. Nejde o skutečná data SimRailu. */
interface DemoPoint { name: string; lat: number; lon: number; stop: boolean }
export const DEMO_ROUTE: DemoPoint[] = [
  { name: 'Katowice', lat: 50.2569, lon: 19.0192, stop: true },
  { name: 'Sosnowiec Główny', lat: 50.279, lon: 19.123, stop: true },
  { name: 'Jaworzno Szczakowa', lat: 50.228, lon: 19.31, stop: false },
  { name: 'Trzebinia', lat: 50.16, lon: 19.465, stop: true },
  { name: 'Kraków Główny', lat: 50.068, lon: 19.9475, stop: true }
];
export const DEMO_BASE_SOD = 12 * 3600;
const DWELL = 45, ACC = 0.5, DEC = 0.7, VMAX = 100 / 3.6;

interface Leg { fromIdx: number; toIdx: number; dist: number; T: number; vpk: number; da: number; ta: number; tc: number; cum: number[] }

function profile(D: number) {
  let v = VMAX;
  if (v * v / (2 * ACC) + v * v / (2 * DEC) > D) v = Math.sqrt((2 * D) / (1 / ACC + 1 / DEC));
  const da = v * v / (2 * ACC), db = v * v / (2 * DEC), ta = v / ACC, tb = v / DEC, tc = (D - da - db) / v;
  return { v, da, ta, tc, T: ta + tc + tb };
}
const pad = (n: number) => String(n).padStart(2, '0');
const sodStr = (s: number) => `2026-01-01 ${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;

export interface DemoSnapshot { train: Train; timetable: Timetable; stations: StationCoord[]; nowSod: number; finished: boolean }

export class DemoSim {
  private legs: Leg[] = [];
  private depart: number[] = [];
  private arrive: number[] = [];
  private stopIdx: number[];
  readonly timetable: Timetable;
  readonly stations: StationCoord[];
  /** Přidané zpoždění v sekundách (vlak „stojí“ a nabírá zpoždění). */
  lateSec = 0;

  constructor(initialDelayMin = 0) {
    this.lateSec = initialDelayMin * 60;
    this.stopIdx = DEMO_ROUTE.map((p, i) => (p.stop ? i : -1)).filter((i) => i >= 0);
    let t = DWELL;
    this.depart[this.stopIdx[0]] = t;
    for (let k = 0; k < this.stopIdx.length - 1; k++) {
      const a = this.stopIdx[k], b = this.stopIdx[k + 1];
      const cum = [0];
      for (let i = a; i < b; i++) cum.push(cum[cum.length - 1] + haversineM(DEMO_ROUTE[i].lat, DEMO_ROUTE[i].lon, DEMO_ROUTE[i + 1].lat, DEMO_ROUTE[i + 1].lon));
      const dist = cum[cum.length - 1], p = profile(dist);
      this.legs.push({ fromIdx: a, toIdx: b, dist, T: p.T, vpk: p.v, da: p.da, ta: p.ta, tc: p.tc, cum });
      const arr = t + p.T;
      this.arrive[b] = arr;
      // průjezdní body: čas průjezdu ze stejného profilu
      for (let i = a + 1; i < b; i++) this.arrive[i] = t + this.timeAt(this.legs[k], cum[i - a]);
      t = arr + DWELL;
      this.depart[b] = t;
    }
    const points: TimetablePoint[] = DEMO_ROUTE.map((p, i) => ({
      index: i, name: p.name, pointId: `demo-${i}`, isStop: p.stop, stopType: p.stop ? 'CommercialStop' : 'NoStopOver', maxSpeed: 100, km: null, platform: null, track: null,
      arrival: i === 0 ? null : sodStr(DEMO_BASE_SOD + this.arrive[i]),
      departure: i === DEMO_ROUTE.length - 1 ? null : sodStr(DEMO_BASE_SOD + (p.stop ? this.depart[i] : this.arrive[i]))
    }));
    this.timetable = { runId: 'demo-run', trainNumber: 'DEMO 1', startStation: DEMO_ROUTE[0].name, endStation: DEMO_ROUTE.at(-1)!.name, points };
    this.stations = DEMO_ROUTE.map((p) => ({ name: p.name, prefix: null, lat: p.lat, lon: p.lon }));
  }

  /** Doba jízdy po ujeté vzdálenosti s v rámci úseku (inverze profilu). */
  private timeAt(leg: Leg, s: number): number {
    const { vpk, da, ta, tc, dist } = leg;
    if (s <= da) return Math.sqrt((2 * s) / ACC);
    if (s <= dist - (vpk * vpk) / (2 * DEC)) return ta + (s - da) / vpk;
    const rem = dist - s;
    return leg.T - Math.sqrt((2 * rem) / DEC) + 0 * tc;
  }
  private distAt(leg: Leg, t: number): { s: number; v: number } {
    const { vpk, da, ta, tc, dist } = leg;
    if (t <= 0) return { s: 0, v: 0 };
    if (t >= leg.T) return { s: dist, v: 0 };
    if (t <= ta) return { s: 0.5 * ACC * t * t, v: ACC * t };
    if (t <= ta + tc) return { s: da + vpk * (t - ta), v: vpk };
    const r = leg.T - t;
    return { s: dist - 0.5 * DEC * r * r, v: DEC * r };
  }

  /** Stav vlaku v čase t (sekundy od startu simulace; hodiny jedou i během zpoždění). */
  snapshot(t: number): DemoSnapshot {
    const tt = t - this.lateSec;
    let lat = DEMO_ROUTE[0].lat, lon = DEMO_ROUTE[0].lon, v = 0, index = 0, finished = false;
    const last = DEMO_ROUTE.length - 1;
    if (tt >= this.arrive[last]) { lat = DEMO_ROUTE[last].lat; lon = DEMO_ROUTE[last].lon; index = last; finished = true; }
    else {
      for (const leg of this.legs) {
        const dep = this.depart[leg.fromIdx];
        if (tt < dep) { const p = DEMO_ROUTE[leg.fromIdx]; lat = p.lat; lon = p.lon; index = leg.fromIdx; break; }
        if (tt < dep + leg.T) {
          const { s, v: vv } = this.distAt(leg, tt - dep);
          v = vv;
          let k = 0; while (k < leg.cum.length - 2 && s > leg.cum[k + 1]) k++;
          const f = (s - leg.cum[k]) / Math.max(1, leg.cum[k + 1] - leg.cum[k]);
          const A = DEMO_ROUTE[leg.fromIdx + k], B = DEMO_ROUTE[leg.fromIdx + k + 1];
          lat = A.lat + (B.lat - A.lat) * f; lon = A.lon + (B.lon - A.lon) * f;
          index = leg.fromIdx + k + 1;
          break;
        }
        const p = DEMO_ROUTE[leg.toIdx]; lat = p.lat; lon = p.lon; index = leg.toIdx; // dojezd, čeká v dwell
      }
    }
    const train: Train = {
      id: 'demo', runId: 'demo-run', serverCode: 'demo', number: 'DEMO 1', name: 'Demonstrační vlak', type: 'bot',
      startStation: DEMO_ROUTE[0].name, endStation: DEMO_ROUTE[last].name, lat, lon,
      speedKmh: Math.round(v * 3.6), timetableIndex: index, signalSpeedKmh: null, distanceToSignalM: null, inBorderArea: null
    };
    return { train, timetable: this.timetable, stations: this.stations, nowSod: (DEMO_BASE_SOD + t) % 86400, finished };
  }

  /** Posune čas těsně před další zastávku (testování zastávek). Vrací nové t. */
  jumpBeforeNextStop(t: number): number {
    const tt = t - this.lateSec;
    for (const leg of this.legs) {
      const arr = this.depart[leg.fromIdx] + leg.T;
      if (tt < arr - 20) return arr - 20 + this.lateSec;
    }
    return t;
  }
}
