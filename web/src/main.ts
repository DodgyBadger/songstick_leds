import './styles.css';
import createSongstickModule from './generated/songstick.js';
import { createElement as createIconElement, Play } from 'lucide';
import {
  defaultLedStripConfig,
  formatMapping,
  mapLogicalFrame,
  parseLedStripConfig,
  physicalLedCount,
  type LedStripConfig,
  type LogicalLedFrame,
} from './led-strip';
import {
  deleteSavedMidiFile,
  listSavedMidiFiles,
  loadSavedMidiFile,
  saveMidiFile,
  type StoredMidiFile,
} from './midi-file-client';

type PlaybackStatus = 'stopped' | 'playing' | 'paused' | 'finished';

interface PlaybackSnapshot {
  status: PlaybackStatus;
  positionMicroseconds: number;
  speedPermille: number;
  currentEvent: number;
  nextEvent: number;
}

interface WasmPlayback {
  loadDemoSong(): boolean;
  play(): void;
  pause(): void;
  restart(): void;
  setSpeedPermille(speed: number): boolean;
  importMidi(bytes: Uint8Array): MidiImportResult;
  update(monotonicMicroseconds: number): void;
  state(): PlaybackSnapshot;
  ledFrame(): LogicalLedFrame;
  delete(): void;
}

interface MidiImportSummary {
  format: number;
  ticksPerQuarter: number;
  trackName: string;
  midiEventCount: number;
  noteCount: number;
  tempoChangeCount: number;
  minimumPitch: number;
  maximumPitch: number;
  durationMicroseconds: number;
  timeSignatureNumerator: number;
  timeSignatureDenominator: number;
}

interface MidiDiagnostic {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  tick: number;
}

interface MidiImportResult {
  success: boolean;
  instrumentProfileId: string;
  summary: MidiImportSummary;
  diagnostics: MidiDiagnostic[];
}

interface SongstickModule {
  Playback: new () => WasmPlayback;
}

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const playPause = required<HTMLButtonElement>('#play-pause');
const restart = required<HTMLButtonElement>('#restart');
const speed = required<HTMLSelectElement>('#speed');
const statusText = required<HTMLElement>('#status');
const positionText = required<HTMLElement>('#position');
const stripElement = required<HTMLElement>('#led-strip');
const stripSummary = required<HTMLElement>('#strip-summary');
const snapshotElement = required<HTMLElement>('#snapshot');
const configForm = required<HTMLFormElement>('#strip-config');
const configError = required<HTMLElement>('#config-error');
const fretCountInput = required<HTMLInputElement>('#fret-count');
const ledsPerFretInput = required<HTMLInputElement>('#leds-per-fret');
const ledsPerMeterInput = required<HTMLInputElement>('#leds-per-meter');
const controllerInput = required<HTMLInputElement>('#controller');
const openMappingInput = required<HTMLInputElement>('#open-index-mapping');
const mappingInput = required<HTMLTextAreaElement>('#index-mapping');
const resetConfig = required<HTMLButtonElement>('#reset-config');
const midiFileInput = required<HTMLInputElement>('#midi-file');
const importStatus = required<HTMLElement>('#import-status');
const importSummary = required<HTMLElement>('#import-summary');
const importSummaryGrid = required<HTMLElement>('#import-summary-grid');
const importDiagnostics = required<HTMLElement>('#import-diagnostics');
const songLabel = required<HTMLElement>('#song-label');
const songList = required<HTMLElement>('#song-list');
const libraryStatus = required<HTMLElement>('#library-status');

const module = (await createSongstickModule()) as SongstickModule;
const playback = new module.Playback();

if (!playback.loadDemoSong()) {
  throw new Error('The fixed integration song was rejected by the portable core.');
}

let stripConfig = defaultLedStripConfig();

const populateConfigForm = (config: LedStripConfig): void => {
  fretCountInput.value = String(config.fretCount);
  ledsPerFretInput.value = String(config.ledsPerFret);
  ledsPerMeterInput.value = config.ledsPerMeter === null ? '' : String(config.ledsPerMeter);
  controllerInput.value = config.controller ?? '';
  openMappingInput.value = config.openLedIndexes.join(',');
  mappingInput.value = formatMapping(config.fretToLedIndexes);
};

populateConfigForm(stripConfig);
playPause.disabled = false;
restart.disabled = false;
speed.disabled = false;

const midiNoteName = (pitch: number): string => {
  const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
};

const summaryItem = (label: string, value: string): HTMLElement => {
  const item = document.createElement('span');
  const small = document.createElement('small');
  small.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = value;
  item.append(small, strong);
  return item;
};

const renderImportResult = (filename: string, result: MidiImportResult): void => {
  const summary = result.summary;
  importSummary.hidden = false;
  importStatus.textContent = result.success
    ? `${filename} was loaded and is playing.`
    : `${filename} is stored, but could not be converted for playback.`;
  importStatus.className = result.success ? 'import-status import-status--success' : 'import-status import-status--error';

  const pitchRange = summary.noteCount === 0
    ? '—'
    : `${midiNoteName(summary.minimumPitch)}–${midiNoteName(summary.maximumPitch)}`;
  const timeSignature = summary.timeSignatureNumerator === 0
    ? 'Not specified'
    : `${summary.timeSignatureNumerator}/${summary.timeSignatureDenominator}`;
  importSummaryGrid.replaceChildren(
    summaryItem('Track', summary.trackName || 'Unnamed'),
    summaryItem('Format', String(summary.format)),
    summaryItem('Duration', `${(summary.durationMicroseconds / 1_000_000).toFixed(2)} s`),
    summaryItem('Notes', String(summary.noteCount)),
    summaryItem('Pitch range', pitchRange),
    summaryItem('PPQN', String(summary.ticksPerQuarter || '—')),
    summaryItem('Tempo events', String(summary.tempoChangeCount)),
    summaryItem('Time signature', timeSignature),
  );

  const diagnosticElements = result.diagnostics.map((diagnostic) => {
    const item = document.createElement('li');
    item.className = `diagnostic diagnostic--${diagnostic.severity}`;
    const code = document.createElement('code');
    code.textContent = diagnostic.code;
    const message = document.createElement('span');
    message.textContent = `${diagnostic.message}${diagnostic.tick > 0 ? ` (tick ${diagnostic.tick})` : ''}`;
    item.append(code, message);
    return item;
  });
  importDiagnostics.replaceChildren(...diagnosticElements);
  importDiagnostics.hidden = diagnosticElements.length === 0;

  if (result.success) {
    songLabel.textContent = summary.trackName || filename;
    speed.value = '750';
    playback.play();
    render();
  }
};

const playSavedSong = async (song: StoredMidiFile): Promise<void> => {
  importStatus.className = 'import-status';
  importStatus.textContent = `Loading ${song.originalName}…`;
  try {
    renderImportResult(song.originalName, playback.importMidi(await loadSavedMidiFile(song.id)));
  } catch (error) {
    importStatus.className = 'import-status import-status--error';
    importStatus.textContent = error instanceof Error ? error.message : 'The saved MIDI file could not be loaded.';
  }
};

const renderSongLibrary = (songs: StoredMidiFile[]): void => {
  if (songs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'song-library__empty';
    empty.textContent = 'No MIDI songs have been imported yet.';
    songList.replaceChildren(empty);
    return;
  }

  songList.replaceChildren(...songs.map((song) => {
    const item = document.createElement('article');
    item.className = 'song-item';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = song.originalName;
    title.title = song.originalName;
    if (song.builtIn) {
      const badge = document.createElement('span');
      badge.className = 'song-item__badge';
      badge.textContent = 'Built in';
      title.append(' ', badge);
    }
    details.append(title);

    const playButton = document.createElement('button');
    playButton.className = 'song-item__play';
    playButton.type = 'button';
    playButton.setAttribute('aria-label', `Play ${song.originalName}`);
    playButton.title = `Play ${song.originalName}`;
    playButton.append(createIconElement(Play, {
      width: '13',
      height: '13',
      'stroke-width': '2.25',
      'aria-hidden': 'true',
    }));
    playButton.addEventListener('click', () => void playSavedSong(song));
    item.append(playButton, details);
    if (!song.builtIn) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'button button--danger song-item__delete';
      deleteButton.type = 'button';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm(`Delete ${song.originalName}?`)) return;
        try {
          await deleteSavedMidiFile(song.id);
          libraryStatus.textContent = `${song.originalName} was deleted.`;
          await refreshSongLibrary();
        } catch (error) {
          libraryStatus.textContent = error instanceof Error ? error.message : 'The song could not be deleted.';
        }
      });
      item.append(deleteButton);
    }
    return item;
  }));
};

const refreshSongLibrary = async (): Promise<void> => {
  try {
    const songs = await listSavedMidiFiles();
    renderSongLibrary(songs);
    if (!libraryStatus.textContent) {
      libraryStatus.textContent = `${songs.length} ${songs.length === 1 ? 'song' : 'songs'} available.`;
    }
  } catch (error) {
    libraryStatus.textContent = error instanceof Error ? error.message : 'The song library could not be loaded.';
  }
};

const renderStrip = (frame: LogicalLedFrame): void => {
  const physicalFrame = mapLogicalFrame(stripConfig, frame);
  const elements = physicalFrame.map((led) => {
    const wrapper = document.createElement('div');
    wrapper.className = `physical-led physical-led--${led.role}${led.open ? ' physical-led--open' : ''}`;
    wrapper.setAttribute(
      'aria-label',
      led.active
        ? `LED ${led.index}, ${led.open ? 'open position' : `fret ${led.frets.join(', ')}`}, ${led.role}, string ${(led.stringIndex ?? 0) + 1}`
        : `LED ${led.index}, ${led.open ? 'open position' : led.frets.length ? `fret ${led.frets.join(', ')}` : 'unmapped'}, off`,
    );

    const index = document.createElement('span');
    index.className = 'physical-led__index';
    index.textContent = `#${led.index}`;

    const light = document.createElement('span');
    light.className = 'physical-led__light';
    light.style.setProperty('--led-color', led.color);
    light.style.setProperty('--led-level', String(led.intensityPermille / 1000));

    const fret = document.createElement('span');
    fret.className = 'physical-led__fret';
    fret.textContent = led.open ? 'OPEN' : led.frets.length ? `F${led.frets.join(',')}` : '—';

    wrapper.append(index, light, fret);
    return wrapper;
  });
  stripElement.replaceChildren(...elements);
  stripElement.setAttribute(
    'aria-label',
    `Simulated RGB strip with ${physicalFrame.length} physical LEDs mapped across ${stripConfig.fretCount} frets`,
  );

  const density = stripConfig.ledsPerMeter === null
    ? 'density unspecified'
    : `${stripConfig.ledsPerMeter} LEDs/m`;
  const controller = stripConfig.controller ?? 'controller unspecified';
  stripSummary.textContent = `${physicalLedCount(stripConfig)} physical LEDs · shared open indicator · ${stripConfig.fretCount} frets · ${stripConfig.ledsPerFret} LED/fret · RGB · ${density} · ${controller}`;
};

const render = (): void => {
  const state = playback.state();
  const frame = playback.ledFrame();

  statusText.textContent = state.status;
  positionText.textContent = `${(state.positionMicroseconds / 1_000_000).toFixed(3)} s`;
  playPause.textContent = state.status === 'playing' ? 'Pause' : 'Play';
  renderStrip(frame);
  snapshotElement.textContent = JSON.stringify({ state, logicalFrame: frame, stripConfig }, null, 2);
};

playPause.addEventListener('click', () => {
  if (playback.state().status === 'playing') playback.pause();
  else playback.play();
  render();
});

restart.addEventListener('click', () => {
  playback.restart();
  render();
});

speed.addEventListener('change', () => {
  playback.setSpeedPermille(Number(speed.value));
  render();
});

midiFileInput.addEventListener('change', async () => {
  const file = midiFileInput.files?.[0];
  if (!file) return;
  importStatus.className = 'import-status';
  importStatus.textContent = `Saving ${file.name}…`;
  try {
    const stored = await saveMidiFile(file);
    importStatus.className = 'import-status import-status--success';
    importStatus.textContent = `${stored.originalName} was imported into the song library.`;
    libraryStatus.textContent = '';
    await refreshSongLibrary();
  } catch (error) {
    importStatus.className = 'import-status import-status--error';
    importStatus.textContent = error instanceof Error ? error.message : 'The MIDI import failed unexpectedly.';
  }
});

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseLedStripConfig({
    fretCount: fretCountInput.value,
    ledsPerFret: ledsPerFretInput.value,
    ledsPerMeter: ledsPerMeterInput.value,
    controller: controllerInput.value,
    openMapping: openMappingInput.value,
    mapping: mappingInput.value,
  });
  if (!result.ok) {
    configError.textContent = result.error;
    return;
  }
  configError.textContent = '';
  stripConfig = result.config;
  render();
});

resetConfig.addEventListener('click', () => {
  stripConfig = defaultLedStripConfig();
  populateConfigForm(stripConfig);
  configError.textContent = '';
  render();
});

const update = (timestampMilliseconds: number): void => {
  playback.update(Math.round(timestampMilliseconds * 1000));
  render();
  requestAnimationFrame(update);
};

window.addEventListener('pagehide', () => playback.delete(), { once: true });
render();
void refreshSongLibrary();
requestAnimationFrame(update);
