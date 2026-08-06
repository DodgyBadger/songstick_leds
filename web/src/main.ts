import './styles.css';
import createSongstickModule from './generated/songstick.js';
import {
  defaultLedStripConfig,
  formatMapping,
  mapLogicalFrame,
  parseLedStripConfig,
  physicalLedCount,
  type LedStripConfig,
  type LogicalLedFrame,
} from './led-strip';

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
  update(monotonicMicroseconds: number): void;
  state(): PlaybackSnapshot;
  ledFrame(): LogicalLedFrame;
  delete(): void;
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
const mappingInput = required<HTMLTextAreaElement>('#index-mapping');
const resetConfig = required<HTMLButtonElement>('#reset-config');

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
  mappingInput.value = formatMapping(config.fretToLedIndexes);
};

populateConfigForm(stripConfig);
playPause.disabled = false;
restart.disabled = false;
speed.disabled = false;

const renderStrip = (frame: LogicalLedFrame): void => {
  const physicalFrame = mapLogicalFrame(stripConfig, frame);
  const elements = physicalFrame.map((led) => {
    const wrapper = document.createElement('div');
    wrapper.className = `physical-led physical-led--${led.role}`;
    wrapper.setAttribute(
      'aria-label',
      led.active
        ? `LED ${led.index}, fret ${led.frets.join(', ')}, ${led.role}, string ${(led.stringIndex ?? 0) + 1}`
        : `LED ${led.index}, ${led.frets.length ? `fret ${led.frets.join(', ')}` : 'unmapped'}, off`,
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
    fret.textContent = led.frets.length ? `F${led.frets.join(',')}` : '—';

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
  stripSummary.textContent = `${physicalLedCount(stripConfig)} physical LEDs · ${stripConfig.fretCount} frets · ${stripConfig.ledsPerFret} LED/fret · RGB · ${density} · ${controller}`;
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

configForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const result = parseLedStripConfig({
    fretCount: fretCountInput.value,
    ledsPerFret: ledsPerFretInput.value,
    ledsPerMeter: ledsPerMeterInput.value,
    controller: controllerInput.value,
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
requestAnimationFrame(update);
