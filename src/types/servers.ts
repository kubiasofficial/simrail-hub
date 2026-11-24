export interface ServerInfo {
  id: string;
  code: string;
  name: string;
  region: string | null;
  /** Jazyk jen pokud je uveden v názvu serveru, např. „EN1 (English)“; jinak null. */
  language: string | null;
  active: boolean;
}

export interface ServerStats {
  trainsTotal: number;
  trainsUser: number;
  trainsBot: number;
  /** Počet obsazených dispečerských stanic (z DispatchedBy). */
  dispatchers: number;
}

export interface ServerRow extends ServerInfo {
  stats: ServerStats | null;
  /** Důvod, proč statistiky chybí (výpadek API, neplatná odpověď…). */
  statsError: string | null;
}

export interface ServersSnapshot {
  fetchedAt: number;
  servers: ServerRow[];
  source: string;
}

export type ServersResult = { ok: true; snapshot: ServersSnapshot } | { ok: false; error: string };
