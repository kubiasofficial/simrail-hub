import { create } from 'zustand';
import { DemoSim } from '@/services/demoSim';

interface DemoState {
  sim: DemoSim;
  t: number;
  running: boolean;
  speed: number;
  initialDelayMin: number;
  tick: (dtSec: number) => void;
  setRunning: (r: boolean) => void;
  setSpeed: (s: number) => void;
  restart: (delayMin?: number) => void;
  addDelay: (min: number) => void;
  jumpToNextStop: () => void;
}

// Parametry v adrese (jen pro fotodokumentaci / odkazy): t=<sekundy>, pause=1, delay=<minuty>
const q = new URLSearchParams(location.hash.replace(/^#/, '').replace(/^[^&?]*[?]/, ''));
const num = (k: string, d: number) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? v : d; };
const startDelay = Math.max(0, Math.min(60, num('delay', 0)));

export const useDemo = create<DemoState>((set, get) => ({
  sim: new DemoSim(startDelay), t: Math.max(0, num('t', 0)), running: q.get('pause') !== '1', speed: 10, initialDelayMin: startDelay,
  tick: (dt) => { const { running, speed, t } = get(); if (running) set({ t: t + dt * speed }); },
  setRunning: (running) => set({ running }),
  setSpeed: (speed) => set({ speed }),
  restart: (delayMin) => { const d = delayMin ?? get().initialDelayMin; set({ sim: new DemoSim(d), t: 0, initialDelayMin: d }); },
  addDelay: (min) => { const { sim } = get(); sim.lateSec += min * 60; set({}); },
  jumpToNextStop: () => { const { sim, t } = get(); set({ t: sim.jumpBeforeNextStop(t) }); }
}));
