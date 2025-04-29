// ts/config.ts

// --- Utility Type for Deep Partial ---
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T[P] extends object
    ? DeepPartial<T[P]>
    : T[P];
};

// --- Interfaces ---
export interface TimingConfig {
  gameLoopInterval: number;
  baseAddBlockInterval: number;
  intervalRandomnessFactor: number;
  maxAddBlockIntervalMs: number;
  minAddBlockIntervalMs: number;
  clusterInterval: number;
  actionCooldownMs: number;
  correctNoteGracePeriodMs: number;
  blockRemoveEffectDurationMs: number;
  levelFlashDurationMs: number;
  penaltyDelayMs: number;
}
export interface DifficultyConfig {
  initialSpeedMultiplier: number;
  notesPerLevel: number;
  fallSpeedIncreaseFactor: number;
}
export interface RulesConfig {
  baseBlockFallSpeed: number;
  minClearAmplitude: number;
  minPenaltyAmplitude: number;
  noteDisplayAmplitudeThreshold: number;
  maxPenalty: number;
  penaltyIncrement: number;
  penaltyBlockCount: number;
  clusterChance: number;
  clusterMaxNotes: number;
  skipSpawnChance: number;
  allowedNotes: string[];
}
export interface LayoutConfig {
  gameAreaHeight: number;
  gameAreaWidth: number;
  numColumns: number;
  columnWidth: number;
  blockWidthPercent: number;
  blockWidth: number;
  blockHeight: number;
}
export interface GameConfig {
  timing: TimingConfig;
  difficulty: DifficultyConfig;
  rules: RulesConfig;
  layout: LayoutConfig;
}

// --- Notes & Scales ---
export const ALL_CHROMATIC_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const MAJOR_SCALE_INTERVALS = [2, 2, 1, 2, 2, 2, 1];

export function generateMajorScale(rootNote: string): string[] {
  const scale: string[] = [];
  let currentNoteIndex = ALL_CHROMATIC_NOTES.indexOf(rootNote);
  if (currentNoteIndex === -1) {
    console.error(`Invalid root note: ${rootNote}. Defaulting to C Major.`);
    currentNoteIndex = 0;
  }
  scale.push(ALL_CHROMATIC_NOTES[currentNoteIndex]);
  for (const interval of MAJOR_SCALE_INTERVALS) {
    currentNoteIndex =
      (currentNoteIndex + interval) % ALL_CHROMATIC_NOTES.length;
    scale.push(ALL_CHROMATIC_NOTES[currentNoteIndex]);
  }
  return scale.slice(0, 7);
}

// --- Base/Default Configuration ---
const defaultLayout: LayoutConfig = {
  /* ... as before ... */ gameAreaHeight: 600,
  gameAreaWidth: 500,
  numColumns: 3,
  columnWidth: 500 / 3,
  blockWidthPercent: 0.8,
  blockWidth: (500 / 3) * 0.8,
  blockHeight: 28,
};
const defaultTiming: TimingConfig = {
  /* ... as before ... */ gameLoopInterval: 50,
  baseAddBlockInterval: 2500,
  intervalRandomnessFactor: 0.6,
  maxAddBlockIntervalMs: 5000,
  minAddBlockIntervalMs: 50,
  clusterInterval: 150,
  actionCooldownMs: 150,
  correctNoteGracePeriodMs: 60,
  blockRemoveEffectDurationMs: 250,
  levelFlashDurationMs: 500,
  penaltyDelayMs: 40,
};
const defaultDifficulty: DifficultyConfig = {
  /* ... as before ... */ initialSpeedMultiplier: 1.2,
  notesPerLevel: 20,
  fallSpeedIncreaseFactor: 0.05,
};
const defaultRules: Omit<RulesConfig, "allowedNotes"> = {
  /* ... as before ... */ baseBlockFallSpeed: 1,
  minClearAmplitude: 0.15,
  minPenaltyAmplitude: 0.2,
  noteDisplayAmplitudeThreshold: 0.2,
  maxPenalty: 300,
  penaltyIncrement: 10,
  penaltyBlockCount: 3,
  clusterChance: 0.15,
  clusterMaxNotes: 3,
  skipSpawnChance: 0.05,
};

// --- Difficulty Presets ---
const difficultyPresets: Record<string, DeepPartial<GameConfig>> = {
  /* ... as before ... */
  misty: {
    timing: {
      baseAddBlockInterval: 3500,
      actionCooldownMs: 200,
      penaltyDelayMs: 60,
    },
    difficulty: {
      initialSpeedMultiplier: 0.9,
      notesPerLevel: 15,
      fallSpeedIncreaseFactor: 0.035,
    },
    rules: { maxPenalty: 400, penaltyIncrement: 5, clusterChance: 0.08 },
  },
  drizzle: {},
  pouring: {
    timing: {
      baseAddBlockInterval: 1800,
      intervalRandomnessFactor: 0.5,
      minAddBlockIntervalMs: 40,
      actionCooldownMs: 120,
      penaltyDelayMs: 30,
    },
    difficulty: {
      initialSpeedMultiplier: 1.6,
      notesPerLevel: 25,
      fallSpeedIncreaseFactor: 0.065,
    },
    rules: {
      maxPenalty: 250,
      penaltyIncrement: 15,
      clusterChance: 0.2,
      penaltyBlockCount: 4,
    },
  },
  torrential: {
    timing: {
      baseAddBlockInterval: 1200,
      intervalRandomnessFactor: 0.4,
      minAddBlockIntervalMs: 30,
      actionCooldownMs: 90,
      penaltyDelayMs: 20,
    },
    difficulty: {
      initialSpeedMultiplier: 2.0,
      notesPerLevel: 30,
      fallSpeedIncreaseFactor: 0.08,
    },
    rules: {
      maxPenalty: 200,
      penaltyIncrement: 20,
      clusterChance: 0.25,
      skipSpawnChance: 0.02,
      penaltyBlockCount: 5,
    },
  },
};

// --- Config Generation Logic ---
function isObject(item: any): item is object {
  return item && typeof item === "object" && !Array.isArray(item);
}

function deepMerge<T extends object>(
  target: T,
  ...sources: DeepPartial<T>[]
): T {
  sources.forEach((source) => {
    if (!source) return;
    (Object.keys(source) as Array<keyof T>).forEach((key) => {
      const targetValue = target[key];
      const sourceValue = source[key];
      if (isObject(targetValue) && isObject(sourceValue)) {
        deepMerge(targetValue, sourceValue as DeepPartial<typeof targetValue>);
      } else if (sourceValue !== undefined) {
        target[key] = sourceValue as T[keyof T];
      }
    });
  });
  return target;
}

/**
 * Generates the final GameConfig based on selected options.
 */
export function getConfiguration(
  difficultyKey: string,
  noteMode: "chromatic" | "majorScale" | "manual", // Added 'manual'
  manualNotes: string[], // Array of selected notes for manual mode
  rootNote?: string // Still needed for major scale mode
): GameConfig {
  const baseConfig: GameConfig = {
    layout: deepMerge({} as LayoutConfig, defaultLayout),
    timing: deepMerge({} as TimingConfig, defaultTiming),
    difficulty: deepMerge({} as DifficultyConfig, defaultDifficulty),
    rules: deepMerge({} as RulesConfig, { ...defaultRules, allowedNotes: [] }),
  };

  const preset = difficultyPresets[difficultyKey] ?? {};
  const mergedConfig = deepMerge(baseConfig, preset);

  // Set allowed notes based on mode
  if (noteMode === "majorScale") {
    if (!rootNote || ALL_CHROMATIC_NOTES.indexOf(rootNote) === -1) {
      console.warn(
        `Invalid or missing root note for Major Scale mode. Defaulting to C.`
      );
      rootNote = "C";
    }
    mergedConfig.rules.allowedNotes = generateMajorScale(rootNote);
    console.log(
      `Generated config for Difficulty: ${difficultyKey}, Mode: Major Scale (${rootNote})`
    );
  } else if (noteMode === "manual") {
    // Use the provided list of manually selected notes
    mergedConfig.rules.allowedNotes =
      manualNotes.length > 0 ? manualNotes : ALL_CHROMATIC_NOTES; // Fallback to chromatic if empty
    console.log(
      `Generated config for Difficulty: ${difficultyKey}, Mode: Manual`
    );
  } else {
    // Chromatic mode
    mergedConfig.rules.allowedNotes = [...ALL_CHROMATIC_NOTES];
    console.log(
      `Generated config for Difficulty: ${difficultyKey}, Mode: Chromatic`
    );
  }

  console.log("Final allowed notes:", mergedConfig.rules.allowedNotes);
  return mergedConfig;
}
