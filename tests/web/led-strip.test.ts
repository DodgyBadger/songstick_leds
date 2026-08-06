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
check(defaultConfig.openLedIndexes[0] === 0, 'default open position should use LED 0');
check(physicalLedCount(defaultConfig) === 13, 'default should contain open plus 12 fret LEDs');

const duplicate = parseLedStripConfig({
  fretCount: '2',
  ledsPerFret: '1',
  ledsPerMeter: '',
  controller: '',
  openMapping: '0',
  mapping: '1;1',
});
check(!duplicate.ok, 'duplicate indexes should be rejected');

const incomplete = parseLedStripConfig({
  fretCount: '3',
  ledsPerFret: '1',
  ledsPerMeter: '',
  controller: '',
  openMapping: '0',
  mapping: '1;2',
});
check(!incomplete.ok, 'incomplete fret mappings should be rejected');

const dense = parseLedStripConfig({
  fretCount: '2',
  ledsPerFret: '2',
  ledsPerMeter: '60',
  controller: 'test controller',
  openMapping: '0',
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
check(mapped[2].role === 'current', 'current note should map to fret 2 / LED 2');
check(mapped[2].color === '#ff3b30', 'string 1 should render red');
check(mapped[4].role === 'next', 'next note should map to fret 4 / LED 4');
check(mapped[4].color === '#34c759', 'string 2 should render green');

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
check(collision[2].role === 'current', 'current output should win a physical-index collision');
check(collision[2].color === '#0a84ff', 'winning string 3 output should render blue');

const open = mapLogicalFrame(defaultConfig, {
  next: {
    active: true,
    stringIndex: 1,
    fret: 0,
    role: 'next',
    intensityPermille: 400,
  },
  current: {
    active: true,
    stringIndex: 0,
    fret: 0,
    role: 'current',
    intensityPermille: 1000,
  },
});
check(open[0].open, 'LED 0 should be labelled as the open position');
check(open[0].role === 'current', 'current open note should win a shared-open collision');
check(open[0].color === '#ff3b30', 'open string 1 should render red');

const duplicateOpen = parseLedStripConfig({
  fretCount: '2',
  ledsPerFret: '1',
  ledsPerMeter: '',
  controller: '',
  openMapping: '1',
  mapping: '1;2',
});
check(!duplicateOpen.ok, 'an open LED index reused by a fret should be rejected');

console.log('LED strip configuration tests passed');
