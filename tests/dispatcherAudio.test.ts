import {it,expect} from 'vitest';import {AnnouncementQueue} from '../src/services/announcementQueue';import {radioSamples,gongSamples,decodeWav,encodeWav} from '../src/services/localAudio';import {normalizeSettings} from '../src/services/settingsSchema';
const tick=()=>new Promise(r=>setTimeout(r,0));
it('frames a bilingual announcement once and gives radio precedence without overlapping speech',async()=>{
 const log:string[]=[];let release!:()=>void;let first=true;
 const q=new AnnouncementQueue(async seg=>{log.push(seg.text);if(first){first=false;await new Promise<void>(r=>release=r);}},Date.now,undefined,{before:async i=>{log.push(i.channel==='dispatcher'?'radio-open':'gong-open');},after:async i=>{log.push(i.channel==='dispatcher'?'radio-close':'gong-close');}});
 q.enqueue({key:'a',kind:'next-station',segments:[{lang:'cs',text:'CS'},{lang:'pl',text:'PL'}]});await tick();q.enqueue({key:'b',kind:'arrived',automatic:true,segments:[{lang:'cs',text:'arrival'}]});q.enqueue({key:'r',kind:'delay',automatic:true,channel:'dispatcher',segments:[{lang:'cs',text:'dispatch'}]});expect(log).toEqual(['gong-open','CS']);release();await tick();await tick();expect(log).toEqual(['gong-open','CS','PL','gong-close','radio-open','dispatch','radio-close','gong-open','arrival','gong-close']);
});
it('skips invalid queued radio messages and no outro sounds after stop',async()=>{
 const log:string[]=[];let release!:()=>void;const q=new AnnouncementQueue(async s=>{log.push(s.text);await new Promise<void>(r=>release=r);},Date.now,undefined,{after:async()=>{log.push('outro');}});
 q.enqueue({key:'a',kind:'delay',segments:[{lang:'cs',text:'voice'}]});await tick();q.enqueue({key:'r',kind:'delay',channel:'dispatcher',valid:()=>false,segments:[{lang:'cs',text:'stale'}]});q.clear();release();await tick();expect(log).toEqual(['voice']);
 const second=new AnnouncementQueue(async s=>{log.push(s.text);});second.enqueue({key:'bad',kind:'delay',channel:'dispatcher',valid:()=>false,segments:[{lang:'cs',text:'invalid'}]});await tick();expect(log).toEqual(['voice']);
});
it('generates bounded original radio cues locally and migrates separate volume settings',()=>{
 for(const closing of [true,false]){const sound=radioSamples(closing);expect(sound.length).toBeGreaterThan(10000);expect(sound.every(x=>Number.isFinite(x)&&Math.abs(x)<=1)).toBe(true);expect(decodeWav(encodeWav(sound)).length).toBe(sound.length);expect(sound).toEqual(radioSamples(closing));}
 expect(gongSamples().length).toBe(60000);expect(normalizeSettings({announcements:{gong:false}}).announcements.gongEnd).toBe(false);const s=normalizeSettings({announcements:{volume:.25},dispatcher:{rangeKm:999,volume:50,radioVolume:-2}});expect(s.announcements.volume).toBe(.25);expect(s.announcements.gongVolume).toBe(.25);expect(s.announcements.gongEnd).toBe(true);expect(s.dispatcher).toMatchObject({enabled:false,audio:false,rangeKm:5,volume:1,radioVolume:0});
});

it('has strong narrow-band acknowledgement tones and only brief quieter squelch at the edges',()=>{
 const amplitude=(samples:Float32Array,start:number,end:number,hz:number)=>{let sin=0,cos=0;const from=Math.round(start*48000),to=Math.round(end*48000);for(let i=from;i<to;i++){sin+=samples[i]*Math.sin(2*Math.PI*hz*i/48000);cos+=samples[i]*Math.cos(2*Math.PI*hz*i/48000);}return 2*Math.hypot(sin,cos)/(to-from);};
 const open=radioSamples(false),close=radioSamples(true);
 expect(amplitude(open,.10,.16,1050)).toBeGreaterThan(.20);expect(amplitude(open,.23,.29,1450)).toBeGreaterThan(.20);
 expect(amplitude(close,.04,.08,1450)).toBeGreaterThan(.20);expect(amplitude(close,.14,.18,1050)).toBeGreaterThan(.20);
 const rms=(a:Float32Array)=>Math.sqrt(a.reduce((n,x)=>n+x*x,0)/a.length);
 expect(rms(open.slice(0,3000))).toBeLessThan(.025);expect(rms(open.slice(16000))).toBeLessThan(.001);
});
