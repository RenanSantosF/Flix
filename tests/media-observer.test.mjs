import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const observerScript=readFileSync(new URL('../android/app/src/main/assets/media-observer.js',import.meta.url),'utf8');
function fixture(){
 let time=1000, resources=[], resourceObserver, scan;
 const messages=[], listeners={};
 class Video{
  currentSrc='';src='';duration=NaN;currentTime=0;paused=true;ended=false;error=null;children=[];
  querySelector(){return this.children[0]||null}querySelectorAll(){return this.children}
 }
 const video=new Video(), videos=[video];
 const win={HTMLVideoElement:Video,HTMLSourceElement:class{},HTMLMediaElement:{NETWORK_NO_SOURCE:3},URL,
  performance:{now:()=>time,getEntriesByType:()=>resources},
  PerformanceObserver:class{constructor(callback){resourceObserver=callback}observe(){}},
  FlixMedia:{postMessage:m=>messages.push(JSON.parse(m))},
  document:{addEventListener:(name,callback)=>{listeners[name]=callback},querySelectorAll:s=>s==='video'?videos:[]},
  setInterval:callback=>{scan=callback},setTimeout:callback=>callback(),addEventListener(){}};
 vm.runInNewContext(observerScript,{window:win,Date:class extends Date{static now(){return time}}});
 return {video,videos,messages,error:()=>{video.error={code:4};listeners.error({target:video})},
  resource:(url,initiatorType='fetch',startTime=time)=>{const entry={name:url,initiatorType,startTime};resources.push(entry);resourceObserver({getEntries:()=>[entry]})},
  scan:()=>scan(),advance:ms=>{time+=ms},emit:name=>listeners[name]?.({target:video})};
}
test('direct sources reach the local bridge on error 4 only',()=>{
 const f=fixture();f.video.src='https://cdn.example/video.mp4?token=private';f.video.duration=60;f.emit('loadedmetadata');
 assert.equal(f.messages.at(-1).source,'');f.error();assert.equal(f.messages.at(-1).source,f.video.src);assert.equal(f.messages.at(-1).sourceReason,'direct');
});
test('a failed blob uses the single recent manifest requested by its own frame',()=>{
 const f=fixture();f.video.src='blob:https://player.example/id';f.resource('https://cdn.example/main.m3u8?token=private');f.error();
 assert.equal(f.messages.at(-1).source,'https://cdn.example/main.m3u8?token=private');assert.equal(f.messages.at(-1).sourceReason,'observed-manifest');assert.equal(f.messages.at(-1).sourceKind,'blob');
});
test('blob recovery refuses ambiguous videos/manifests, unrelated resources and stale requests',()=>{
 for(const mode of ['multiple-manifests','multiple-videos','stale','script','http']){
  const f=fixture();f.video.src='blob:https://player.example/id';
  f.resource(mode==='http'?'http://cdn.example/a.m3u8':'https://cdn.example/a.m3u8',mode==='script'?'script':'fetch',mode==='stale'?-31000:1000);
  if(mode==='multiple-manifests')f.resource('https://cdn.example/b.m3u8');
  if(mode==='multiple-videos')f.videos.push({});f.error();assert.equal(f.messages.at(-1).source,'',mode);
 }
});
test('a paused failed blob can recover when its manifest arrives after the error, within five seconds',()=>{
 const f=fixture();f.video.src='blob:https://player.example/id';f.error();assert.equal(f.messages.at(-1).sourceReason,'blob-without-manifest');
 f.advance(1000);f.resource('https://cdn.example/main.mpd');f.scan();assert.equal(f.messages.at(-1).source,'https://cdn.example/main.mpd');
 const count=f.messages.length;f.scan();assert.equal(f.messages.length,count);
 const expired=fixture();expired.video.src='blob:https://player.example/id';expired.error();expired.advance(6000);expired.resource('https://cdn.example/late.m3u8');expired.scan();assert.equal(expired.messages.at(-1).source,'');
});
test('non-HTTPS and missing sources stay local diagnostics, never native fetch candidates',()=>{
 for(const [src,kind] of [['http://cdn.example/a.mp4','http'],['','missing'],['data:video/mp4,abc','other']]){
  const f=fixture();f.video.src=src;f.error();assert.equal(f.messages.at(-1).source,'');assert.equal(f.messages.at(-1).sourceKind,kind);
 }
});

test('a new video load does not reuse the previous video manifest',()=>{
 const f=fixture();f.video.src='blob:https://player.example/new';f.resource('https://cdn.example/previous.m3u8');f.advance(2000);f.emit('loadstart');f.error();assert.equal(f.messages.at(-1).source,'');
 f.resource('https://cdn.example/current.m3u8');f.scan();assert.equal(f.messages.at(-1).source,'https://cdn.example/current.m3u8');
});
