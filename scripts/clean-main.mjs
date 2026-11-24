import {rmSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
const project=resolve(import.meta.dirname,'..'),output=join(project,'dist-electron');
if(dirname(output)!==project||basename(output)!=='dist-electron')throw Error('Unexpected generated output path');
// Generated JavaScript only: never AppData, sources, recordings or installed application files.
rmSync(output,{recursive:true,force:true});
