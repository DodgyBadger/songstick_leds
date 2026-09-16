import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import {
  BUILT_IN_SONG,
  builtInMidiBytes,
  deleteSavedMidiFile,
  listSavedMidiFiles,
  loadSavedMidiFile,
  MAXIMUM_MIDI_BYTES,
  saveMidiFile,
  validateMidiFile,
} from '../../web/src/midi-file-client.ts';

const midiBytes = new Uint8Array([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
]);

test.beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
});

test('persists MIDI in browser storage and keeps the built-in song available', async () => {
  const originalName = 'Frère Jacques – take 1.MIDI';
  const stored = await saveMidiFile(new File([midiBytes], originalName));
  assert.equal(stored.originalName, originalName);
  assert.equal(stored.size, midiBytes.byteLength);
  assert(!Number.isNaN(Date.parse(stored.uploadedAt)));

  assert.deepEqual(await listSavedMidiFiles(), [BUILT_IN_SONG, stored]);
  assert.deepEqual(await loadSavedMidiFile(stored.id), midiBytes);
  assert.deepEqual(await loadSavedMidiFile(BUILT_IN_SONG.id), builtInMidiBytes);

  await deleteSavedMidiFile(stored.id);
  assert.deepEqual(await listSavedMidiFiles(), [BUILT_IN_SONG]);
  await assert.rejects(loadSavedMidiFile(stored.id), /not found/);
  await assert.rejects(deleteSavedMidiFile(BUILT_IN_SONG.id), /cannot be deleted/);
});

test('rejects invalid filenames, content, and oversized files before storage', async () => {
  assert.throws(() => validateMidiFile('song.txt', midiBytes), /valid .mid or .midi/);
  assert.throws(() => validateMidiFile('song.mid', new Uint8Array()), /empty/);
  assert.throws(() => validateMidiFile('song.mid', new TextEncoder().encode('not midi')), /Standard MIDI header/);

  const oversized = new File([new Uint8Array(MAXIMUM_MIDI_BYTES + 1)], 'large.mid');
  await assert.rejects(saveMidiFile(oversized), /1 MiB limit/);
  assert.deepEqual(await listSavedMidiFiles(), [BUILT_IN_SONG]);
});

test('keeps the built-in demo available without IndexedDB', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
  assert.deepEqual(await listSavedMidiFiles(), [BUILT_IN_SONG]);
  assert.deepEqual(await loadSavedMidiFile(BUILT_IN_SONG.id), builtInMidiBytes);
});
