import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Mic, X } from 'lucide-react';
import { useSettings } from '@/stores/settings';
import type { TtsProgressDto, TtsStatusDto } from '@/types/ipc';

/** Průvodce prvním spuštěním: jedním kliknutím stáhne Piper a český hlas (potřebuje internet). */
export function Onboarding() {
  const dismissed = useSettings((s) => s.settings.onboarding.dismissed);
  const voiceId = useSettings((s) => s.settings.announcements.voiceId);
  const engine = useSettings((s) => s.settings.announcements.engine);
  const update = useSettings((s) => s.update);
  const [st, setSt] = useState<TtsStatusDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<TtsProgressDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const api = window.simrailHub!;

  const reload = async () => { const r = await api.call('tts:status'); if (r.ok) setSt(r.data); };
  useEffect(() => { void reload(); return api.onTtsProgress(setProgress); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const voice = st?.voices.find((v) => v.id === voiceId);
  const ready = !!st?.piperInstalled && !!voice?.installed;
  if (dismissed || !st || !st.supported || engine !== 'piper') return null;
  if (ready) return null;

  const run = async () => {
    setBusy(true); setError(null);
    try {
      if (!st.piperInstalled) { const r = await api.call('tts:install-piper'); if (!r.ok) throw new Error(r.error); }
      const r2 = await api.call('tts:install-voice', voiceId); if (!r2.ok) throw new Error(r2.error);
      await reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); setProgress(null); }
  };

  return (
    <section className="panel relative rounded-2xl border-sky-brand/30 p-5">
      <button aria-label="Odložit" onClick={() => void update({ onboarding: { dismissed: true } })} className="absolute right-3 top-3 rounded p-1 text-slate-500 hover:bg-white/10"><X size={15} /></button>
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-brand/15 text-sky-soft"><Mic size={20} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-white">Dokončete nastavení českých hlášení</div>
          <p className="mt-1 text-sm text-slate-400">Stáhne se hlasový systém Piper (~22 MB) a český hlas (~63 MB). Jednorázově, potom hlášení fungují offline a zdarma.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={() => void run()} disabled={busy} className="flex items-center gap-2 rounded-xl bg-sky-brand px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-sky-soft disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} {busy ? 'Stahuji…' : 'Nastavit automaticky'}
            </button>
            {busy && progress && <span className="text-xs text-sky-soft">{progress.task}{progress.fraction !== null ? ` ${Math.round(progress.fraction * 100)} %` : ''}</span>}
          </div>
          {error && <div role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">{error} Zkuste to znovu, nebo použijte systémový hlas v Nastavení.</div>}
        </div>
      </div>
    </section>
  );
}
