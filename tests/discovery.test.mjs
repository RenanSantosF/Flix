import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanTitles,makeShelves,uniqueTitles} from '../lib/discovery.ts';
test('discovery keeps movie and TV identities distinct and drops repeated or invalid results',()=>{
 const rows=cleanTitles({results:[{id:1,title:'A',media_type:'movie'},{id:1,name:'B',media_type:'tv'},{id:1,title:'Duplicate',media_type:'movie'},{id:-1,title:'Invalid',media_type:'movie'},{id:2,name:'Person',media_type:'person'}]});
 assert.deepEqual(rows.map(t=>t.media_type+':'+t.id),['movie:1','tv:1']);assert.equal(uniqueTitles([...rows,...rows]).length,2);
});
test('genre discovery excludes featured titles and duplicates across shelves without losing the next shelf on failure',()=>{
 const data=[{results:[{id:1,title:'Featured'},{id:2,title:'New'}]},{results:[{id:2,title:'Repeated'},{id:3,title:'Comedy'}]},null,{results:[{id:4,title:'Thriller'}]}];
 const shelves=makeShelves(data,[{id:1,media_type:'movie',title:'Featured'}]);
 assert.deepEqual(shelves.map(s=>[s.id,s.titles.map(t=>t.id)]),[['action',[2]],['comedy',[3]],['thriller',[4]]]);
});
