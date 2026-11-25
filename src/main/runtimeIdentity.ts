import {app} from 'electron';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {releaseIdentity} from '../services/releaseChannel';
export const runtimeIdentity=releaseIdentity(app.isPackaged,JSON.parse(readFileSync(join(app.getAppPath(),'package.json'),'utf8')));
