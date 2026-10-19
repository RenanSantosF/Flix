import {test} from 'node:test';
import assert from 'node:assert/strict';
process.env.KV_REST_API_TOKEN='test-token';process.env.ADMIN_PASSWORD='senha-forte-123';process.env.KV_REST_API_URL='https://kv.example';
const {viewToken,readToken,adminSession,validSession,passwordMatches}=await import('../lib/ad-store.ts');
test('view tokens are bound to a campaign, expire and reject tampering',()=>{
 const token=viewToken('abc',1000);assert.equal(readToken(token,2000),'abc');
 assert.equal(readToken(token,1000+3*3600000),null);
 assert.equal(readToken(token.replace(/^abc/,'xyz'),2000),null);assert.equal(readToken('a.b.c',2000),null);
});
test('admin session is signed with the password and expires',()=>{
 const s=adminSession(1000);assert.equal(validSession(s,2000),true);assert.equal(validSession(s,1000+8*86400000),false);
 assert.equal(validSession(s.replace(/^\d+/,'99999999999999'),2000),false);
 assert.equal(passwordMatches('senha-forte-123'),true);assert.equal(passwordMatches('errada'),false);
});
