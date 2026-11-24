import type { FetchLike } from '../adapters/simrailApi';

/**
 * UKÁZKOVÁ DATA pro fotodokumentaci. Zapínají se výhradně přepínačem --docs-fixtures v NEBALENÉ aplikaci
 * (viz appContext.ts) a v okně je vidět výrazný štítek. Nejde o živý provoz SimRailu.
 */
const train = (id: string, no: string, type: 'bot' | 'user', lat: number, lon: number, v: number, idx: number, name: string, a: string, b: string, runId = `run-${no}`) =>
  ({ id, RunId: runId, Type: type, TrainNoLocal: no, TrainName: name, StartStation: a, EndStation: b, TrainData: { Latititute: lat, Longitute: lon, Velocity: v, VDDelayedTimetableIndex: idx, SignalInFrontSpeed: 100, DistanceToSignalInFront: 850, InBorderStationArea: false } });

const SERVERS = { result: true, count: 3, description: 'fixture', data: [
  { id: 'f1', IsActive: true, ServerCode: 'cz1', ServerName: 'CZ1 (Czech)', ServerRegion: 'Europe' },
  { id: 'f2', IsActive: true, ServerCode: 'en1', ServerName: 'EN1 (English)', ServerRegion: 'Europe' },
  { id: 'f3', IsActive: false, ServerCode: 'cz2', ServerName: 'CZ2 (Czech)', ServerRegion: 'Europe' }
] };

const TRAINS: Record<string, unknown> = {
  cz1: { result: true, data: [
    train('t1', '4421', 'user', 50.2405, 19.2214, 87, 2, 'IC Vltava', 'Katowice', 'Kraków Główny'),
    train('t2', '3150', 'bot', 50.2569, 19.0192, 0, 0, 'R Silesia', 'Katowice', 'Trzebinia'),
    train('t3', '60812', 'bot', 50.1601, 19.4651, 62, 3, 'TLK Beskid', 'Sosnowiec Główny', 'Kraków Główny'),
    train('t4', '5307', 'user', 50.0912, 19.7733, 104, 4, 'EIC Wawel', 'Katowice', 'Kraków Główny'),
    train('t5', '71234', 'bot', 50.2790, 19.1230, 0, 1, 'Cargo', 'Sosnowiec Główny', 'Kraków Główny'),
    train('t6', '2208', 'bot', 50.1980, 19.3550, 71, 2, 'R Jura', 'Katowice', 'Kraków Główny'),
    train('t7', '9051', 'user', 50.0680, 19.9475, 0, 4, 'IR Małopolska', 'Katowice', 'Kraków Główny')
  ] },
  en1: { result: true, data: [train('e1', '1100', 'bot', 50.25, 19.05, 80, 0, 'Demo EN', 'Katowice', 'Kraków Główny')] }
};

const STATIONS = { result: true, data: [
  { Name: 'Katowice', Prefix: 'KO', Latititude: 50.2569, Longitude: 19.0192, DispatchedBy: [{ SteamId: '1' }] },
  { Name: 'Sosnowiec Główny', Prefix: 'SG', Latititude: 50.279, Longitude: 19.123, DispatchedBy: [] },
  { Name: 'Trzebinia', Prefix: 'TZ', Latititude: 50.16, Longitude: 19.465, DispatchedBy: [{ SteamId: '2' }] },
  { Name: 'Kraków Główny', Prefix: 'KR', Latititude: 50.068, Longitude: 19.9475, DispatchedBy: [{ SteamId: '3' }] }
] };

const pt = (name: string, arr: string | null, dep: string | null, stop: string) => ({ nameOfPoint: name, nameForPerson: name, arrivalTime: arr && `2026-01-01 ${arr}`, departureTime: dep && `2026-01-01 ${dep}`, stopType: stop });
const TIMETABLES = [{ trainNoLocal: '4421', runId: 'run-4421', startStation: 'Katowice', endStation: 'Kraków Główny', timetable: [
  pt('Katowice', null, '12:10:00', 'CommercialStop'), pt('Sosnowiec Główny', '12:20:00', '12:22:00', 'CommercialStop'),
  pt('Jaworzno Szczakowa', '12:33:00', '12:33:00', 'NoStopOver'), pt('Trzebinia', '12:41:00', '12:42:00', 'CommercialStop'),
  pt('Kraków Główny', '13:05:00', null, 'CommercialStop')
] }];

const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body) });

export const fixtureFetch: FetchLike = async (url) => {
  const u = new URL(url);
  const code = u.searchParams.get('serverCode') ?? '';
  if (u.pathname.endsWith('/servers-open')) return ok(SERVERS);
  if (u.pathname.endsWith('/trains-open')) return ok(TRAINS[code] ?? { result: true, data: [] });
  if (u.pathname.endsWith('/stations-open')) return ok(STATIONS);
  if (u.pathname.endsWith('/getAllTimetables')) return ok(TIMETABLES);
  if (u.pathname.endsWith('/getTime')) return ok('12:39:00');
  return { ok: false, status: 404, text: async () => '{}' };
};
