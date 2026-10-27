/**
 * Tiny localStorage wrapper. Every access is wrapped in try/catch, so
 * private mode, blocked storage, a full quota or broken JSON never crash the
 * game; the caller simply gets the fallback value. Nothing runs at import time.
 */

const PREFIX = 'gomoku:';

/**
 * Reads a JSON value.
 * @template T
 * @param {string} key name without the app prefix
 * @param {T} fallback returned when the value is missing or unreadable
 * @returns {T | unknown} the stored value (validate it before use) or the fallback
 */
export function load(key, fallback) {
  try {
    const raw = globalThis.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON value.
 * @param {string} key name without the app prefix
 * @param {unknown} value any JSON-serialisable value
 * @returns {boolean} true when the value was stored
 */
export function save(key, value) {
  try {
    globalThis.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
