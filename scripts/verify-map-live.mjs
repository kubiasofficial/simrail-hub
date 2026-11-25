import {resolve} from 'node:path';

import {_electron as electron} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:process.argv[2]??'.deployment/test-launcher/win-unpacked/SimRail Hub TEST.exe',args:['--verify-hidden','--user-data-dir='+resolve('.test-user-approved-a-live')],env});
const result={at:new Date().toISOString(),errors:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(60000);p.on('pageerror',e=>result.errors.push(e.message));await p.waitForFunction(()=>!!window.simrailHub);
 await p.evaluate(()=>window.simrailHub.call('settings:update',{onboarding:{dismissed:true},announcements:{auto:false},appLanguage:'cs',map:{followSelected:false}}));
 const live=await p.evaluate(async()=>{
  const list=await window.simrailHub.call('trains:list','cz1');if(!list.ok)throw Error(list.error);
  const selected=[list.data.trains.find(t=>t.name?.includes('EIP')),list.data.trains.find(t=>t.number==='71560')??list.data.trains.find(t=>/\b(?:ROJ|MOJ|MOE)\b/.test(t.name??'')),list.data.trains.find(t=>t.name?.includes('TLK'))].filter(Boolean);
  const routes=[];
  for(const train of selected){const before=performance.now(),r=await window.simrailHub.call('trains:route','cz1',train.number);
   if(!r.ok)throw Error('Route '+train.number+': '+r.error);
   if(!r.data.sections.length)throw Error('No rail geometry for '+train.number);
   routes.push({number:train.number,name:train.name,sections:r.data.sections.length,coordinates:r.data.sections.reduce((sum,s)=>sum+s.coordinates.length,0),first:r.data.first,last:r.data.last,matched:r.data.matchedPoints,total:r.data.totalPoints,gaps:r.data.missingSections,elapsedMs:Math.round(performance.now()-before)});
  }
  if(!routes.length)throw Error('No live sample');
  localStorage.setItem('simrail:selection:v1',JSON.stringify({server:'cz1',train:routes[0].number}));return {trainCount:list.data.trains.length,routes};
 });Object.assign(result,live);
 await p.reload();await p.getByRole('button',{name:'Palubní počítač',exact:true}).first().click();await p.locator('.journey-panel-v2').waitFor();await p.waitForTimeout(700);
 result.dashboard={next:await p.locator('.journey-panel-v2 .next-station').innerText(),delay:await p.locator('.delay-indicator').innerText(),imageLoaded:await p.locator('.train-compact .vehicle-card img').evaluateAll(images=>images.some(i=>i.complete&&i.naturalWidth>0))};
 await p.screenshot({path:'.deployment/approved-a-live-dashboard.png'});
 await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.locator('.map-route-status').getByRole('button',{name:'Celý úsek'}).waitFor();
 await p.locator('.map-route-status').getByRole('button',{name:'Celý úsek'}).click();
 await p.waitForFunction(()=>[...document.querySelectorAll('.rail-route-future,.rail-route-passed')].some(e=>(e.getAttribute('d')?.length??0)>20));
 await p.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(i=>i.complete&&i.naturalWidth>0));
 await p.waitForTimeout(800);
 result.map=await p.evaluate(()=>({selectedCategory:document.querySelector('.rail-train.chosen')?.dataset.category,selectedColor:getComputedStyle(document.querySelector('.rail-train.chosen .train-body')).backgroundColor,stations:document.querySelectorAll('.station-entity').length,stationBuildings:document.querySelectorAll('.map-station-symbol>svg').length,stationCallouts:document.querySelectorAll('.station-callout').length,routePaths:document.querySelectorAll('.rail-route-future').length,loadedTiles:[...document.querySelectorAll('.leaflet-tile')].filter(i=>i.complete&&i.naturalWidth>0).length}));
 if(!result.map.stationBuildings||result.map.selectedCategory!=='EIP'||result.map.selectedColor!=='rgb(117, 66, 183)')throw Error('Class color or station buildings missing');
 await p.screenshot({path:'.deployment/approved-a-live-map.png'});
 if(result.errors.length)throw Error(result.errors.join(';'));await writeFile('docs/verification/approved-a-live.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}

