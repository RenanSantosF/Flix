import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPhone,maskPhone,mergeEpisodes,mergeLibrary,nextDoc,normalizePhone,validPassword} from '../lib/account.ts';
import {sessionPhone,sessionToken} from '../lib/account-store.ts';
const title=(id,name=`T${id}`)=>({id,media_type:'movie',title:name,overview:'',poster_path:null,backdrop_path:null,release_date:'2020-01-01',vote_average:7,genre_ids:[]});
const entry=(id,updatedAt,position=100)=>({title:title(id),season:1,episode:1,position,duration:1000,updatedAt,completed:false});

test('phones normalize to national digits with area code', () => {
  for (const raw of ['(11) 91234-5678','11912345678','+55 11 91234-5678','5511912345678','011912345678'])assert.equal(normalizePhone(raw),'11912345678');
  assert.equal(normalizePhone('(21) 3456-7890'),'2134567890');
  for (const raw of ['91234-5678','(01) 91234-5678','abc',null,'1'.repeat(50)])assert.equal(normalizePhone(raw),null);
});
test('phone input is formatted while typing and pasted +55 is dropped', () => {
  assert.equal(formatPhone('11'),'(11');
  assert.equal(formatPhone('1191234'),'(11) 9123-4');
  assert.equal(formatPhone('11912345678'),'(11) 91234-5678');
  assert.equal(formatPhone('+55 11 91234-5678'),'(11) 91234-5678');
  assert.equal(maskPhone('11912345678'),'(11) •••••-5678');
});
test('passwords need 4 to 64 characters', () => {
  assert.equal(validPassword('1234'),true);assert.equal(validPassword('123'),false);assert.equal(validPassword('x'.repeat(65)),false);assert.equal(validPassword(1234),false);
});
test('merge keeps every favorite and the latest progress per title', () => {
  const older={favorites:[title(1),title(2)],history:[entry(1,100,50),entry(3,300)]},newer={favorites:[title(2),title(4)],history:[entry(1,200,80)]};
  const merged=mergeLibrary(older,newer);
  assert.deepEqual(merged.favorites.map(t=>t.id),[2,4,1]);
  assert.deepEqual(merged.history.map(h=>[h.title.id,h.position]),[[3,100],[1,80]]);
  assert.deepEqual(mergeEpisodes({'10':{'1:1':{position:5,duration:50,updatedAt:1}}},{'10':{'1:1':{position:9,duration:50,updatedAt:2},'1:2':{position:3,duration:50,updatedAt:2}}}),{'10':{'1:1':{position:9,duration:50,updatedAt:2},'1:2':{position:3,duration:50,updatedAt:2}}});
});
test('an up-to-date device replaces the copy, a stale one is merged, a clean one only pulls', () => {
  const stored={library:{favorites:[title(1)],history:[]},episodes:{},rev:3};
  assert.equal(nextDoc(stored,{rev:1,dirty:false}),null);
  const replaced=nextDoc(stored,{rev:3,dirty:true,library:{favorites:[],history:[]},episodes:{}});
  assert.deepEqual([replaced.rev,replaced.library.favorites.length],[4,0]);
  const merged=nextDoc(stored,{rev:2,dirty:true,library:{favorites:[title(5)],history:[]},episodes:{}});
  assert.deepEqual([merged.rev,merged.library.favorites.map(t=>t.id)],[4,[5,1]]);
  assert.equal(nextDoc(null,{rev:0,dirty:true,library:{favorites:[title(7)]},episodes:{}}).rev,1);
});
test('session cookies are signed and expire', () => {
  const token=sessionToken('11912345678',1000);
  assert.equal(sessionPhone(token,2000),'11912345678');
  assert.equal(sessionPhone(token.replace('11912345678','11900000000'),2000),null);
  assert.equal(sessionPhone(token,1000+366*86400000),null);
  assert.equal(sessionPhone('garbage'),null);assert.equal(sessionPhone(undefined),null);
});
