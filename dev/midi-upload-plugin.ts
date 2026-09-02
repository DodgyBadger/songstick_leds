import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';

export const MAXIMUM_MIDI_BYTES = 1024 * 1024;
export const MIDI_UPLOAD_ROUTE = '/api/midi-files';

export interface StoredMidiFile {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  builtIn?: boolean;
}

const storedIdPattern = /^\d+-[0-9a-f-]{36}\.mid$/;
const builtInTrack = [
  0x00, 0xff, 0x03, 0x0e,
  0x53, 0x6f, 0x6e, 0x67, 0x73, 0x74, 0x69, 0x63, 0x6b, 0x20, 0x44, 0x65, 0x6d, 0x6f,
  0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
  ...[
    45, 47, 49, 50, 52, 54, 55, 57, 55, 54,
    52, 50, 49, 47, 45, 50, 52, 49, 47, 45,
  ].flatMap((pitch) => [0x00, 0x90, pitch, 0x64, 0x60, 0x80, pitch, 0x00]),
  0x00, 0xff, 0x2f, 0x00,
];
export const builtInMidiBytes = Buffer.from([
  0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
  0x4d, 0x54, 0x72, 0x6b,
  (builtInTrack.length >>> 24) & 0xff,
  (builtInTrack.length >>> 16) & 0xff,
  (builtInTrack.length >>> 8) & 0xff,
  builtInTrack.length & 0xff,
  ...builtInTrack,
]);
export const BUILT_IN_SONG: StoredMidiFile = {
  id: 'built-in-songstick-demo.mid',
  originalName: 'Songstick Demo.mid',
  size: builtInMidiBytes.length,
  uploadedAt: '2026-09-02T00:00:00.000Z',
  builtIn: true,
};
const metadataPath = (uploadDirectory: string, id: string): string =>
  path.join(uploadDirectory, `${id}.json`);

const listStoredMidiFiles = async (uploadDirectory: string): Promise<StoredMidiFile[]> => {
  await mkdir(uploadDirectory, { recursive: true });
  const entries = await readdir(uploadDirectory);
  const records = await Promise.all(entries.filter((entry) => storedIdPattern.test(entry)).map(async (id) => {
    try {
      const metadata = JSON.parse(await readFile(metadataPath(uploadDirectory, id), 'utf8')) as StoredMidiFile;
      if (metadata.id === id && typeof metadata.originalName === 'string' &&
          typeof metadata.size === 'number' && typeof metadata.uploadedAt === 'string') {
        return metadata;
      }
    } catch {
      // Files written before catalog metadata was introduced remain selectable.
    }
    const fileStat = await stat(path.join(uploadDirectory, id));
    return {
      id,
      originalName: id,
      size: fileStat.size,
      uploadedAt: fileStat.mtime.toISOString(),
    };
  }));
  return records.sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
};

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const sendMidi = (response: ServerResponse, bytes: Buffer): void => {
  response.statusCode = 200;
  response.setHeader('Content-Type', 'audio/midi');
  response.setHeader('Content-Length', bytes.length);
  response.setHeader('Cache-Control', 'no-store');
  response.end(bytes);
};

const safeOriginalName = (header: string | undefined): string | null => {
  if (!header) return null;
  try {
    const filename = decodeURIComponent(header);
    if (filename.length === 0 || filename.length > 255 ||
        filename !== path.basename(filename) || filename.includes('\\') ||
        /[\u0000-\u001f\u007f]/.test(filename) || !/\.(mid|midi)$/i.test(filename)) {
      return null;
    }
    return filename;
  } catch {
    return null;
  }
};

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAXIMUM_MIDI_BYTES) throw new Error('UPLOAD_TOO_LARGE');
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
};

export const createMidiUploadMiddleware = (
  uploadDirectory: string,
): Connect.NextHandleFunction => async (request, response, next) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname !== MIDI_UPLOAD_ROUTE && !pathname.startsWith(`${MIDI_UPLOAD_ROUTE}/`)) {
    next();
    return;
  }

  if (request.method === 'POST' && pathname === MIDI_UPLOAD_ROUTE) {
    const originalName = safeOriginalName(request.headers['x-midi-filename'] as string | undefined);
    if (!originalName) {
      sendJson(response, 400, { error: 'A valid .mid or .midi filename is required.' });
      return;
    }

    try {
      const bytes = await readRequestBody(request);
      if (bytes.length === 0) {
        sendJson(response, 400, { error: 'The MIDI file is empty.' });
        return;
      }
      if (bytes.subarray(0, 4).toString('ascii') !== 'MThd') {
        sendJson(response, 400, { error: 'The file does not have a Standard MIDI header.' });
        return;
      }

      await mkdir(uploadDirectory, { recursive: true });
      const id = `${Date.now()}-${randomUUID()}.mid`;
      await writeFile(path.join(uploadDirectory, id), bytes, { flag: 'wx' });
      const stored: StoredMidiFile = {
        id,
        originalName,
        size: bytes.length,
        uploadedAt: new Date().toISOString(),
      };
      await writeFile(metadataPath(uploadDirectory, id), `${JSON.stringify(stored, null, 2)}\n`, { flag: 'wx' });
      sendJson(response, 201, stored);
    } catch (error) {
      if (error instanceof Error && error.message === 'UPLOAD_TOO_LARGE') {
        sendJson(response, 413, { error: 'The MIDI file exceeds the 1 MiB limit.' });
        return;
      }
      sendJson(response, 500, { error: 'The MIDI file could not be saved.' });
    }
    return;
  }

  if (request.method === 'GET' && pathname === MIDI_UPLOAD_ROUTE) {
    try {
      sendJson(response, 200, { songs: [BUILT_IN_SONG, ...await listStoredMidiFiles(uploadDirectory)] });
    } catch {
      sendJson(response, 500, { error: 'The song library could not be read.' });
    }
    return;
  }

  if (request.method === 'GET') {
    const id = pathname.slice(`${MIDI_UPLOAD_ROUTE}/`.length);
    if (id === BUILT_IN_SONG.id) {
      sendMidi(response, builtInMidiBytes);
      return;
    }
    if (!storedIdPattern.test(id)) {
      sendJson(response, 404, { error: 'The saved MIDI file was not found.' });
      return;
    }
    try {
      const bytes = await readFile(path.join(uploadDirectory, id));
      sendMidi(response, bytes);
    } catch {
      sendJson(response, 404, { error: 'The saved MIDI file was not found.' });
    }
    return;
  }

  if (request.method === 'DELETE') {
    const id = pathname.slice(`${MIDI_UPLOAD_ROUTE}/`.length);
    if (id === BUILT_IN_SONG.id) {
      sendJson(response, 409, { error: 'The built-in demonstration song cannot be deleted.' });
      return;
    }
    if (!storedIdPattern.test(id)) {
      sendJson(response, 404, { error: 'The saved MIDI file was not found.' });
      return;
    }
    try {
      await unlink(path.join(uploadDirectory, id));
      await unlink(metadataPath(uploadDirectory, id)).catch(() => undefined);
      response.statusCode = 204;
      response.setHeader('Cache-Control', 'no-store');
      response.end();
    } catch {
      sendJson(response, 404, { error: 'The saved MIDI file was not found.' });
    }
    return;
  }

  response.setHeader('Allow', 'GET, POST, DELETE');
  sendJson(response, 405, { error: 'Method not allowed.' });
};

export const midiUploadPlugin = (): Plugin => {
  const uploadDirectory = path.resolve('var/midi-uploads');
  const install = (middlewares: Connect.Server): void => {
    middlewares.use(createMidiUploadMiddleware(uploadDirectory));
  };
  return {
    name: 'songstick-midi-upload',
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
};
