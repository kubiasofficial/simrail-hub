import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseTimetables} from '../dist-electron/adapters/trainsApi.js';
import {playablePassengerStops} from '../dist-electron/services/seasonalAnnouncements.js';
import {recordingNames} from '../dist-electron/services/localAudio.js';
import {isFreightTrain} from '../dist-electron/services/trainPurpose.js';
const source=process.argv[2];if(!source)throw Error('Pass the path to a fresh official getAllTimetables snapshot.');
const bytes=await readFile(source),timetables=parseTimetables(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')));
const manifest=JSON.parse(await readFile('assets/recordings/manifest.json','utf8')),files=new Set(manifest.files.map(f=>f.file));
const normalize=s=>s.toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const filename=s=>normalize(s).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')+'.wav';
const stations=new Map();let passengerRuns=0;
for(const timetable of timetables){
 if(isFreightTrain({name:timetable.category||'',vehicles:(timetable.vehicleType??'').split(';')}))continue;
 const stops=playablePassengerStops(timetable.points);if(!stops.length)continue;passengerRuns++;
 for(const stop of stops){
  const key=normalize(stop.name),entry=stations.get(key)??{station:stop.name,file:filename(stop.name),numbers:new Set(),covered:false};
  const names=recordingNames({kind:'arrived',station:stop.name,trainNumber:timetable.trainNumber,isFreight:false});
  entry.covered=!!names&&names.every(f=>files.has(f));if(entry.covered)entry.file=names.at(-1);
  entry.numbers.add(timetable.trainNumber);stations.set(key,entry);
 }
}
const rows=[...stations.values()].map(e=>({...e,numbers:[...e.numbers].sort(),services:e.numbers.size})).sort((a,b)=>b.services-a.services||a.station.localeCompare(b.station,'pl'));
const result={at:new Date().toISOString(),source:'https://api1.aws.simrail.eu:8082/api/getAllTimetables?serverCode=cz1',snapshotSHA256:createHash('sha256').update(bytes).digest('hex'),criterion:'CommercialStop/PH, line > 0, non-placeholder pointId, passenger timetable category; no transit-only or 999xx points.',timetables:timetables.length,passengerRuns,covered:rows.filter(e=>e.covered),missing:rows.filter(e=>!e.covered)};
await writeFile('docs/verification/recording-coverage.json',JSON.stringify(result,null,2)+'\n');
const lines=['Stanice k namluvení – SimRail Hub','',`Kontrola API: ${new Intl.DateTimeFormat('cs-CZ',{timeZone:'Europe/Prague',dateStyle:'medium'}).format(new Date())}.`,`${result.covered.length} stanic již pokryto, ${result.missing.length} chybí. Pořadí podle počtu osobních spojů v jízdních řádech CZ1.`, 'Pouze PH zastávky s doloženou tratí a skutečným pointId; průjezdy a body mimo mapu se nenahrávají.', 'Nahrávka stanice se použije na všech osobních spojích, které v ní zastavují. Není vázaná na předčíslí vlaku.', '','NAMLOUVAT JEN NÁZEV STANICE. Každý název do vlastního souboru. Originály si ponech.','',...result.missing.map((e,i)=>`${i+1}. ${e.station} → ${e.file} (${e.services} spojů)`),'','Sędziszów: dříve jsi uváděl, že nahrávku máš; v připojeném balíku stále není. Nejdřív ji dohledáme, zbytečně ji nenahrávej znovu.'];
await writeFile('../Stanice-k-namluveni.txt',lines.join('\n')+'\n');
console.log(JSON.stringify({covered:result.covered.length,missing:result.missing.length,passengerRuns,priority:result.missing.slice(0,20).map(e=>({station:e.station,file:e.file,services:e.services}))},null,2));
