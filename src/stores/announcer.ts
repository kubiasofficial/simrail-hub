import { create } from 'zustand';
import { AnnouncementQueue } from '@/services/announcementQueue';
import { buildSegments, type AnnKind, type Segment, type PronEntry, type TemplateOverrides } from '@/services/announcements';
import { useSettings } from './settings';

interface AnnouncerState {
  pending: number; playing: boolean; lastText: string | null; lastError: string | null;
  pron: PronEntry[]; templates: TemplateOverrides;
  reloadContent: () => Promise<void>;
  announce: (key: string, kind: AnnKind, params: { station?: string | null; delayMin?: number }) => boolean;
  speakText: (seg: Segment) => Promise<void>;
  stop: () => void;
}

let current: HTMLAudioElement | null = null;
let cancelCurrent:(()=>void)|null=null;
let playbackGeneration=0;
const api = () => window.simrailHub!;

/** Přehraje jeden segment vybraným enginem (Piper offline / systémový hlas). Chyby vyhazuje s českým popisem. */
async function playSegment(seg: Segment): Promise<void> {
  const generation=playbackGeneration;
  const { engine, voiceId, rate, volume } = useSettings.getState().settings.announcements;
  if (engine === 'piper') {
    const r = await api().call('tts:synthesize', seg.text, voiceId, rate);
    if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');
    if (!r.ok) throw new Error(r.error);
    const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'audio/wav' }));
    await new Promise<void>((resolve, reject) => {
      const a = new Audio(url); current = a; a.volume = volume;
      cancelCurrent=()=>{a.pause();reject(new DOMException('Přehrávání zastaveno','AbortError'));};
      a.onended = () => resolve(); a.onerror = () => reject(new Error('Přehrání zvuku selhalo.'));
      void a.play().catch(reject);
    }).finally(() => { URL.revokeObjectURL(url); current = null;cancelCurrent=null; });
    return;
  }
  const lang = seg.lang === 'cs' ? 'cs-CZ' : 'pl-PL';
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)));
  if (!voice) throw new Error(`V systému není nainstalovaný hlas pro jazyk ${seg.lang === 'cs' ? 'česky' : 'polsky'}. Nainstalujte jazykový balíček Windows nebo použijte Piper.`);
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(seg.text); u.voice = voice; u.lang = lang; u.rate = rate; u.volume = volume;
    u.onend = () => resolve(); u.onerror = () => reject(new Error('Systémový hlas selhal.'));
    speechSynthesis.speak(u);
  });
}

export const useAnnouncer = create<AnnouncerState>((set, get) => {
  const queue = new AnnouncementQueue(async (seg) => {
    set({ playing: true, lastText: seg.text });
    try { await playSegment(seg); set({ lastError: null }); }
    catch (e) { if((e as Error).name!=='AbortError')set({ lastError: (e as Error).message }); throw e; }
    finally { set({ playing: queue.pending > 0 }); }
  }, Date.now, (pending) => set({ pending }));
  return {
    pending: 0, playing: false, lastText: null, lastError: null, pron: [], templates: {},
    reloadContent: async () => {
      const [d, m] = await Promise.all([api().call('dict:list'), api().call('mods:active')]);
      set({ pron: [...(d.ok ? d.data : []), ...(m.ok ? m.data.pronunciations : [])], templates: m.ok ? m.data.templates : {} });
    },
    announce: (key, kind, params) => {
      const { language } = useSettings.getState().settings.announcements;
      const segments = buildSegments(kind, params, language, get().pron, get().templates);
      return queue.enqueue({ key, kind, segments });
    },
    speakText: async (seg) => { set({ lastText: seg.text }); try { await playSegment(seg); set({ lastError: null }); } catch (e) { set({ lastError: (e as Error).message }); } },
    stop: () => { playbackGeneration++;queue.clear();cancelCurrent?.();current?.pause();speechSynthesis.cancel();set({playing:false}); }
  };
});
