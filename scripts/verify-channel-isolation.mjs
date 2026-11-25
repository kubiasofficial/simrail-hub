import {resolve} from 'node:path';

import {_electron as electron} from '@playwright/test';import {writeFile} from 'node:fs/promises';
const env={...process.env,PORTABLE_EXECUTABLE_FILE:'verification-portable'};delete env.ELECTRON_RUN_AS_NODE;
let stable,test;
const result={at:new Date().toISOString()};
try{
 stable=await electron.launch({executablePath:process.argv[2]??'.deployment/oprava-zpozdeni/win-unpacked/SimRail Hub.exe',args:['--verify-hidden','--user-data-dir='+resolve('.test-user-channel-stable')],env});
 const a=await stable.firstWindow();await a.waitForFunction(()=>!!window.simrailHub);
 test=await electron.launch({executablePath:process.argv[3]??'.deployment/test-launcher/win-unpacked/SimRail Hub TEST.exe',args:['--verify-hidden','--user-data-dir='+resolve('.test-user-channel-test')],env});
 const b=await test.firstWindow();await b.waitForFunction(()=>!!window.simrailHub);
 const baseline=await a.evaluate(()=>window.simrailHub.call('settings:get'));
 await b.evaluate(()=>window.simrailHub.call('settings:update',{appLanguage:'pl',onboarding:{dismissed:true},announcements:{auto:false}}));
 const untouched=await a.evaluate(()=>window.simrailHub.call('settings:get'));
 if(untouched.appLanguage!==baseline.appLanguage)throw Error('Test wrote stable preferences');
 await a.evaluate(()=>window.simrailHub.call('settings:update',{appLanguage:'de',onboarding:{dismissed:true},announcements:{auto:false}}));
 if((await b.evaluate(()=>window.simrailHub.call('settings:get'))).appLanguage!=='pl')throw Error('Stable wrote test preferences');
 await Promise.all([a.evaluate(()=>window.simrailHub.call('settings:update',{appLanguage:'cs'})),b.evaluate(()=>window.simrailHub.call('settings:update',{appLanguage:'cs'}))]);
 result.stable={info:await a.evaluate(()=>window.simrailHub.getAppInfo()),diag:await a.evaluate(()=>window.simrailHub.call('diag:info')),name:await stable.evaluate(({app})=>app.getName())};
 result.test={info:await b.evaluate(()=>window.simrailHub.getAppInfo()),diag:await b.evaluate(()=>window.simrailHub.call('diag:info')),name:await test.evaluate(({app})=>app.getName()),title:await test.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle())};
 if(result.test.info.channel!=='test'||result.test.name!=='SimRail Hub TEST'||result.test.title!=='SimRail Hub TEST')throw Error('Test identity missing');
 if(result.stable.diag.dbFile===result.test.diag.dbFile||result.stable.diag.userData===result.test.diag.userData)throw Error('Profiles shared');
 result.test.updates=await b.evaluate(async()=>({automatic:await window.simrailHub.call('update:auto-check'),legacy:await window.simrailHub.call('update:check'),install:await window.simrailHub.call('update:install')}));
 if(result.test.updates.automatic.status!=='manual'||result.test.updates.legacy.status!=='unconfigured'||result.test.updates.install)throw Error('Public updater enabled in test');
 await b.reload();await b.locator('.test-channel-badge').waitFor();await b.locator('.test-build-info').waitFor();
 result.test.installStableLink=await b.getByRole('link',{name:'Získat instalační verzi'}).count();if(result.test.installStableLink)throw Error('Stable installer offered in TEST');
 await b.screenshot({path:'.deployment/test-channel-home.png'});
 result.sideBySide=true;result.settingsIsolated=true;result.normalProfilesUsed=false;result.publicUpdated=false;
 await writeFile('docs/verification/test-channel-isolation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{if(test)await test.close();if(stable)await stable.close();}

