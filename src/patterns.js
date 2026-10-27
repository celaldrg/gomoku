/**
 * Pattern classification of line segments.
 *
 * A segment is a run of cells in one line that holds no opponent stone; the
 * board edge and opponent stones bound it. Inside a segment a cell is either
 * one of our stones (bit set in the mask) or empty. A segment is classified by
 * the strongest shape it contains, using the classic gomoku definitions:
 *
 *   five        five in a row (exactly five under the "exact" rule)
 *   open four   two or more empty points complete a five (cannot be stopped)
 *   four        exactly one empty point completes a five
 *   open three  one move away from an open four
 *   three       one move away from a four
 *   open two    one move away from an open three
 *   two         one move away from a three
 *   one         a lone stone with room to grow
 *
 * Results are memoised per (length, mask) in a lazily filled table, so each
 * shape is analysed once and later lookups are a single array read.
 */

/** Pattern ids, ordered from weakest to strongest. */
export const PATTERN = Object.freeze({
  NONE: 0,
  ONE: 1,
  TWO: 2,
  OPEN_TWO: 3,
  THREE: 4,
  OPEN_THREE: 5,
  FOUR: 6,
  OPEN_FOUR: 7,
  FIVE: 8,
});

/** Heuristic value of each pattern, indexed by pattern id. */
export const PATTERN_SCORE = Object.freeze([0, 1, 10, 40, 50, 400, 500, 8000, 1000000]);

/** Longest supported segment: one line of a 15x15 board. */
export const MAX_SEGMENT = 15;

const UNKNOWN = 255;
const tables = [null, null];

function popcount(mask) {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count++;
  return count;
}

function hasFive(mask, exact) {
  const starts = mask & (mask >>> 1) & (mask >>> 2) & (mask >>> 3) & (mask >>> 4);
  if (!exact) return starts !== 0;
  // Exactly five: the cells just before and just after the run are not ours.
  return (starts & ~(mask << 1) & ~(mask >>> 5)) !== 0;
}

/** Number of empty points that complete a five, capped at 2. */
function completions(length, mask, exact) {
  let found = 0;
  for (let cell = 0; cell < length; cell++) {
    const bit = 1 << cell;
    if ((mask & bit) === 0 && hasFive(mask | bit, exact) && ++found === 2) return 2;
  }
  return found;
}

/** Best completion count reachable after `steps` more of our stones (0, 1 or 2). */
function reach(length, mask, exact, steps) {
  if (steps === 0) return completions(length, mask, exact);
  let best = 0;
  for (let cell = 0; cell < length && best < 2; cell++) {
    const bit = 1 << cell;
    if ((mask & bit) === 0) best = Math.max(best, reach(length, mask | bit, exact, steps - 1));
  }
  return best;
}

const LEVELS = [
  [PATTERN.FOUR, PATTERN.OPEN_FOUR],
  [PATTERN.THREE, PATTERN.OPEN_THREE],
  [PATTERN.TWO, PATTERN.OPEN_TWO],
];

function computePattern(length, mask, exact) {
  if (mask === 0) return PATTERN.NONE;
  if (hasFive(mask, exact)) return PATTERN.FIVE;
  const stones = popcount(mask);
  for (let steps = 0; steps < LEVELS.length; steps++) {
    // A five needs five stones: this level adds `steps` stones plus the completing one.
    if (stones + steps < 4) continue;
    const reached = reach(length, mask, exact, steps);
    if (reached > 0) return LEVELS[steps][reached - 1];
  }
  return PATTERN.ONE;
}

/**
 * Returns a fast classifier for one rule set. The classifier maps a segment
 * (its length and the bit mask of our stones) to a PATTERN id.
 * @param {boolean} exact true for the "exactly five" rule
 * @returns {(length: number, mask: number) => number}
 */
export function segmentClassifier(exact) {
  const slot = exact ? 1 : 0;
  if (!tables[slot]) tables[slot] = new Uint8Array((MAX_SEGMENT + 1) << MAX_SEGMENT).fill(UNKNOWN);
  const table = tables[slot];
  return function classify(length, mask) {
    if (length < 5) return PATTERN.NONE;
    const key = (length << MAX_SEGMENT) | mask;
    let pattern = table[key];
    if (pattern === UNKNOWN) {
      pattern = computePattern(length, mask, exact);
      table[key] = pattern;
    }
    return pattern;
  };
}
