// --- Game Dimensions & Layout ---
export const GAME_AREA_HEIGHT = 600;
export const GAME_AREA_WIDTH = 500;
export const NUM_COLUMNS = 3;
export const COLUMN_WIDTH = GAME_AREA_WIDTH / NUM_COLUMNS;
export const BLOCK_WIDTH_PERCENT = 0.8;
export const BLOCK_WIDTH = COLUMN_WIDTH * BLOCK_WIDTH_PERCENT;
export const BLOCK_HEIGHT = 30;
export const BASE_BLOCK_FALL_SPEED = 1;
export const GAME_LOOP_INTERVAL = 50;
export const CHROMATIC_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// --- Note Generation & Timing ---
export const BASE_ADD_BLOCK_INTERVAL = 2500;
export const INTERVAL_RANDOMNESS_FACTOR = 0.6;
export const MAX_ADD_BLOCK_INTERVAL_MS = 5000;
export const MIN_ADD_BLOCK_INTERVAL_MS = 50;
export const CLUSTER_CHANCE = 0.15;
export const CLUSTER_MAX_NOTES = 3;
export const CLUSTER_INTERVAL = 150;
export const SKIP_SPAWN_CHANCE = 0.05;

// --- Configurable Settings ---
export const MIN_CLEAR_AMPLITUDE = 0.15;
export const MIN_PENALTY_AMPLITUDE = 0.2;
export const NOTE_DISPLAY_AMPLITUDE_THRESHOLD = 0.2;
export const PENALTY_DELAY_MS = 40;
export const MAX_PENALTY = 300;
export const PENALTY_INCREMENT = 10;
export const PENALTY_BLOCK_COUNT = 3;
export const ACTION_COOLDOWN_MS = 150;
export const CORRECT_NOTE_GRACE_PERIOD_MS = 60;
export const BLOCK_REMOVE_EFFECT_DURATION_MS = 250;
export const NOTES_PER_LEVEL = 20;
export const FALL_SPEED_INCREASE_FACTOR = 0.05;
export const INITIAL_SPEED_MULTIPLIER = 1.4;
export const LEVEL_FLASH_DURATION_MS = 500;