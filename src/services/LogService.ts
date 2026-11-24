import { appendFileSync, mkdirSync, statSync, renameSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MAX_BYTES = 1_000_000;
export type LogLevel = 'info' | 'warn' | 'error';

/** Jednoduchý souborový log s rotací (app.log → app.old.log). Nikdy nevyhazuje výjimky. */
export class LogService {
  private file: string;
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'app.log');
  }
  log(level: LogLevel, scope: string, message: string, err?: unknown): void {
    try {
      const detail = err instanceof Error ? ` | ${err.name}: ${err.message}` : err ? ` | ${String(err)}` : '';
      appendFileSync(this.file, `${new Date().toISOString()} [${level.toUpperCase()}] ${scope}: ${message}${detail}\n`);
      if (statSync(this.file).size > MAX_BYTES) renameSync(this.file, join(this.dir, 'app.old.log'));
    } catch { /* logování nesmí shodit aplikaci */ }
  }
  info(scope: string, msg: string) { this.log('info', scope, msg); }
  warn(scope: string, msg: string, e?: unknown) { this.log('warn', scope, msg, e); }
  error(scope: string, msg: string, e?: unknown) { this.log('error', scope, msg, e); }
  read(): string { return existsSync(this.file) ? readFileSync(this.file, 'utf8') : ''; }
  get path(): string { return this.file; }
}
