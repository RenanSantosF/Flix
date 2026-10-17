import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLive,normalizeLiveList,providerUrl,liveStatus,liveTime} from '../lib/live-catalog.ts';
// Documentation-shaped fixtures, not recorded upstream responses.
test('events preserve the official multi-channel player and normalize offset times',()=>{
 const item=normalizeLive({slug:'final',name:'Time A x Time B',status:'live',start_at:'2026-10-17T19:30:00-03:00',play_event_url:'/play/evento/final',page_url:'/eventos/final',channels:[{name:'Canal 1'},'Canal 2']},'event');
 assert.equal(item.playUrl,'https://superflixapi.fun/play/evento/final');assert.equal(item.startsAt,'2026-10-17T22:30:00.000Z');assert.equal(item.status,'live');assert.deepEqual(item.channels,['Canal 1','Canal 2']);assert.match(liveTime(item),/19:30/);
});
test('channels accept public envelopes and deduplicate IDs, never invent player URLs',()=>{
 const data={data:{channels:[{id:12,name:'Esporte',play_url:'/canal/esporte',category:{name:'Esportes'}},{id:12,name:'Duplicado',play_url:'/canal/esporte'},{id:13,name:'Sem link'}]}};
 const channels=normalizeLiveList(data,'channel');assert.equal(channels.length,1);assert.equal(channels[0].category,'Esportes');assert.equal(normalizeLive({id:13,name:'Sem link'},'channel'),null);
});
test('untrusted origins, credentials and unsafe schemes cannot become playback URLs',()=>{
 for(const s of ['https://evil.example/canal/test','//evil.example/a','javascript:alert(1)','https://superflixapi.fun@evil.example/a','https://user:secret@superflixapi.fun/a','http://superflixapi.fun/a'])assert.equal(providerUrl(s),'');
 assert.equal(normalizeLive({name:'Unsafe',play_url:'https://evil.example/'},'channel'),null);
});
test('timezone-less dates stay provider text and unknown statuses never become live',()=>{
 const item=normalizeLive({id:'abc',title:'Evento',play_event_url:'/eventos/abc',date:'2026-10-17 19:30',status:'mystery'},'event');assert.equal(item.startsAt,'');assert.equal(liveTime(item),'2026-10-17 19:30');assert.equal(item.status,'unknown');assert.equal(liveStatus('ao vivo'),'live');assert.equal(liveStatus('finished'),'ended');
});
