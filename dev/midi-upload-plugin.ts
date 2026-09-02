import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';

export const MAXIMUM_MIDI_BYTES = 1024 * 1024;
export const MIDI_UPLOAD_ROUTE = '/api/midi-files';

interface StoredMidiFile {
  id: string;
  originalName: string;
  size: number;
}

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
};

const safeOriginalName = (header: string | undefined): string | null => {
  if (!header) return null;
  try {
    const basename = path.basename(decodeURIComponent(header)).replace(/[^a-zA-Z0-9._ -]/g, '_');
    if (!/\.(mid|midi)$/i.test(basename)) return null;
    return basename.slice(0, 120);
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
      const stored: StoredMidiFile = { id, originalName, size: bytes.length };
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

  if (request.method === 'GET') {
    const id = pathname.slice(`${MIDI_UPLOAD_ROUTE}/`.length);
    if (!/^\d+-[0-9a-f-]{36}\.mid$/.test(id)) {
      sendJson(response, 404, { error: 'The saved MIDI file was not found.' });
      return;
    }
    try {
      const bytes = await readFile(path.join(uploadDirectory, id));
      response.statusCode = 200;
      response.setHeader('Content-Type', 'audio/midi');
      response.setHeader('Content-Length', bytes.length);
      response.setHeader('Cache-Control', 'no-store');
      response.end(bytes);
    } catch {
      sendJson(response, 404, { error: 'The saved MIDI file was not found.' });
    }
    return;
  }

  response.setHeader('Allow', 'GET, POST');
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
