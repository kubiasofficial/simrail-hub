import {resolve} from 'node:path';

import {_electron as electron} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:'node_modules/electron/dist/electron.exe',args:['.','--docs-fixtures','--verify-hidden','--size=1440x1000','--user-data-dir='+resolve('.test-user-regression-ui')],env});
const result={errors:[]};
try{
 const p=await app.firstWindow();p.on('pageerror',e=>result.errors.push(e.message));
 await p.waitForFunction(()=>!!window.simrailHub);
 await p.evaluate(()=>window.simrailHub.call('settings:update',{onboarding:{dismissed:true},announcements:{auto:false},appLanguage:'cs',appCountry:'cz'}));await p.reload();
 const open=async()=>{await p.locator('.language-toggle').click();await p.locator('dialog.language-panel').waitFor();};
 const closed=async()=>{await p.locator('dialog.language-panel').waitFor({state:'detached'});};
 await open();
 result.dialog=await p.locator('dialog').evaluate(d=>({parent:d.parentElement.tagName,drag:getComputedStyle(d).webkitAppRegion,buttons:[...d.querySelectorAll('button')].every(b=>getComputedStyle(b).webkitAppRegion==='no-drag')}));
 if(result.dialog.parent!=='BODY'||result.dialog.drag!=='no-drag'||!result.dialog.buttons)throw Error('Native drag regions still cover the dialog');
 await p.locator('.language-head button').click();await closed();result.closeButton=true;
 await open();await p.keyboard.press('Escape');await closed();result.escape=true;
 await open();await p.mouse.click(320,850);await closed();result.backdrop=true;
 await open();await p.locator('.country-option').filter({hasText:'Deutsch'}).last().click();await closed();
 await p.waitForFunction(()=>document.querySelector('.language-toggle')?.textContent.includes('Deutsch'));result.selectedGerman=true;
 await open();await p.locator('.country-option').filter({hasText:'Čeština'}).click();await closed();
 await p.getByRole('button',{name:'Živá mapa',exact:true}).click();await p.waitForSelector('.station-entity');await p.waitForSelector('.train-entity');
 result.icons=await p.evaluate(()=>{
 const a=document.querySelector('.map-station-symbol'),b=document.querySelector('.train-body'),c=document.querySelector('.train-cluster');
 return {stationGlyphs:document.querySelectorAll('.map-station-symbol>svg').length,stations:document.querySelectorAll('.station-entity').length,trains:document.querySelectorAll('.train-entity').length,stationColor:getComputedStyle(a).backgroundColor,stationRadius:getComputedStyle(a).borderRadius,trainHeight:getComputedStyle(b).height,trainRadius:getComputedStyle(b).borderRadius,clusterRadius:c?getComputedStyle(c).borderRadius:null};
 });
 if(!result.icons.stationGlyphs||result.icons.trainRadius!=='50%')throw Error('New map icons missing');
 await p.screenshot({path:'.deployment/regression-map.png'});
 await writeFile('docs/verification/regression-ui.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));if(result.errors.length)throw Error(result.errors.join(';'));
}finally{await app.close();}

