import {_electron as electron} from '@playwright/test';
import {resolve} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const packaged=process.argv[2],profile=resolve('.test-user-railway-redesign');
const app=await electron.launch({executablePath:resolve(packaged??'node_modules/electron/dist/electron.exe'),args:[...(packaged?[]:['.']),'--docs-fixtures','--verify-hidden','--size=1600x1050','--user-data-dir='+profile],env});
const result={at:new Date().toISOString(),controlledData:true,errors:[],pages:[],overflows:[]};
try{
 const p=await app.firstWindow();p.setDefaultTimeout(25000);p.on('pageerror',e=>result.errors.push(e.stack??e.message));await p.waitForFunction(()=>!!window.simrailHub);await p.emulateMedia({reducedMotion:'reduce'});
 if(packaged){const identity=await p.evaluate(()=>window.simrailHub.getAppInfo());if(identity.channel!=='test')throw Error('Refusing non-TEST packaged app');result.packagedIdentity=identity;}
 if(packaged)await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].showInactive());
 await app.evaluate(({ipcMain})=>{const h=ipcMain._invokeHandlers.get('app:info');ipcMain.removeHandler('app:info');ipcMain.handle('app:info',async(...args)=>({...await h(...args),channel:'test'}));});
 await p.evaluate(()=>localStorage.removeItem('simrail:shift:v1'));await p.reload();
 await p.locator('.railway-shell').waitFor();await mkdir('.deployment/railway-preview',{recursive:true});
 const nav=p.getByRole('navigation',{name:'Hlavní navigace'});
 const pages=['Domů','Online servery','Živá mapa','Palubní počítač','Směna','Historie a oblíbené','Dostupná DLC','Rozšíření launcheru','Nastavení'];
 for(let i=0;i<pages.length;i++){
  await nav.getByRole('button',{name:pages[i],exact:true}).click();
  if(pages[i]==='Palubní počítač'){await p.getByRole('button',{name:'DEMO',exact:true}).click();await p.locator('.journey-panel-v3').waitFor();}
  await p.waitForTimeout(500);
  const overflow=await p.locator('main').evaluate(n=>({width:n.clientWidth,scroll:n.scrollWidth}));if(overflow.scroll>overflow.width+3)result.overflows.push({page:pages[i],...overflow});
  await p.screenshot({path:'.deployment/railway-preview/'+String(i+1).padStart(2,'0')+'.png'});result.pages.push(pages[i]);
 }
 await p.getByRole('button',{name:'Hlášení',exact:true}).click();await p.getByText('Uvítání po odjezdu',{exact:true}).waitFor();result.serviceOptions=true;
 // Language modal must close using both Escape and X, with controls still usable.
 const lang=p.getByRole('button',{name:'Vybrat jazyk aplikace'}).first();await lang.click();await p.getByRole('heading',{name:'Vyber si jazyk.'}).waitFor();await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));await lang.click();await p.getByRole('dialog').getByRole('button',{name:'Zavřít',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));result.languageClosable=true;
 await nav.getByRole('button',{name:'Domů',exact:true}).click();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1050,900));await p.waitForTimeout(400);await p.screenshot({path:'.deployment/railway-preview/narrow-home.png'});const narrow=await p.locator('main').evaluate(n=>n.scrollWidth<=n.clientWidth+3);if(!narrow)throw Error('Narrow home overflows');result.narrowHome=true;
 for(const name of pages){await nav.getByRole('button',{name,exact:true}).click();await p.waitForTimeout(150);const dimensions=await p.locator('main').evaluate(n=>({client:n.clientWidth,scroll:n.scrollWidth}));if(dimensions.scroll>dimensions.client+3)throw Error('Narrow overflow '+name+' '+JSON.stringify(dimensions));}result.allPagesNarrow=true;
 await nav.getByRole('button',{name:'Směna',exact:true}).click();
 await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('shift:plan');ipcMain.handle('shift:plan',(_,server,request)=>({ok:true,data:{schema:1,server,generatedAt:Date.now(),serverSod:36000,end:43200,request,notes:['Kontrolovaná data pro zkoušku rozhraní.'],legs:[{id:'a',number:'53103',runId:'controlled-a',from:'Warszawa Wschodnia',to:'Warszawa Zachodnia',departure:37000,arrival:38000,takeoverArrival:36900,vehicle:'EU07',requiredDlc:[],availability:'future',sameConsist:false}]}}));});
 await p.getByRole('button',{name:'Navrhnout směnu',exact:true}).click();await p.getByRole('button',{name:'Ověřit a sledovat',exact:true}).waitFor();result.shiftPlanDisplayed=true;await p.reload();await nav.getByRole('button',{name:'Směna',exact:true}).click();await p.getByRole('button',{name:'Ověřit a sledovat',exact:true}).waitFor();result.shiftPersisted=true;await p.getByRole('button',{name:'Ukončit směnu',exact:true}).click();

 if(result.errors.length||result.overflows.length)throw Error(JSON.stringify({errors:result.errors,overflows:result.overflows}));
 await writeFile('docs/verification/railway-redesign-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
