/**
 * Player settings and the saved game, checked before use.
 * Pure module: values come from storage, so nothing is trusted as-is.
 */
import { BLACK, WHITE, RULES, SIZE, inBounds } from './board.js';
import { LEVELS, DEFAULT_LEVEL } from './ai.js';
import { MODES } from './game.js';

/** Settings of a first visit. */
export const DEFAULT_SETTINGS = Object.freeze({
  mode: MODES.AI,
  level: DEFAULT_LEVEL,
  humanColor: BLACK,
  rule: RULES.FREESTYLE,
  numbers: false,
});

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/**
 * Builds valid settings from an untrusted object; unknown or broken fields
 * fall back to DEFAULT_SETTINGS.
 * @param {unknown} raw e.g. the parsed value from storage
 * @returns {{mode: string, level: string, humanColor: number, rule: string, numbers: boolean}}
 */
export function sanitizeSettings(raw) {
  const value = raw !== null && typeof raw === 'object' ? raw : {};
  return {
    mode: pick(value.mode, Object.values(MODES), DEFAULT_SETTINGS.mode),
    level: pick(value.level, Object.keys(LEVELS), DEFAULT_SETTINGS.level),
    humanColor: pick(value.humanColor, [BLACK, WHITE], DEFAULT_SETTINGS.humanColor),
    rule: pick(value.rule, Object.values(RULES), DEFAULT_SETTINGS.rule),
    numbers: value.numbers === true,
  };
}

/**
 * Reads a saved move list. Anything malformed gives an empty list, so the
 * replay never shifts colors; legality is checked later by createGame.
 * @param {unknown} raw e.g. the parsed value from storage
 * @returns {{x: number, y: number}[]}
 */
export function sanitizeMoves(raw) {
  if (!Array.isArray(raw) || raw.length > SIZE * SIZE) return [];
  const valid = raw.every((move) => move !== null && typeof move === 'object'
    && Number.isInteger(move.x) && Number.isInteger(move.y) && inBounds(move.x, move.y));
  return valid ? raw.map(({ x, y }) => ({ x, y })) : [];
}
