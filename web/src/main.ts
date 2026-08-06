import './styles.css';
import createSongstickModule from './generated/songstick.js';

type PlaybackStatus = 'stopped' | 'playing' | 'paused' | 'finished';

interface PlaybackSnapshot {
  status: PlaybackStatus;
  positionMicroseconds: number;
  speedPermille: number;
  currentEvent: number;
  nextEvent: number;
}

interface LedOutput {
  active: boolean;
  stringIndex: number;
  fret: number;
  role: 'off' | 'current' | 'next';
  intensityPermille: number;
}

interface LedFrame {
  current: LedOutput;
  next: LedOutput;
}

interface WasmPlayback {
  loadDemoSong(): boolean;
  play(): void;
  pause(): void;
  restart(): void;
  setSpeedPermille(speed: number): boolean;
  update(monotonicMicroseconds: number): void;
  state(): PlaybackSnapshot;
  ledFrame(): LedFrame;
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
const ledFrameElement = required<HTMLElement>('#led-frame');
const snapshotElement = required<HTMLElement>('#snapshot');

const module = (await createSongstickModule()) as SongstickModule;
const playback = new module.Playback();

if (!playback.loadDemoSong()) {
  throw new Error('The fixed integration song was rejected by the portable core.');
}

playPause.disabled = false;
restart.disabled = false;
speed.disabled = false;

const ledDescription = (output: LedOutput): string => {
  if (!output.active) return 'Off';
  return `${output.role}: string ${output.stringIndex + 1}, fret ${output.fret}, ${output.intensityPermille / 10}%`;
};

const renderLed = (output: LedOutput): HTMLElement => {
  const element = document.createElement('div');
  element.className = `led led--${output.role}`;
  element.classList.toggle('led--off', !output.active);
  element.textContent = ledDescription(output);
  return element;
};

const render = (): void => {
  const state = playback.state();
  const frame = playback.ledFrame();

  statusText.textContent = state.status;
  positionText.textContent = `${(state.positionMicroseconds / 1_000_000).toFixed(3)} s`;
  playPause.textContent = state.status === 'playing' ? 'Pause' : 'Play';
  ledFrameElement.replaceChildren(renderLed(frame.current), renderLed(frame.next));
  snapshotElement.textContent = JSON.stringify({ state, frame }, null, 2);
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

const update = (timestampMilliseconds: number): void => {
  playback.update(Math.round(timestampMilliseconds * 1000));
  render();
  requestAnimationFrame(update);
};

window.addEventListener('pagehide', () => playback.delete(), { once: true });
render();
requestAnimationFrame(update);
