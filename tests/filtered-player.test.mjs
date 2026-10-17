import assert from 'node:assert/strict';
import test from 'node:test';
import {FILTERED_CSP, FILTERED_SANDBOX, MAX_PLAYER_BYTES, filterPlayerHtml, isVerificationPage, providerUrl, readPlayerHtml} from '../lib/filtered-player.ts';

const source = new URL('https://superflixapi.fun/filme/603');
const app = 'https://flix.example';

test('rejects arbitrary origins, credentials, traversal and non-player paths', () => {
  for (const path of ['https://example.com/filme/1', '//127.0.0.1/filme/1', '/\\127.0.0.1/filme/1', '/filme/../../admin', '/login', '/api/private', '/'.repeat(2050)]) {
    assert.throws(() => providerUrl(path), path);
  }
  assert.equal(providerUrl('/serie/1396/1/2').href, 'https://superflixapi.fun/serie/1396/1/2');
});

test('removes observed ad scripts while retaining video initialization and media', () => {
  const input = `<script>var __Y={detectSandbox:function(){location.href='/sanbox.php'}};</script>
    <script>const queue='sf_qads_example';</script>
    <script src="https://ads.asiafilm.org/pop.js"></script>
    <script>const player = new Player('video');</script><video id="video" controls src="movie.mp4"></video>`;
  const output = filterPlayerHtml(input, source, app);
  assert.doesNotMatch(output, /detectSandbox|sf_qads_|asiafilm/);
  assert.match(output, /new Player/);
  assert.match(output, /<video id="video"/);
  assert.match(output, /<base href="https:\/\/superflixapi.fun\/filme\/603">/);
});

test('parses malformed HTML and removes redirect metadata and plugin probes', () => {
  const output = filterPlayerHtml(`<BASE HREF="https://evil.example"><meta http-equiv="REFRESH" content="0;url=https://evil.example"><object data="test.pdf"></object><embed src="test.pdf"><template><script>detectSandbox()</script></template><video controls>`, source, app);
  assert.doesNotMatch(output, /evil\.example|<object|<embed|detectSandbox|http-equiv="REFRESH"/);
  assert.equal((output.match(/<base /g) || []).length, 1);
  assert.match(output, /<video controls/);
});

test('keeps same-provider nested documents on the filtered endpoint despite the remote base URL', () => {
  const output = filterPlayerHtml(`<iframe src="/player/embed?id=1#noLink"></iframe><iframe src="https://other.example/embed/1"></iframe>`, source, app);
  assert.match(output, /src="https:\/\/flix.example\/api\/player\/filter\?path=%2Fplayer%2Fembed%3Fid%3D1#noLink"/);
  assert.match(output, /src="https:\/\/other.example\/embed\/1"/);
});

test('enforces isolation in the response even when opened without an iframe', () => {
  const sandbox = FILTERED_CSP.split(';')[0];
  assert.equal(sandbox, 'sandbox ' + FILTERED_SANDBOX);
  assert.doesNotMatch(sandbox, /allow-same-origin|allow-popups|allow-top-navigation|allow-downloads/);
  assert.match(FILTERED_CSP, /object-src 'none'/);
});

test('recognizes human-verification pages instead of stripping their controls', () => {
  assert.equal(isVerificationPage('<title>Verificação</title><p>Confirme que você é humano para continuar.</p>'), true);
  assert.equal(isVerificationPage('<title>Attention Required! | Cloudflare</title>Sorry, you have been blocked'), true);
  assert.equal(isVerificationPage('<title>Matrix</title><video controls></video>'), false);
});

test('limits decoded upstream bytes even without a trustworthy content length', async () => {
  assert.equal(await readPlayerHtml(new Response('<video>ok</video>')), '<video>ok</video>');
  await assert.rejects(readPlayerHtml(new Response('x', {headers:{'content-length':String(MAX_PLAYER_BYTES + 1)}})));
  await assert.rejects(readPlayerHtml(new Response('x'.repeat(MAX_PLAYER_BYTES + 1))));
});
