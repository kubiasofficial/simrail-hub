import type { AnnKind, Segment } from './announcements';

export interface QueueItem { key: string; kind: AnnKind; segments: Segment[]; enqueuedAt: number }
const PRIORITY: Record<AnnKind, number> = { terminal: 0, arrived: 1, approaching: 2, 'next-station': 3, delay: 4 };
const MAX_AGE_MS: Partial<Record<AnnKind, number>> = { approaching: 60_000, 'next-station': 120_000, delay: 120_000 };

/** Fronta hlášení: přehrává po jednom, vynechává duplicity a zastaralá hlášení (např. „blížíme se“ po příjezdu). */
export class AnnouncementQueue {
  private items: QueueItem[] = [];
  private seen = new Set<string>();
  private busy = false;
  private generation = 0;
  constructor(private play: (seg: Segment) => Promise<void>, private now: () => number = Date.now, private onChange?: (pending: number) => void) {}

  get pending() { return this.items.length; }
  enqueue(item: Omit<QueueItem, 'enqueuedAt'>): boolean {
    if (this.seen.has(item.key)) return false;
    this.seen.add(item.key);
    this.items.push({ ...item, enqueuedAt: this.now() });
    this.items.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.enqueuedAt - b.enqueuedAt);
    this.onChange?.(this.items.length);
    void this.drain();
    return true;
  }
  clear() { this.generation++; this.items = []; this.onChange?.(0); }
  resetHistory() { this.seen.clear(); }

  private async drain(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (this.items.length) {
        const it = this.items.shift()!;
        this.onChange?.(this.items.length);
        const max = MAX_AGE_MS[it.kind];
        if (max !== undefined && this.now() - it.enqueuedAt > max) continue;
        const generation=this.generation;
        for (const seg of it.segments) { if(generation!==this.generation)break;try { await this.play(seg); } catch { /* chyba přehrání jedné části nezastaví frontu */ } }
      }
    } finally { this.busy = false; }
  }
}
