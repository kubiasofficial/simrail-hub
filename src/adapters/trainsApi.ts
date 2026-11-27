import { ApiError, pick, unwrapList, LIVE_DATA_BASE, TIMETABLE_BASE } from './simrailApi';
import type { StationCoord, Timetable, TimetablePoint, Train } from '../types/trains';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Najde číselnou hodnotu podle začátku názvu pole (API má v názvech souřadnic překlepy, např. „Latititude“). */
function byPrefix(obj: Rec, prefix: string): number | null {
  for (const [k, v] of Object.entries(obj)) if (k.toLowerCase().startsWith(prefix)) { const n = num(v); if (n !== null) return n; }
  return null;
}
const validCoord = (lat: number | null, lon: number | null): lat is number =>
  lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

export function parseTrains(json: unknown, serverCode: string): { trains: Train[]; skipped: number } {
  const trains: Train[] = [];
  let skipped = 0;
  for (const r of unwrapList(json)) {
    const td = pick(r, 'TrainData', 'trainData');
    const d: Rec = isRec(td) ? td : {};
    const lat = byPrefix(d, 'lat');
    const lon = byPrefix(d, 'lon');
    const number = str(pick(r, 'TrainNoLocal', 'trainNoLocal'));
    if (!number || !validCoord(lat, lon) || lon === null) { skipped++; continue; }
    const type = str(pick(r, 'Type', 'type'))?.toLowerCase();
    trains.push({
      id: str(pick(r, 'id', 'Id')) ?? `${serverCode}:${number}`,
      runId: str(pick(r, 'RunId', 'runId')),
      serverCode,
      vehicles: Array.isArray(pick(r, "Vehicles")) ? (pick(r, "Vehicles") as unknown[]).filter((v): v is string => typeof v === "string") : [],
      steamId: str(pick(d, "ControlledBySteamID")),
      number,
      name: str(pick(r, 'TrainName', 'trainName')),
      type: type === 'bot' || type === 'user' ? type : null,
      startStation: str(pick(r, 'StartStation', 'startStation')),
      endStation: str(pick(r, 'EndStation', 'endStation')),
      lat, lon,
      speedKmh: num(pick(d, 'Velocity', 'velocity')),
      timetableIndex: num(pick(d, 'VDDelayedTimetableIndex', 'vdDelayedTimetableIndex')),
      signalSpeedKmh: num(pick(d, 'SignalInFrontSpeed', 'signalInFrontSpeed')),
      distanceToSignalM: num(pick(d, 'DistanceToSignalInFront', 'distanceToSignalInFront')),
      inBorderArea: typeof pick(d, 'InBorderStationArea', 'inBorderStationArea') === 'boolean' ? (pick(d, 'InBorderStationArea', 'inBorderStationArea') as boolean) : null
    });
  }
  return { trains, skipped };
}

export function parseStations(json: unknown): StationCoord[] {
  const out: StationCoord[] = [];
  for (const r of unwrapList(json)) {
    const name = str(pick(r, 'Name', 'name'));
    const lat = byPrefix(r, 'lat');
    const lon = byPrefix(r, 'lon');
    if (name && validCoord(lat, lon) && lon !== null) {
      const raw = pick(r, 'DispatchedBy');
      const dispatchers = Array.isArray(raw) ? raw.filter(isRec).map(d => ({ steamId: str(pick(d, 'SteamId')) ?? '' })).filter(d => /^\d{17}$/.test(d.steamId)) : [];
      out.push({ name, prefix: str(pick(r, 'Prefix')), lat, lon, imageUrl: str(pick(r, 'MainImageURL')), dispatchers });
    }
  }
  return out;
}

export function parseTimetables(json: unknown): Timetable[] {
  const list: Rec[] = Array.isArray(json) ? json.filter(isRec) : unwrapList(json);
  const out: Timetable[] = [];
  for (const r of list) {
    const number = str(pick(r, 'trainNoLocal', 'TrainNoLocal'));
    const raw = pick(r, 'timetable', 'Timetable');
    if (!number || !Array.isArray(raw)) continue;
    const points: TimetablePoint[] = [];
    raw.filter(isRec).forEach((p, i) => {
      const name = str(pick(p, 'nameForPerson', 'NameForPerson')) ?? str(pick(p, 'nameOfPoint', 'NameOfPoint'));
      if (!name) return;
      const stopType = str(pick(p, 'stopType', 'StopType'));
      points.push({
        index: i,
        name,
        pointId: str(pick(p, 'pointId', 'PointId')),
        arrival: str(pick(p, 'arrivalTime', 'ArrivalTime')),
        departure: str(pick(p, 'departureTime', 'DepartureTime')),
        isStop: stopType === null ? null : stopType.toLowerCase() !== 'nostopover',
        stopType,
        maxSpeed: num(pick(p, 'maxSpeed', 'MaxSpeed')),
        km: num(pick(p, 'kilometrage', 'Kilometrage', 'mileage')),
        platform: str(pick(p, 'platform', 'Platform')),
        track: str(pick(p, 'track', 'Track'))
      });
    });
    out.push({ vehicleType:str(pick(r,'locoType','LocoType'))??'', category:str(pick(raw.find(isRec)??{},'trainType','TrainType'))??'', continuesAs:str(pick(r,'continuesAs'))??'', runId: str(pick(r, 'runId', 'RunId')), trainNumber: number, startStation: str(pick(r, 'startStation', 'StartStation')), endStation: str(pick(r, 'endStation', 'EndStation')), points });
  }
  return out;
}

/** „2024-08-05 02:15:00“ nebo „02:15“ → sekundy od půlnoci; jinak null. */
export function parseSod(s: string | null): number | null {
  if (!s) return null;
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s);
  if (!m) return null;
  const h = +m[1], mi = +m[2], se = m[3] ? +m[3] : 0;
  return h < 24 && mi < 60 && se < 60 ? h * 3600 + mi * 60 + se : null;
}

/**
 * getTime encodes the simulated wall clock as an epoch value. Its UTC clock
 * fields match timetable wall times (verified against live CZ1 runs 2026-11-25).
 * Applying the computer/Warsaw timezone introduces a false +60/+120 min delay.
 */
export function serverTimeToSod(json: unknown): number | null {
  let v: unknown = json;
  if (isRec(v)) v = pick(v, 'data', 'time', 'serverTime', 'result');
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) v = Number(v);
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v > 1e11 ? v : v > 1e9 ? v * 1000 : null;
    if (ms === null) return null;
    const date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return null;
    return date.getUTCHours() * 3600 + date.getUTCMinutes() * 60 + date.getUTCSeconds();
  }
  return typeof v === 'string' ? parseSod(v) : null;
}

export const timetablesUrl = (code: string) => `${TIMETABLE_BASE}/getAllTimetables?serverCode=${encodeURIComponent(code)}`;
export const timeUrl = (code: string) => `${TIMETABLE_BASE}/getTime?serverCode=${encodeURIComponent(code)}`;
export { ApiError, LIVE_DATA_BASE };
