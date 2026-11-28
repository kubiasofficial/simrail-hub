import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeWav,trimSilence,encodeWav} from '../dist-electron/services/localAudio.js';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const profile=resolve('.test-user-radio-dispatcher-'+Date.now());
const app=await electron.launch({executablePath:resolve('.deployment/radio-dispatcher-test/win-unpacked/SimRail Hub TEST.exe'),args:['--docs-fixtures','--verify-hidden','--user-data-dir='+profile],env});
const result={at:new Date().toISOString(),errors:[],profileIsolated:false,radioCue:[],metadata:null,ui:{},backgroundPlayback:false};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(20000);p.on('pageerror',e=>result.errors.push(e.message));await p.waitForFunction(()=>window.simrailHub);
 result.info=await p.evaluate(()=>window.simrailHub.getAppInfo());if(result.info.channel!=='test')throw Error('Wrong build');
 const diag=await p.evaluate(()=>window.simrailHub.call('diag:info'));if(resolve(diag.userData)!==profile)throw Error('Wrong profile');result.profileIsolated=true;
 await p.evaluate(()=>window.simrailHub.call('settings:update',{appLanguage:'cs',announcements:{auto:false},onboarding:{dismissed:true}}));
 await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
 const expected=encodeWav(trimSilence(decodeWav(await readFile('assets/recordings/vysilacka.wav'))));
 for(const closing of [false,true]){
  const r=await p.evaluate(closing=>window.simrailHub.call('audio:radio',closing),closing);if(!r.ok)throw Error(r.error);
  const bytes=new Uint8Array(r.data);if(!Buffer.from(bytes).equals(Buffer.from(expected)))throw Error('Synthesized cue instead of supplied recording');
  const played=await p.evaluate(async data=>{const url=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:'audio/wav'})),a=new Audio(url);a.volume=0;try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Cue timeout')),5000);a.onended=()=>{clearTimeout(timer);resolve();};a.onerror=()=>reject(Error('Invalid cue'));a.play().catch(reject);});return a.duration;}finally{a.pause();a.removeAttribute('src');a.load();URL.revokeObjectURL(url);}},Array.from(bytes));
  result.radioCue.push({closing,seconds:played,sha256:createHash('sha256').update(bytes).digest('hex'),matchesSuppliedClip:true});
 }
 const metadata=await p.evaluate(()=>window.simrailHub.call('radio:now-playing','kiss'));if(!metadata.ok)throw Error(metadata.error);result.metadata=metadata.data;
 const unsupported=await p.evaluate(()=>window.simrailHub.call('radio:now-playing','custom'));if(!unsupported.ok||unsupported.data!==null)throw Error('Unsupported metadata must be empty');
 const nav=p.getByRole('navigation',{name:'Hlavní navigace'});await nav.getByRole('button',{name:'Palubní počítač',exact:true}).click();
 // Fixture server train selected through the same picker as normal users.
 const trains=await p.evaluate(()=>window.simrailHub.call('trains:list','cz1'));if(!trains.ok||!trains.data.trains.length)throw Error('No fixture trains');await p.locator('.dashboard-source select').selectOption('cz1');const number=p.getByLabel('Číslo vlaku',{exact:true});await number.fill(trains.data.trains[0].number);await p.getByRole('button',{name:'Sledovat',exact:true}).click();await p.getByRole('combobox',{name:'Četnost zpráv dispečera'}).selectOption('detailed');
 await p.getByRole('button',{name:'Rádio',exact:true}).click();const dialog=p.getByRole('dialog',{name:'Rádio',exact:true});await dialog.getByText('PRÁVĚ HRAJE',{exact:true}).waitFor();
 await p.locator('audio[data-radio-audio]').evaluate(a=>a.muted=true);
 await dialog.getByRole('button',{name:'Přehrát',exact:true}).click();
 await p.waitForFunction(()=>{const a=document.querySelector('audio[data-radio-audio]');return a.currentTime>2&&!a.paused;},null,{timeout:45000});
 if(metadata.data){await p.waitForFunction(()=>!!document.querySelector('.radio-track strong'),null,{timeout:12000});result.ui.nowPlaying=await p.locator('.radio-track').innerText();}
 else result.ui.nowPlaying=await p.locator('.radio-track').innerText();
 await p.screenshot({path:'.deployment/radio-dispatcher-test/radio-preview.png'});
 // Switching to an unsupported station must never retain Kiss's last song.
 await dialog.getByRole('button',{name:'Správa stanic'}).click();await dialog.getByLabel('Název',{exact:true}).fill('Zkušební stanice');await dialog.getByLabel('HTTPS stream',{exact:true}).fill('https://example.com/no-stream');await dialog.getByRole('button',{name:'Přidat',exact:true}).click();
 await dialog.locator('.radio-presets').getByRole('button').filter({hasText:'Zkušební stanice'}).click();await p.waitForFunction(()=>!document.querySelector('.radio-track strong'));
 result.ui.clearedOnStationSwitch=true;
 await dialog.locator('.radio-presets').getByRole('button').filter({hasText:'Rádio Kiss'}).click();
 await p.waitForFunction(()=>{const a=document.querySelector('audio[data-radio-audio]');return a.currentTime>1&&!a.paused;},null,{timeout:45000});
 await dialog.getByRole('button',{name:'Zavřít dialog'}).click();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());
 const before=await p.locator('audio[data-radio-audio]').evaluate(a=>a.currentTime);await p.waitForTimeout(2500);const after=await p.locator('audio[data-radio-audio]').evaluate(a=>({time:a.currentTime,paused:a.paused}));if(after.paused||after.time<=before)throw Error('Background playback stopped');result.backgroundPlayback=true;
 await nav.getByRole('button',{name:'Nastavení',exact:true}).click();await p.locator('.settings-tabs').getByRole('button',{name:'Hlášení',exact:true}).click();await p.getByText('Vystupování a dveře',{exact:true}).waitFor();await p.getByText('Zavazadla a volné uličky',{exact:true}).waitFor();result.ui.automaticGroups=true;
 const settings=await p.evaluate(()=>window.simrailHub.call('settings:get'));if(!settings.announcements.exit||settings.dispatcher.verbosity!=='detailed')throw Error('New defaults not migrated');
 if(result.errors.length)throw Error('Renderer errors');
 await writeFile('docs/verification/radio-dispatcher-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
