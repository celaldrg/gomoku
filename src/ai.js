/**
 * Gomoku AI.
 *
 * 1. Opening: an empty board is answered in the centre.
 * 2. Immediate win: complete a five whenever possible.
 * 3. Must block: stop the opponent's five.
 * 4. Otherwise: iterative-deepening alpha-beta (negamax) over candidate moves
 *    near existing stones, ordered by pattern gain. The search is
 *    threat-aware: against an open three only blocks and our own fours are
 *    tried, and forced replies to fours are followed past the depth limit.
 *
 * Pure module: no DOM, so it runs in Node tests, on the main thread or in a
 * module Web Worker (see ai-worker.js).
 */
import { BLACK, WHITE, EMPTY, SIZE, RULES, opponent } from './board.js';
import { Position, WIN } from './engine.js';
import { PATTERN } from './patterns.js';
import { createRng, randomInt } from './rng.js';

/**
 * Difficulty presets.
 * depth: deepest iteration; rootWidth / width: candidate moves kept at the
 * root / inside the tree; timeLimitMs: search budget (easy and medium
 * normally reach their depth well inside it; it only caps slow devices);
 * margin: the easy level picks randomly among moves scoring within this
 * margin of the best one.
 */
export const LEVELS = Object.freeze({
  easy: Object.freeze({ depth: 1, rootWidth: 8, width: 6, timeLimitMs: 300, margin: 120 }),
  medium: Object.freeze({ depth: 5, rootWidth: 12, width: 8, timeLimitMs: 800, margin: 0 }),
  hard: Object.freeze({ depth: 10, rootWidth: 16, width: 10, timeLimitMs: 2000, margin: 0 }),
});

/** Level used when none, or an unknown one, is given. */
export const DEFAULT_LEVEL = 'medium';

/**
 * The clock is read once every CLOCK_INTERVAL nodes (a power of two). A node
 * costs a few microseconds, so a search stops about a millisecond after its
 * deadline.
 */
const CLOCK_INTERVAL = 64;

const MAX_PLY = 64;
const PROVEN = WIN - 1000;
const KEY_OFFSET = 1 << 24;

const defaultClock = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

class Search {
  constructor(position, { width, rootWidth, deadline, now }) {
    this.position = position;
    this.width = width;
    this.rootWidth = rootWidth;
    this.deadline = deadline;
    this.now = now;
    this.nodes = 0;
    this.stopped = false;
    this.moves = Array.from({ length: MAX_PLY }, () => new Int16Array(position.area));
    this.keys = new Float64Array(position.area);
    this.points = new Int16Array(position.area);
  }

  timeUp() {
    if (!this.stopped && this.deadline !== Infinity && this.now() >= this.deadline) this.stopped = true;
    return this.stopped;
  }

  /**
   * Fills this.moves[ply] with candidate moves for `me`, best first.
   * When the opponent threatens to make an open four, only moves that block
   * it or make a four of our own are kept; otherwise the list is cut to `width`.
   * @returns {number} number of moves
   */
  generate(me, ply, width) {
    const op = 3 - me;
    const urgent = this.position.count[op][PATTERN.OPEN_THREE] > 0;
    let n = this.collect(me, op, urgent);
    if (n === 0 && urgent) n = this.collect(me, op, false);
    const sorted = this.keys.subarray(0, n).sort();
    const count = urgent ? n : Math.min(n, width);
    const out = this.moves[ply];
    for (let i = 0; i < count; i++) out[i] = 255 - (sorted[n - 1 - i] % 256);
    return count;
  }

  /** Scores candidate cells into this.keys as (attack + defence) with the cell in the low byte. */
  collect(me, op, urgent) {
    const pos = this.position;
    let n = 0;
    for (let cell = 0; cell < pos.area; cell++) {
      if (pos.cells[cell] !== EMPTY || pos.near[cell] === 0) continue;
      const attack = pos.gainAt(cell, me);
      const attackPattern = pos.gainPattern;
      const defence = pos.gainAt(cell, op);
      if (urgent && attackPattern < PATTERN.FOUR && pos.gainPattern < PATTERN.FOUR) continue;
      this.keys[n++] = (attack + defence + KEY_OFFSET) * 256 + (255 - cell);
    }
    return n;
  }

  /** Negamax with alpha-beta pruning; returns the score for `me`, who is to move. */
  negamax(me, depth, alpha, beta, ply) {
    const pos = this.position;
    const op = 3 - me;
    if ((++this.nodes & (CLOCK_INTERVAL - 1)) === 0) this.timeUp();
    if (this.stopped) return 0;
    if (pos.hasFour(me)) return WIN - ply - 1;
    if (pos.count[op][PATTERN.OPEN_FOUR] > 0) return -(WIN - ply - 2);
    if (pos.count[op][PATTERN.FOUR] > 0) return this.forcedBlock(me, depth, alpha, beta, ply);
    if (depth <= 0 || ply >= MAX_PLY - 1) return pos.evaluate(me, ply);
    if (pos.count[me][PATTERN.OPEN_THREE] > 0) return WIN - ply - 3;
    const count = this.generate(me, ply, this.width);
    if (count === 0) return 0;
    const moves = this.moves[ply];
    let best = -Infinity;
    for (let i = 0; i < count; i++) {
      pos.place(moves[i], me);
      const value = -this.negamax(op, depth - 1, -beta, -alpha, ply + 1);
      pos.remove(moves[i]);
      if (this.stopped) return 0;
      if (value > best) {
        best = value;
        if (value > alpha) alpha = value;
        if (alpha >= beta) break;
      }
    }
    return best;
  }

  /** The opponent has a four: block it, or lose to a double four. Runs past depth 0. */
  forcedBlock(me, depth, alpha, beta, ply) {
    const pos = this.position;
    const found = pos.fivePoints(3 - me, this.points);
    if (found > 1) return -(WIN - ply - 2);
    if (found === 0 || ply >= MAX_PLY - 1) return pos.evaluate(me, ply);
    const cell = this.points[0];
    pos.place(cell, me);
    const value = -this.negamax(3 - me, depth - 1, -beta, -alpha, ply + 1);
    pos.remove(cell);
    return value;
  }

  /**
   * Iterative deepening at the root. The best move of each finished
   * iteration is searched first in the next one; when time runs out the
   * best fully searched move so far is kept.
   * @returns {{cell: number, score: number, depth: number}}
   */
  run(me, maxDepth, margin, rng) {
    const pos = this.position;
    const op = 3 - me;
    const count = this.generate(me, 0, this.rootWidth);
    const roots = Array.from(this.moves[0].subarray(0, count), (cell) => ({ cell, score: -Infinity }));
    let best = { cell: roots[0].cell, score: 0, depth: 0 };
    for (let depth = 1; depth <= maxDepth && !this.timeUp(); depth++) {
      let alpha = -Infinity;
      let bestIndex = -1;
      for (let i = 0; i < roots.length && !this.timeUp(); i++) {
        const root = roots[i];
        pos.place(root.cell, me);
        const value = -this.negamax(op, depth - 1, -Infinity, margin > 0 ? Infinity : -alpha, 1);
        pos.remove(root.cell);
        if (this.stopped) break;
        root.score = value;
        if (value > alpha) {
          alpha = value;
          bestIndex = i;
        }
      }
      if (bestIndex < 0) break;
      best = { cell: roots[bestIndex].cell, score: alpha, depth: this.stopped ? depth - 1 : depth };
      if (this.stopped || Math.abs(alpha) >= PROVEN) break;
      roots.unshift(...roots.splice(bestIndex, 1));
    }
    return margin > 0 ? pickNear(best, roots, margin, rng) : best;
  }
}

/** Easy level: a random move among those scoring within `margin` of the best. */
function pickNear(best, roots, margin, rng) {
  if (best.score >= PROVEN) return best;
  const pool = roots.filter((root) => root.score > -PROVEN && root.score >= best.score - margin);
  if (pool.length === 0) return best;
  const choice = pool[randomInt(rng, pool.length)];
  return { cell: choice.cell, score: choice.score, depth: best.depth };
}

/**
 * Picks a move for `player`.
 * @param {ArrayLike<number>} cells flat board (index = y * size + x) of EMPTY / BLACK / WHITE
 * @param {number} player color to move (BLACK or WHITE)
 * @param {object} [options]
 * @param {number} [options.size=15] board size
 * @param {string} [options.rule='freestyle'] a RULES value
 * @param {string} [options.level='medium'] a LEVELS key
 * @param {number} [options.depth] maximum search depth (overrides the level)
 * @param {number} [options.timeLimitMs] search budget counted from the call; 0 or Infinity
 *   disables it (overrides the level)
 * @param {() => number} [options.rng] random source for the easy level's variety
 * @param {() => number} [options.now] clock in milliseconds
 * @returns {{x: number, y: number, reason: string, score: number, depth: number, nodes: number} | null}
 *   null when the game is already won or the board is full; reason is
 *   'opening', 'win', 'block' or 'search'
 */
export function chooseMove(cells, player, options = {}) {
  const now = options.now ?? defaultClock;
  const started = now();
  const size = options.size ?? SIZE;
  const rule = options.rule === RULES.EXACT ? RULES.EXACT : RULES.FREESTYLE;
  const level = Object.hasOwn(LEVELS, options.level ?? '') ? LEVELS[options.level] : LEVELS[DEFAULT_LEVEL];
  const position = Position.from(cells, size, rule);
  if (position.count[BLACK][PATTERN.FIVE] + position.count[WHITE][PATTERN.FIVE] > 0) return null;
  if (position.stones === position.area) return null;
  const pick = (cell, reason, details) => ({
    x: cell % size, y: Math.floor(cell / size), reason, score: 0, depth: 0, nodes: 0, ...details,
  });
  if (position.stones === 0) return pick(Math.floor(size / 2) * (size + 1), 'opening');
  const points = new Int16Array(position.area);
  if (position.fivePoints(player, points) > 0) return pick(points[0], 'win');
  if (position.fivePoints(opponent(player), points) > 0) return pick(points[0], 'block');

  const limit = options.timeLimitMs ?? level.timeLimitMs;
  const deadline = limit > 0 && Number.isFinite(limit) ? started + limit : Infinity;
  const search = new Search(position, { width: level.width, rootWidth: level.rootWidth, deadline, now });
  const rng = options.rng ?? createRng(position.stones + 1);
  const best = search.run(player, options.depth ?? level.depth, level.margin, rng);
  return pick(best.cell, 'search', { score: best.score, depth: best.depth, nodes: search.nodes });
}

/**
 * Serves one request from the UI thread; the module Web Worker calls this.
 * @param {{id?: number, cells: ArrayLike<number>, player: number, size?: number,
 *   rule?: string, level?: string, seed?: number, timeLimitMs?: number}} request
 * @returns {{id: (number|undefined), move: ReturnType<typeof chooseMove>}}
 */
export function handleAiMessage(request) {
  const { id, cells, player, size, rule, level, seed = 1, timeLimitMs } = request;
  const move = chooseMove(cells, player, { size, rule, level, timeLimitMs, rng: createRng(seed) });
  return { id, move };
}
