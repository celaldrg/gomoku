/**
 * The interactive board: keeps the canvas sharp at any size, turns mouse,
 * touch and keyboard input into moves, and runs the short animations.
 *
 * Mouse and pen: hover shows a ghost stone, a click places it.
 * Touch: the first tap aims (ghost stone and guide lines, adjustable by
 * sliding), a second tap on the same point places the stone.
 * Keyboard: arrow keys move a cursor, Enter or Space places a stone.
 */
import { SIZE, EMPTY } from './board.js';
import { boardGeometry, pointToCell, stepCursor } from './geometry.js';
import { createRenderer } from './render.js';

const DROP_MS = 180;
const WIN_MS = 560;
const PLACE_KEYS = new Set(['Enter', ' ']);

const same = (a, b) => a !== null && b !== null && a.x === b.x && a.y === b.y;
const hasModifier = (event) => event.altKey || event.ctrlKey || event.metaKey;

/**
 * Connects a canvas to the game.
 * @param {HTMLCanvasElement} canvas focusable board canvas
 * @param {{onPlace: (x: number, y: number) => void,
 *   onCursor: (cell: {x: number, y: number}) => void,
 *   onAimChange: (aiming: boolean) => void}} handlers
 * @returns {{update: (state: object, options: {interactive: boolean, numbers: boolean,
 *   placed?: {x: number, y: number} | null}) => void}}
 */
export function createBoardView(canvas, handlers) {
  const renderer = createRenderer(canvas);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let geometry = null;
  let state = null;
  let interactive = false;
  let numbers = false;
  let hover = null;
  let aim = null;
  let press = null;
  let cursor = null;
  let cursorVisible = false;
  let drop = null;
  let winStart = 0;
  let frame = 0;

  const isEmpty = (cell) => state !== null && state.cells[cell.y * SIZE + cell.x] === EMPTY;
  const canPlayAt = (cell) => interactive && cell !== null && isEmpty(cell);

  /** Hit test against the current layout, even before the first resize callback. */
  function cellAt(event) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return null;
    return pointToCell(boardGeometry(rect.width, SIZE), event.clientX - rect.left, event.clientY - rect.top);
  }

  function startCursor() {
    const last = state?.lastMove;
    return last ? { x: last.x, y: last.y } : { x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2) };
  }

  function setAim(cell) {
    if (same(cell, aim) || (cell === null && aim === null)) return;
    const wasAiming = aim !== null;
    aim = cell;
    if (wasAiming !== (aim !== null)) handlers.onAimChange(aim !== null);
    requestDraw();
  }

  function setHover(cell) {
    if (same(cell, hover) || (cell === null && hover === null)) return;
    hover = cell;
    requestDraw();
  }

  function showCursor(cell, announce) {
    cursor = cell;
    cursorVisible = true;
    if (announce) handlers.onCursor(cell);
    requestDraw();
  }

  function hideCursor() {
    if (!cursorVisible) return;
    cursorVisible = false;
    requestDraw();
  }

  function onPointerDown(event) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    hideCursor();
    const cell = cellAt(event);
    if (!cell || !interactive) return;
    if (event.pointerType !== 'touch') {
      press = { id: event.pointerId, cell, confirm: false };
      return;
    }
    press = { id: event.pointerId, cell, confirm: same(aim, cell) };
    if (!press.confirm && isEmpty(cell)) setAim(cell);
  }

  function onPointerMove(event) {
    const cell = cellAt(event);
    if (event.pointerType !== 'touch') {
      setHover(cell);
      return;
    }
    if (!press || press.id !== event.pointerId || !cell) return;
    if (!same(cell, press.cell)) press.confirm = false;
    if (canPlayAt(cell)) setAim(cell);
  }

  function onPointerUp(event) {
    if (!press || press.id !== event.pointerId) return;
    const started = press;
    press = null;
    if (event.pointerType === 'touch') {
      if (started.confirm && canPlayAt(aim)) place(aim);
      return;
    }
    const cell = cellAt(event);
    if (same(cell, started.cell) && canPlayAt(cell)) place(cell);
  }

  function place(cell) {
    setAim(null);
    handlers.onPlace(cell.x, cell.y);
  }

  function onKeyDown(event) {
    if (hasModifier(event)) return;
    const next = stepCursor(cursor ?? startCursor(), event.key);
    if (next) {
      event.preventDefault();
      showCursor(next, true);
    } else if (PLACE_KEYS.has(event.key)) {
      event.preventDefault();
      if (!cursorVisible) showCursor(cursor ?? startCursor(), true);
      else if (canPlayAt(cursor)) place(cursor);
    }
  }

  /** Arrow, Enter or Space with nothing focused jumps to the board. */
  function onDocumentKeyDown(event) {
    if (event.target !== document.body || hasModifier(event)) return;
    if (!PLACE_KEYS.has(event.key) && !stepCursor(startCursor(), event.key)) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    showCursor(cursor ?? startCursor(), true);
  }

  function onFocus() {
    if (canvas.matches(':focus-visible')) showCursor(cursor ?? startCursor(), false);
  }

  function ghost() {
    if (!interactive || !state) return null;
    if (aim) return { ...aim, color: state.turn, aim: true };
    const target = cursorVisible ? cursor : hover;
    return target && isEmpty(target) ? { ...target, color: state.turn, aim: false } : null;
  }

  function requestDraw() {
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function paint(now = performance.now()) {
    frame = 0;
    if (!geometry || !state) return;
    const dropT = drop ? Math.min(1, Math.max(0, (now - drop.start) / DROP_MS)) : 1;
    const winT = winStart ? Math.min(1, Math.max(0, (now - winStart) / WIN_MS)) : 1;
    renderer.draw({
      cells: state.cells,
      moves: state.moves,
      lastMove: state.lastMove,
      winLine: state.winLine,
      numbers,
      ghost: ghost(),
      cursor: cursorVisible ? cursor : null,
      drop: drop && dropT < 1 ? { x: drop.x, y: drop.y, t: dropT } : null,
      winProgress: winT,
    });
    if (dropT < 1 || winT < 1) requestDraw();
    else {
      drop = null;
      winStart = 0;
    }
  }

  function fit() {
    const pixels = canvas.getBoundingClientRect().width;
    if (pixels <= 0) return;
    geometry = boardGeometry(pixels, SIZE);
    renderer.resize(geometry, window.devicePixelRatio || 1);
    paint();
  }

  /** Re-fits when the page zoom or the screen changes the pixel ratio. */
  function watchPixelRatio() {
    matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`)
      .addEventListener('change', () => {
        fit();
        watchPixelRatio();
      }, { once: true });
  }

  /**
   * Shows a new game snapshot.
   * @param {object} next game.getState()
   * @param {{interactive: boolean, numbers: boolean, placed?: {x: number, y: number} | null}} options
   *   interactive: whether the human may place a stone now; placed: the move to animate
   */
  function update(next, options) {
    const animate = Boolean(options.placed) && !reducedMotion.matches;
    const start = performance.now();
    state = next;
    interactive = options.interactive;
    numbers = options.numbers;
    drop = animate ? { x: options.placed.x, y: options.placed.y, start } : null;
    winStart = animate && next.winLine ? start + DROP_MS : 0;
    if (!canPlayAt(aim)) setAim(null);
    if (hover && !isEmpty(hover)) hover = null;
    canvas.classList.toggle('is-waiting', !interactive && !next.over);
    requestDraw();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { press = null; });
  canvas.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') setHover(null);
  });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('focus', onFocus);
  canvas.addEventListener('blur', hideCursor);
  document.addEventListener('keydown', onDocumentKeyDown);
  new ResizeObserver(fit).observe(canvas);
  watchPixelRatio();

  return { update };
}
