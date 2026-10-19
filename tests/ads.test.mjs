import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adDocument,adHost,adKey} from '../lib/ads.ts';
test('ads render only with a valid Adsterra key and keep the requested size',()=>{
 assert.equal(adDocument(undefined,'banner'),'');assert.equal(adDocument('abc','banner'),'');
 assert.equal(adKey("0123456789abcdef0123456789abcdef'};alert(1)//"),'');
 const html=adDocument(' 0123456789ABCDEF0123456789ABCDEF ','rect');
 assert.match(html,/key:'0123456789abcdef0123456789abcdef'/);assert.match(html,/height:250,width:300/);
 assert.match(html,/src="https:\/\/www\.highperformanceformat\.com\/0123456789abcdef0123456789abcdef\/invoke\.js"/);
});
test('ad host falls back to the default network domain when invalid',()=>{
 assert.equal(adHost('pl123.example.com'),'pl123.example.com');
 assert.equal(adHost('evil.com/"><script>'),'www.highperformanceformat.com');assert.equal(adHost(''),'www.highperformanceformat.com');
});
