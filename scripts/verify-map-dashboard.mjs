import {resolve} from 'node:path';

import {_electron as electron} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:'node_modules/electron/dist/electron.exe',args:['.','--docs-fixtures','--verify-hidden','--size=1440x1000','--user-data-dir='+resolve('.test-user-approved-a')],env});
const result={at:new Date().toISOString(),errors:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(30000);p.on('pageerror',e=>result.errors.push(e.message));
 await p.waitForFunction(()=>!!window.simrailHub);
 await p.evaluate(async()=>{await window.simrailHub.call('settings:update',{onboarding:{dismissed:true},announcements:{auto:false},appLanguage:'cs'});localStorage.setItem('simrail:selection:v1',JSON.stringify({server:'cz1',train:'4421'}));});await p.reload();
 await p.getByRole('button',{name:'Palubní počítač',exact:true}).first().click();await p.locator('.journey-panel-v2').waitFor();await p.waitForTimeout(1000);
 result.initialNext=await p.locator('.journey-panel-v2 .next-station').innerText();await p.screenshot({path:'.deployment/approved-a-dashboard.png'});
 await p.getByLabel('Číslo vlaku',{exact:true}).fill('abc');await p.getByRole('button',{name:'Sledovat',exact:true}).click();await p.locator('.train-picker [role=alert]').waitFor();
 if(!await p.locator('.journey-train-number').innerText().then(t=>t==='4421'))throw Error('Invalid search cleared current train');
 await p.getByLabel('Číslo vlaku',{exact:true}).fill('4421');await p.getByRole('button',{name:'Sledovat',exact:true}).click();
 await p.evaluate(()=>window.simrailHub.call('dashboard:open','cz1','4421'));await p.waitForTimeout(500);const other=app.windows().find(w=>w!==p);if(!other)throw Error('No standalone window');await other.locator('.journey-summary').waitFor();
 const pair=await p.evaluate(()=>window.simrailHub.call('mobile:start','cz1','4421'));if(!pair.ok)throw Error(pair.error);
 await p.getByRole('button',{name:'Přestat sledovat',exact:true}).click();
 await p.locator('.journey-summary').waitFor({state:'detached'});await other.locator('.journey-summary').waitFor({state:'detached'});
 result.stopped={mainCleared:true,standaloneCleared:true,savedSelection:await p.evaluate(()=>JSON.parse(localStorage.getItem('simrail:selection:v1')).train)};
 const url=new URL(pair.data.urls[0]);url.hostname='127.0.0.1';try{await fetch(url);throw Error('Mobile still active');}catch(e){if(e.message==='Mobile still active')throw e;result.stopped.mobileRevoked=true;}
 await other.close();
 await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.waitForSelector('.station-entity');
 await p.getByRole('textbox',{name:'Vyhledat vlak nebo stanici'}).fill('4421');
 await p.locator('.search-results').getByRole('button',{name:'Vlak 4421',exact:true}).click();
 await p.getByText('Dostupný herní úsek · koleje OSM',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Celý úsek',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('.rail-route-future')].some(e=>(e.getAttribute('d')?.length??0)>20));await p.waitForTimeout(1000);
 result.map=await p.evaluate(()=>({trainRadius:getComputedStyle(document.querySelector('.chosen .train-body')).borderRadius,stationGlyphs:document.querySelectorAll('.map-station-symbol>svg').length,stationCallouts:document.querySelectorAll('.station-callout').length,stationTrainOverlaps:[...document.querySelectorAll('.map-station-symbol')].filter(s=>{const a=s.getBoundingClientRect();return [...document.querySelectorAll('.train-body')].some(t=>{const b=t.getBoundingClientRect();return Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;});}).length,categories:[...new Set([...document.querySelectorAll('.rail-train')].map(e=>e.dataset.category))],routePaths:document.querySelectorAll('.rail-route-future').length,routeCoordinates:[...document.querySelectorAll('.rail-route-future')].map(p=>p.getAttribute('d')?.length??0)}));
 if(result.map.stationTrainOverlaps)throw Error('Station hidden beneath train');
 if(result.map.trainRadius!=='50%'||!result.map.stationGlyphs||!result.map.routeCoordinates.some(n=>n>20))throw Error('Approved icons/rail route missing');
 await p.screenshot({path:'.deployment/approved-a-map.png'});
 await p.getByRole('button',{name:'Skrýt trasu',exact:true}).click();await p.locator('.rail-route-future').waitFor({state:'detached'});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());await p.waitForTimeout(300);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());await p.waitForTimeout(300);
 if(await p.locator('.rail-route-future').count())throw Error('Hidden route reappeared');result.routeHideSurvivesRestore=true;
 if(result.errors.length)throw Error(result.errors.join(';'));await writeFile('docs/verification/approved-a-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}



