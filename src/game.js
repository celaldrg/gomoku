/**
 * Game state for the UI: turn order, legal moves, wins, draws and undo.
 * Pure module: no DOM, no storage; the UI reads snapshots via getState().
 */
import { SIZE, EMPTY, BLACK, WHITE, RULES, findWin, inBounds, opponent } from './board.js';
import { LEVELS, DEFAULT_LEVEL } from './ai.js';

/** Play modes: against the computer or two players on one device. */
export const MODES = Object.freeze({ AI: 'ai', PVP: 'pvp' });

/**
 * Moves of the ?demo position (black first), taken from an AI self-play game:
 * 20 stones, white has just made an open three on row 4 and black, the
 * human, is to move with a hidden winning attack.
 */
export const DEMO_MOVES = Object.freeze([
  [6, 7], [8, 7], [6, 5], [8, 6], [8, 5], [9, 5], [7, 6], [9, 4], [4, 9], [5, 8],
  [6, 8], [6, 9], [6, 4], [6, 6], [9, 6], [4, 7], [7, 10], [10, 4], [7, 7], [11, 4],
].map(([x, y]) => Object.freeze({ x, y })));

/**
 * Creates a game.
 * @param {object} [options]
 * @param {string} [options.mode='ai'] a MODES value
 * @param {string} [options.level='medium'] a LEVELS key (AI mode)
 * @param {number} [options.humanColor=BLACK] the human's color in AI mode
 * @param {string} [options.rule='freestyle'] a RULES value
 * @param {{x: number, y: number}[]} [options.moves] moves to replay, black first
 * @returns {{
 *   play: (x: number, y: number) => object,
 *   undo: () => number,
 *   canUndo: () => boolean,
 *   isAiTurn: () => boolean,
 *   aiRequest: (seed?: number) => object,
 *   getState: () => object,
 * }}
 */
export function createGame(options = {}) {
  const size = SIZE;
  const mode = options.mode === MODES.PVP ? MODES.PVP : MODES.AI;
  const level = Object.hasOwn(LEVELS, options.level ?? '') ? options.level : DEFAULT_LEVEL;
  const humanColor = options.humanColor === WHITE ? WHITE : BLACK;
  const rule = options.rule === RULES.EXACT ? RULES.EXACT : RULES.FREESTYLE;
  const cells = new Uint8Array(size * size);
  const moves = [];
  let winLine = null;

  const turn = () => (moves.length % 2 === 0 ? BLACK : WHITE);
  const winner = () => (winLine ? moves[moves.length - 1].color : EMPTY);
  const isDraw = () => winLine === null && moves.length === cells.length;
  const isOver = () => winLine !== null || isDraw();
  const copyLine = () => (winLine ? winLine.map((p) => ({ ...p })) : null);

  /**
   * Places a stone for the side to move.
   * @returns {{ok: true, x: number, y: number, color: number, winner: number,
   *   line: ({x: number, y: number}[]|null), draw: boolean} | {ok: false, reason: string}}
   *   reason is 'over', 'bounds' or 'occupied'
   */
  function play(x, y) {
    if (isOver()) return { ok: false, reason: 'over' };
    if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(x, y, size)) {
      return { ok: false, reason: 'bounds' };
    }
    const index = y * size + x;
    if (cells[index] !== EMPTY) return { ok: false, reason: 'occupied' };
    const color = turn();
    cells[index] = color;
    moves.push({ x, y, color });
    winLine = findWin(cells, x, y, { size, rule });
    return { ok: true, x, y, color, winner: winner(), line: copyLine(), draw: isDraw() };
  }

  /** Moves that undo() would take back: one in two-player mode, back to the human's turn vs AI. */
  function undoCount() {
    const last = moves[moves.length - 1];
    if (!last) return 0;
    if (mode === MODES.PVP) return 1;
    const count = last.color === humanColor ? 1 : 2;
    return count <= moves.length ? count : 0;
  }

  /**
   * Takes back the last move (two-player) or the last human move and the
   * AI's reply (vs AI). A finished game becomes playable again.
   * @returns {number} how many moves were removed
   */
  function undo() {
    const count = undoCount();
    for (let i = 0; i < count; i++) {
      const { x, y } = moves.pop();
      cells[y * size + x] = EMPTY;
    }
    if (count > 0) winLine = null;
    return count;
  }

  /** @returns {boolean} true when the computer should move now */
  function isAiTurn() {
    return mode === MODES.AI && !isOver() && turn() !== humanColor;
  }

  /**
   * Plain, transferable request for chooseMove / the AI worker.
   * @param {number} [seed=1] random seed for the easy level's variety
   */
  function aiRequest(seed = 1) {
    return { cells: Array.from(cells), size, player: turn(), rule, level, seed };
  }

  /** @returns {object} a snapshot copy of the whole game state */
  function getState() {
    const last = moves[moves.length - 1];
    return {
      size,
      mode,
      level,
      rule,
      humanColor,
      aiColor: mode === MODES.AI ? opponent(humanColor) : EMPTY,
      cells: Array.from(cells),
      moves: moves.map((m) => ({ ...m })),
      lastMove: last ? { ...last } : null,
      turn: turn(),
      winner: winner(),
      winLine: copyLine(),
      draw: isDraw(),
      over: isOver(),
    };
  }

  for (const move of options.moves ?? []) {
    if (!play(move.x, move.y).ok) throw new Error(`Illegal move in options.moves: ${move.x},${move.y}`);
  }

  return Object.freeze({ play, undo, canUndo: () => undoCount() > 0, isAiTurn, aiRequest, getState });
}

/**
 * The deterministic ?demo game used for the README screenshot.
 * @returns {ReturnType<typeof createGame>}
 */
export function createDemoGame() {
  return createGame({ mode: MODES.AI, level: DEFAULT_LEVEL, humanColor: BLACK, moves: DEMO_MOVES });
}
