import * as asar from '@electron/asar';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {chromium} from '@playwright/test';
const dir='.deployment/recordings-seasonal-test',archive=join(dir,'win-unpacked/resources/app.asar'),pkg=JSON.parse(asar.extractFile(archive,'package.json').toString());
if(pkg.hubChannel!=='test')throw Error('Wrong channel');if(asar.listPackage(archive).some(f=>/\.(wav|m4a|secret|pem|pfx)$/i.test(f)))throw Error('Private files bundled');
let matched=0;for(const folder of ['dist','dist-electron'])for(const f of await readdir(folder,{recursive:true,withFileTypes:true})){if(!f.isFile())continue;const path=join(f.parentPath??f.path,f.name),relative=path.slice(folder.length+1);if(!asar.extractFile(archive,join(folder,relative)).equals(await readFile(path)))throw Error('Stale package '+path);matched++;}
const profile=resolve('.test-user-seasonal-portable-'+Date.now()),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const exe=resolve(dir,'SimRail-Hub-TEST.exe'),child=spawn(exe,['--verify-hidden','--remote-debugging-port=9278','--user-data-dir='+profile],{env,windowsHide:true,stdio:'ignore'});let browser;
try{for(let n=0;n<120;n++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9278');break;}catch{await new Promise(r=>setTimeout(r,500));}}if(!browser)throw Error('Portable did not start');
 const p=browser.contexts()[0].pages()[0];await p.waitForFunction(()=>window.simrailHub);const info=await p.evaluate(()=>window.simrailHub.getAppInfo()),diag=await p.evaluate(()=>window.simrailHub.call('diag:info'));if(info.channel!=='test'||resolve(diag.userData)!==profile)throw Error('Wrong isolated app');
 const settings=await p.evaluate(()=>window.simrailHub.call('settings:get'));if(!settings.announcements.journeyInfo||!settings.announcements.seasonal)throw Error('New defaults missing');
 const status=await p.evaluate(()=>window.simrailHub.call('recordings:status'));if(!status.ok||!status.data.services.find(s=>s.id==='christmas_farewell')?.available)throw Error('Recordings unavailable');
 const result={at:new Date().toISOString(),info,actualPortableStarted:true,isolatedProfile:true,matchedFiles:matched,privateAudioBundled:false,servicesAvailable:status.data.services.filter(s=>s.available).length,portableSHA256:createHash('sha256').update(await readFile(exe)).digest('hex')};await writeFile('docs/verification/seasonal-recordings-package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{if(browser){const c=await browser.newBrowserCDPSession();await c.send('Browser.close').catch(()=>undefined);}await new Promise(r=>{if(child.exitCode!==null)r();else{child.once('exit',r);setTimeout(r,5000);}});}
