import './styles.css';
import createSongstickModule from './generated/songstick.js';
import { createElement as createIconElement, Pause, Play, RotateCcw, Trash2 } from 'lucide';
import {
  defaultLedStripConfig, formatMapping, mapLogicalFrame, parseLedStripConfig, physicalLedCount,
  type LedStripConfig, type LogicalLedFrame,
} from './led-strip';
import {
  deleteSavedMidiFile, listSavedMidiFiles, loadSavedMidiFile, saveMidiFile, type StoredMidiFile,
} from './midi-file-client';

type PlaybackStatus = 'stopped' | 'playing' | 'paused' | 'finished';
type ScreenName = 'library' | 'player' | 'manage';

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
interface SongstickModule { Playback: new () => WasmPlayback; }

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
};

const screens: Record<ScreenName, HTMLElement> = {
  library: required('#screen-library'),
  player: required('#screen-player'),
  manage: required('#screen-manage'),
};
const deviceScreen = required<HTMLElement>('#device-screen');
const viewportSize = required<HTMLSelectElement>('#viewport-size');
const librarySongList = required<HTMLElement>('#library-song-list');
const manageSongList = required<HTMLElement>('#manage-song-list');
const libraryStatus = required<HTMLElement>('#library-status');
const openManage = required<HTMLButtonElement>('#open-manage');
const manageBack = required<HTMLButtonElement>('#manage-back');
const playerBack = required<HTMLButtonElement>('#player-back');
const playerTitle = required<HTMLElement>('#player-title');
const playPause = required<HTMLButtonElement>('#play-pause');
const restart = required<HTMLButtonElement>('#restart');
const speedDown = required<HTMLButtonElement>('#speed-down');
const speedUp = required<HTMLButtonElement>('#speed-up');
const speedDisplay = required<HTMLElement>('#speed-display');
const statusText = required<HTMLElement>('#status');
const positionText = required<HTMLElement>('#position');
const playerProgress = required<HTMLProgressElement>('#player-progress');
const midiFileInput = required<HTMLInputElement>('#midi-file');
const importStatus = required<HTMLElement>('#import-status');
const deleteConfirmation = required<HTMLElement>('#delete-confirmation');
const deleteSongName = required<HTMLElement>('#delete-song-name');
const cancelDelete = required<HTMLButtonElement>('#cancel-delete');
const confirmDelete = required<HTMLButtonElement>('#confirm-delete');
const importSummary = required<HTMLElement>('#import-summary');
const importSummaryGrid = required<HTMLElement>('#import-summary-grid');
const importDiagnostics = required<HTMLElement>('#import-diagnostics');
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

const module = (await createSongstickModule()) as SongstickModule;
const playback = new module.Playback();
if (!playback.loadDemoSong()) throw new Error('The fixed integration song was rejected by the portable core.');

let stripConfig = defaultLedStripConfig();
let songs: StoredMidiFile[] = [];
let activeSong: StoredMidiFile | null = null;
let activeDurationMicroseconds = 0;
let pendingDelete: StoredMidiFile | null = null;
let renderedPlaybackStatus: PlaybackStatus | null = null;

const icon = (iconNode: Parameters<typeof createIconElement>[0], size: number): SVGElement =>
  createIconElement(iconNode, {
    width: String(size), height: String(size), 'stroke-width': '2.25', 'aria-hidden': 'true',
  });
restart.append(icon(RotateCcw, 15));

const showScreen = (name: ScreenName): void => {
  for (const [screenName, screen] of Object.entries(screens)) screen.hidden = screenName !== name;
};

const populateConfigForm = (config: LedStripConfig): void => {
  fretCountInput.value = String(config.fretCount);
  ledsPerFretInput.value = String(config.ledsPerFret);
  ledsPerMeterInput.value = config.ledsPerMeter === null ? '' : String(config.ledsPerMeter);
  controllerInput.value = config.controller ?? '';
  openMappingInput.value = config.openLedIndexes.join(',');
  mappingInput.value = formatMapping(config.fretToLedIndexes);
};
populateConfigForm(stripConfig);

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
const renderImportDetails = (result: MidiImportResult): void => {
  const summary = result.summary;
  importSummary.hidden = false;
  importSummaryGrid.replaceChildren(
    summaryItem('Track', summary.trackName || 'Unnamed'),
    summaryItem('Format', String(summary.format)),
    summaryItem('Duration', `${(summary.durationMicroseconds / 1_000_000).toFixed(2)} s`),
    summaryItem('Notes', String(summary.noteCount)),
    summaryItem('Pitch range', summary.noteCount === 0 ? '—' : `${midiNoteName(summary.minimumPitch)}–${midiNoteName(summary.maximumPitch)}`),
    summaryItem('PPQN', String(summary.ticksPerQuarter || '—')),
    summaryItem('Tempo events', String(summary.tempoChangeCount)),
    summaryItem('Time signature', summary.timeSignatureNumerator === 0 ? 'Not specified' : `${summary.timeSignatureNumerator}/${summary.timeSignatureDenominator}`),
  );
  const diagnostics = result.diagnostics.map((diagnostic) => {
    const item = document.createElement('li');
    item.className = `diagnostic diagnostic--${diagnostic.severity}`;
    const code = document.createElement('code');
    code.textContent = diagnostic.code;
    const message = document.createElement('span');
    message.textContent = `${diagnostic.message}${diagnostic.tick > 0 ? ` (tick ${diagnostic.tick})` : ''}`;
    item.append(code, message);
    return item;
  });
  importDiagnostics.replaceChildren(...diagnostics);
  importDiagnostics.hidden = diagnostics.length === 0;
};

const setPlayerEnabled = (enabled: boolean): void => {
  playPause.disabled = !enabled;
  restart.disabled = !enabled;
  speedDown.disabled = !enabled;
  speedUp.disabled = !enabled;
};
const selectSong = async (song: StoredMidiFile): Promise<void> => {
  activeSong = null;
  activeDurationMicroseconds = 0;
  playerTitle.textContent = song.originalName;
  playerTitle.title = song.originalName;
  statusText.textContent = 'Loading…';
  setPlayerEnabled(false);
  showScreen('player');
  try {
    const result = playback.importMidi(await loadSavedMidiFile(song.id));
    renderImportDetails(result);
    if (!result.success) {
      statusText.textContent = result.diagnostics[0]?.message ?? 'This song cannot be played.';
      return;
    }
    activeSong = song;
    activeDurationMicroseconds = result.summary.durationMicroseconds;
    playback.setSpeedPermille(750);
    statusText.textContent = 'Ready';
    setPlayerEnabled(true);
    render();
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : 'The song could not be loaded.';
  }
};

const libraryRow = (song: StoredMidiFile): HTMLElement => {
  const row = document.createElement('button');
  row.className = 'screen-song-row';
  row.type = 'button';
  row.setAttribute('role', 'listitem');
  row.title = song.originalName;
  const title = document.createElement('span');
  title.textContent = song.originalName;
  row.append(title);
  if (song.builtIn) {
    const badge = document.createElement('small');
    badge.textContent = 'Built in';
    row.append(badge);
  }
  row.addEventListener('click', () => void selectSong(song));
  return row;
};
const openDeleteConfirmation = (song: StoredMidiFile): void => {
  pendingDelete = song;
  deleteSongName.textContent = song.originalName;
  deleteConfirmation.hidden = false;
  cancelDelete.focus();
};
const manageRow = (song: StoredMidiFile): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'screen-song-row screen-song-row--manage';
  row.setAttribute('role', 'listitem');
  const title = document.createElement('span');
  title.textContent = song.originalName;
  title.title = song.originalName;
  row.append(title);
  if (song.builtIn) {
    const badge = document.createElement('small');
    badge.textContent = 'Built in';
    row.append(badge);
  } else {
    const deleteButton = document.createElement('button');
    deleteButton.className = 'screen-delete';
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', `Delete ${song.originalName}`);
    deleteButton.title = `Delete ${song.originalName}`;
    deleteButton.append(icon(Trash2, 13));
    deleteButton.addEventListener('click', () => openDeleteConfirmation(song));
    row.append(deleteButton);
  }
  return row;
};
const renderSongLists = (): void => {
  librarySongList.replaceChildren(...songs.map(libraryRow));
  manageSongList.replaceChildren(...songs.map(manageRow));
};
const refreshSongLibrary = async (): Promise<void> => {
  try {
    songs = await listSavedMidiFiles();
    renderSongLists();
    libraryStatus.textContent = `${songs.length} ${songs.length === 1 ? 'song' : 'songs'} available`;
  } catch (error) {
    libraryStatus.textContent = error instanceof Error ? error.message : 'The song library could not be loaded.';
  }
};

const renderStrip = (frame: LogicalLedFrame): void => {
  const physicalFrame = mapLogicalFrame(stripConfig, frame);
  const elements = physicalFrame.map((led) => {
    const wrapper = document.createElement('div');
    wrapper.className = `physical-led physical-led--${led.role}${led.open ? ' physical-led--open' : ''}`;
    wrapper.setAttribute('aria-label', led.active
      ? `LED ${led.index}, ${led.open ? 'open position' : `fret ${led.frets.join(', ')}`}, ${led.role}, string ${(led.stringIndex ?? 0) + 1}`
      : `LED ${led.index}, ${led.open ? 'open position' : led.frets.length ? `fret ${led.frets.join(', ')}` : 'unmapped'}, off`);
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
  stripElement.setAttribute('aria-label', `Simulated RGB strip with ${physicalFrame.length} physical LEDs mapped across ${stripConfig.fretCount} frets`);
  const density = stripConfig.ledsPerMeter === null ? 'density unspecified' : `${stripConfig.ledsPerMeter} LEDs/m`;
  const controller = stripConfig.controller ?? 'controller unspecified';
  stripSummary.textContent = `${physicalLedCount(stripConfig)} physical LEDs · shared open indicator · ${stripConfig.fretCount} frets · ${stripConfig.ledsPerFret} LED/fret · RGB · ${density} · ${controller}`;
};

const render = (): void => {
  const state = playback.state();
  const frame = playback.ledFrame();
  if (activeSong) statusText.textContent = state.status === 'stopped' ? 'Ready' : state.status;
  positionText.textContent = `${(state.positionMicroseconds / 1_000_000).toFixed(1)} s`;
  speedDisplay.textContent = `${Math.round(state.speedPermille / 10)}%`;
  playerProgress.max = Math.max(1, activeDurationMicroseconds);
  playerProgress.value = Math.min(state.positionMicroseconds, activeDurationMicroseconds);
  speedDown.disabled = !activeSong || state.speedPermille <= 500;
  speedUp.disabled = !activeSong || state.speedPermille >= 1000;
  if (renderedPlaybackStatus !== state.status) {
    const playing = state.status === 'playing';
    playPause.replaceChildren(icon(playing ? Pause : Play, 22));
    playPause.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playPause.title = playing ? 'Pause' : 'Play';
    renderedPlaybackStatus = state.status;
  }
  renderStrip(frame);
  snapshotElement.textContent = JSON.stringify({ state, logicalFrame: frame, stripConfig, activeSong }, null, 2);
};

openManage.addEventListener('click', () => showScreen('manage'));
manageBack.addEventListener('click', () => showScreen('library'));
playerBack.addEventListener('click', () => showScreen('library'));
viewportSize.addEventListener('change', () => { deviceScreen.dataset.viewport = viewportSize.value; });
playPause.addEventListener('click', () => {
  const state = playback.state();
  if (state.status === 'playing') playback.pause();
  else {
    if (state.status === 'finished') playback.restart();
    playback.play();
  }
  render();
});
restart.addEventListener('click', () => { playback.restart(); render(); });
const changeSpeed = (difference: number): void => {
  const next = Math.max(500, Math.min(1000, playback.state().speedPermille + difference));
  playback.setSpeedPermille(next);
  render();
};
speedDown.addEventListener('click', () => changeSpeed(-100));
speedUp.addEventListener('click', () => changeSpeed(100));

midiFileInput.addEventListener('change', async () => {
  const file = midiFileInput.files?.[0];
  if (!file) return;
  importStatus.className = 'screen-status';
  importStatus.textContent = `Importing ${file.name}…`;
  try {
    const stored = await saveMidiFile(file);
    importStatus.className = 'screen-status screen-status--success';
    importStatus.textContent = `${stored.originalName} imported.`;
    await refreshSongLibrary();
  } catch (error) {
    importStatus.className = 'screen-status screen-status--error';
    importStatus.textContent = error instanceof Error ? error.message : 'The MIDI import failed.';
  } finally {
    midiFileInput.value = '';
  }
});
cancelDelete.addEventListener('click', () => {
  pendingDelete = null;
  deleteConfirmation.hidden = true;
});
confirmDelete.addEventListener('click', async () => {
  if (!pendingDelete) return;
  const song = pendingDelete;
  confirmDelete.disabled = true;
  try {
    await deleteSavedMidiFile(song.id);
    if (activeSong?.id === song.id) {
      activeSong = null;
      activeDurationMicroseconds = 0;
      setPlayerEnabled(false);
    }
    importStatus.className = 'screen-status screen-status--success';
    importStatus.textContent = `${song.originalName} deleted.`;
    pendingDelete = null;
    deleteConfirmation.hidden = true;
    await refreshSongLibrary();
  } catch (error) {
    importStatus.className = 'screen-status screen-status--error';
    importStatus.textContent = error instanceof Error ? error.message : 'The song could not be deleted.';
    deleteConfirmation.hidden = true;
  } finally {
    confirmDelete.disabled = false;
  }
});

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseLedStripConfig({
    fretCount: fretCountInput.value, ledsPerFret: ledsPerFretInput.value,
    ledsPerMeter: ledsPerMeterInput.value, controller: controllerInput.value,
    openMapping: openMappingInput.value, mapping: mappingInput.value,
  });
  if (!result.ok) { configError.textContent = result.error; return; }
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
setPlayerEnabled(false);
showScreen('library');
window.addEventListener('pagehide', () => playback.delete(), { once: true });
render();
void refreshSongLibrary();
requestAnimationFrame(update);
