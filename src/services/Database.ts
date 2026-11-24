import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Tenká obálka nad vestavěným SQLite (node:sqlite) – žádná nativní závislost. */
export class Database {
  readonly db: DatabaseSync;
  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS pronunciations (word TEXT PRIMARY KEY, spoken TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tts_cache (hash TEXT PRIMARY KEY, file TEXT NOT NULL, bytes INTEGER NOT NULL, created INTEGER NOT NULL);
    `);
  }
  getKv(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }
  setKv(key: string, value: string): void {
    this.db.prepare('INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }
  close(): void { this.db.close(); }
}
