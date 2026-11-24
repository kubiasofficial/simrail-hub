import { useEffect, useMemo, useRef, useState } from 'react';
import { computeOnboard, DelayTracker, type Connection, type OnboardModel } from '@/services/onboard';
import type { TrainDetailPayload } from '@/types/trains';
import { useDemo } from '@/stores/demo';

export interface FeedSource { mode: 'live' | 'demo'; server: string | null; train: string | null }
export interface Feed { model: OnboardModel | null; notes: string[]; error: string | null; detail: TrainDetailPayload | null; updatedAt: number | null }

const LIVE_POLL_MS = 5000;

/** Zdroj dat palubního počítače: živá data z API (polling) nebo demo simulace. Demo a živá data se nikdy nemíchají. */
export function useTrainFeed(src: FeedSource): Feed {
  const tracker = useRef(new DelayTracker());
  const demo = useDemo();
  const [detail, setDetail] = useState<TrainDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { tracker.current = new DelayTracker(); setDetail(null); setError(null); setLastOk(null); }, [src.mode, src.server, src.train]);

  useEffect(() => {
    if (src.mode !== 'live' || !src.server || !src.train) return;
    let alive = true, busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await window.simrailHub!.call('trains:detail', src.server!, src.train!);
        if (!alive) return;
        if (r.ok) { setDetail(r.data); setError(null); setLastOk(Date.now()); } else setError(r.error);
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { busy = false; }
    };
    void run(); const id = setInterval(run, LIVE_POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [src.mode, src.server, src.train]);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (src.mode !== 'demo') return;
    const id = setInterval(() => useDemo.getState().tick(0.25), 250);
    return () => clearInterval(id);
  }, [src.mode]);

  return useMemo<Feed>(() => {
    if (src.mode === 'demo') {
      const s = demo.sim.snapshot(demo.t);
      const model = computeOnboard({ train: s.train, timetable: s.timetable, stations: s.stations, nowSod: s.nowSod, tracker: tracker.current, connection: 'demo' });
      return { model, notes: ['DEMO – simulovaná data, nejde o skutečný vlak.'], error: null, detail: { train: s.train, timetable: s.timetable, stations: s.stations, serverSod: s.nowSod, fetchedAt: Date.now(), notes: [] }, updatedAt: Date.now() };
    }
    if (!detail?.train) return { model: null, notes: detail?.notes ?? [], error, detail, updatedAt: lastOk };
    const age = lastOk ? now - lastOk : Infinity;
    const connection: Connection = age >= 30_000 ? 'lost' : error || age >= 15_000 ? 'stale' : 'live';
    const model = computeOnboard({ train: detail.train, timetable: detail.timetable, stations: detail.stations, nowSod: detail.serverSod, tracker: tracker.current, connection });
    return { model, notes: detail.notes, error, detail, updatedAt: lastOk };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src.mode, demo.t, demo.sim, detail, error, lastOk, Math.floor(now / 5000)]);
}
