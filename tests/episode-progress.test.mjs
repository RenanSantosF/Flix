import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEpisodes,withEpisode,episodeFraction} from '../lib/episode-progress.ts';
test('episode progress is stored per season and episode and survives parsing',()=>{
 let s=withEpisode({},10,1,2,600,1200,5);s=withEpisode(s,10,1,3,1190,1200,6);s=withEpisode(s,10,1,2,700,1200,7);
 const back=parseEpisodes(JSON.stringify(s));assert.equal(back['10']['1:2'].position,700);assert.equal(episodeFraction(back['10']['1:3']),1190/1200);
 assert.equal(withEpisode(s,10,1,4,0,1200),s);assert.equal(episodeFraction(undefined),0);
});
test('invalid stored data is dropped',()=>{
 assert.deepEqual(parseEpisodes('{"x":{"1:1":{}},"5":{"a":1,"1:1":{"position":5,"duration":-1,"updatedAt":1}}}'),{'5':{}});
 assert.deepEqual(parseEpisodes('nope'),{});
});
