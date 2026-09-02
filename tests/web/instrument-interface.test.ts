import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../../web/index.html', import.meta.url), 'utf8');

test('presents one bounded instrument screen before the virtual LED strip', () => {
  assert.equal((html.match(/id="device-screen"/g) ?? []).length, 1);
  assert(html.indexOf('id="device-screen"') < html.indexOf('id="led-strip"'));
});

test('defines separate library, player, and management states', () => {
  assert.match(html, /id="screen-library"/);
  assert.match(html, /id="screen-player"[^>]*hidden/);
  assert.match(html, /id="screen-manage"[^>]*hidden/);
});

test('keeps transport controls exclusively on the player screen', () => {
  assert.equal((html.match(/id="play-pause"/g) ?? []).length, 1);
  const player = html.slice(html.indexOf('id="screen-player"'), html.indexOf('id="screen-manage"'));
  assert.match(player, /id="play-pause"/);
  assert.match(player, /id="speed-down"/);
  assert.match(player, /id="speed-up"/);
});

test('keeps detailed diagnostics outside the instrument screen', () => {
  assert(html.indexOf('id="import-summary"') > html.indexOf('id="led-strip"'));
});
