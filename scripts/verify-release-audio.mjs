import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222');const p=b.contexts()[0].pages()[0];await p.waitForFunction(()=>!!window.simrailHub);
const result=await p.evaluate(async()=>{
 const app=await window.simrailHub.getAppInfo();
 const r=await window.simrailHub.call('tts:synthesize','Zkouška hlášení. Příští stanice Katovice.','cs_CZ-jirka-medium',1);if(!r.ok)throw Error(r.error);
 const url=URL.createObjectURL(new Blob([r.data],{type:'audio/wav'}));
 try{return await new Promise((resolve,reject)=>{const a=new Audio(url);a.volume=.3;const timer=setTimeout(()=>reject(Error('Playback timeout')),15000);a.onended=()=>{clearTimeout(timer);resolve({app,ended:true,duration:a.duration});};a.onerror=()=>{clearTimeout(timer);reject(Error(a.error?.message??'Playback failed'));};void a.play().catch(reject);});}finally{URL.revokeObjectURL(url);}
});
console.log(result);await writeFile('docs/verification/release-audio-results.json',JSON.stringify(result,null,2));
try{await(await b.newBrowserCDPSession()).send('Browser.close');}catch{}
