import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';
import {mkdir,writeFile,readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const profile=resolve('.test-user-update081-to082'),cache=resolve('.deployment/update081-to082-cache');await mkdir(cache,{recursive:true});
const env={...process.env,LOCALAPPDATA:cache};delete env.ELECTRON_RUN_AS_NODE;delete env.PORTABLE_EXECUTABLE_FILE;delete env.PORTABLE_EXECUTABLE_DIR;
const app=await electron.launch({executablePath:resolve('.deployment/release-081-publish/win-unpacked/SimRail Hub.exe'),args:['--verify-hidden','--user-data-dir='+profile],env});
try{
 const p=await app.firstWindow();await p.waitForFunction(()=>!!window.simrailHub);const info=await p.evaluate(()=>window.simrailHub.getAppInfo());if(info.version!=='0.8.1'||info.channel!=='stable')throw Error('Wrong baseline app');const diag=await p.evaluate(()=>window.simrailHub.call('diag:info'));if(resolve(diag.userData)!==profile)throw Error('Refusing real user profile');
 const policy=await app.evaluate(({app})=>{const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');return {autoInstallOnAppQuit:require('electron-updater').autoUpdater.autoInstallOnAppQuit,cacheBase:process.env.LOCALAPPDATA};});if(policy.autoInstallOnAppQuit!==false||resolve(policy.cacheBase)!==cache)throw Error('Unsafe update verification policy');
 const deadline=Date.now()+8*60000;let last='',state;
 while(Date.now()<deadline){state=await p.evaluate(()=>window.simrailHub.call('update:status'));const summary=state.status+':'+(state.version??'')+':'+Math.floor((state.percent??0)/10)*10;if(summary!==last){console.log(summary);last=summary;}if(state.status==='ready'){if(state.version!=='0.8.2')throw Error('Unexpected target version');break;}if(['idle','current','error'].includes(state.status))await p.evaluate(()=>window.simrailHub.call('update:auto-check'));await new Promise(r=>setTimeout(r,3000));}
 if(state?.status!=='ready')throw Error('Update did not reach ready: '+state?.status);
 const manifest=JSON.parse(await readFile('.deployment/publish082-manifest.json','utf8')),expected=manifest.assets.find(a=>a.name==='SimRail-Hub-Setup-0.8.2.exe');
 const files=await readdir(cache,{recursive:true});let matched=null;for(const name of files.filter(n=>n.endsWith('.exe'))){const b=await readFile(resolve(cache,name)),hash=createHash('sha256').update(b).digest('hex');if(hash===expected.sha256)matched={bytes:b.length,sha256:hash};}if(!matched)throw Error('Downloaded installer differs from verified release');
 const result={at:new Date().toISOString(),baseline:info.version,target:state.version,status:state.status,isolatedProfile:true,isolatedCache:true,autoInstallOnAppQuit:false,installationTriggered:false,downloadedInstaller:matched};await writeFile('docs/verification/update081-to082.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
