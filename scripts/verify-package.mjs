import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
const page=browser.contexts()[0].pages()[0];
await page.waitForFunction(()=>!!window.simrailHub);
const result=await page.evaluate(async()=>{
 const api=window.simrailHub;
 const [info,servers,stations,trains,board]=await Promise.all([api.getAppInfo(),api.getServers(),api.call('stations:list','cz1'),api.call('trains:list','pl3'),api.call('stations:board','cz1','Katowice')]);
 return {info,servers:servers.ok,stations:stations.ok?stations.data.length:stations.error,
  stationPlayers:stations.ok?stations.data.filter(s=>s.dispatchers?.length).length:0,
  stationAvatars:stations.ok?stations.data.flatMap(s=>s.dispatchers??[]).filter(p=>p.avatarUrl).length:0,
  trainPlayers:trains.ok?trains.data.trains.filter(t=>t.steamId).length:0,
  trainAvatars:trains.ok?trains.data.trains.filter(t=>t.avatarUrl).length:0,
  stationBoard:board.ok?board.data.length:board.error};
});
console.log(result);await writeFile('docs/verification/package-results.json',JSON.stringify(result,null,2));await browser.close();
