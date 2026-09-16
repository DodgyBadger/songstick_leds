export const MAXIMUM_MIDI_BYTES = 1024 * 1024;

export interface StoredMidiFile {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  builtIn?: boolean;
}

interface StoredMidiRecord extends StoredMidiFile {
  bytes: ArrayBuffer;
}

const DATABASE_NAME = 'songstick-midi-library';
const DATABASE_VERSION = 1;
const SONG_STORE = 'songs';

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

export const builtInMidiBytes = new Uint8Array([
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
  size: builtInMidiBytes.byteLength,
  uploadedAt: '2026-09-02T00:00:00.000Z',
  builtIn: true,
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', () => reject(request.error ?? new Error('Browser storage request failed.')), { once: true });
});

const transactionCompletion = (transaction: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  transaction.addEventListener('complete', () => resolve(), { once: true });
  transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('Browser storage transaction was aborted.')), { once: true });
  transaction.addEventListener('error', () => reject(transaction.error ?? new Error('Browser storage transaction failed.')), { once: true });
});

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) {
    reject(new Error('This browser does not provide persistent local storage.'));
    return;
  }
  const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener('upgradeneeded', () => {
    if (!request.result.objectStoreNames.contains(SONG_STORE)) {
      request.result.createObjectStore(SONG_STORE, { keyPath: 'id' });
    }
  });
  request.addEventListener('success', () => resolve(request.result), { once: true });
  request.addEventListener('error', () => reject(request.error ?? new Error('The local song library could not be opened.')), { once: true });
  request.addEventListener('blocked', () => reject(new Error('Close other Songstick tabs, then try again.')), { once: true });
});

const withDatabase = async <T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    return await operation(database);
  } finally {
    database.close();
  }
};

export const validateMidiFile = (name: string, bytes: Uint8Array): void => {
  if (name.length === 0 || name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(name) || !/\.(mid|midi)$/i.test(name)) {
    throw new Error('A valid .mid or .midi filename is required.');
  }
  if (bytes.byteLength === 0) throw new Error('The MIDI file is empty.');
  if (bytes.byteLength > MAXIMUM_MIDI_BYTES) throw new Error('The MIDI file exceeds the 1 MiB limit.');
  if (bytes.byteLength < 4 || bytes[0] !== 0x4d || bytes[1] !== 0x54 || bytes[2] !== 0x68 || bytes[3] !== 0x64) {
    throw new Error('The file does not have a Standard MIDI header.');
  }
};

export const saveMidiFile = async (file: File): Promise<StoredMidiFile> => {
  if (file.size > MAXIMUM_MIDI_BYTES) throw new Error('The MIDI file exceeds the 1 MiB limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateMidiFile(file.name, bytes);
  const stored: StoredMidiRecord = {
    id: `${Date.now()}-${crypto.randomUUID()}.mid`,
    originalName: file.name,
    size: bytes.byteLength,
    uploadedAt: new Date().toISOString(),
    bytes: bytes.buffer,
  };
  await withDatabase(async (database) => {
    const transaction = database.transaction(SONG_STORE, 'readwrite');
    const completion = transactionCompletion(transaction);
    transaction.objectStore(SONG_STORE).add(stored);
    await completion;
  });
  const { bytes: _bytes, ...metadata } = stored;
  return metadata;
};

export const loadSavedMidiFile = async (id: string): Promise<Uint8Array> => {
  if (id === BUILT_IN_SONG.id) return builtInMidiBytes.slice();
  return withDatabase(async (database) => {
    const transaction = database.transaction(SONG_STORE, 'readonly');
    const completion = transactionCompletion(transaction);
    const record = await requestResult(transaction.objectStore(SONG_STORE).get(id)) as StoredMidiRecord | undefined;
    await completion;
    if (!record) throw new Error('The saved MIDI file was not found.');
    return new Uint8Array(record.bytes);
  });
};

export const listSavedMidiFiles = async (): Promise<StoredMidiFile[]> => {
  try {
    return await withDatabase(async (database) => {
      const transaction = database.transaction(SONG_STORE, 'readonly');
      const completion = transactionCompletion(transaction);
      const records = await requestResult(transaction.objectStore(SONG_STORE).getAll()) as StoredMidiRecord[];
      await completion;
      const songs = records
        .map(({ bytes: _bytes, ...metadata }) => metadata)
        .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
      return [BUILT_IN_SONG, ...songs];
    });
  } catch {
    return [BUILT_IN_SONG];
  }
};

export const deleteSavedMidiFile = async (id: string): Promise<void> => {
  if (id === BUILT_IN_SONG.id) throw new Error('The built-in demonstration song cannot be deleted.');
  await withDatabase(async (database) => {
    const transaction = database.transaction(SONG_STORE, 'readwrite');
    const completion = transactionCompletion(transaction);
    transaction.objectStore(SONG_STORE).delete(id);
    await completion;
  });
};
