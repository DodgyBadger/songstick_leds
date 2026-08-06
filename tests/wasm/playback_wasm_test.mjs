import createSongstickModule from '../../build/wasm/songstick.js';
import { readFile } from 'node:fs/promises';

const wasmBinary = await readFile(new URL('../../build/wasm/songstick.wasm', import.meta.url));
const module = await createSongstickModule({ wasmBinary });
const playback = new module.Playback();

function midiFile(track) {
  const bytes = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00, 0x00, 0x01, 0x01, 0xe0,
    0x4d, 0x54, 0x72, 0x6b,
    (track.length >>> 24) & 0xff,
    (track.length >>> 16) & 0xff,
    (track.length >>> 8) & 0xff,
    track.length & 0xff,
    ...track,
  ];
  return new Uint8Array(bytes);
}

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

  const imported = playback.importMidi(midiFile([
    0x00, 0xff, 0x03, 0x04, 0x57, 0x41, 0x53, 0x4d,
    0x00, 0x90, 0x32, 0x64,
    0x83, 0x60, 0x32, 0x00,
    0x00, 0xff, 0x2f, 0x00,
  ]));
  assert(imported.success, 'valid MIDI bytes should import');
  assert(imported.summary.trackName === 'WASM', 'track metadata should cross the boundary');
  assert(imported.summary.noteCount === 1, 'note count should cross the boundary');
  assert(playback.state().status === 'stopped', 'successful import should load the converted song');
  assert(playback.ledFrame().current.fret === 3, 'imported D3 should map to provisional fret 3');

  const malformed = playback.importMidi(new Uint8Array([0x00, 0x01]));
  assert(!malformed.success, 'invalid MIDI bytes should be rejected');
  assert(malformed.diagnostics[0].code === 'MIDI_HEADER_SIGNATURE', 'diagnostics should cross the boundary');

  const empty = playback.importMidi(new Uint8Array());
  assert(!empty.success, 'empty MIDI bytes should be rejected');
  assert(empty.diagnostics[0].code === 'MIDI_EMPTY', 'empty upload diagnostic should cross the boundary');

  const openString = playback.importMidi(midiFile([
    0x00, 0x90, 0x2d, 0x64,
    0x83, 0x60, 0x2d, 0x00,
    0x00, 0xff, 0x2f, 0x00,
  ]));
  assert(openString.success, 'provisional A2 open string should import');
  assert(openString.instrumentProfileId === 'provisional-a-mixolydian-v2', 'open profile version should cross the boundary');
  assert(playback.ledFrame().current.fret === 0, 'imported A2 should map to logical open');

  console.log('WebAssembly playback integration passed');
} finally {
  playback.delete();
}
