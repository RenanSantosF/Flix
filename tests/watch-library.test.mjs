import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLibrary,applyProgress,applyPlayback,remainingLabel} from '../lib/watch-library.ts';
import {normalizeTitle} from '../lib/catalog.ts';
const title={id:603,media_type:'movie',title:'Matrix',poster_path:'/poster.jpg'};
test('library preserves watch position, timestamp and favorites after a storage round trip',()=>{
 const now=Date.now();const data=parseLibrary(JSON.stringify({favorites:[title,title],history:[{title,season:1,episode:1,position:371,duration:7200,updatedAt:now}]}));
 assert.equal(data.favorites.length,1);assert.equal(data.history[0].position,371);assert.equal(data.history[0].updatedAt,now);assert.equal(data.history[0].completed,false);
});
test('malformed and unsafe storage cannot create invalid titles or playback values',()=>{
 assert.deepEqual(parseLibrary('broken'),{favorites:[],history:[]});
 const data=parseLibrary(JSON.stringify({favorites:[{...title,id:-3},{...title,media_type:'person'}],history:[{title,season:-9,episode:'4',position:10,duration:500,updatedAt:Infinity}]}));
 assert.equal(data.favorites.length,0);assert.equal(data.history[0].position,10);assert.equal(data.history[0].season,1);assert.equal(data.history[0].episode,1);
 assert.equal(normalizeTitle({...title,poster_path:'https://evil.test/pixel'}).poster_path,null);
});
test('late progress from a previous episode cannot overwrite the active episode',()=>{
 const data={favorites:[],history:[{title,season:2,episode:4,position:20,duration:800,updatedAt:1,completed:false}]};
 assert.equal(applyProgress(data,'movie:603',2,3,500,800),data);
 const next=applyProgress(data,'movie:603',2,4,780,800);assert.equal(next.history[0].completed,true);assert.equal(next.history[0].position,780);
 assert.equal(applyProgress(data,'movie:603',2,4,NaN,800),data);
});
test('history is bounded and newest titles appear first',()=>{
 const history=Array.from({length:100},(_,i)=>({title:{...title,id:i+1},season:1,episode:1,position:1,duration:100,updatedAt:Date.now()-i*1000}));
 const data=parseLibrary(JSON.stringify({history}));assert.equal(data.history.length,80);assert.equal(data.history[0].title.id,1);
});

test('opening a session, buffering and failed starts do not create a continue card',()=>{
 const empty={favorites:[],history:[]};
 for(const [p,d,playing] of [[0,0,false],[0,7200,true],[0,7200,false],[9,7200,false],[NaN,7200,true]])assert.equal(applyPlayback(empty,title,1,1,p,d,playing),empty);
 const started=applyPlayback(empty,title,1,1,2,7200,true);assert.equal(started.history.length,1);assert.equal(started.history[0].position,2);
 const paused=applyPlayback(started,title,1,1,17,7200,false);assert.equal(paused.history[0].position,17);
 assert.equal(applyPlayback(paused,title,1,1,0,7200,false),paused);
});
test('an unsuccessful episode switch preserves the old resume point',()=>{
 const series={...title,media_type:'tv'},empty={favorites:[],history:[]};
 const watched=applyPlayback(empty,series,2,3,600,2400,true);
 assert.equal(applyPlayback(watched,series,2,4,0,2400,true),watched);
 const next=applyPlayback(watched,series,2,4,2,2400,true);assert.equal(next.history.length,1);assert.equal(next.history[0].episode,4);
});
test('legacy failed starts disappear while a deliberately queued next episode remains',()=>{
 const data=parseLibrary(JSON.stringify({history:[{title,position:0,duration:0},{title:{...title,id:604,media_type:'tv'},season:2,episode:4,position:0,duration:0,queued:true}]}));
 assert.equal(data.history.length,1);assert.equal(data.history[0].queued,true);
 const playing=applyPlayback(data,data.history[0].title,2,4,2,2400,true);assert.equal(playing.history[0].queued,undefined);assert.equal(playing.history[0].position,2);
});
test('remaining time never shows zero minutes for an unfinished minute',()=>{
 assert.equal(remainingLabel(599,600),'Menos de 1 min restante');assert.equal(remainingLabel(0,3601),'1h 1min restantes');
});
