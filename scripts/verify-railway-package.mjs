import * as asar from '@electron/asar';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const dir=process.argv[2]??'.deployment/railway-test-final',archive=join(dir,'win-unpacked','resources','app.asar');
const pkg=JSON.parse(asar.extractFile(archive,'package.json').toString()),files=asar.listPackage(archive);
if(pkg.hubChannel!=='test'||typeof pkg.hubBuildId!=='string')throw Error('Wrong package identity');
if(files.some(f=>/\.(wav|m4a|mp3|pem|pfx)$/i.test(f)))throw Error('Private audio or signing credential packaged');
let matched=0;for(const folder of ['dist','dist-electron'])for(const name of await readdir(folder,{recursive:true,withFileTypes:true})){if(!name.isFile())continue;const base=name.parentPath??name.path;const path=join(base,name.name),relative=path.slice(folder.length+1),expected=await readFile(path),actual=asar.extractFile(archive,join(folder,relative));if(!actual.equals(expected))throw Error('Packaged file differs: '+path);matched++;}
const result={at:new Date().toISOString(),identity:{version:pkg.version,channel:pkg.hubChannel,buildId:pkg.hubBuildId},matchedFiles:matched,privateAudioBundled:false,sha256:createHash('sha256').update(await readFile(join(dir,'SimRail-Hub-TEST.exe'))).digest('hex')};
await writeFile('docs/verification/railway-test-package.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
