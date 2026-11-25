import {resolve} from 'node:path';

import {_electron as electron} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const root=process.argv[2]??'.deployment/oprava-zpozdeni';
const app=await electron.launch({executablePath:root+'/win-unpacked/SimRail Hub.exe',args:['--verify-hidden','--user-data-dir='+resolve('.test-user-delay-preview')],env});
const result={at:new Date().toISOString(),errors:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(60000);p.on('pageerror',e=>result.errors.push(e.message));
 await p.waitForFunction(()=>!!window.simrailHub);
 const live=await p.evaluate(async()=>{
 await window.simrailHub.call('settings:update',{announcements:{auto:false},onboarding:{dismissed:true},appLanguage:'cs'});
 const list=await window.simrailHub.call('trains:list','cz1');if(!list.ok)throw Error(list.error);
 const number=list.data.trains.some(t=>t.number==='71560')?'71560':list.data.trains[0].number;
 const detail=await window.simrailHub.call('trains:detail','cz1',number);if(!detail.ok||!detail.data.timetable?.points.length)throw Error('Missing real timetable');
 localStorage.setItem('simrail:selection:v1',JSON.stringify({mode:'live',server:'cz1',train:number}));
 return {number,points:detail.data.timetable.points.length,notes:detail.data.notes};
 });Object.assign(result,live);await p.reload();
 await p.getByRole('button',{name:'Palubní počítač',exact:true}).first().click();
 await p.locator('.delay-indicator').waitFor();
 result.firstDelay=await p.locator('.delay-indicator').innerText();result.severity=await p.locator('.delay-indicator').getAttribute('data-severity');
 if(/Nedostupné|Nelze určit/.test(result.firstDelay)||!result.firstDelay.includes('odhad')||result.severity!=='unknown')throw Error('Initial estimate missing/overstated: '+result.firstDelay);
 await p.screenshot({path:'.deployment/delay-preview-dashboard.png'});
 const pair=await p.evaluate(async n=>{const r=await window.simrailHub.call('mobile:start','cz1',n);if(!r.ok)throw Error(r.error);return r.data;},result.number);
 const url=new URL(pair.urls[0]);url.hostname='127.0.0.1';const root=await fetch(url);const cookie=root.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Pairing missing');
 const state=await (await fetch(new URL('/api/state',url),{headers:{Cookie:cookie}})).json();
 result.mobileDelay={min:state.model.delayMin,kind:state.model.delayKind};
 if(result.mobileDelay.kind!=='estimate'||result.mobileDelay.min===null)throw Error('Mobile initial estimate missing');
 await p.evaluate(()=>window.simrailHub.call('mobile:stop'));
 if(result.errors.length)throw Error(result.errors.join(';'));
 await writeFile('docs/verification/delay-initial-preview.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}

