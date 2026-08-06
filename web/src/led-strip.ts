export type LedRole = 'off' | 'current' | 'next';

export interface LogicalLedOutput {
  active: boolean;
  stringIndex: number;
  fret: number;
  role: LedRole;
  intensityPermille: number;
}

export interface LogicalLedFrame {
  current: LogicalLedOutput;
  next: LogicalLedOutput;
}

export interface LedStripConfig {
  fretCount: number;
  ledsPerFret: number;
  ledsPerMeter: number | null;
  controller: string | null;
  colorOrder: 'RGB';
  fretToLedIndexes: number[][];
}

export interface PhysicalLedState {
  index: number;
  frets: number[];
  active: boolean;
  role: LedRole;
  intensityPermille: number;
  stringIndex: number | null;
  color: string;
}

export interface ConfigFields {
  fretCount: string;
  ledsPerFret: string;
  ledsPerMeter: string;
  controller: string;
  mapping: string;
}

export type ConfigResult =
  | { ok: true; config: LedStripConfig }
  | { ok: false; error: string };

const STRING_COLORS = ['#ff3b30', '#34c759', '#0a84ff'] as const;
const MAX_FRETS = 36;
const MAX_LEDS_PER_FRET = 16;
const MAX_LED_INDEX = 4095;

export const defaultLedStripConfig = (): LedStripConfig => ({
  fretCount: 12,
  ledsPerFret: 1,
  ledsPerMeter: null,
  controller: null,
  colorOrder: 'RGB',
  fretToLedIndexes: Array.from({ length: 12 }, (_, index) => [index]),
});

export const formatMapping = (mapping: readonly (readonly number[])[]): string =>
  mapping.map((indexes) => indexes.join(',')).join(';');

const parseInteger = (value: string, label: string, minimum: number, maximum: number): number => {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`${label} must be a whole number.`);
  }
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

export const parseLedStripConfig = (fields: ConfigFields): ConfigResult => {
  try {
    const fretCount = parseInteger(fields.fretCount, 'Fret count', 1, MAX_FRETS);
    const ledsPerFret = parseInteger(
      fields.ledsPerFret,
      'LEDs per fret',
      1,
      MAX_LEDS_PER_FRET,
    );
    const densityText = fields.ledsPerMeter.trim();
    const ledsPerMeter = densityText === ''
      ? null
      : parseInteger(densityText, 'LEDs per metre', 1, 1000);

    const groups = fields.mapping.split(';').map((group) => group.trim());
    if (groups.length !== fretCount) {
      throw new Error(`Index mapping needs ${fretCount} semicolon-separated fret groups.`);
    }

    const usedIndexes = new Set<number>();
    const fretToLedIndexes = groups.map((group, fretIndex) => {
      const values = group === '' ? [] : group.split(',').map((value) => value.trim());
      if (values.length !== ledsPerFret) {
        throw new Error(`Fret ${fretIndex + 1} needs exactly ${ledsPerFret} LED index value(s).`);
      }
      return values.map((value) => {
        const index = parseInteger(value, `Fret ${fretIndex + 1} LED index`, 0, MAX_LED_INDEX);
        if (usedIndexes.has(index)) {
          throw new Error(`LED index ${index} is mapped more than once.`);
        }
        usedIndexes.add(index);
        return index;
      });
    });

    return {
      ok: true,
      config: {
        fretCount,
        ledsPerFret,
        ledsPerMeter,
        controller: fields.controller.trim() || null,
        colorOrder: 'RGB',
        fretToLedIndexes,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid configuration.' };
  }
};

export const physicalLedCount = (config: LedStripConfig): number =>
  Math.max(...config.fretToLedIndexes.flat()) + 1;

export const mapLogicalFrame = (
  config: LedStripConfig,
  frame: LogicalLedFrame,
): PhysicalLedState[] => {
  const count = physicalLedCount(config);
  const fretsByIndex = Array.from({ length: count }, () => [] as number[]);
  config.fretToLedIndexes.forEach((indexes, fretIndex) => {
    indexes.forEach((index) => fretsByIndex[index].push(fretIndex + 1));
  });

  const leds = Array.from({ length: count }, (_, index): PhysicalLedState => ({
    index,
    frets: fretsByIndex[index],
    active: false,
    role: 'off',
    intensityPermille: 0,
    stringIndex: null,
    color: '#202832',
  }));

  const apply = (output: LogicalLedOutput): void => {
    if (!output.active || output.fret < 1 || output.fret > config.fretCount) return;
    for (const index of config.fretToLedIndexes[output.fret - 1]) {
      leds[index] = {
        ...leds[index],
        active: true,
        role: output.role,
        intensityPermille: output.intensityPermille,
        stringIndex: output.stringIndex,
        color: STRING_COLORS[output.stringIndex] ?? '#ffffff',
      };
    }
  };

  apply(frame.next);
  apply(frame.current);
  return leds;
};
