import {voiceForLanguage} from '@/services/voiceCatalog';
import {SERVICE_ANNOUNCEMENTS,type ServiceAnnouncementId} from '@/services/serviceAnnouncements';
import { create } from 'zustand';
import { AnnouncementQueue } from '@/services/announcementQueue';
import { buildSegments, spokenName, type AnnKind, type Segment, type PronEntry, type TemplateOverrides } from '@/services/announcements';
import { useSettings } from './settings';

interface AnnouncerState {
  radio:(key:string,text:string,valid:()=>boolean)=>boolean;discardRadio:()=>void;reconcileRadio:()=>void;suspendPassengers:()=>void;speakRadio:()=>Promise<void>;testRadioVoice:()=>boolean;
  resetRun:()=>void;reconcile:(station:string|null,delayMin:number|null)=>void;
  pending: number; playing: boolean; nextAllowedAt:number; lastText: string | null; lastError: string | null;
  pron: PronEntry[]; templates: TemplateOverrides;
  reloadContent: () => Promise<void>;
  announce: (key: string, kind: AnnKind, params: { station?: string | null; delayMin?: number;trainNumber?:string;isFreight?:boolean;automatic?:boolean }) => boolean;
  automaticService:(key:string,ids:ServiceAnnouncementId[],valid:()=>boolean,complete:()=>void)=>boolean;
  announceService:(key:string,id:ServiceAnnouncementId,isFreight:boolean)=>boolean;
  lastSource:'recorded'|'tts'|null;
  speakText: (seg: Segment) => Promise<void>;
  speakGong: () => Promise<void>;
  stop: () => void;
}

let current: HTMLAudioElement | null = null;
let cancelCurrent:(()=>void)|null=null;
let playbackGeneration=0;
const api = () => window.simrailHub!;

async function playBytes(bytes:Uint8Array,volume=useSettings.getState().settings.announcements.volume):Promise<void> {
    let audio:HTMLAudioElement|null=null;
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }));
    await new Promise<void>((resolve, reject) => {
      const a = new Audio(url);audio=a; current = a; a.volume = volume;
      cancelCurrent=()=>{a.pause();reject(new DOMException('Přehrávání zastaveno','AbortError'));};
      a.onended = () => resolve(); a.onerror = () => reject(new Error('Přehrání zvuku selhalo.'));
      void a.play().catch(reject);
    }).finally(() => { if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();}URL.revokeObjectURL(url); if(current===audio){current = null;cancelCurrent=null;} });

}

/** Přehraje jeden segment vybraným enginem (Piper offline / systémový hlas). Chyby vyhazuje s českým popisem. */
async function playSegment(seg: Segment): Promise<void> {
  const generation=playbackGeneration;
  const { engine, voiceId, rate, recorded } = useSettings.getState().settings.announcements;
  const volume=seg.radio?useSettings.getState().settings.dispatcher.volume:useSettings.getState().settings.announcements.volume;
  if(seg.recording&&recorded){const r=await api().call('recordings:render',seg.recording,false);if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');if(!r.ok)throw Error(r.error);if(r.data){useAnnouncer.setState({lastSource:'recorded',...(seg.recording.service||seg.recording.kind==='delay'||seg.recording.kind==='terminal'?{lastText:SERVICE_ANNOUNCEMENTS[seg.recording.service??seg.recording.kind as 'delay'|'terminal'].label}:{} )});await playBytes(r.data,volume);return;}if(seg.recording.service)throw Error('Chybí místní nahrávka '+SERVICE_ANNOUNCEMENTS[seg.recording.service].file);}
  useAnnouncer.setState({lastSource:'tts'});
  if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');
  if (engine === 'piper') {
    const r = await api().call('tts:synthesize', seg.text, voiceForLanguage(seg.lang,voiceId), rate);
    if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');
    if (!r.ok) throw new Error(r.error);
    await playBytes(r.data,volume);
    return;
  }
  const lang = seg.lang === 'cs' ? 'cs-CZ' : 'pl-PL';
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)));
  if (!voice) throw new Error(`V systému není nainstalovaný hlas pro jazyk ${seg.lang === 'cs' ? 'česky' : 'polsky'}. Nainstalujte jazykový balíček Windows nebo použijte Piper.`);
  await new Promise<void>((resolve, reject) => {
    const u = new SpeechSynthesisUtterance(seg.text); u.voice = voice; u.lang = lang; u.rate = rate; u.volume = volume;
    const cancel=()=>reject(new DOMException('Přehrávání zastaveno','AbortError'));cancelCurrent=cancel;
    u.onend = () => {if(cancelCurrent===cancel)cancelCurrent=null;resolve();}; u.onerror = () => {if(cancelCurrent===cancel)cancelCurrent=null;reject(generation!==playbackGeneration?new DOMException('Přehrávání zastaveno','AbortError'):new Error('Systémový hlas selhal.'));};
    speechSynthesis.speak(u);
  });
}

async function cue(kind:'gong'|'open'|'close',generation:number){
 const s=useSettings.getState().settings;const r=kind==='gong'?await api().call('audio:gong'):await api().call('audio:radio',kind==='close');
 if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');if(!r.ok)throw Error(r.error);
 await playBytes(r.data,kind==='gong'?s.announcements.gongVolume:s.dispatcher.radioVolume);
}
async function frame(channel:'passenger'|'dispatcher'|undefined,end:boolean){
 const generation=playbackGeneration,s=useSettings.getState().settings;
 if(end){await new Promise(r=>setTimeout(r,300));if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');}
 if(channel==='dispatcher')await cue(end?'close':'open',generation);
 else if(end?s.announcements.gongEnd:s.announcements.gong)await cue('gong',generation);
}
export const useAnnouncer = create<AnnouncerState>((set, get) => {
  const queue = new AnnouncementQueue(async (seg) => {
    set({ playing: true, lastText: seg.text });
    try { await playSegment(seg); set({ lastError: null }); }
    catch (e) { if((e as Error).name!=='AbortError')set({ lastError: (e as Error).message }); throw e; }
    finally { set({ playing:false }); }
  }, Date.now, (pending) => set({ pending }),{gapMs:()=>useSettings.getState().settings.announcements.gapSeconds*1000,onCooldown:nextAllowedAt=>set({nextAllowedAt}),before:item=>frame(item.channel,false),after:item=>frame(item.channel,true)});
  return {
    suspendPassengers:()=>queue.discard(item=>item.channel!=='dispatcher'&&!!item.automatic),
    radio:(key,text,valid)=>queue.enqueue({key,kind:'delay',channel:'dispatcher',automatic:true,valid,segments:[{lang:'cs',text:spokenName(text,'cs',get().pron),radio:true}]}),
    reconcileRadio:()=>queue.discard(item=>item.channel==='dispatcher'&&!!item.valid&&!item.valid()),
    discardRadio:()=>queue.discard(item=>item.channel==='dispatcher'),
    testRadioVoice:()=>{get().stop();return queue.enqueue({key:'radio-preview:'+Date.now(),kind:'delay',channel:'dispatcher',segments:[{lang:'cs',text:'Zkouška spojení. Tady dispečer. Příjem.',radio:true}]});},
    speakRadio:async()=>{get().stop();const generation=playbackGeneration;try{await cue('open',generation);if(generation===playbackGeneration)await cue('close',generation);}catch(e){if((e as Error).name!=='AbortError')set({lastError:(e as Error).message});}},
    resetRun:()=>{get().stop();queue.resetHistory();},
    reconcile:(station,delayMin)=>queue.discard(item=>item.channel!=='dispatcher'&&!!item.automatic&&(item.service?!!item.valid&&!item.valid():item.kind==='delay'?(delayMin===null||delayMin<=0):!!item.station&&item.station!==station)),
    pending: 0, playing: false, nextAllowedAt:0, lastText: null, lastError: null, lastSource:null, pron: [], templates: {},
    reloadContent: async () => {
      const [d, m] = await Promise.all([api().call('dict:list'), api().call('mods:active')]);
      set({ pron: [...(d.ok ? d.data : []), ...(m.ok ? m.data.pronunciations : [])], templates: m.ok ? m.data.templates : {} });
    },
    announce: (key, kind, params) => {
      const { language } = useSettings.getState().settings.announcements;
      const segments = buildSegments(kind, params, language, get().pron, get().templates);
      if(params.isFreight)return false;
      if(segments[0])segments[0].intro=true;
      for(const segment of segments)if(segment.lang==='cs')segment.recording={kind,station:params.station??null,trainNumber:params.trainNumber??null,isFreight:false};
      if(!params.automatic)get().stop();
      return queue.enqueue({ key, kind, segments,automatic:!!params.automatic,station:params.station });
    },
    automaticService:(key,ids,valid,complete)=>{
      if(!useSettings.getState().settings.announcements.recorded||!valid())return false;
      return queue.enqueue({key,kind:'delay',channel:'passenger',automatic:true,service:true,valid,onComplete:complete,segments:ids.map(id=>({lang:'cs',text:SERVICE_ANNOUNCEMENTS[id].label,recording:{kind:'delay',station:null,trainNumber:null,isFreight:false,service:id}}))});
    },
    announceService:(key,id,isFreight)=>{
      if(isFreight||!useSettings.getState().settings.announcements.recorded)return false;
      const entry=SERVICE_ANNOUNCEMENTS[id];if(!entry)return false;
      get().stop();
      return queue.enqueue({key,kind:'delay',segments:[{lang:'cs',text:entry.label,intro:true,recording:{kind:'delay',station:null,trainNumber:null,isFreight:false,service:id}}]});
    },
    speakText: async (seg) => { get().stop();set({ lastText: seg.text }); try {const generation=playbackGeneration;await frame(undefined,false);if(generation===playbackGeneration){await playSegment(seg);if(generation===playbackGeneration)await frame(undefined,true);}set({ lastError: null }); } catch (e) { if((e as Error).name!=='AbortError')set({ lastError: (e as Error).message }); } },
    speakGong: async()=>{get().stop();const generation=playbackGeneration;try{const r=await api().call('audio:gong');if(generation!==playbackGeneration)throw new DOMException('Přehrávání zastaveno','AbortError');if(!r.ok)throw Error(r.error);await playBytes(r.data,useSettings.getState().settings.announcements.gongVolume);set({lastError:null});}catch(e){if((e as Error).name!=='AbortError')set({lastError:(e as Error).message});}},
    stop: () => { playbackGeneration++;queue.clear();cancelCurrent?.();current?.pause();speechSynthesis.cancel();set({playing:false}); }
  };
});
