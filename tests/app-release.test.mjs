import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appBuild,isAppAgent,parseRelease} from '../lib/app-release.ts';
test('app builds are read from the user agent',()=>{
 assert.equal(appBuild('Mozilla/5.0 Chrome/130 Mobile Safari/537.36'),null);
 assert.equal(appBuild('Mozilla/5.0 ... wv FlixAndroid/1.0'),0);
 assert.equal(appBuild('Mozilla/5.0 ... wv FlixAndroid/1.0 FlixBuild/24'),24);
 assert.equal(isAppAgent('x FlixAndroid/1.0'),true);assert.equal(isAppAgent('FlixAndroidFake'),false);
});
test('only tagged releases with the Flix.apk asset count',()=>{
 const r=parseRelease({tag_name:'android-v24',name:'Flix 0.24-download',body:'Notas',published_at:'2026-10-20T00:00:00Z',assets:[{name:'Flix.apk',size:11234567}]});
 assert.deepEqual(r,{versionCode:24,versionName:'0.24',notes:'Notas',publishedAt:'2026-10-20T00:00:00Z',sizeMb:11.2});
 assert.equal(parseRelease({tag_name:'v24',assets:[{name:'Flix.apk'}]}),null);
 assert.equal(parseRelease({tag_name:'android-v24',assets:[{name:'other.apk'}]}),null);
});
