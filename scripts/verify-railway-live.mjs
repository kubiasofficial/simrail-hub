import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:resolve('node_modules/electron/dist/electron.exe'),args:['.','--verify-hidden','--user-data-dir='+resolve('.test-user-railway-live')],env});
try{const p=await app.firstWindow();await p.waitForFunction(()=>!!window.simrailHub);const result={at:new Date().toISOString(),liveApi:true};
 const stations=await p.evaluate(()=>window.simrailHub.call('stations:list','cz1'));if(!stations.ok)throw Error(stations.error);result.warsaw=stations.data.filter(s=>['Warszawa Wschodnia','Warszawa Centralna','Warszawa Zachodnia'].includes(s.name)).map(s=>({name:s.name,lat:s.lat,lon:s.lon}));if(result.warsaw.length!==3)throw Error('Missing Warsaw coordinates');
 const trains=await p.evaluate(()=>window.simrailHub.call('trains:list','cz1'));if(!trains.ok)throw Error(trains.error);result.trains=trains.data.trains.length;
 const t=trains.data.trains.find(t=>/^(16|61|35|53)\d{2,3}$/.test(t.number))??trains.data.trains[0];if(!t)throw Error('No live trains');
 const detail=await p.evaluate(number=>window.simrailHub.call('trains:detail','cz1',number),t.number);if(!detail.ok||!detail.data.timetable)throw Error('Live timetable unavailable');result.timetable={number:t.number,points:detail.data.timetable.points.length,vehicle:detail.data.timetable.vehicleType};
 const sod=detail.data.serverSod;if(sod===null)throw Error('Missing clock');
 const request={transport:'passenger',origin:'Warszawa Wschodnia',endSod:(sod+6*3600)%86400,breakMinutes:30,ownedDlc:[5240850,4916490,2868050,3583200,4009000,4009020,4380650]};
 const plan=await p.evaluate(q=>window.simrailHub.call('shift:plan','cz1',q),request);if(!plan.ok)throw Error(plan.error);result.plan={legs:plan.data.legs.map(l=>({number:l.number,from:l.from,to:l.to,departure:l.departure,arrival:l.arrival,availability:l.availability})),notes:plan.data.notes};
 await writeFile('docs/verification/railway-live.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
