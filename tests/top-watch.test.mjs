import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankTop,validDevice,daySeed,topDays} from '../lib/top-watch.ts';
test('recent days weigh more, so yesterday\'s hit gives way to today\'s',()=>{
 assert.deepEqual(rankTop([{'movie:2':5},{'movie:1':7}]),['movie:2','movie:1']);
 assert.deepEqual(rankTop([{'movie:1':3},{'movie:1':3,'movie:2':4}]),['movie:1','movie:2']);
 assert.equal(rankTop([Object.fromEntries(Array.from({length:30},(_,i)=>['tv:'+i,i]))]).length,10);
});
test('device ids and day helpers are well formed',()=>{
 assert.ok(validDevice('0f8e2c8a-1d4b-4a5e-9c2f-1234567890ab'));assert.ok(!validDevice('x'));assert.ok(!validDevice('a b'.repeat(10)));
 assert.equal(topDays(new Date('2026-10-20T15:00:00Z')).length,5);
 assert.equal(daySeed(new Date('2026-10-20T15:00:00Z'))+1,daySeed(new Date('2026-10-21T15:00:00Z')));
});
