import {LocalRecordings,decodeWav} from '../dist-electron/services/localAudio.js';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=resolve('../hlaseni'),recordings=new LocalRecordings(directory);
const manifest=JSON.parse(await readFile(resolve(directory,'seznam-nahravek-16-61.json'),'utf8'));
const stations=['Grodzisk Mazowiecki','Żyrardów','Skierniewice','Koluszki','Łódź Widzew','Łódź Chojny','Zduńska Wola','Sosnowiec Południowy'];
const result={at:new Date().toISOString(),privateAudioBundled:false,files:[],rendered:0};
for(let i=0;i<manifest.length;i++){
 const b=await readFile(resolve(directory,manifest[i].wav));const samples=decodeWav(b);if(samples.length<4800)throw Error('Empty recording');result.files.push({file:manifest[i].wav,seconds:samples.length/48000});
 for(const number of ['1601','6160','16105','61180'])for(const kind of ['next-station','approaching','arrived']){const bytes=await recordings.render({kind,station:stations[i],trainNumber:number,isFreight:false},false);if(!bytes||decodeWav(bytes).length<samples.length)throw Error('Station not included');result.rendered++;}
}
await writeFile('docs/verification/recordings-16-61.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
