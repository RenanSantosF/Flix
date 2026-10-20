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

test('Japanese animation is an anime and leaves Séries/Filmes for its own tab', async () => {
  const {normalizeTitle}=await import('../lib/catalog.ts');
  const {matchesFilter}=await import('../lib/discovery.ts');
  const naruto=normalizeTitle({id:46260,name:'Naruto',genre_ids:[16,10759],original_language:'ja'},'tv');
  const fromDetail=normalizeTitle({id:1,name:'Detalhe',genres:[{id:16}],origin_country:['JP']},'tv');
  const simpsons=normalizeTitle({id:456,name:'Os Simpsons',genre_ids:[16,35],original_language:'en'},'tv');
  const drama=normalizeTitle({id:2,name:'Drama',genre_ids:[18],original_language:'ja'},'tv');
  assert.equal(naruto.anime,true);assert.equal(fromDetail.anime,true);
  assert.equal(simpsons.anime,undefined);assert.equal(drama.anime,undefined);
  assert.equal(matchesFilter(naruto,'anime'),true);assert.equal(matchesFilter(naruto,'tv'),false);assert.equal(matchesFilter(naruto,'all'),true);
  assert.equal(matchesFilter(simpsons,'tv'),true);assert.equal(matchesFilter(simpsons,'anime'),false);
  const film=normalizeTitle({id:3,title:'Suzume',genre_ids:[16],original_language:'ja'},'movie');
  assert.equal(matchesFilter(film,'movie'),false);assert.equal(matchesFilter(film,'anime'),true);
});
