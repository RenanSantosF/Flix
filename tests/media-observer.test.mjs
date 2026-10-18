import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const observerScript=readFileSync(new URL('../android/app/src/main/assets/media-observer.js',import.meta.url),'utf8');
function fixture(){
 let time=1000, resources=[], resourceObserver, scan, nextTimer=0;
 const timers=new Map();
 function advance(ms){const until=time+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;time=due[1].at;timers.delete(due[0]);due[1].fn();}time=until;}
 const messages=[], listeners={}, labels=[];
 class Video{
  currentSrc='';src='';readyState=0;duration=NaN;currentTime=0;paused=true;ended=false;error=null;children=[];loads=0;plays=0;
  load(){this.loads++}play(){this.plays++;this.paused=false;return Promise.resolve()}pause(){this.paused=true}
  querySelector(){return this.children[0]||null}querySelectorAll(){return this.children}
 }
 const video=new Video(), videos=[video];
 const win={HTMLVideoElement:Video,HTMLSourceElement:class{},HTMLMediaElement:{NETWORK_NO_SOURCE:3},URL,
  performance:{now:()=>time,getEntriesByType:()=>resources},
  PerformanceObserver:class{constructor(callback){resourceObserver=callback}observe(){}},
  location:{href:'https://player.example/embed/123?token=private#play'},
  FlixMedia:{postMessage:m=>messages.push(JSON.parse(m))},
  document:{addEventListener:(name,callback)=>{listeners[name]=callback},querySelectorAll:s=>s==='video'?videos:labels},
  setInterval:callback=>{scan=callback},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{at:time+delay,fn});return id},clearTimeout:id=>timers.delete(id),addEventListener(){}};
 vm.runInNewContext(observerScript,{window:win,Date:class extends Date{static now(){return time}}});
 return {video,videos,messages,label:(text,visible=true)=>{const label={textContent:text,getClientRects:()=>visible?[{}]:[]};labels.push(label);return label},style:fn=>{win.getComputedStyle=fn},clearLabels:()=>{labels.length=0},error:(settle=true)=>{video.error={code:4};listeners.error({target:video});if(settle)advance(5000)},
  resource:(url,initiatorType='fetch',startTime=time)=>{const entry={name:url,initiatorType,startTime};resources.push(entry);resourceObserver({getEntries:()=>[entry]})},
  command:data=>win.FlixMedia.onmessage({data:JSON.stringify(data)}),scan:()=>scan(),advance,emit:name=>listeners[name]?.({target:video})};
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

test('recovery includes declared page context only on an error, for the local decoder',()=>{
 const f=fixture();f.video.src='https://cdn.example/v.mp4';f.video.duration=60;f.video.hasAttribute=()=>true;f.video.crossOrigin='anonymous';
 f.emit('playing');assert.equal(f.messages.at(-1).frameUrl,'');f.error();assert.equal(f.messages.at(-1).frameUrl,'https://player.example/embed/123?token=private#play');assert.equal(f.messages.at(-1).corsMode,'anonymous');
});


test('a transient failure does not interrupt the provider when its own recovery starts playback',()=>{
 const f=fixture();f.video.src='https://cdn.example/temporary.mp4';f.error(false);
 assert.equal(f.messages.length,0);f.advance(1000);
 f.video.src='https://cdn.example/working.mp4';f.video.error=null;f.emit('loadstart');
 f.video.duration=60;f.video.readyState=4;f.video.paused=false;f.emit('loadedmetadata');f.emit('playing');f.advance(6000);
 assert.ok(f.messages.some(m=>m.playing));assert.equal(f.messages.filter(m=>m.error).length,0);
});
test('stable unsupported media gets one fallback only after the full recovery window',()=>{
 const f=fixture();f.video.src='https://cdn.example/broken.mp4';f.error(false);f.advance(4000);f.scan();
 assert.equal(f.messages.length,0);f.advance(999);assert.equal(f.messages.length,0);f.advance(1);
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].source,f.video.src);f.scan();assert.equal(f.messages.length,1);
});
test('loading a replacement cancels the old fallback and gives the new source its own recovery window',()=>{
 const f=fixture();f.video.src='https://cdn.example/first.mp4';f.error(false);f.advance(1000);
 f.video.src='https://cdn.example/second.mp4';f.emit('loadstart');f.error(false);f.advance(4000);assert.equal(f.messages.length,0);
 f.advance(1000);assert.equal(f.messages.length,1);assert.equal(f.messages[0].source,'https://cdn.example/second.mp4');
});


test('a removed failed video cannot transfer its obsolete source to the native player',()=>{
 const f=fixture();f.video.src='https://cdn.example/obsolete.mp4';f.error(false);f.video.isConnected=false;
 f.advance(6000);assert.equal(f.messages.length,0);
});


test('an unready video supplies its assigned source only to the local diagnostic bridge',()=>{
 const f=fixture();f.video.src='https://cdn.example/private?token=secret';f.video.readyState=0;f.video.networkState=2;
 f.advance(3000);f.scan();const state=f.messages.at(-1);
 assert.equal(state.event,'state');assert.equal(state.sourceKind,'https');assert.equal(state.readyState,0);assert.equal(state.networkState,2);
 assert.equal(state.source,f.video.src);
 const count=f.messages.length;f.scan();assert.equal(f.messages.length,count);
});


test('visible Loading ad is diagnostic state and never a native recovery source or movie progress',()=>{
 const f=fixture();f.label('Loading ad');f.video.src='https://player.example/ad?token=secret';f.video.duration=30;f.video.paused=false;
 f.advance(3000);f.emit('playing');f.error();
 assert.ok(f.messages.length>0);assert.ok(f.messages.every(m=>m.event==='state' && m.adLoading===true && !m.playing));
 assert.ok(f.messages.every(m=>m.error!==4));
 f.clearLabels();f.video.error=null;f.video.src='https://cdn.example/movie.mp4';f.video.readyState=4;f.emit('loadstart');f.emit('playing');
 assert.ok(f.messages.at(-1).playing);
});
test('a hidden ad label or unrelated text does not suppress a real movie failure',()=>{
 for(const [label,visible] of [['Loading ad',false],['The Loading adventures',true]]){
  const f=fixture();f.label(label,visible);f.video.src='https://cdn.example/movie.mp4';f.error();
  assert.equal(f.messages.at(-1).source,f.video.src);
 }
});


test('Loading ad can be reported before the provider creates its video element',()=>{
 const f=fixture();f.videos.length=0;f.label('Loading ad...');f.advance(3000);f.scan();
 assert.equal(f.messages.at(-1).adLoading,true);assert.equal(f.messages.at(-1).readyState,-1);assert.equal(f.messages.at(-1).sourceKind,'missing');
});


test('an ad label hidden by an ancestor does not suppress the movie',()=>{
 const f=fixture(),label=f.label('Loading ad'),parent={};label.parentElement=parent;
 f.style(node=>({visibility:'visible',display:'block',opacity:node===parent?'0':'1'}));
 f.video.src='https://cdn.example/movie.mp4';f.error();assert.equal(f.messages.at(-1).source,f.video.src);
});


test('a local retry reuses the same assigned source once without replacing the document',()=>{
 const f=fixture();f.video.src='https://cdn.example/media?token=secret';f.video.paused=false;f.advance(3000);f.scan();
 const state=f.messages.at(-1);assert.equal(state.retryWanted,true);assert.notEqual(state.videoId.split(':').at(-1),'state');
 const command={type:'retry-source',videoId:state.videoId,source:state.source};f.command(command);f.command(command);
 assert.equal(f.video.loads,1);assert.equal(f.video.plays,1);assert.equal(f.video.src,command.source);
});
test('retry command cannot restart a paused, removed, replaced, ready or ad video',()=>{
 for(const mode of ['pause','removed','replaced','ready','ad','wrong-id','wrong-source']){
  const f=fixture();f.video.src='https://cdn.example/media';f.video.paused=false;f.advance(3000);f.scan();
  const state=f.messages.at(-1),command={type:'retry-source',videoId:state.videoId,source:state.source};
  if(mode==='pause'){f.video.paused=true;f.emit('pause')}
  if(mode==='removed')f.video.isConnected=false;
  if(mode==='replaced')f.video.src='https://cdn.example/other';
  if(mode==='ready')f.video.readyState=1;
  if(mode==='ad')f.label('Loading ad');
  if(mode==='wrong-id')command.videoId='old:1';
  if(mode==='wrong-source')command.source='https://other.example/media';
  f.command(command);assert.equal(f.video.loads,0,mode);assert.equal(f.video.plays,0,mode);
 }
});
