import {
  defaultLedStripConfig,
  mapLogicalFrame,
  parseLedStripConfig,
  physicalLedCount,
} from '../../web/src/led-strip.ts';

const check = (condition: boolean, message: string): void => {
  if (!condition) throw new Error(message);
};

const defaultConfig = defaultLedStripConfig();
check(defaultConfig.fretCount === 12, 'default should contain 12 frets');
check(defaultConfig.ledsPerFret === 1, 'default should contain one LED per fret');
check(physicalLedCount(defaultConfig) === 12, 'default should contain 12 physical LEDs');

const duplicate = parseLedStripConfig({
  fretCount: '2',
  ledsPerFret: '1',
  ledsPerMeter: '',
  controller: '',
  mapping: '0;0',
});
check(!duplicate.ok, 'duplicate indexes should be rejected');

const incomplete = parseLedStripConfig({
  fretCount: '3',
  ledsPerFret: '1',
  ledsPerMeter: '',
  controller: '',
  mapping: '0;1',
});
check(!incomplete.ok, 'incomplete fret mappings should be rejected');

const dense = parseLedStripConfig({
  fretCount: '2',
  ledsPerFret: '2',
  ledsPerMeter: '60',
  controller: 'test controller',
  mapping: '4,5;8,9',
});
check(dense.ok, 'valid sparse multi-LED mappings should be accepted');
if (dense.ok) {
  check(physicalLedCount(dense.config) === 10, 'sparse mapping should retain physical indexes');
  check(dense.config.ledsPerMeter === 60, 'density should be preserved');
}

const mapped = mapLogicalFrame(defaultConfig, {
  next: {
    active: true,
    stringIndex: 1,
    fret: 4,
    role: 'next',
    intensityPermille: 400,
  },
  current: {
    active: true,
    stringIndex: 0,
    fret: 2,
    role: 'current',
    intensityPermille: 1000,
  },
});
check(mapped[1].role === 'current', 'current note should map to fret 2 / LED 1');
check(mapped[1].color === '#ff3b30', 'string 1 should render red');
check(mapped[3].role === 'next', 'next note should map to fret 4 / LED 3');
check(mapped[3].color === '#34c759', 'string 2 should render green');

const collision = mapLogicalFrame(defaultConfig, {
  next: {
    active: true,
    stringIndex: 1,
    fret: 2,
    role: 'next',
    intensityPermille: 400,
  },
  current: {
    active: true,
    stringIndex: 2,
    fret: 2,
    role: 'current',
    intensityPermille: 1000,
  },
});
check(collision[1].role === 'current', 'current output should win a physical-index collision');
check(collision[1].color === '#0a84ff', 'winning string 3 output should render blue');

console.log('LED strip configuration tests passed');
