import type {ServerInfo} from '../types/servers';
export function serverFlag(server:Pick<ServerInfo,'code'|'name'>):string|null{
 const prefix=server.code.toLowerCase().match(/^(cz|de|pl|fr|en|es|it|nl|sk|hu|pt)/)?.[1];
 if(prefix)return './assets/flags/'+(prefix==='en'?'gb':prefix)+'.png';
 if(/polski/i.test(server.name))return './assets/flags/pl.png';
 if(/česky|czech/i.test(server.name))return './assets/flags/cz.png';
 return null;
}
