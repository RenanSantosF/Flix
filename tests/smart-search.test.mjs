import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseQuery,intentLabel,titleScore,typoVariants,similar} from '../lib/smart-search.ts';
test('genre words are understood with accents, plurals and typos',()=>{
 for(const q of ['comédia','comedia','comedias','comdia','Comédias engraçadas'])assert.equal(parseQuery(q).genres[0]?.label,'Comédia',q);
 assert.equal(parseQuery('filmes de terorr').genres[0].label,'Terror');
 assert.equal(parseQuery('filmes de terorr').type,'movie');
 assert.equal(parseQuery('séries de anime').genres[0].language,'ja');
 assert.deepEqual(parseQuery('comedia romantica').genres.map(g=>g.label),['Comédia','Romance']);
 assert.equal(parseQuery('ação').genres[0].label,'Ação');
});
test('years, decades and leftover title words are separated',()=>{
 const q=parseQuery('melhores filmes de ação anos 90');assert.equal(q.decade,1990);assert.equal(q.text,'');assert.equal(intentLabel(q),'Ação · filmes · anos 90');
 assert.equal(parseQuery('terror 2023').year,2023);
 assert.equal(parseQuery('homem aranha').text,'homem aranha');assert.equal(parseQuery('homem aranha').genres.length,0);
 assert.equal(parseQuery('vingadores').genres.length,0);
});
test('typo tolerance ranks the intended title first',()=>{
 const titles=['Vingadores: Ultimato','Vida de Inseto','Os Vingadores','Velozes e Furiosos'];
 const best=t=>[...titles].sort((a,b)=>titleScore(t,b)-titleScore(t,a))[0];
 assert.match(best('vingadorez'),/Vingadores/);assert.match(best('os vigadores'),/Vingadores/);
 assert.ok(typoVariants('vingadorez').includes('vingador'));
 assert.ok(similar('aranah','aranha'));
});
