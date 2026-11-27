const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TOKEN=/^[a-f0-9]{64}$/;
const DAY=86400000;
const RESPONSE_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const ALLOWED={
 'drive-start':['Trasa','Začátek řízení','Místo','Server','Součást směny'],
 'drive-end':['Trasa','Začátek řízení','Konec řízení','Místo','Doba evidence','Server','Zpoždění – odhad z launcheru','Poznámka'],
 'shift-start':['Doprava','Server','Plánovaný konec','Plánované jízdy','Přestávka'],
 'shift-break':['Vlak','Místo pozorovaného příjezdu','Stav','Zdroj','Server'],
 'shift-arrival':['Vlak','Místo pozorovaného příjezdu','Stav','Zdroj','Server'],
 'shift-ready':['Místo','Další krok','Server'],
 'shift-end':['Doprava','Server','Pozorované dokončené jízdy','Doba evidence','Vlaky']
};
const SUFFIX={
 'drive-start':/^.{1,180} právě převzal vlak \d{1,12}$/u,
 'drive-end':/^.{1,180} ukončil řízení vlaku \d{1,12}$/u,
 'shift-start':/^.{1,180} zahájil směnu$/u,
 'shift-break':/^.{1,180} zahájil přestávku ve směně$/u,
 'shift-arrival':/^.{1,180} dorazil do cíle poslední plánované jízdy$/u,
 'shift-ready':/^.{1,180} má konec přestávky$/u,
 'shift-end':/^.{1,180} (dokončil|ukončil) směnu$/u
};
class HttpError extends Error{constructor(status,message,retryAfter=0){super(message);this.status=status;this.retryAfter=retryAfter;}}
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...RESPONSE_HEADERS,...extra}});
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const hmac=async(secret,value)=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));};
async function body(req,max=16000){if(!req.headers.get('content-type')?.startsWith('application/json'))throw new HttpError(415,'Je vyžadován JSON.');const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Chybí zadání.');const chunks=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>max){await reader.cancel();throw new HttpError(413,'Zadání je příliš velké.');}chunks.push(r.value);}}finally{reader.releaseLock();}const out=new Uint8Array(size);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}try{const data=JSON.parse(new TextDecoder().decode(out));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw new HttpError(400,'Neplatný JSON.');}}
async function quota(db,key,limit,window,now){const expires=(Math.floor(now/window)+1)*window;const row=await db.prepare('INSERT INTO rates(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=excluded.expires WHERE expires<=? OR count<? RETURNING count').bind(key,expires,now,now,limit).first();if(!row)throw new HttpError(429,'Limit oznámení byl dosažen. Zkus to později.',expires-now);}
export function validateEvent(q,now){
 if(!UUID.test(q.eventId??'')||!(Object.hasOwn(ALLOWED,q.kind)||q.kind==='connection-test')||!Number.isSafeInteger(q.revision)||q.revision<0||q.revision>100)throw new HttpError(400,'Neplatná událost.');
 if(q.kind==='connection-test')return {allowed_mentions:{parse:[]},embeds:[{title:'Zkouška propojení · SimRail Hub 0.8.1',description:'Ověření veřejného odesílání na komunitní Discord. Nejde o převzetí vlaku ani o skutečnou jízdu.',color:0x87cdec,timestamp:new Date(now).toISOString(),footer:{text:'SimRail Hub · technická zkouška spojení'}}]};
 const input=q.payload;if(!input||Object.keys(input).some(k=>!['allowed_mentions','embeds'].includes(k))||!Array.isArray(input.embeds)||input.embeds.length!==1)throw new HttpError(400,'Neplatný formát oznámení.');
 const e=input.embeds[0];if(typeof e.title!=='string'||e.title.length>256||!SUFFIX[q.kind].test(e.title)||/[\r\n\x00-\x1f]/.test(e.title)||Object.keys(e).some(k=>!['title','fields','color','timestamp','footer'].includes(k)))throw new HttpError(400,'Neplatný obsah oznámení.');
 if(!Array.isArray(e.fields)||e.fields.length<2||e.fields.length>8)throw new HttpError(400,'Neplatné údaje jízdy.');let length=e.title.length;const names=new Set();
 const fields=e.fields.map(f=>{if(!f||!ALLOWED[q.kind].includes(f.name)||names.has(f.name)||typeof f.value!=='string'||!f.value.length||f.value.length>1024||/[\x00-\x1f\x7f]/.test(f.value))throw new HttpError(400,'Neplatný údaj jízdy.');names.add(f.name);length+=f.value.length;return {name:f.name,value:f.value.replace(/@/g,'@\u200b'),inline:false};});
 if(length>4500||!names.has('Server'))throw new HttpError(400,'Chybí server nebo jsou údaje příliš dlouhé.');
 const server=fields.find(f=>f.name==='Server').value;if(!/^[\w-]{1,40}$/.test(server))throw new HttpError(400,'Neplatný server.');
 return {allowed_mentions:{parse:[]},embeds:[{title:e.title.replace(/@/g,'@\u200b'),fields,color:q.kind.startsWith('shift')?0xbba1ec:0x87cdec,timestamp:new Date(now).toISOString(),footer:{text:'SimRail Hub · komunitní evidence · potvrzeno uživatelem, účet Steamu neověřen'}}]};
}
const activationJs=`const code=new URL(location.href).searchParams.get('code');const status=document.getElementById('status');window.onTurnstileReady=()=>{if(!code||!/^[a-f0-9-]{36}$/i.test(code)){status.textContent='Odkaz není platný. Otevři ověření z launcheru.';return;}turnstile.render('#challenge',{sitekey:document.body.dataset.sitekey,action:'simrail-connect',cData:code,callback:async token=>{status.textContent='Potvrzuji propojení…';try{const r=await fetch('/v1/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,token})});const data=await r.json();if(!r.ok)throw Error(data.error||'Ověření se nepodařilo.');status.textContent='Hotovo. Vrať se do launcheru a potvrď převzetí vlaku. Tuto záložku můžeš zavřít.';}catch(e){status.textContent=e.message;turnstile.reset();}}});};`;
function activationPage(sitekey){return new Response(`<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SimRail Hub · Propojení Discordu</title><style>body{margin:0;background:#0a131b;color:#eaf4fa;font:16px system-ui;min-height:100vh;display:grid;place-items:center}main{max-width:520px;margin:24px;padding:32px;border:1px solid #547c94;border-radius:16px;background:#142733}h1{font-size:28px}p{line-height:1.7;color:#b7d0df}small{display:block;color:#92b1c2;margin-top:26px}#status{color:#b5e7f7}</style><body data-sitekey="${sitekey}"><main><span>SIMRAIL HUB · KOMUNITNÍ DISCORD</span><h1>Potvrď propojení launcheru.</h1><p>Jednorázové ověření chrání společný Discord před automatickým spamem. Žádný účet Steamu ani Discordu se tím nepřihlašuje.</p><div id="challenge"></div><p id="status">Probíhá ověření…</p><small>Zprávy o převzetí a ukončení jízdy se odešlou až po tvém potvrzení v launcheru. Ověření není záznamem jízdy.</small></main><script src="/activate.js"></script><script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady&render=explicit" async defer></script></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Content-Type-Options':'nosniff'}});}
export async function handle(req,env,deps={}){
 const now=deps.now?.()??Date.now(),fetcher=deps.fetch??fetch,db=env.DB,u=new URL(req.url);
 try{
  if(req.method==='GET'&&u.pathname==='/health'){const schema=await db.prepare("SELECT value FROM meta WHERE key='schema'").first();const ready=schema?.value==='1'&&!!env.DISCORD_WEBHOOK&&!!env.TURNSTILE_SECRET&&!!env.SIGNING_SECRET&&!!env.TURNSTILE_SITEKEY;if(req.headers.get('Authorization')==='Bearer '+env.SIGNING_SECRET){try{const target=new URL(env.DISCORD_WEBHOOK);const response=await fetcher(target,{redirect:'manual',signal:AbortSignal.timeout(10000)});const info=await response.json();return json({ready,networkStatus:response.status,validWebhookReply:typeof info.id==='string'});}catch(error){return json({ready,networkError:error?.name??'unknown',classification:['Illegal invocation','AbortSignal','timeout','URL','redirect','context'].find(term=>String(error?.message??'').toLowerCase().includes(term.toLowerCase()))??'unspecified'});}}return json({service:'simrail-hub-community',version:1,ready},ready?200:503);}
  if(req.method==='GET'&&u.pathname==='/activate')return activationPage(env.TURNSTILE_SITEKEY??'');
  if(req.method==='GET'&&u.pathname==='/activate.js')return new Response(activationJs,{headers:{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff'}});
  if(req.method!=='POST'||!['/v1/register','/v1/register-status','/v1/activate','/v1/events'].includes(u.pathname))throw new HttpError(404,'Nenalezeno.');
  if(!env.SIGNING_SECRET||!env.DISCORD_WEBHOOK||!env.TURNSTILE_SECRET)throw new HttpError(503,'Komunitní propojení není připravené.');
  const ip=req.headers.get('CF-Connecting-IP')??'unknown',ipHash=await hmac(env.SIGNING_SECRET,'ip:'+ip);await quota(db,'request:'+ipHash,120,60000,now);const q=await body(req);
  if(u.pathname==='/v1/register'){
   if(!UUID.test(q.clientId??''))throw new HttpError(400,'Neplatné zařízení.');await quota(db,'register:'+ipHash,10,3600000,now);await quota(db,'register-global',300,DAY,now);
   const code=crypto.randomUUID(),pollSecret=random();await db.prepare('INSERT INTO enrollments(code,client,poll_hash,expires) VALUES (?,?,?,?)').bind(code,q.clientId,await digest(pollSecret),now+600000).run();return json({code,pollSecret,activationUrl:u.origin+'/activate?code='+code});
  }
  if(u.pathname==='/v1/activate'){
   if(!UUID.test(q.code??'')||typeof q.token!=='string'||!q.token.length||q.token.length>2048)throw new HttpError(400,'Neplatné ověření.');await quota(db,'activate:'+ipHash,15,600000,now);
   const row=await db.prepare('SELECT * FROM enrollments WHERE code=? AND expires>?').bind(q.code,now).first();if(!row)throw new HttpError(410,'Ověření vypršelo. Otevři nové v launcheru.');if(row.approved)return json({ok:true});
   const r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:q.token,remoteip:ip,idempotency_key:q.code}),signal:AbortSignal.timeout(10000)});const verified=await r.json();if(!r.ok||!verified.success||verified.hostname!==u.hostname||verified.action!=='simrail-connect'||verified.cdata!==q.code)throw new HttpError(403,'Ověření se nepodařilo. Zkus to znovu.');await db.prepare('UPDATE enrollments SET approved=? WHERE code=? AND approved IS NULL AND expires>?').bind(now,q.code,now).run();return json({ok:true});
  }
  if(u.pathname==='/v1/register-status'){
   if(!UUID.test(q.code??'')||!TOKEN.test(q.pollSecret??''))throw new HttpError(400,'Neplatné ověření.');const row=await db.prepare('SELECT * FROM enrollments WHERE code=? AND poll_hash=? AND expires>?').bind(q.code,await digest(q.pollSecret),now).first();if(!row)throw new HttpError(410,'Ověření vypršelo.');if(!row.approved)return json({state:'pending'});
   const expires=row.approved+30*DAY,token=await hmac(env.SIGNING_SECRET,'device:'+row.client+':'+q.code+':'+expires);await db.prepare('INSERT INTO devices(client,token_hash,expires) VALUES (?,?,?) ON CONFLICT(client) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires').bind(row.client,await digest(token),expires).run();return json({state:'ready',token,expires});
  }
  const client=req.headers.get('X-SimRail-Client'),token=req.headers.get('Authorization')?.replace(/^Bearer /,'');if(!UUID.test(client??'')||!TOKEN.test(token??''))throw new HttpError(401,'Nejdřív ověř propojení Discordu v launcheru.');const device=await db.prepare('SELECT client FROM devices WHERE client=? AND token_hash=? AND expires>?').bind(client,await digest(token),now).first();if(!device)throw new HttpError(401,'Propojení vypršelo. Ověř ho znovu.');
  const payload=validateEvent(q,now),eventHash=await digest(JSON.stringify(q.payload)),id=client+':'+q.eventId+':'+q.revision;
  let existing=await db.prepare('SELECT * FROM events WHERE id=?').bind(id).first();
  if(existing){if(existing.hash!==eventHash)throw new HttpError(409,'Událost má jiný obsah.');if(existing.state==='sent')return json({kind:'sent',messageId:existing.message_id});if(existing.state==='retry'&&existing.retry_at>now)return json({kind:'failed',error:existing.error,retryAfterMs:existing.retry_at-now},429);if(existing.state!=='retry')return json({kind:'unknown',error:'Tato zpráva už byla zpracována bez jistého potvrzení. Ověř Discord před opakováním.'},202);}
  if(q.kind==='connection-test')await quota(db,'test-device:'+client,1,DAY,now);
  await quota(db,'events:'+ipHash,12,60000,now);await quota(db,'events-device:'+client,30,3600000,now);await quota(db,'events-global-minute',60,60000,now);await quota(db,'events-global-day',1000,DAY,now);
  const claimed=existing?await db.prepare("UPDATE events SET state='sending' WHERE id=? AND state='retry' AND retry_at<=? RETURNING id").bind(id,now).first():await db.prepare("INSERT OR IGNORE INTO events(id,client,hash,kind,state,created) VALUES (?,?,?,?,'sending',?) RETURNING id").bind(id,client,eventHash,q.kind,now).first();if(!claimed)return json({kind:'unknown',error:'Událost se právě zpracovává. Ověř doručení na Discordu.'},202);
  let outcome;try{const target=new URL(env.DISCORD_WEBHOOK);if(target.protocol!=='https:'||target.hostname!=='discord.com'||!/^\/api\/webhooks\/\d+\/[\w-]+$/.test(target.pathname))throw Error('config');target.searchParams.set('wait','true');const r=await fetcher(target,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
   if(r.ok){const ack=await r.json();outcome=/^\d+$/.test(ack.id??'')?{kind:'sent',messageId:ack.id}:{kind:'unknown',error:'Discord neposkytl potvrzení. Ověř doručení.'};}
   else if(r.status===429){let seconds=30;try{const b=await r.json();if(Number.isFinite(b.retry_after))seconds=b.retry_after;}catch{}outcome={kind:'failed',error:'Discord omezuje rychlost odesílání.',retryAfterMs:Math.max(1000,Math.min(3600000,seconds*1000))};}
   else outcome={kind:r.status>=500?'unknown':'failed',error:'Discord nepotvrdil oznámení. Ověř doručení před opakováním.'};
  }catch{outcome={kind:'unknown',error:'Spojení skončilo bez potvrzení. Ověř zprávu na Discordu.'};}
  await db.prepare('UPDATE events SET state=?,message_id=?,retry_at=?,error=? WHERE id=?').bind(outcome.kind==='sent'?'sent':outcome.retryAfterMs?'retry':'unknown',outcome.messageId??null,outcome.retryAfterMs?now+outcome.retryAfterMs:null,outcome.error??null,id).run();return json(outcome,outcome.retryAfterMs?429:outcome.kind==='sent'?200:202);
 }catch(e){if(e instanceof HttpError)return json({error:e.message,retryAfterMs:e.retryAfter||undefined},e.status,e.retryAfter?{'Retry-After':String(Math.ceil(e.retryAfter/1000))}:{});return json({error:'Komunitní služba je dočasně nedostupná. Zkus to později.'},503);}
}
export default {fetch:handle,async scheduled(_event,env){const now=Date.now();await env.DB.batch([env.DB.prepare('DELETE FROM rates WHERE expires<?').bind(now-DAY),env.DB.prepare('DELETE FROM enrollments WHERE expires<?').bind(now-DAY),env.DB.prepare('DELETE FROM devices WHERE expires<?').bind(now),env.DB.prepare('DELETE FROM events WHERE created<?').bind(now-14*DAY)]);}};
