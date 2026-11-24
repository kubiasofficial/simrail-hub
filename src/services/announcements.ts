import { czechMinutes, polishMinutes } from './czech';
import { normName } from './onboard';
import type { AnnouncementLang } from '../types/settings';
import type { TimetablePoint } from '../types/trains';

export type AnnKind = 'next-station' | 'approaching' | 'arrived' | 'terminal' | 'delay';
export interface Segment { lang: 'cs' | 'pl'; text: string; intro?:boolean; recording?:{kind:AnnKind;station:string|null;trainNumber:string|null;isFreight:boolean} }
export interface AnnouncementEvent { key: string; kind: AnnKind; station: string | null; delayMin?: number }
export interface PronEntry { word: string; spoken: string }

/** České exonyma a slova ve jménech stanic (klíče bez diakritiky, malými písmeny). */
const CS_WORDS: Record<string, string> = {
  katowice: 'Katovice', krakow: 'Krakov', warszawa: 'Varšava', wroclaw: 'Vratislav', czestochowa: 'Čenstochová',
  lodz: 'Lodž', poznan: 'Poznaň', gdansk: 'Gdaňsk', glowny: 'hlavní', glowna: 'hlavní', zachodni: 'západní', wschodni: 'východní', centralna: 'centrální'
};

export function spokenName(name: string, lang: 'cs' | 'pl', dict: PronEntry[] = []): string {
  const full = dict.find((e) => normName(e.word) === normName(name));
  if (full) return full.spoken;
  return name.split(/\s+/).map((w) => {
    const d = dict.find((e) => normName(e.word) === normName(w));
    if (d) return d.spoken;
    return lang === 'cs' ? (CS_WORDS[normName(w)] ?? w) : w;
  }).join(' ');
}

interface Params { station?: string | null; delayMin?: number }

const T = {
  cs: {
    'next-station': (p: Params) => `Vážení cestující, příští stanice ${p.station}.`,
    approaching: (p: Params) => `Vážení cestující, za okamžik přijedeme do stanice ${p.station}.`,
    arrived: (p: Params) => `Přijeli jsme do stanice ${p.station}.`,
    terminal: () => 'Vážení cestující, přijíždíme do konečné stanice. Prosíme, nezapomeňte si svá osobní zavazadla.',
    delay: (p: Params) => `Vážení cestující, náš vlak je aktuálně opožděn přibližně o ${czechMinutes(p.delayMin ?? 0)}.`
  },
  pl: {
    'next-station': (p: Params) => `Szanowni Państwo, następna stacja ${p.station}.`,
    approaching: (p: Params) => `Szanowni Państwo, za chwilę dojedziemy do stacji ${p.station}.`,
    arrived: (p: Params) => `Dojechaliśmy do stacji ${p.station}.`,
    terminal: () => 'Szanowni Państwo, wjeżdżamy na stację końcową. Prosimy o zabranie swoich bagaży osobistych.',
    delay: (p: Params) => `Szanowni Państwo, nasz pociąg jest opóźniony o około ${polishMinutes(p.delayMin ?? 0)}.`
  }
} as const;

export type TemplateOverrides = Partial<Record<'cs' | 'pl', Partial<Record<AnnKind, string>>>>;

/** Sestaví text hlášení; šablony z modů (přepsání) používají zástupné znaky {station} a {minutes}. */
export function buildSegments(kind: AnnKind, p: Params, language: AnnouncementLang, dict: PronEntry[] = [], overrides: TemplateOverrides = {}): Segment[] {
  const langs: ('cs' | 'pl')[] = language === 'cs-pl' ? ['cs', 'pl'] : [language];
  return langs.map((lang) => {
    const station = p.station ? spokenName(p.station, lang, dict) : '';
    const o = overrides[lang]?.[kind];
    const text = o
      ? o.replaceAll('{station}', station).replaceAll('{minutes}', p.delayMin ? (lang === 'cs' ? czechMinutes(p.delayMin) : polishMinutes(p.delayMin)) : '')
      : T[lang][kind]({ station, delayMin: p.delayMin });
    return { lang, text };
  });
}

export interface TriggerInput {
  isFreight?: boolean;
  runKey: string;
  index: number | null;
  speedKmh: number | null;
  /** Vzdálenost k následující zastávce v metrech (null = souřadnice stanice nejsou k dispozici). */
  distToNextStopM: number | null;
  points: TimetablePoint[];
  delayMin: number | null;
}
export interface TriggerConfig { approachM: number; arrivedM: number; movingKmh: number; stoppedKmh: number; delayStepMin: number }
export const DEFAULT_TRIGGER: TriggerConfig = { approachM: 2000, arrivedM: 300, movingKmh: 5, stoppedKmh: 2, delayStepMin: 5 };

/** Stavový automat automatických hlášení: každou událost pro daný jízdní běh vyvolá nejvýše jednou. */
export class AnnouncementTrigger {
  private fired = new Set<string>();
  private run: string | null = null;
  constructor(private cfg: TriggerConfig = DEFAULT_TRIGGER) {}

  reset() { this.fired.clear(); this.run = null; }

  update(inp: TriggerInput): { events: AnnouncementEvent[]; disabled: string[] } {
    if (inp.runKey !== this.run) { this.fired.clear(); this.run = inp.runKey; }
    if (inp.isFreight) return {events:[],disabled:[]};
    const disabled: string[] = [];
    if (!inp.points.length) return { events: [], disabled: ['Chybí jízdní řád vlaku – automatická hlášení jsou vypnutá, použijte ruční režim.'] };
    if (inp.index === null) return { events: [], disabled: ['API neposkytlo index jízdního řádu – automatická hlášení jsou vypnutá, použijte ruční režim.'] };
    if (inp.speedKmh === null) return { events: [], disabled: ['API neposkytlo rychlost vlaku – automatická hlášení jsou vypnutá, použijte ruční režim.'] };

    const events: AnnouncementEvent[] = [];
    const emit = (key: string, e: Omit<AnnouncementEvent, 'key'>) => { if (!this.fired.has(key)) { this.fired.add(key); events.push({ key, ...e }); } };
    const moving = inp.speedKmh >= this.cfg.movingKmh;
    const stopped = inp.speedKmh <= this.cfg.stoppedKmh;
    const idx = Math.min(Math.max(inp.index, 0), inp.points.length - 1);
    const si = inp.points.findIndex((p, k) => k >= idx && p.isStop !== false);
    const stop = si >= 0 ? inp.points[si] : null;

    if (stop) {
      const isLast = si === inp.points.length - 1;
      if (moving) emit(`next:${si}`, { kind: 'next-station', station: stop.name });
      if (inp.distToNextStopM === null) {
        disabled.push(`Chybí souřadnice stanice „${stop.name}“ – hlášení „blížíme se“ a „příjezd“ nelze spustit automaticky.`);
      } else {
        if (moving && inp.distToNextStopM <= this.cfg.approachM) {
          emit(`${isLast ? 'terminal' : 'approach'}:${si}`, isLast ? { kind: 'terminal', station: stop.name } : { kind: 'approaching', station: stop.name });
        }
        // Výchozí stanici (index 0) neohlašujeme jako příjezd – vlak v ní na začátku jízdy jen stojí.
        if (stopped && si > 0 && inp.distToNextStopM <= this.cfg.arrivedM) emit(`arrived:${si}`, { kind: 'arrived', station: stop.name });
      }
    }
    if (moving && inp.delayMin !== null && inp.delayMin >= this.cfg.delayStepMin) {
      const bucket = Math.floor(inp.delayMin / this.cfg.delayStepMin) * this.cfg.delayStepMin;
      emit(`delay:${bucket}`, { kind: 'delay', station: null, delayMin: inp.delayMin });
    }
    return { events, disabled };
  }
}
