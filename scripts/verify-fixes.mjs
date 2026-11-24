import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const electron=await chromium.connectOverCDP('http://127.0.0.1:9222');const page=electron.contexts()[0].pages()[0];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.waitForFunction(()=>!!window.simrailHub);
const audio=await page.evaluate(async()=>{
 const result=await window.simrailHub.call('tts:synthesize','Zkouška hlášení. Příští stanice Katovice.','cs_CZ-jirka-medium',1);
 if(!result.ok)throw Error(result.error);
 const url=URL.createObjectURL(new Blob([result.data],{type:'audio/wav'}));
 try{return await new Promise((resolve,reject)=>{const a=new Audio(url);a.volume=.5;const timeout=setTimeout(()=>reject(Error('Audio timeout')),20000);a.onended=()=>{clearTimeout(timeout);resolve({ended:true,duration:a.duration,bytes:result.data.byteLength});};a.onerror=()=>{clearTimeout(timeout);reject(Error('Audio error '+a.error?.message));};void a.play().catch(reject);});}finally{URL.revokeObjectURL(url);}
});
const live=await page.evaluate(async()=>{const r=await window.simrailHub.call('trains:list','cz1');if(!r.ok)throw Error(r.error);return {passenger:r.data.trains.find(t=>t.vehicles?.some(v=>v.startsWith('EN57/')))?.number,freight:r.data.trains.find(t=>t.vehicles?.some(v=>v.startsWith('412W/')))?.number};});
const paired=await page.evaluate(async number=>{const r=await window.simrailHub.call('mobile:start','cz1',number);if(!r.ok)throw Error(r.error);const second=await window.simrailHub.call('mobile:start','cz1',number);return {url:r.data.urls[0],stable:r.data.urls[0]===second.data.urls[0]};},live.passenger);
const mobile=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const phone=await mobile.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await phone.route('http://scanner.invalid/',route=>route.fulfill({contentType:'text/html',body:'<a id="scan" href="'+paired.url+'">Otevřít QR</a>'}));
await phone.goto('http://scanner.invalid/');await phone.locator('#scan').click();
await phone.waitForFunction(()=>document.querySelector('#connection')?.textContent==='Online',{},{timeout:45000});
const mobileResult={online:true,tokenRemoved:!phone.url().includes('pair='),stable:paired.stable,cookie:(await phone.context().cookies()).some(c=>c.name==='hub'&&c.sameSite==='Lax')};
await phone.screenshot({path:'docs/verification/qr-fixed-mobile.png'});await mobile.close();
await page.getByRole('button',{name:'Palubní počítač',exact:true}).click();
await page.getByLabel('Vlak',{exact:true}).selectOption(live.freight);await page.getByText('Nákladní vlak · hlášení pro cestující jsou vypnutá.',{exact:true}).waitFor();
const freight={hiddenControls:await page.getByRole('button',{name:'Příští stanice',exact:true}).count()===0};
await page.screenshot({path:'docs/verification/freight-no-announcements.png'});
await page.getByLabel('Vlak',{exact:true}).selectOption(live.passenger);await page.getByRole('button',{name:'Příští stanice',exact:true}).waitFor();
const result={audio,mobile:mobileResult,freight,passengerControlsRestored:true,errors};
await writeFile('docs/verification/fixes-results.json',JSON.stringify(result,null,2));console.log(result);
await page.evaluate(()=>window.simrailHub.call('mobile:stop'));await electron.close();
if(errors.length||!paired.stable)process.exitCode=1;
