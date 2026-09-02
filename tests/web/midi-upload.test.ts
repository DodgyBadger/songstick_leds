import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createMidiUploadMiddleware, MIDI_UPLOAD_ROUTE } from '../../dev/midi-upload-plugin.ts';

const midiBytes = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
]);

test('persists an uploaded MIDI file and serves the saved bytes', async () => {
  const uploadDirectory = await mkdtemp(path.join(tmpdir(), 'songstick-midi-'));
  const middleware = createMidiUploadMiddleware(uploadDirectory);
  const server = createServer((request, response) => {
    middleware(request, response, () => {
      response.statusCode = 404;
      response.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const upload = await fetch(`${baseUrl}${MIDI_UPLOAD_ROUTE}`, {
      method: 'POST',
      headers: { 'X-Midi-Filename': encodeURIComponent('example tune.mid') },
      body: midiBytes,
    });
    assert.equal(upload.status, 201);
    const record = await upload.json() as { id: string; originalName: string; size: number; uploadedAt: string };
    assert.equal(record.originalName, 'example tune.mid');
    assert.equal(record.size, midiBytes.length);
    assert(!Number.isNaN(Date.parse(record.uploadedAt)));
    assert.deepEqual(await readFile(path.join(uploadDirectory, record.id)), midiBytes);

    const listing = await fetch(`${baseUrl}${MIDI_UPLOAD_ROUTE}`);
    assert.equal(listing.status, 200);
    assert.deepEqual(await listing.json(), { songs: [record] });

    const download = await fetch(`${baseUrl}${MIDI_UPLOAD_ROUTE}/${record.id}`);
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), midiBytes);

    const deletion = await fetch(`${baseUrl}${MIDI_UPLOAD_ROUTE}/${record.id}`, { method: 'DELETE' });
    assert.equal(deletion.status, 204);
    await assert.rejects(readFile(path.join(uploadDirectory, record.id)));
    assert.deepEqual(await (await fetch(`${baseUrl}${MIDI_UPLOAD_ROUTE}`)).json(), { songs: [] });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(uploadDirectory, { recursive: true, force: true });
  }
});

test('rejects content without a Standard MIDI header', async () => {
  const uploadDirectory = await mkdtemp(path.join(tmpdir(), 'songstick-midi-'));
  const middleware = createMidiUploadMiddleware(uploadDirectory);
  const server = createServer((request, response) => middleware(request, response, () => response.end()));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}${MIDI_UPLOAD_ROUTE}`, {
      method: 'POST',
      headers: { 'X-Midi-Filename': 'not-midi.mid' },
      body: Buffer.from('not midi'),
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'The file does not have a Standard MIDI header.' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(uploadDirectory, { recursive: true, force: true });
  }
});

test('rejects a file without a MIDI extension', async () => {
  const uploadDirectory = await mkdtemp(path.join(tmpdir(), 'songstick-midi-'));
  const middleware = createMidiUploadMiddleware(uploadDirectory);
  const server = createServer((request, response) => middleware(request, response, () => response.end()));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}${MIDI_UPLOAD_ROUTE}`, {
      method: 'POST',
      headers: { 'X-Midi-Filename': 'song.txt' },
      body: midiBytes,
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'A valid .mid or .midi filename is required.' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(uploadDirectory, { recursive: true, force: true });
  }
});
