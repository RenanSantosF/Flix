import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLibrary,applyProgress} from '../lib/watch-library.ts';
import {normalizeTitle} from '../lib/catalog.ts';
const title={id:603,media_type:'movie',title:'Matrix',poster_path:'/poster.jpg'};
test('library preserves watch position, timestamp and favorites after a storage round trip',()=>{
 const now=Date.now();const data=parseLibrary(JSON.stringify({favorites:[title,title],history:[{title,season:1,episode:1,position:371,duration:7200,updatedAt:now}]}));
 assert.equal(data.favorites.length,1);assert.equal(data.history[0].position,371);assert.equal(data.history[0].updatedAt,now);assert.equal(data.history[0].completed,false);
});
test('malformed and unsafe storage cannot create invalid titles or playback values',()=>{
 assert.deepEqual(parseLibrary('broken'),{favorites:[],history:[]});
 const data=parseLibrary(JSON.stringify({favorites:[{...title,id:-3},{...title,media_type:'person'}],history:[{title,season:-9,episode:'4',position:-10,duration:500,updatedAt:Infinity}]}));
 assert.equal(data.favorites.length,0);assert.equal(data.history[0].position,0);assert.equal(data.history[0].season,1);assert.equal(data.history[0].episode,1);
 assert.equal(normalizeTitle({...title,poster_path:'https://evil.test/pixel'}).poster_path,null);
});
test('late progress from a previous episode cannot overwrite the active episode',()=>{
 const data={favorites:[],history:[{title,season:2,episode:4,position:20,duration:800,updatedAt:1,completed:false}]};
 assert.equal(applyProgress(data,'movie:603',2,3,500,800),data);
 const next=applyProgress(data,'movie:603',2,4,780,800);assert.equal(next.history[0].completed,true);assert.equal(next.history[0].position,780);
 assert.equal(applyProgress(data,'movie:603',2,4,NaN,800),data);
});
test('history is bounded and newest titles appear first',()=>{
 const history=Array.from({length:100},(_,i)=>({title:{...title,id:i+1},season:1,episode:1,position:0,duration:0,updatedAt:Date.now()-i*1000}));
 const data=parseLibrary(JSON.stringify({history}));assert.equal(data.history.length,80);assert.equal(data.history[0].title.id,1);
});
