/**
 * Board geometry in CSS pixels: where the lines are, which intersection a
 * pointer hits, coordinate labels and keyboard cursor steps.
 * Pure module: the canvas code and the tests share it.
 */
import { SIZE } from './board.js';

/** Space between the board edge and the outer lines, in cells. */
const MARGIN = 0.75;

/** Arrow keys and the cursor step they make, as [dx, dy]. */
const STEPS = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] });

/**
 * Layout of a square board drawn `pixels` wide.
 * @param {number} pixels side length of the board
 * @param {number} [size=SIZE] lines per side
 * @returns {{pixels: number, size: number, cell: number, origin: number, radius: number}}
 *   cell: distance between lines; origin: position of the first line; radius: stone radius
 */
export function boardGeometry(pixels, size = SIZE) {
  const cell = pixels / (size - 1 + 2 * MARGIN);
  return { pixels, size, cell, origin: cell * MARGIN, radius: cell * 0.46 };
}

/**
 * Pixel position of an intersection.
 * @param {ReturnType<typeof boardGeometry>} geometry
 * @param {number} x column
 * @param {number} y row
 * @returns {{px: number, py: number}}
 */
export function cellCenter(geometry, x, y) {
  return { px: geometry.origin + x * geometry.cell, py: geometry.origin + y * geometry.cell };
}

/**
 * Nearest intersection to a point on the board. Points in the outer margin
 * snap to the edge lines; points off the board give null.
 * @param {ReturnType<typeof boardGeometry>} geometry
 * @param {number} px
 * @param {number} py
 * @returns {{x: number, y: number} | null}
 */
export function pointToCell(geometry, px, py) {
  const { pixels, size, origin, cell } = geometry;
  if (!(px >= 0 && py >= 0 && px <= pixels && py <= pixels)) return null;
  const snap = (value) => Math.min(size - 1, Math.max(0, Math.round((value - origin) / cell)));
  return { x: snap(px), y: snap(py) };
}

/**
 * Column letter, A at the left.
 * @param {number} x
 * @returns {string}
 */
export function columnLabel(x) {
  return String.fromCharCode(65 + x);
}

/**
 * Row number, 1 at the bottom as in usual gomoku notation.
 * @param {number} y
 * @param {number} [size=SIZE]
 * @returns {string}
 */
export function rowLabel(y, size = SIZE) {
  return String(size - y);
}

/**
 * Name of an intersection, e.g. the centre of a 15x15 board is "H8".
 * @param {number} x
 * @param {number} y
 * @param {number} [size=SIZE]
 * @returns {string}
 */
export function pointLabel(x, y, size = SIZE) {
  return columnLabel(x) + rowLabel(y, size);
}

/**
 * Star points: the centre and the point on the fourth line from each corner.
 * @param {number} [size=SIZE]
 * @returns {{x: number, y: number}[]}
 */
export function starPoints(size = SIZE) {
  const near = 3;
  const far = size - 4;
  const mid = Math.floor(size / 2);
  return [{ x: near, y: near }, { x: far, y: near }, { x: mid, y: mid }, { x: near, y: far }, { x: far, y: far }];
}

/**
 * Moves the keyboard cursor one step; it stops at the board edge.
 * @param {{x: number, y: number}} cursor
 * @param {string} key KeyboardEvent.key
 * @param {number} [size=SIZE]
 * @returns {{x: number, y: number} | null} null when `key` is not an arrow key
 */
export function stepCursor(cursor, key, size = SIZE) {
  if (!Object.hasOwn(STEPS, key)) return null;
  const [dx, dy] = STEPS[key];
  const clamp = (value) => Math.min(size - 1, Math.max(0, value));
  return { x: clamp(cursor.x + dx), y: clamp(cursor.y + dy) };
}
