/**
 * Seeded pseudo-random numbers, so AI variety and tests stay reproducible.
 */

/**
 * Creates a small, fast seeded generator (mulberry32).
 * @param {number} [seed=1] any integer
 * @returns {() => number} a function returning floats in [0, 1)
 */
export function createRng(seed = 1) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws an integer in [0, n).
 * @param {() => number} rng generator from createRng
 * @param {number} n exclusive upper bound (> 0)
 * @returns {number}
 */
export function randomInt(rng, n) {
  return Math.floor(rng() * n);
}
