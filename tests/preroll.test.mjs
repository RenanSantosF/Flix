import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampSkip,pickMedia,skipSeconds,trackingUrls} from '../lib/preroll.ts';
test('skip offset follows VAST time or percentage and falls back to the Flix default',()=>{
 assert.equal(skipSeconds('00:00:07',30),7);assert.equal(skipSeconds('00:01:02.5',90),62.5);
 assert.equal(skipSeconds('25%',20),5);assert.equal(skipSeconds('',20),5);assert.equal(skipSeconds('bad',20,3),3);
 assert.equal(clampSkip(undefined),5);assert.equal(clampSkip('99'),30);assert.equal(clampSkip('-1'),5);assert.equal(clampSkip('8'),8);
});
test('only HTTPS MP4/WebM files near phone width are played',()=>{
 const files=[{url:'http://a/x.mp4',type:'video/mp4',width:854,height:480},{url:'https://a/vpaid.js',type:'application/javascript',width:854,height:480},{url:'https://a/big.mp4',type:'video/mp4',width:1920,height:1080},{url:'https://a/mid.mp4',type:'video/mp4',width:960,height:540}];
 assert.equal(pickMedia(files),'https://a/mid.mp4');assert.equal(pickMedia(files.slice(0,2)),'');
});
test('tracking pixels drop non-HTTP URLs and expand cache busters',()=>{
 const [url,...rest]=trackingUrls([' https://t.example/i?cb=[CACHEBUSTING] ','javascript:alert(1)','']);
 assert.equal(rest.length,0);assert.match(url,/^https:\/\/t\.example\/i\?cb=\d+$/);
});
