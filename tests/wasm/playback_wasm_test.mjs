import createSongstickModule from '../../build/wasm/songstick.js';
import { readFile } from 'node:fs/promises';

const wasmBinary = await readFile(new URL('../../build/wasm/songstick.wasm', import.meta.url));
const module = await createSongstickModule({ wasmBinary });
const playback = new module.Playback();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  assert(playback.loadDemoSong(), 'demo song should load');
  let state = playback.state();
  assert(state.status === 'stopped', 'song should start stopped');
  assert(state.currentEvent === 0, 'first event should be ready');

  let frame = playback.ledFrame();
  assert(frame.current.active, 'ready frame should contain current LED');
  assert(frame.current.stringIndex === 0, 'first LED should use string zero');
  assert(frame.next.active, 'ready frame should contain next LED');

  playback.play();
  playback.update(1_000_000);
  playback.update(2_000_000);
  state = playback.state();
  assert(state.positionMicroseconds === 750_000, 'default speed should be 75%');
  assert(state.currentEvent === 0, 'first event should remain active');

  playback.pause();
  playback.update(10_000_000);
  assert(playback.state().positionMicroseconds === 750_000, 'pause should freeze position');

  assert(playback.setSpeedPermille(1000), '100% speed should be accepted');
  playback.play();
  playback.update(10_000_000);
  playback.update(10_250_000);
  assert(playback.state().positionMicroseconds === 1_000_000, 'resume should preserve position');

  console.log('WebAssembly playback integration passed');
} finally {
  playback.delete();
}
