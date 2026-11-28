import * as asar from '@electron/asar';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {encodeWav,decodeWav,trimSilence} from '../dist-electron/services/localAudio.js';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
const dir='.deployment/station-recordings-test',archive=join(dir,'win-unpacked/resources/app.asar'),pkg=JSON.parse(asar.extractFile(archive,'package.json').toString());
if(pkg.hubChannel!=='test')throw Error('Wrong channel');if(asar.listPackage(archive).some(f=>/\.(wav|m4a|secret|pem|pfx)$/i.test(f)))throw Error('Private files bundled');
let matched=0;for(const folder of ['dist','dist-electron'])for(const f of await readdir(folder,{recursive:true,withFileTypes:true})){if(!f.isFile())continue;const path=join(f.parentPath??f.path,f.name),relative=path.slice(folder.length+1);if(!asar.extractFile(archive,join(folder,relative)).equals(await readFile(path)))throw Error('Stale package '+path);matched++;}
const profile=resolve('.test-user-station-recordings-portable-'+Date.now()),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const exe=resolve(dir,'SimRail-Hub-TEST.exe'),child=spawn(exe,['--docs-fixtures','--verify-hidden','--remote-debugging-port=9293','--user-data-dir='+profile],{env,windowsHide:true,stdio:'ignore'});let browser;
try{for(let n=0;n<120;n++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9293');break;}catch{await new Promise(r=>setTimeout(r,500));}}if(!browser)throw Error('Portable did not start');
 const p=browser.contexts()[0].pages()[0];await p.waitForFunction(()=>window.simrailHub);const info=await p.evaluate(()=>window.simrailHub.getAppInfo()),diag=await p.evaluate(()=>window.simrailHub.call('diag:info'));if(info.channel!=='test'||resolve(diag.userData)!==profile)throw Error('Wrong isolated app');
 const settings=await p.evaluate(()=>window.simrailHub.call('settings:get'));if(!settings.announcements.journeyInfo||!settings.announcements.seasonal)throw Error('New defaults missing');
 const status=await p.evaluate(()=>window.simrailHub.call('recordings:status'));if(!status.ok||!status.data.services.find(s=>s.id==='christmas_farewell')?.available)throw Error('Recordings unavailable');
 const stationClips=[];for(const station of ['Sędziszów','Warszawa Śródmieście','Łódź Fabryczna','Katowice Szopienice Południowe','Zgierz Kontrewers','Dąbrowa Górnicza Ząbkowice']){const r=await p.evaluate(station=>window.simrailHub.call('recordings:render',{kind:'arrived',station,trainNumber:'23901',isFreight:false},false),station);if(!r.ok||!r.data||new Uint8Array(r.data).length<48044)throw Error('Station clip missing '+station);stationClips.push(station);}
 const trains=await p.evaluate(()=>window.simrailHub.call('trains:list','cz1'));if(!trains.ok||!trains.data.trains.length)throw Error('No controlled trains');
 const pair=await p.evaluate(number=>window.simrailHub.call('mobile:start','cz1',number),trains.data.trains[0].number);if(!pair.ok)throw Error(pair.error);const u=new URL(pair.data.urls[0]);u.hostname='127.0.0.1';const root=await fetch(u),cookie=root.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Pair cookie missing');const html=await root.text();if(!html.includes('id="arrival"')||!html.includes('id="reconnect"'))throw Error('Old mobile HTML bundled');
 const mobile=await fetch(u.origin+'/api/state',{headers:{cookie}}).then(r=>r.json());if(mobile.app.mobileRevision!=='2026-11-28.1'||mobile.app.channel!=='test'||mobile.app.buildId!==info.buildId||!mobile.presentation?.times)throw Error('Old mobile payload bundled');
 await p.evaluate(()=>window.simrailHub.call('mobile:stop'));
 const cue=await p.evaluate(()=>window.simrailHub.call('audio:radio',false));if(!cue.ok)throw Error(cue.error);const expected=encodeWav(trimSilence(decodeWav(await readFile(join(dir,'win-unpacked/resources/recordings/vysilacka.wav')))));if(!Buffer.from(cue.data).equals(Buffer.from(expected)))throw Error('New radio cue missing from portable');
 const radioMetadata=await p.evaluate(()=>window.simrailHub.call('radio:now-playing','kiss'));if(!radioMetadata.ok)throw Error(radioMetadata.error);
 const manifest=JSON.parse(await readFile(join(dir,'win-unpacked/resources/recordings/manifest.json'),'utf8'));for(const file of manifest.files){const bytes=await readFile(join(dir,'win-unpacked/resources/recordings',file.file));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Audio hash mismatch '+file.file);}

 const imported=JSON.parse(await readFile('docs/verification/station-recordings-import.json','utf8'));
 const registry=await import('../dist-electron/services/stationRecordings.js');
 const rendered=await p.evaluate(async names=>{let count=0;for(const station of names){for(const trainNumber of ['1935','61105']){const r=await window.simrailHub.call('recordings:render',{kind:'arrived',station,trainNumber,isFreight:false},false);if(!r.ok||!r.data||r.data.length<48044)throw Error('Missing packaged station '+station);count++;}}return count;},Object.keys(registry.STATION_RECORDINGS));
 for(const clip of imported.files.filter(r=>r.status==='upcoming')){
  if((await readdir(join(dir,'win-unpacked/resources/recordings'))).includes(clip.file))throw Error('Upcoming clip was bundled '+clip.file);
  const r=await p.evaluate(station=>window.simrailHub.call('recordings:render',{kind:'arrived',station,trainNumber:'1935',isFreight:false},false),clip.station);if(!r.ok||r.data!==null)throw Error('Upcoming clip enabled prematurely');
 }
 for(const clip of imported.files){const original=await readFile(join('../hlaseni',clip.source));if(createHash('sha256').update(original).digest('hex')!==clip.sourceSha256)throw Error('Original changed '+clip.source);}
 await p.evaluate(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();});
 const nav=p.getByRole('navigation',{name:'Hlavní navigace'});await nav.getByRole('button',{name:'Nastavení',exact:true}).click();await p.locator('.settings-tabs').getByRole('button',{name:'Hlášení',exact:true}).click();
 const preview=p.getByRole('combobox',{name:'Stanice pro zkoušku hlášení'});if(await preview.locator('option').count()!==156)throw Error('Incomplete station preview');await preview.selectOption('Sędziszów');
 const result={at:new Date().toISOString(),info,recordedStations:156,passengerRenders:rendered,originalsVerified:imported.files.length,upcomingExcluded:9,previewStations:156,radioCueBundled:true,publicAudioFiles:manifest.files.length,radioMetadata:radioMetadata.data,actualPortableStarted:true,isolatedProfile:true,matchedFiles:matched,privateAudioBundled:false,stationClips,mobileRevision:mobile.app.mobileRevision,pairedPackagedMobile:true,servicesAvailable:status.data.services.filter(s=>s.available).length,portableSHA256:createHash('sha256').update(await readFile(exe)).digest('hex')};await writeFile('docs/verification/station-recordings-package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{if(browser){const c=await browser.newBrowserCDPSession();await c.send('Browser.close').catch(()=>undefined);}await new Promise(r=>{if(child.exitCode!==null)r();else{child.once('exit',r);setTimeout(r,5000);}});}
