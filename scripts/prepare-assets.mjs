import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
for(const name of ['leaflet.js','leaflet.css'])await copyFile(`node_modules/leaflet/dist/${name}`,`public/vendor/${name}`);
