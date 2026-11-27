import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeWav} from '../dist-electron/services/localAudio.js';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const profile=resolve('.test-user-seasonal-'+Date.now());
const app=await electron.launch({executablePath:resolve('.deployment/recordings-seasonal-test/win-unpacked/SimRail Hub TEST.exe'),args:['--verify-hidden','--user-data-dir='+profile],env});
const result={at:new Date().toISOString(),channel:null,isolatedProfile:true,ipcClips:[],radioPlayback:false,newSettingsVisible:false,errors:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(20000);await p.waitForFunction(()=>!!window.simrailHub);p.on('pageerror',e=>result.errors.push(e.message));
 const info=await p.evaluate(()=>window.simrailHub.getAppInfo());result.channel=info.channel;if(info.channel!=='test')throw Error('Not TEST');
 const diag=await p.evaluate(()=>window.simrailHub.call('diag:info'));if(resolve(diag.userData)!==profile)throw Error('Real user profile');
 await p.evaluate(()=>window.simrailHub.call('settings:update',{appLanguage:'cs',announcements:{auto:false,recorded:true}}));
 const status=await p.evaluate(()=>window.simrailHub.call('recordings:status'));if(!status.ok)throw Error(status.error);if(status.data.services.filter(s=>s.available).length!==14)throw Error('Wrong service availability');
 const pairs=[['Klimont\u00f3w','klimontow'],['Zast\u00f3w','zastow'],['Krak\u00f3w Batowice','krakow_batowice'],['Kutno','kutno'],['Piotrk\u00f3w Trybunalski','piotrkow_trybunalski']];
 for(const [station,file] of pairs){const r=await p.evaluate(station=>window.simrailHub.call('recordings:render',{kind:'next-station',station,trainNumber:'23901',isFreight:false},false),station);if(!r.ok||!r.data)throw Error('No IPC clip '+station);const bytes=new Uint8Array(r.data);if(decodeWav(bytes).length<4800)throw Error('Empty IPC clip');result.ipcClips.push({station,bytes:bytes.length});}
 const radio=await p.evaluate(async()=>{const results=[];for(const closing of [false,true]){const r=await window.simrailHub.call('audio:radio',closing);if(!r.ok)throw Error(r.error);const bytes=new Uint8Array(r.data),url=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));const audio=new Audio(url);audio.volume=0;try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Radio playback timeout')),5000);audio.onended=()=>{clearTimeout(timer);resolve();};audio.onerror=()=>{clearTimeout(timer);reject(Error('Radio decode failed'));};audio.play().catch(reject);});results.push({closing,seconds:audio.duration});}finally{audio.pause();audio.src='';URL.revokeObjectURL(url);}}return results;});result.radioPlayback=radio;
 // Close any first-run release/language overlay in this isolated profile only.
 await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
 const nav=p.getByRole('navigation',{name:'Hlavn\u00ed navigace'});await nav.getByRole('button',{name:'Nastaven\u00ed',exact:true}).click();await p.locator('.settings-tabs').getByRole('button',{name:'Hl\u00e1\u0161en\u00ed',exact:true}).click();
 await p.getByText('Informace b\u011bhem cesty',{exact:true}).waitFor();await p.getByText('V\u00e1no\u010dn\u00ed hl\u00e1\u0161en\u00ed',{exact:true}).waitFor();
 const select=p.getByRole('combobox',{name:'Stanice pro zkou\u0161ku hl\u00e1\u0161en\u00ed'});await select.selectOption('Krak\u00f3w Batowice');if(await select.inputValue()!=='Krak\u00f3w Batowice')throw Error('Missing station preview');result.newSettingsVisible=true;
 if(result.errors.length)throw Error('Renderer errors');
 await writeFile('docs/verification/seasonal-recordings-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
