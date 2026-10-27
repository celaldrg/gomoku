/**
 * Board constants and win detection for gomoku.
 * Pure module: no DOM access, safe to import from Node and Web Workers.
 * A board is a flat array of cells where index = y * size + x.
 */

/** Default board size: 15x15 intersections. */
export const SIZE = 15;

/** Cell value of an empty intersection. */
export const EMPTY = 0;
/** Cell value of a black stone; black moves first. */
export const BLACK = 1;
/** Cell value of a white stone. */
export const WHITE = 2;

/** Win rules: five or more in a row ("freestyle") or exactly five ("exact"). */
export const RULES = Object.freeze({ FREESTYLE: 'freestyle', EXACT: 'exact' });

/** Line directions as [dx, dy]: horizontal, vertical, diagonal, anti-diagonal. */
export const DIRECTIONS = Object.freeze([
  Object.freeze([1, 0]),
  Object.freeze([0, 1]),
  Object.freeze([1, 1]),
  Object.freeze([1, -1]),
]);

/**
 * Returns the other player's color.
 * @param {number} color BLACK or WHITE
 * @returns {number}
 */
export function opponent(color) {
  return color === BLACK ? WHITE : BLACK;
}

/**
 * Tells whether (x, y) lies on a board of the given size.
 * @param {number} x
 * @param {number} y
 * @param {number} [size=SIZE]
 * @returns {boolean}
 */
export function inBounds(x, y, size = SIZE) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

/**
 * Collects the run of same-colored stones through (x, y) along (dx, dy).
 * @returns {{x: number, y: number}[]}
 */
function runThrough(cells, size, x, y, dx, dy) {
  const color = cells[y * size + x];
  const same = (cx, cy) => inBounds(cx, cy, size) && cells[cy * size + cx] === color;
  let sx = x;
  let sy = y;
  while (same(sx - dx, sy - dy)) {
    sx -= dx;
    sy -= dy;
  }
  const run = [];
  for (let cx = sx, cy = sy; same(cx, cy); cx += dx, cy += dy) run.push({ x: cx, y: cy });
  return run;
}

/**
 * Finds a winning line through the stone at (x, y).
 * Freestyle accepts five or more in a row; the exact rule needs exactly five.
 * @param {ArrayLike<number>} cells flat board
 * @param {number} x
 * @param {number} y
 * @param {{size?: number, rule?: string}} [options]
 * @returns {{x: number, y: number}[] | null} the winning stones in order, or null
 */
export function findWin(cells, x, y, { size = SIZE, rule = RULES.FREESTYLE } = {}) {
  if (!inBounds(x, y, size) || cells[y * size + x] === EMPTY) return null;
  for (const [dx, dy] of DIRECTIONS) {
    const run = runThrough(cells, size, x, y, dx, dy);
    if (rule === RULES.EXACT ? run.length === 5 : run.length >= 5) return run;
  }
  return null;
}
