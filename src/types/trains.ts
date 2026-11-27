export interface Train {
  vehicles?: string[];
  steamId?: string | null;
  avatarUrl?: string | null;
  id: string;
  runId: string | null;
  serverCode: string;
  number: string;
  name: string | null;
  type: 'bot' | 'user' | null;
  startStation: string | null;
  endStation: string | null;
  lat: number;
  lon: number;
  /** km/h; null, pokud API rychlost neposkytlo. */
  speedKmh: number | null;
  /** Index aktuálního záznamu jízdního řádu (VDDelayedTimetableIndex). */
  timetableIndex: number | null;
  signalSpeedKmh: number | null;
  distanceToSignalM: number | null;
  inBorderArea: boolean | null;
}

export interface TimetablePoint {
  index: number;
  name: string;
  pointId: string | null;
  arrival: string | null;
  departure: string | null;
  /** true = zastavuje, false = průjezd (stopType NoStopOver), null = neznámé. */
  isStop: boolean | null;
  stopType: string | null;
  /** Concrete railway line; missing/zero cannot establish the playable section. */
  line?:number|null;
  maxSpeed: number | null;
  km: number | null;
  platform: string | null;
  track: string | null;
}

export interface Timetable {
  vehicleType?:string; category?:string; continuesAs?:string;
  runId: string | null;
  trainNumber: string;
  startStation: string | null;
  endStation: string | null;
  points: TimetablePoint[];
}

export interface StationCoord { name: string; prefix: string | null; lat: number; lon: number; imageUrl?: string | null; dispatchers?: { steamId: string; avatarUrl?: string | null }[] }

export interface TrainsPayload {
  serverCode: string;
  fetchedAt: number;
  trains: Train[];
  skipped: number;
}

export interface TrainDetailPayload {
  train: Train | null;
  timetable: Timetable | null;
  stations: StationCoord[];
  /** Sekundy od půlnoci v čase jízdního řádu (nebo null, pokud čas serveru nelze určit). */
  serverSod: number | null;
  fetchedAt: number;
  notes: string[];
}

export type TrainsResult = { ok: true; data: TrainsPayload } | { ok: false; error: string };
export type TrainDetailResult = { ok: true; data: TrainDetailPayload } | { ok: false; error: string };
