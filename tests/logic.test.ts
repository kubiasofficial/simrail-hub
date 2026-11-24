import { describe, it, expect } from 'vitest';
import { parseTrains, parseTimetables, parseStations, parseSod, serverTimeToSod } from '../src/adapters/trainsApi';
import { computeOnboard, DelayTracker, delayClass, diffSod, findStation } from '../src/services/onboard';
import { AnnouncementTrigger, buildSegments, spokenName, type TriggerInput } from '../src/services/announcements';
import { czechMinutes, polishMinutes } from '../src/services/czech';
import { DemoSim } from '../src/services/demoSim';

// Vzorová data odpovídají dokumentaci komunitního SDK; nejsou to záznamy živého API (viz README).
const trainsJson = { result: true, data: [
  { id: 't1', TrainNoLocal: '12345', RunId: 'r1', Type: 'user', TrainName: 'IC', StartStation: 'A', EndStation: 'B', TrainData: { Latititute: 50.1, Longitute: 19.9, Velocity: 80, VDDelayedTimetableIndex: 2 } },
  { id: 't2', TrainNoLocal: '999', TrainData: { Latititute: 0, Longitute: 0 } },
  { id: 't3', TrainData: {} }
] };

describe('parsování vlaků a jízdních řádů', () => {
  it('toleruje překlepy v souřadnicích a vyřadí neplatné záznamy', () => {
    const r = parseTrains(trainsJson, 'en1');
    expect(r.trains).toHaveLength(1);
    expect(r.skipped).toBe(2);
    expect(r.trains[0]).toMatchObject({ number: '12345', lat: 50.1, lon: 19.9, speedKmh: 80, timetableIndex: 2, type: 'user' });
  });
  it('nevymýšlí rychlost, když chybí', () => {
    const r = parseTrains({ data: [{ TrainNoLocal: '1', TrainData: { Latitude: 50, Longitude: 19 } }] }, 'x');
    expect(r.trains[0].speedKmh).toBeNull();
    expect(r.trains[0].timetableIndex).toBeNull();
  });
  it('parsuje jízdní řád a rozliší zastávky a průjezdy', () => {
    const t = parseTimetables([{ trainNoLocal: '1', timetable: [
      { nameOfPoint: 'A', departureTime: '2026-01-01 10:00:00', stopType: 'CommercialStop' },
      { nameOfPoint: 'B', arrivalTime: '2026-01-01 10:10:00', stopType: 'NoStopOver' },
      { nameOfPoint: 'C' }] }]);
    expect(t[0].points.map((p) => p.isStop)).toEqual([true, false, null]);
  });
  it('parsuje stanice a čas', () => {
    expect(parseStations({ data: [{ Name: 'Katowice', Latititude: 50.25, Longitude: 19.01 }, { Name: 'x' }] })).toHaveLength(1);
    expect(parseSod('2026-01-01 02:15:30')).toBe(2 * 3600 + 15 * 60 + 30);
    expect(parseSod('nesmysl')).toBeNull();
    expect(serverTimeToSod('13:05:00')).toBe(13 * 3600 + 300);
    expect(serverTimeToSod({ data: 'x' })).toBeNull();
    expect(typeof serverTimeToSod(1767225600000)).toBe('number');
  });
});

describe('zpoždění', () => {
  it('třídy podle zadání', () => {
    expect([null, -2, 0, 1, 15, 16].map(delayClass)).toEqual(['none', 'early', 'ontime', 'late', 'late', 'verylate']);
  });
  it('rozdíl přes půlnoc', () => { expect(diffSod(60, 86400 - 120)).toBe(180); expect(diffSod(86400 - 60, 120)).toBe(-180); });
});

describe('palubní počítač nad demo daty', () => {
  const sim = new DemoSim(0);
  const tracker = new DelayTracker();
  const model = (t: number) => { const s = sim.snapshot(t); return computeOnboard({ train: s.train, timetable: s.timetable, stations: s.stations, nowSod: s.nowSod, tracker, connection: 'demo' }); };
  it('na začátku stojí v první stanici (zvýrazněná) a další je Sosnowiec', () => {
    const m = model(0);
    expect(m.phase).toBe('standing');
    expect(m.current).toBe('Katowice');
    expect(m.next).toBe('Sosnowiec Główny');
    expect(m.rows[0].standing).toBe(true);
  });
  it('za jízdy nemá aktuální stanici a ukazuje předchozí a další', () => {
    const m = model(200);
    expect(m.phase).toBe('moving');
    expect(m.current).toBeNull();
    expect(m.previous).toBe('Katowice');
    expect(m.next).toBe('Sosnowiec Główny');
  });
  it('průjezdní bod není „další stanice“', () => {
    let t = 0; let found = false;
    for (; t < 4000; t += 5) { const m = model(t); if (m.next === 'Trzebinia' && m.rows[2].status !== 'upcoming') { found = true; break; } }
    expect(found).toBe(true);
  });
  it('bez zpoždění vychází 0 min a šedá třída; po přidání zpoždění roste', () => {
    const s0 = new DemoSim(0); const tr0 = new DelayTracker(); let last = null as ReturnType<typeof computeOnboard> | null;
    for (let t = 0; t < 1500; t += 5) { const s = s0.snapshot(t); last = computeOnboard({ train: s.train, timetable: s.timetable, stations: s.stations, nowSod: s.nowSod, tracker: tr0, connection: 'demo' }); }
    expect(last!.delayMin).toBe(0);
    expect(last!.delayClass).toBe('ontime');
    const s1 = new DemoSim(7); const tr1 = new DelayTracker();
    for (let t = 0; t < 1500; t += 5) { const s = s1.snapshot(t); last = computeOnboard({ train: s.train, timetable: s.timetable, stations: s.stations, nowSod: s.nowSod, tracker: tr1, connection: 'demo' }); }
    expect(last!.delayMin).toBe(7);
    expect(last!.delayClass).toBe('late');
    expect(last!.rows.at(-1)!.estimated).not.toBeNull();
  });
  it('bez jízdního řádu model poctivě hlásí chybějící data', () => {
    const s = sim.snapshot(100);
    const m = computeOnboard({ train: s.train, timetable: null, stations: [], nowSod: null, tracker: new DelayTracker(), connection: 'live' });
    expect(m.hasTimetable).toBe(false);
    expect(m.delayMin).toBeNull();
    expect(m.next).toBeNull();
  });
  it('findStation ignoruje diakritiku', () => { expect(findStation('Krakow Glowny', sim.stations)?.name).toBe('Kraków Główny'); });
});

describe('texty hlášení', () => {
  it('české šablony odpovídají zadání včetně exonym', () => {
    expect(buildSegments('next-station', { station: 'Katowice' }, 'cs')[0].text).toBe('Vážení cestující, příští stanice Katovice.');
    expect(buildSegments('approaching', { station: 'Kraków Główny' }, 'cs')[0].text).toBe('Vážení cestující, za okamžik přijedeme do stanice Krakov hlavní.');
    expect(buildSegments('arrived', { station: 'Kraków Główny' }, 'cs')[0].text).toBe('Přijeli jsme do stanice Krakov hlavní.');
    expect(buildSegments('terminal', {}, 'cs')[0].text).toContain('konečné stanice');
    expect(buildSegments('delay', { delayMin: 10 }, 'cs')[0].text).toBe('Vážení cestující, náš vlak je aktuálně opožděn přibližně o deset minut.');
  });
  it('číslovky a skloňování minut', () => {
    expect([1, 2, 5, 21, 22, 25, 12].map(czechMinutes)).toEqual(['jednu minutu', 'dvě minuty', 'pět minut', 'dvacet jednu minutu', 'dvacet dvě minuty', 'dvacet pět minut', 'dvanáct minut']);
    expect([1, 3, 5, 12, 22].map(polishMinutes)).toEqual(['1 minutę', '3 minuty', '5 minut', '12 minut', '22 minuty']);
  });
  it('dvojjazyčná šablona vrací dva segmenty a polština nepoužívá exonyma', () => {
    const s = buildSegments('next-station', { station: 'Katowice' }, 'cs-pl');
    expect(s.map((x) => x.lang)).toEqual(['cs', 'pl']);
    expect(s[1].text).toContain('Katowice');
  });
  it('uživatelský slovník výslovnosti má přednost a šablony z modů přepisují výchozí', () => {
    expect(spokenName('Katowice', 'cs', [{ word: 'Katowice', spoken: 'Katovíce' }])).toBe('Katovíce');
    expect(buildSegments('arrived', { station: 'Trzebinia' }, 'cs', [], { cs: { arrived: 'Jsme v {station}.' } })[0].text).toBe('Jsme v Trzebinia.');
  });
});

describe('automatická hlášení – stavový automat', () => {
  const sim = new DemoSim(0);
  const run = (trig: AnnouncementTrigger, from = 0, to = 4000, mutate?: (i: TriggerInput) => TriggerInput) => {
    const tracker = new DelayTracker(); const out: string[] = []; let disabled: string[] = [];
    for (let t = from; t < to; t += 2) {
      const s = sim.snapshot(t);
      const m = computeOnboard({ train: s.train, timetable: s.timetable, stations: s.stations, nowSod: s.nowSod, tracker, connection: 'demo' });
      let inp: TriggerInput = { runKey: 'demo-run', index: s.train.timetableIndex, speedKmh: s.train.speedKmh, distToNextStopM: m.distanceToNextStopM, points: s.timetable.points, delayMin: m.delayMin };
      if (mutate) inp = mutate(inp);
      const r = trig.update(inp);
      disabled = r.disabled;
      for (const e of r.events) out.push(e.key);
    }
    return { keys: out, disabled };
  };
  it('každou událost spustí právě jednou a ve správném pořadí', () => {
    const { keys } = run(new AnnouncementTrigger());
    expect(new Set(keys).size).toBe(keys.length); // žádné duplicity
    expect(keys.filter((k) => k.startsWith('arrived'))).toEqual(['arrived:1', 'arrived:3', 'arrived:4']);
    expect(keys.filter((k) => k.startsWith('approach'))).toEqual(['approach:1', 'approach:3']);
    expect(keys).toContain('terminal:4');
    expect(keys.indexOf('next:1')).toBeLessThan(keys.indexOf('approach:1'));
    expect(keys.indexOf('approach:1')).toBeLessThan(keys.indexOf('arrived:1'));
  });
  it('opakované volání se stejným stavem nevytvoří duplicitu', () => {
    const t = new AnnouncementTrigger();
    const inp: TriggerInput = { runKey: 'r', index: 1, speedKmh: 60, distToNextStopM: 1500, points: sim.timetable.points, delayMin: null };
    expect(t.update(inp).events.length).toBeGreaterThan(0);
    expect(t.update(inp).events).toHaveLength(0);
  });
  it('nový jízdní běh vynuluje stav', () => {
    const t = new AnnouncementTrigger();
    const inp: TriggerInput = { runKey: 'r1', index: 1, speedKmh: 60, distToNextStopM: 1500, points: sim.timetable.points, delayMin: null };
    t.update(inp);
    expect(t.update({ ...inp, runKey: 'r2' }).events.length).toBeGreaterThan(0);
  });
  it('bez dat se bezpečně vypne a nabídne ruční režim', () => {
    const base: TriggerInput = { runKey: 'r', index: 1, speedKmh: 60, distToNextStopM: 100, points: sim.timetable.points, delayMin: null };
    for (const bad of [{ points: [] }, { index: null }, { speedKmh: null }]) {
      const r = new AnnouncementTrigger().update({ ...base, ...bad });
      expect(r.events).toEqual([]);
      expect(r.disabled[0]).toMatch(/ruční režim/);
    }
  });
  it('bez souřadnic stanice nehlásí „blížíme se“ ani „příjezd“, ale „příští stanice“ ano', () => {
    const { keys, disabled } = run(new AnnouncementTrigger(), 0, 4000, (i) => ({ ...i, distToNextStopM: null }));
    expect(keys.some((k) => k.startsWith('approach') || k.startsWith('arrived'))).toBe(false);
    expect(keys.some((k) => k.startsWith('next:'))).toBe(true);
    expect(disabled.join(' ')).toMatch(/Chybí souřadnice/);
  });
  it('hlášení zpoždění se spustí po prahu a neopakuje se v témže pásmu', () => {
    const t = new AnnouncementTrigger();
    const inp: TriggerInput = { runKey: 'r', index: 1, speedKmh: 60, distToNextStopM: 9000, points: sim.timetable.points, delayMin: 6 };
    expect(t.update(inp).events.map((e) => e.kind)).toContain('delay');
    expect(t.update({ ...inp, delayMin: 7 }).events.map((e) => e.kind)).not.toContain('delay');
    expect(t.update({ ...inp, delayMin: 11 }).events.map((e) => e.kind)).toContain('delay');
  });
});

describe('DemoSim', () => {
  it('doběhne do cíle, rychlost je ve stanicích nulová a „skok před stanici“ funguje', () => {
    const s = new DemoSim(0);
    expect(s.snapshot(10000).finished).toBe(true);
    expect(s.snapshot(0).train.speedKmh).toBe(0);
    const t2 = s.jumpBeforeNextStop(0);
    expect(t2).toBeGreaterThan(0);
    expect(s.snapshot(t2).train.timetableIndex).toBe(1);
  });
});
