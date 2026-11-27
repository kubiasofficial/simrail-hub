import {chromium} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {MobileServer} from '../dist-electron/services/MobileServer.js';
import {DemoSim} from '../dist-electron/services/demoSim.js';
const base=new DemoSim(0).snapshot(0);let calls=0,clockOffset=0;
const points=[['Outside',false],['Katowice',true],['Technical',false],['Sosnowiec Główny',true],['Sosnowiec Południowy',true]].map(([name,ph],index)=>({name,index,pointId:String(100+index),line:1,arrival:index===1?'11:28':index===3?'12:15':'12:25',departure:index===1?'11:29':index===3?'12:17':'12:27',isStop:ph,stopType:ph?'CommercialStop':'NoStopOver',km:index,maxSpeed:100,platform:null,track:null}));
const stations=[{name:'Katowice',prefix:'KO',lat:50.25686264038086,lon:19.01921844482422},{name:'Sosnowiec Główny',prefix:'SG',lat:50.27600860595703,lon:19.120859146118164},{name:'Sosnowiec Południowy',prefix:'Spł1',lat:50.27341079711914,lon:19.121028900146484}];
const now=()=>Date.now()+clockOffset;
const tracking={getDetail:async()=>({ok:true,data:{train:{...base.train,id:'mobile-qa',runId:'mobile-qa',number:'23901',name:'R',startStation:'Katowice',endStation:'Sosnowiec Południowy',lat:stations[0].lat,lon:stations[0].lon,speedKmh:0,timetableIndex:++calls===1?1:2},timetable:{trainNumber:'23901',runId:'mobile-qa',startStation:'Katowice',endStation:'Sosnowiec Południowy',points},stations,serverSod:43200,fetchedAt:now(),notes:[]}})};
const route={trainNumber:'23901',runId:'mobile-qa',sections:[{fromIndex:1,toIndex:3,coordinates:[[50.25686,19.01921],[50.268,19.063],[50.2791423,19.1262529]]}],stops:[],totalPoints:5,matchedPoints:3,missingSections:0,sourceDate:'2026-11-28',first:1,last:3};
const server=new MobileServer(tracking,resolve('public'),()=>({wifi:[{address:'192.168.1.2',family:'IPv4',internal:false}]}),now,async()=>route,{version:'0.8.3',channel:'test',buildId:'mobile-station-fix'});
let browser;const results={at:new Date().toISOString(),source:'controlled real HTTP MobileServer + browser, no actual game drive',phoneClockOffsetHours:18,clockSkewSafe:false,sharedTimes:false,criticalDelay:false,reconnect:false,unlockRecovery:false,oldResponseIgnored:false,narrowAndLandscape:false,expiryStopsPolling:false,errors:[]};
try{
 const pair=await server.start('cz1','23901'),url=new URL(pair.urls[0]);url.hostname='127.0.0.1';browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});p.setDefaultTimeout(15000);p.on('pageerror',e=>results.errors.push(e.message));
 await p.addInitScript(()=>{const realNow=Date.now.bind(Date);Date.now=()=>realNow()+18*3600000;});
 let fail=false,hold=false,release,held=false,stateRequests=0;
 await p.route('**/api/state',async r=>{stateRequests++;if(fail){await r.fulfill({status:503,contentType:'application/json',body:'{}'});return;}if(hold){hold=false;const response=await r.fetch(),data=await response.json();data.model.next='OLD RESPONSE MUST NOT WIN';held=true;await new Promise(r=>release=r);await r.fulfill({response,body:JSON.stringify(data)}).catch(()=>undefined);return;}await r.continue();});
 await p.goto(url.href);await p.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='live');if(p.url().includes('pair='))throw Error('Token in URL');results.clockSkewSafe=true;
 await p.waitForFunction(()=>document.querySelector('#arrival')?.textContent==='12:15');results.sharedTimes=true;
 clockOffset+=6000;await p.getByRole('button',{name:'Obnovit připojení',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#delay')?.textContent==='+31 min');
 if(await p.locator('#arrival').textContent()!=='12:46'||await p.locator('#departure').textContent()!=='12:48')throw Error('Estimated clocks differ');results.criticalDelay=true;
 await mkdir('.deployment/mobile-station-fix',{recursive:true});await p.screenshot({path:'.deployment/mobile-station-fix/phone-portrait.png',fullPage:true});
 fail=true;await p.getByRole('button',{name:'Obnovit připojení',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='lost');fail=false;await p.waitForTimeout(350);await p.evaluate(()=>window.dispatchEvent(new Event('online')));await p.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='live');results.reconnect=true;
 hold=true;await p.getByRole('button',{name:'Obnovit připojení',exact:true}).click();for(let i=0;i<50&&!held;i++)await p.waitForTimeout(40);if(!held)throw Error('No held request');
 await p.evaluate(()=>{window.qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.qaHidden});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(350);
 await p.evaluate(()=>{window.qaHidden=false;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='live');results.unlockRecovery=true;
 release();await p.waitForTimeout(300);if(await p.locator('#next').textContent()!=='Sosnowiec Główny')throw Error('Old response overwrote fresh data');results.oldResponseIgnored=true;
 for(const viewport of [{width:320,height:740},{width:844,height:390}]){await p.setViewportSize(viewport);for(const name of ['Jízdní řád','Mapa','Přehled']){await p.getByRole('button',{name,exact:true}).click();await p.waitForTimeout(300);if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Horizontal overflow '+name+' '+viewport.width);}}
 results.narrowAndLandscape=true;await p.setViewportSize({width:844,height:390});await p.getByRole('button',{name:'Přehled',exact:true}).click();await p.screenshot({path:'.deployment/mobile-station-fix/phone-landscape.png',fullPage:true});
 await p.emulateMedia({reducedMotion:'reduce'});if(await p.locator('#delay-card').evaluate(n=>getComputedStyle(n).animationName)!=='none')throw Error('Reduced motion ignored');
 clockOffset+=13*3600000;await p.getByRole('button',{name:'Obnovit připojení',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#connection')?.textContent?.includes('vypršelo'));const before=stateRequests;await p.waitForTimeout(5500);if(stateRequests!==before)throw Error('Expired page still polls');results.expiryStopsPolling=true;
 if(results.errors.length)throw Error(results.errors.join(';'));await writeFile('docs/verification/mobile-station-fix-browser.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser?.close();server.stop();}
