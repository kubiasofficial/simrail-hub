import {resolve} from 'node:path';

import {_electron as electron} from '@playwright/test';
import {writeFile} from 'node:fs/promises';import * as asar from '@electron/asar';
const root=process.argv[2]??'.deployment/oprava-k-overeni',env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const files=asar.listPackage(root+'/win-unpacked/resources/app.asar');
if(files.some(x=>/\.(wav|m4a)$/i.test(x)||/CloudAccount|cloudConfig/.test(x)))throw Error('Private audio or removed cloud code in ASAR');
const app=await electron.launch({executablePath:root+'/win-unpacked/SimRail Hub.exe',args:['--verify-hidden','--user-data-dir='+resolve('.test-user-regression-packaged')],env});
const result={at:new Date().toISOString(),errors:[],tileResponses:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(60000);
 p.on('pageerror',e=>result.errors.push(e.message));
 p.on('response',r=>{if(r.url().startsWith('https://tile.openstreetmap.org/'))result.tileResponses.push(r.status());});
 await p.waitForFunction(()=>!!window.simrailHub);
 await p.evaluate(()=>window.simrailHub.call('settings:update',{onboarding:{dismissed:true},announcements:{auto:false},appLanguage:'cs',appCountry:'cz'}));await p.reload();
 const live=await p.evaluate(async()=>{
  const info=await window.simrailHub.getAppInfo(),diag=await window.simrailHub.call('diag:info'),list=await window.simrailHub.call('trains:list','cz1');
  if(!list.ok||!list.data.trains.length)throw Error('No live trains');
  const samples=[];
  for(const train of list.data.trains.slice(0,6)){
   const detail=await window.simrailHub.call('trains:detail','cz1',train.number);
   if(!detail.ok||!detail.data.timetable?.points.length||detail.data.serverSod===null)throw Error('Timetable/clock failed: '+JSON.stringify(detail));
   const d=detail.data,point=d.timetable.points[d.train.timetableIndex];
   samples.push({number:train.number,runMatches:d.train.runId===d.timetable.runId,points:d.timetable.points.length,stations:d.stations.length,serverSod:d.serverSod,index:d.train.timetableIndex,target:point?.name,arrival:point?.arrival,notes:d.notes});
  }
  localStorage.setItem('simrail:selection:v1',JSON.stringify({mode:'live',server:'cz1',train:samples[0].number}));
  return {version:info.version,fixtures:diag.fixtures,trainCount:list.data.trains.length,samples};
 });Object.assign(result,live);
 if(result.fixtures||result.samples.some(s=>!s.runMatches||s.notes.length))throw Error('Live data invalid '+JSON.stringify(result.samples));
 await p.reload();await p.getByRole('button',{name:'Palubní počítač',exact:true}).first().click();
 await p.waitForSelector('.journey-summary');await p.waitForSelector('li');
 result.initialDelay=await p.locator('.journey-summary').innerText();
 await p.screenshot({path:'.deployment/regression-live-dashboard.png'});
 await p.locator('.language-toggle').click();await p.locator('.language-head button').click();await p.locator('.language-panel').waitFor({state:'detached'});result.packagedLanguageClosed=true;
 const pair=await p.evaluate(async(number)=>{const r=await window.simrailHub.call('mobile:start','cz1',number);if(!r.ok)throw Error(r.error);return r.data;},result.samples[0].number);
 const url=new URL(pair.urls[0]);url.hostname='127.0.0.1';
 const mobile=await fetch(url),cookie=mobile.headers.get('set-cookie')?.split(';')[0];
 if(mobile.status!==200||!cookie)throw Error('Pairing failed');
 const response=await fetch(new URL('/api/state',url),{headers:{Cookie:cookie}});
 const state=await response.json();
 if(response.status!==200||!state.timetable?.points.length||!state.model?.hasTimetable)throw Error('Mobile timetable failed');
 result.mobile={paired:true,status:response.status,points:state.timetable.points.length,hasTimetable:state.model.hasTimetable,delayMin:state.model.delayMin};
 await p.evaluate(()=>window.simrailHub.call('mobile:stop'));
 await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.waitForSelector('.station-entity');await p.waitForSelector('.train-entity');
 await p.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(i=>i.complete&&i.naturalWidth>0),null,{timeout:45000});
 result.map=await p.evaluate(()=>({stations:document.querySelectorAll('.station-entity').length,trains:document.querySelectorAll('.train-entity').length,loadedTiles:[...document.querySelectorAll('.leaflet-tile')].filter(i=>i.complete&&i.naturalWidth>0).length,stationShape:getComputedStyle(document.querySelector('.map-station-symbol')).borderRadius,trainHeight:getComputedStyle(document.querySelector('.train-body')).height}));
 await p.screenshot({path:'.deployment/regression-live-map.png'});
 result.privateAudioBundled=false;result.versionUnchanged=result.version==='0.5.0';result.published=false;
 if(result.errors.length)throw Error(result.errors.join(';'));
 await writeFile('docs/verification/regression-packaged-live.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await app.close();}

