export function appDocument(url:string,entry:string,devOrigin?:string):boolean{
 try{const u=new URL(url),e=new URL(entry);return devOrigin?u.origin===devOrigin&&u.pathname==='/':u.protocol==='file:'&&u.pathname===e.pathname&&u.host===e.host;}catch{return false;}
}
export function externalHttps(raw:string):boolean{
 try{if(/[\u0000-\u0020]/.test(raw))return false;const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}
}
