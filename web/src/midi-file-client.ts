export interface StoredMidiFile {
  id: string;
  originalName: string;
  size: number;
  uploadedAt: string;
}

const errorMessage = async (response: Response): Promise<string> => {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === 'string') return body.error;
  } catch {
    // Fall through to the status-based message.
  }
  return `MIDI storage request failed (${response.status}).`;
};

export const saveMidiFile = async (file: File): Promise<StoredMidiFile> => {
  const response = await fetch('/api/midi-files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Midi-Filename': encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json() as Promise<StoredMidiFile>;
};

export const loadSavedMidiFile = async (id: string): Promise<Uint8Array> => {
  const response = await fetch(`/api/midi-files/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(await errorMessage(response));
  return new Uint8Array(await response.arrayBuffer());
};

export const listSavedMidiFiles = async (): Promise<StoredMidiFile[]> => {
  const response = await fetch('/api/midi-files');
  if (!response.ok) throw new Error(await errorMessage(response));
  const body = await response.json() as { songs: StoredMidiFile[] };
  return body.songs;
};

export const deleteSavedMidiFile = async (id: string): Promise<void> => {
  const response = await fetch(`/api/midi-files/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response));
};
