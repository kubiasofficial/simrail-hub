import {buildShift} from './shiftPlanner';
import {withStationFallbacks} from './stationFallbacks';
import { isPassengerStop } from './passengerStops';
import { ApiError, fetchJson, stationsUrl, trainsUrl, type FetchLike } from '../adapters/simrailApi';
import { parseStations, parseTimetables, parseTrains, serverTimeToSod, timeUrl, timetablesUrl } from '../adapters/trainsApi';
import type { StationCoord, Timetable, TrainDetailResult, TrainsResult, TrainsPayload } from '../types/trains';

import { SteamProfiles } from './SteamProfiles';

interface Cached<T> { at: number; value: T }

/** Načítání poloh vlaků, stanic, jízdních řádů a času serveru s mezipamětí, aby se API nezahlcovalo. */
export class TrainTrackingService {
  private trains = new Map<string, Cached<TrainsPayload>>();
  private stations = new Map<string, Cached<StationCoord[]>>();
  private timetables = new Map<string, Cached<Timetable[]>>();
  private profiles: SteamProfiles;
  private stationPending=new Map<string,Promise<{data:StationCoord[];notes:string[]}>>();
  private timetablePending=new Map<string,Promise<{data:Timetable[]|null;notes:string[]}>>();
  private pendingTrains=new Map<string,Promise<TrainsResult>>();
  constructor(private fetchFn: FetchLike, private now: () => number = Date.now) { this.profiles = new SteamProfiles(fetchFn); }

  private fresh<T>(c: Cached<T> | undefined, ttl: number): T | null { return c && this.now() - c.at < ttl ? c.value : null; }

  async getTrains(code:string,force=false):Promise<TrainsResult>{
    const pending=this.pendingTrains.get(code);if(pending)return pending;
    const work=this.loadTrains(code,force).finally(()=>this.pendingTrains.delete(code));
    this.pendingTrains.set(code,work);return work;
  }
  private async loadTrains(code: string, force = false): Promise<TrainsResult> {
    for(const cache of [this.trains,this.stations])while(cache.size>32)cache.delete(cache.keys().next().value!);
    while(this.timetables.size>3)this.timetables.delete(this.timetables.keys().next().value!);
    const hit = this.fresh(this.trains.get(code), force ? 1_500 : 3_000);
    if (hit) return { ok: true, data: hit };
    try {
      const { trains, skipped } = parseTrains(await fetchJson(this.fetchFn, trainsUrl(code)), code);
      await Promise.all(trains.map(async t => { if (t.steamId) t.avatarUrl = await this.profiles.avatar(t.steamId); }));
      const data: TrainsPayload = { serverCode: code, fetchedAt: this.now(), trains, skipped };
      this.trains.set(code, { at: this.now(), value: data });
      return { ok: true, data };
    } catch (e) { return { ok: false, error: `Polohy vlaků se nepodařilo načíst: ${(e as Error).message}` }; }
  }

  async getStations(code:string,notes:string[]=[]):Promise<StationCoord[]>{
    let pending=this.stationPending.get(code);
    if(!pending){const warnings:string[]=[];pending=this.loadStations(code,warnings).then(data=>({data,notes:warnings})).finally(()=>this.stationPending.delete(code));this.stationPending.set(code,pending);}
    const result=await pending;notes.push(...result.notes);return result.data;
  }
  private async loadStations(code: string, notes: string[] = []): Promise<StationCoord[]> {
    for(const cache of [this.trains,this.stations])while(cache.size>32)cache.delete(cache.keys().next().value!);
    while(this.timetables.size>3)this.timetables.delete(this.timetables.keys().next().value!);
    const hit = this.fresh(this.stations.get(code), 30_000);
    if (hit) return hit;
    try { const v = withStationFallbacks(parseStations(await fetchJson(this.fetchFn, stationsUrl(code)))); await Promise.all(v.flatMap(s => (s.dispatchers ?? []).map(async d => { d.avatarUrl = await this.profiles.avatar(d.steamId); }))); this.stations.set(code, { at: this.now(), value: v }); return v; }
    catch (e) { notes.push(`Souřadnice stanic nejsou dostupné: ${(e as Error).message}`); return withStationFallbacks(this.stations.get(code)?.value ?? []); }
  }

  async getStationBoard(code: string, name: string) {
    const notes: string[] = [];
    const schedules = await this.getTimetables(code, notes);
    if (!schedules) throw new Error(notes.join(' ') || 'Jízdní řády nejsou dostupné.');
    const norm = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLowerCase().trim();
    let now = 0;
    try { now = serverTimeToSod(await fetchJson(this.fetchFn,timeUrl(code))) ?? 0; } catch { /* planned board remains available */ }
    const clock = (s:string|null) => { const match = /(?:^|[ T])(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s ?? ''); return match ? +match[1]*3600 + +match[2]*60 + +(match[3]??0) : 0; };
    return schedules.flatMap(t => t.points.filter(p => norm(p.name) === norm(name) && isPassengerStop(p)).map(p => ({ number:t.trainNumber,arrival:p.arrival,departure:p.departure,destination:t.endStation })))
      .sort((a,b) => ((clock(a.departure??a.arrival)-now+86400)%86400)-((clock(b.departure??b.arrival)-now+86400)%86400)).slice(0,12);
  }
  private async getTimetables(code:string,notes:string[]):Promise<Timetable[]|null>{
    let pending=this.timetablePending.get(code);
    if(!pending){const warnings:string[]=[];pending=this.loadTimetables(code,warnings).then(data=>({data,notes:warnings})).finally(()=>this.timetablePending.delete(code));this.timetablePending.set(code,pending);}
    const result=await pending;notes.push(...result.notes);return result.data;
  }
  private async loadTimetables(code: string, notes: string[]): Promise<Timetable[] | null> {
    for(const cache of [this.trains,this.stations])while(cache.size>32)cache.delete(cache.keys().next().value!);
    while(this.timetables.size>3)this.timetables.delete(this.timetables.keys().next().value!);
    const hit = this.fresh(this.timetables.get(code), 300_000);
    if (hit) return hit;
    try { const v = parseTimetables(await fetchJson(this.fetchFn, timetablesUrl(code), 20_000)); this.timetables.set(code, { at: this.now(), value: v }); return v; }
    catch (e) { notes.push(`Jízdní řády nejsou dostupné: ${(e as Error).message}`); return this.timetables.get(code)?.value ?? null; }
  }

  async planShift(code:string,request:import('../types/shift').ShiftRequest){
    const notes:string[]=[];
    const [schedules,stations,trains,clock]=await Promise.all([this.getTimetables(code,notes),this.getStations(code,notes),this.getTrains(code),fetchJson(this.fetchFn,timeUrl(code))]);
    const sod=serverTimeToSod(clock);
    if(!schedules||!trains.ok||sod===null||notes.length)throw Error(notes.join(' ')||'Pro směnu chybí aktuální jízdní řád, stanice nebo čas serveru.');
    return buildShift(code,request,schedules,stations,trains.data.trains,sod,this.now());
  }
  async getDetail(code: string, trainNumber: string): Promise<TrainDetailResult> {
    const tr = await this.getTrains(code);
    if (!tr.ok) return tr;
    const train = tr.data.trains.find((t) => t.number === trainNumber) ?? null;
    const notes: string[] = [];
    if (!train) notes.push(`Vlak ${trainNumber} není na serveru ${code} právě k dispozici.`);
    const [stations, tts] = await Promise.all([this.getStations(code, notes), this.getTimetables(code, notes)]);
    const timetable = (train?.runId ? tts?.find(t => t.runId === train.runId) : tts?.find(t => t.trainNumber === trainNumber)) ?? null;
    if (tts && !timetable) notes.push(`Pro vlak ${trainNumber} nebyl nalezen jízdní řád.`);
    let serverSod: number | null = null;
    try { serverSod = serverTimeToSod(await fetchJson(this.fetchFn, timeUrl(code))); if (serverSod === null) notes.push('Čas serveru se nepodařilo zpracovat – zpoždění nelze určit.'); }
    catch (e) { notes.push(`Čas serveru není dostupný: ${e instanceof ApiError ? e.message : (e as Error).message}`); }
    return { ok: true, data: { train, timetable, stations, serverSod, fetchedAt: tr.data.fetchedAt, notes } };
  }
}
