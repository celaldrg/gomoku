/**
 * Incremental position used by the AI search.
 *
 * Every line of five or more cells is kept as two bitboards (one per color).
 * After a move only the four lines through it are re-classified, so pattern
 * counts, the heuristic score and the neighbourhood map stay current at a
 * small, constant cost per move. Pure module: no DOM, safe in a Web Worker.
 */
import { BLACK, WHITE, EMPTY, SIZE, RULES, DIRECTIONS } from './board.js';
import { PATTERN, PATTERN_SCORE, MAX_SEGMENT, segmentClassifier } from './patterns.js';

/** Score of a won position; proven results are WIN minus the plies needed. */
export const WIN = 100000000;

/** Candidate moves are empty cells within this distance of a stone. */
const NEAR_RADIUS = 2;
/** The side to move values its own patterns a little higher (initiative). */
const TEMPO = 1.1;
/** Two open threes against us usually cannot both be stopped. */
const DOUBLE_THREE_PENALTY = 1500;

const geometries = new Map();

/** Maps every cell to its line id and position in each direction (cached per size). */
function lineGeometry(size) {
  if (geometries.has(size)) return geometries.get(size);
  const area = size * size;
  const lineOf = new Int16Array(4 * area).fill(-1);
  const posOf = new Int8Array(4 * area);
  const lineCells = [];
  DIRECTIONS.forEach(([dx, dy], dir) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x - dx;
        const py = y - dy;
        if (px >= 0 && py >= 0 && px < size && py < size) continue; // not a line start
        const cells = [];
        for (let cx = x, cy = y; cx >= 0 && cy >= 0 && cx < size && cy < size; cx += dx, cy += dy) {
          cells.push(cy * size + cx);
        }
        if (cells.length < 5) continue;
        cells.forEach((cell, pos) => {
          lineOf[dir * area + cell] = lineCells.length;
          posOf[dir * area + cell] = pos;
        });
        lineCells.push(Int16Array.from(cells));
      }
    }
  });
  const geometry = { lineOf, posOf, lineCells, lineLen: Int8Array.from(lineCells, (c) => c.length) };
  geometries.set(size, geometry);
  return geometry;
}

function lowestBit(x) {
  return 31 - Math.clz32(x & -x);
}

/** Bounds [lo, hi) of the opponent-free segment around `pos`, packed as lo | hi << 4. */
function segmentAround(blockers, pos, length) {
  const below = blockers & ((1 << pos) - 1);
  const lo = below === 0 ? 0 : 32 - Math.clz32(below);
  const above = blockers >>> (pos + 1);
  const hi = above === 0 ? length : pos + 1 + lowestBit(above);
  return lo | (hi << 4);
}

function holdsFour(packed) {
  const first = packed & 15;
  const second = packed >> 4;
  return first === PATTERN.FOUR || first === PATTERN.OPEN_FOUR
    || second === PATTERN.FOUR || second === PATTERN.OPEN_FOUR;
}

/**
 * Board state with incrementally maintained pattern counts per color.
 * `count[color][pattern]` is the number of line segments whose strongest
 * shape is `pattern`; `score[color]` is the matching heuristic sum.
 */
export class Position {
  /**
   * @param {number} [size=15] board size, 5..15
   * @param {string} [rule='freestyle'] a RULES value
   */
  constructor(size = SIZE, rule = RULES.FREESTYLE) {
    if (!Number.isInteger(size) || size < 5 || size > MAX_SEGMENT) {
      throw new RangeError(`Unsupported board size: ${size}`);
    }
    const geometry = lineGeometry(size);
    const lines = geometry.lineCells.length;
    this.size = size;
    this.area = size * size;
    this.classify = segmentClassifier(rule === RULES.EXACT);
    this.lineOf = geometry.lineOf;
    this.posOf = geometry.posOf;
    this.lineCells = geometry.lineCells;
    this.lineLen = geometry.lineLen;
    this.cells = new Uint8Array(this.area);
    this.near = new Uint8Array(this.area);
    this.mark = new Uint32Array(this.area);
    this.stamp = 0;
    this.stones = 0;
    this.bits = [null, new Int32Array(lines), new Int32Array(lines)];
    this.lineShapes = [null, new Uint8Array(lines), new Uint8Array(lines)];
    this.count = [null, new Int32Array(PATTERN_SCORE.length), new Int32Array(PATTERN_SCORE.length)];
    this.score = [0, 0, 0];
    this.gainPattern = PATTERN.NONE;
  }

  /**
   * Builds a position from a flat board.
   * @param {ArrayLike<number>} cells EMPTY / BLACK / WHITE per cell
   * @param {number} [size=15]
   * @param {string} [rule='freestyle']
   * @returns {Position}
   */
  static from(cells, size = SIZE, rule = RULES.FREESTYLE) {
    const position = new Position(size, rule);
    for (let cell = 0; cell < position.area; cell++) {
      if (cells[cell] === BLACK || cells[cell] === WHITE) position.place(cell, cells[cell]);
    }
    return position;
  }

  /**
   * Puts a stone on an empty cell.
   * @param {number} cell index
   * @param {number} color BLACK or WHITE
   */
  place(cell, color) {
    this.cells[cell] = color;
    this.stones++;
    for (let dir = 0; dir < 4; dir++) {
      const key = dir * this.area + cell;
      const line = this.lineOf[key];
      if (line < 0) continue;
      this.bits[color][line] |= 1 << this.posOf[key];
      this.refreshLine(line);
    }
    this.adjustNear(cell, 1);
  }

  /**
   * Takes the stone back from a cell.
   * @param {number} cell index
   */
  remove(cell) {
    const color = this.cells[cell];
    this.cells[cell] = EMPTY;
    this.stones--;
    for (let dir = 0; dir < 4; dir++) {
      const key = dir * this.area + cell;
      const line = this.lineOf[key];
      if (line < 0) continue;
      this.bits[color][line] &= ~(1 << this.posOf[key]);
      this.refreshLine(line);
    }
    this.adjustNear(cell, -1);
  }

  /** Adds `delta` to the stone count of every cell within NEAR_RADIUS of `cell`. */
  adjustNear(cell, delta) {
    const { size } = this;
    const x0 = cell % size;
    const y0 = (cell - x0) / size;
    const x1 = Math.min(size - 1, x0 + NEAR_RADIUS);
    const y1 = Math.min(size - 1, y0 + NEAR_RADIUS);
    for (let y = Math.max(0, y0 - NEAR_RADIUS); y <= y1; y++) {
      for (let x = Math.max(0, x0 - NEAR_RADIUS); x <= x1; x++) this.near[y * size + x] += delta;
    }
  }

  /** Re-classifies one line for both colors and updates the totals. */
  refreshLine(line) {
    for (let color = BLACK; color <= WHITE; color++) {
      const shapes = this.scanLine(line, color);
      const previous = this.lineShapes[color][line];
      if (shapes === previous) continue;
      this.tally(color, previous, -1);
      this.tally(color, shapes, 1);
      this.lineShapes[color][line] = shapes;
    }
  }

  /** Adds (sign = 1) or removes (sign = -1) the packed patterns of one line. */
  tally(color, packed, sign) {
    const first = packed & 15;
    const second = packed >> 4;
    if (first !== PATTERN.NONE) this.count[color][first] += sign;
    if (second !== PATTERN.NONE) this.count[color][second] += sign;
    this.score[color] += sign * (PATTERN_SCORE[first] + PATTERN_SCORE[second]);
  }

  /**
   * Classifies every segment of a line for one color. A 15-cell line holds at
   * most two segments long enough for a five, so both fit in one byte.
   * @returns {number} up to two pattern ids packed as first | second << 4
   */
  scanLine(line, color) {
    const length = this.lineLen[line];
    const own = this.bits[color][line];
    let free = ~this.bits[3 - color][line] & ((1 << length) - 1);
    let packed = 0;
    let shift = 0;
    while (free !== 0) {
      const start = lowestBit(free);
      const run = lowestBit(~(free >>> start));
      const mask = (own >>> start) & ((1 << run) - 1);
      if (run >= 5 && mask !== 0) {
        packed |= this.classify(run, mask) << shift;
        shift += 4;
      }
      free &= ~(((1 << run) - 1) << start);
    }
    return packed;
  }

  /**
   * Heuristic gain if `color` played the empty `cell`: the pattern score
   * difference over its four lines. The strongest pattern the move creates
   * is left in `this.gainPattern`.
   * @param {number} cell empty cell index
   * @param {number} color BLACK or WHITE
   * @returns {number}
   */
  gainAt(cell, color) {
    const own = this.bits[color];
    const blockers = this.bits[3 - color];
    let gain = 0;
    let created = PATTERN.NONE;
    for (let dir = 0; dir < 4; dir++) {
      const key = dir * this.area + cell;
      const line = this.lineOf[key];
      if (line < 0) continue;
      const pos = this.posOf[key];
      const bounds = segmentAround(blockers[line], pos, this.lineLen[line]);
      const lo = bounds & 15;
      const length = (bounds >> 4) - lo;
      if (length < 5) continue;
      const before = (own[line] >>> lo) & ((1 << length) - 1);
      const was = this.classify(length, before);
      const now = this.classify(length, before | (1 << (pos - lo)));
      gain += PATTERN_SCORE[now] - PATTERN_SCORE[was];
      if (now > was && now > created) created = now;
    }
    this.gainPattern = created;
    return gain;
  }

  /** Pattern of the segment around `pos` on `line` once `color` plays there. */
  patternAfter(line, pos, color) {
    const bounds = segmentAround(this.bits[3 - color][line], pos, this.lineLen[line]);
    const lo = bounds & 15;
    const length = (bounds >> 4) - lo;
    const before = (this.bits[color][line] >>> lo) & ((1 << length) - 1);
    return this.classify(length, before | (1 << (pos - lo)));
  }

  /**
   * Lists the distinct empty cells where `color` would complete a five.
   * @param {number} color BLACK or WHITE
   * @param {Int16Array} out receives the cell indexes
   * @returns {number} how many cells were written to `out`
   */
  fivePoints(color, out) {
    const stamp = ++this.stamp;
    let found = 0;
    for (let line = 0; line < this.lineCells.length; line++) {
      if (!holdsFour(this.lineShapes[color][line])) continue;
      const cells = this.lineCells[line];
      for (let pos = 0; pos < cells.length; pos++) {
        const cell = cells[pos];
        if (this.cells[cell] !== EMPTY || this.mark[cell] === stamp) continue;
        if (this.patternAfter(line, pos, color) === PATTERN.FIVE) {
          this.mark[cell] = stamp;
          out[found++] = cell;
        }
      }
    }
    return found;
  }

  /**
   * True when `color` can complete a five with its next stone.
   * @param {number} color
   * @returns {boolean}
   */
  hasFour(color) {
    return this.count[color][PATTERN.FOUR] + this.count[color][PATTERN.OPEN_FOUR] > 0;
  }

  /**
   * Static evaluation from the point of view of `me`, who is to move.
   * Forced results are returned as proven scores (close to +/-WIN).
   * @param {number} me color to move
   * @param {number} ply distance from the search root
   * @returns {number}
   */
  evaluate(me, ply) {
    const op = 3 - me;
    const theirs = this.count[op];
    if (this.hasFour(me)) return WIN - ply - 1;
    if (theirs[PATTERN.OPEN_FOUR] > 0) return -(WIN - ply - 2);
    let value = this.score[me] * TEMPO - this.score[op];
    if (theirs[PATTERN.FOUR] === 0) {
      if (this.count[me][PATTERN.OPEN_THREE] > 0) return WIN - ply - 3;
      if (theirs[PATTERN.OPEN_THREE] >= 2) value -= DOUBLE_THREE_PENALTY;
    }
    return value;
  }
}
