import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({executablePath:resolve('.deployment/station-recordings-test/win-unpacked/SimRail Hub TEST.exe'),args:['--docs-fixtures','--verify-hidden','--user-data-dir='+resolve('.test-user-station-recordings-ui-'+Date.now())],env});
const result={at:new Date().toISOString(),previewCount:0,selected:[],played:[],errors:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(20000);p.on('pageerror',e=>result.errors.push(e.message));await p.waitForFunction(()=>window.simrailHub);
 await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
 const nav=p.getByRole('navigation',{name:'Hlavní navigace'});await nav.getByRole('button',{name:'Nastavení',exact:true}).click();await p.locator('.settings-tabs').getByRole('button',{name:'Hlášení',exact:true}).click();
 const select=p.getByRole('combobox',{name:'Stanice pro zkoušku hlášení'});result.previewCount=await select.locator('option').count();if(result.previewCount!==156)throw Error('Missing preview station');
 for(const station of ['Sędziszów','Warszawa Śródmieście','Katowice Szopienice Południowe','Zgierz Kontrewers']){await select.selectOption(station);if(await select.inputValue()!==station)throw Error('Preview failed');result.selected.push(station);}
 for(const station of ['Sędziszów','Warszawa Śródmieście']){
  result.played.push(await p.evaluate(async station=>{const r=await window.simrailHub.call('recordings:render',{kind:'arrived',station,trainNumber:'1935',isFreight:false},false);if(!r.ok||!r.data)throw Error('Missing recording');const url=URL.createObjectURL(new Blob([new Uint8Array(r.data)],{type:'audio/wav'})),a=new Audio(url);a.volume=0;a.playbackRate=2;try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Playback timeout')),15000);a.onended=()=>{clearTimeout(timer);resolve();};a.onerror=()=>{clearTimeout(timer);reject(Error('Decode error'));};a.play().catch(reject);});return {station,seconds:a.duration,actualWavPlayback:true,muted:true};}finally{a.pause();a.removeAttribute('src');a.load();URL.revokeObjectURL(url);}},station));
 }
 if(result.errors.length)throw Error('Renderer error');await writeFile('docs/verification/station-recordings-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
