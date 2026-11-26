import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const executable=process.argv[2]??'node_modules/electron/dist/electron.exe';
const args=process.argv[2]?[]:['.'];
const app=await electron.launch({executablePath:resolve(executable),args:[...args,'--docs-fixtures','--verify-hidden','--size=1440x1000','--user-data-dir='+resolve('.test-user-sneak-peek')],env});
const result={at:new Date().toISOString(),controlledFixtures:false,errors:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(30000);p.on('pageerror',e=>result.errors.push(e.message));
 const requests=[];p.on('request',r=>requests.push(r.url()));
 await p.waitForFunction(()=>!!window.simrailHub);result.controlledFixtures=await p.evaluate(async()=>!!(await window.simrailHub.call('diag:info')).fixtures);result.info=await p.evaluate(()=>window.simrailHub.getAppInfo());
 await p.evaluate(async()=>{await window.simrailHub.call('settings:update',{onboarding:{dismissed:true},map:{sneakPeek:false},dispatcher:{enabled:false,audio:false},announcements:{auto:false},appLanguage:'cs'});localStorage.setItem('simrail:selection:v1',JSON.stringify({server:'cz1',train:null}));});await p.reload();
 await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.getByRole('button',{name:'Vrstvy a vzhled'}).click();
 if(await p.getByRole('checkbox',{name:'Sneak peek – připravované tratě'}).isChecked())throw Error('Preview not default-off');
 if(requests.some(url=>/sneak-peek-[^/]+\.js/.test(url)))throw Error('Preview dataset eagerly loaded');
 result.defaultOffAndLazy=true;
 await app.evaluate(({ipcMain})=>{global.peekForbiddenCalls=[];for(const channel of ['tts:synthesize','recordings:render','trains:route']){const handler=ipcMain._invokeHandlers.get(channel);if(!handler)continue;ipcMain.removeHandler(channel);ipcMain.handle(channel,(...args)=>{global.peekForbiddenCalls.push(channel);return handler(...args);});}});
 await p.getByRole('checkbox',{name:'Sneak peek – připravované tratě'}).check();await p.locator('.peek-show-route').click();
 await p.getByRole('region',{name:'Detail připravované tratě'}).waitFor();try{await p.locator('.peek-route-line').waitFor({timeout:30000});}catch(e){await p.screenshot({path:'.deployment/sneak-peek/failed-fit.png'});throw e;}
 await p.waitForTimeout(600);
 result.preview=await p.evaluate(()=>({path:document.querySelector('.peek-route-line')?.getAttribute('d'),stroke:document.querySelector('.peek-route-line')?.getAttribute('stroke'),apiText:document.querySelector('.peek-detail-body')?.textContent,steam:document.querySelector('.peek-steam-link')?.getAttribute('href'),legend:document.querySelector('.peek-map-legend')?.textContent}));
 if(!result.preview.path||result.preview.path.length<100||!result.preview.apiText.includes('neposkytlo souřadnice')||!result.preview.steam.includes('/5548340/'))throw Error('Preview geometry or evidence missing');
 const calls=await app.evaluate(()=>global.peekForbiddenCalls);if(calls.length)throw Error('Preview touched operational/audio channels: '+calls);result.separateFromLiveAndAudio=true;
 await p.getByRole('button',{name:'Zobrazit celou trať'}).click();await p.locator('.peek-stations summary').click();await p.locator('.peek-sources summary').click();
 result.stationRows=await p.locator('.peek-stations li').count();if(result.stationRows!==12)throw Error('Wrong preview station list');
 await p.screenshot({path:'.deployment/sneak-peek/preview-overview.png'});
 // Zoom using Leaflet's actual button; station symbols should appear only at detailed zoom.
 for(let i=0;i<4&&!await p.locator('.peek-station-marker').count();i++){await p.getByRole('button',{name:'Zoom in',exact:true}).click();await p.waitForTimeout(400);}
 await p.locator('.peek-station-marker').first().waitFor();result.previewStationMarkers=await p.locator('.peek-station-marker').count();
 await p.getByRole('button',{name:'Zavřít detail',exact:true}).click();await p.locator('.peek-detail').waitFor({state:'detached'});
 await p.getByRole('button',{name:'Vrstvy a vzhled'}).click();await p.getByRole('checkbox',{name:'Sneak peek – připravované tratě'}).uncheck();await p.locator('.peek-route-line').waitFor({state:'detached'});if(await p.locator('.peek-station-marker').count())throw Error('Preview stations left behind');
 await p.getByRole('checkbox',{name:'Sneak peek – připravované tratě'}).check();await p.locator('.peek-show-route').click();
 await p.evaluate(()=>window.simrailHub.call('settings:update',{animations:false}));await p.reload();await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.getByRole('button',{name:'Vrstvy a vzhled'}).click();await p.locator('.peek-show-route').click();await p.locator('.peek-route-line').waitFor();await p.waitForFunction(()=>document.documentElement.dataset.animations==='off');
 if(await p.locator('.peek-route-line').evaluate(n=>getComputedStyle(n).animationName)!=='none')throw Error('Animations-off ignored');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());await p.waitForTimeout(300);if(await p.locator('.peek-route-line').count())throw Error('Hidden map continues preview rendering');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());try{await p.locator('.peek-route-line').waitFor();}catch(e){await p.screenshot({path:'.deployment/sneak-peek/failed-restore.png'});throw e;}
 result.toggleAndBackground=true;
 await p.reload();await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.getByRole('button',{name:'Vrstvy a vzhled'}).click();if(!await p.getByRole('checkbox',{name:'Sneak peek – připravované tratě'}).isChecked())throw Error('Preference not persisted');await p.locator('.peek-show-route').click();
 await p.locator('.peek-route-line').waitFor();await p.waitForTimeout(400);result.persistedAcrossReload=true;
 result.geometryRequests=requests.filter(url=>/overpass|api\.openstreetmap\.org/.test(url));if(result.geometryRequests.length)throw Error('Runtime preview fetched remote geometry');
 await p.screenshot({path:'.deployment/sneak-peek/preview-final.png'});
 if(result.errors.length)throw Error(result.errors.join(';'));await writeFile('docs/verification/sneak-peek-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
