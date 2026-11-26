import {join} from 'node:path';
import * as asar from '@electron/asar';import {readFile,writeFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const file=process.argv[2]??'.deployment/dispatcher-pulse-final/win-unpacked/resources/app.asar',pkg=JSON.parse(asar.extractFile(file,'package.json').toString()),files=asar.listPackage(file);
if(pkg.version!=='0.7.0'||pkg.hubChannel!=='test'||!pkg.hubBuildId)throw Error('TEST identity missing');
if(files.some(p=>/\.(wav|mp3|m4a)$/i.test(p)||/CloudAccount|cloudConfig/.test(p)))throw Error('Private audio or removed cloud code bundled');
const entries=(await readdir('dist/assets')).filter(n=>/\.(js|css)$/.test(n));for(const name of entries){const built=await readFile('dist/assets/'+name),packed=asar.extractFile(file,join('dist','assets',name));if(!built.equals(packed))throw Error('Stale renderer '+name);}
const recordings=await readFile('dist-electron/services/localAudio.js');if(!recordings.equals(asar.extractFile(file,join('dist-electron','services','localAudio.js'))))throw Error('Stale recording support');
const main=await readFile('dist-electron/main/callIpc.js');if(!main.equals(asar.extractFile(file,join('dist-electron','main','callIpc.js'))))throw Error('Stale audio IPC');
const result={at:new Date().toISOString(),version:pkg.version,channel:pkg.hubChannel,buildId:pkg.hubBuildId,privateAudioBundled:false,cloudCodeBundled:false,rendererMatchesFinalBuild:true,audioIpcMatchesFinalBuild:true,recordingSupportMatchesFinalBuild:true};await writeFile('docs/verification/dispatcher-distribution.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
