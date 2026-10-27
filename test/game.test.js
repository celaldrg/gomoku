import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createDemoGame, DEMO_MOVES, MODES } from '../src/game.js';
import { SIZE, EMPTY, BLACK, WHITE, RULES } from '../src/board.js';
import { Position } from '../src/engine.js';
import { PATTERN } from '../src/patterns.js';

/** Plays [x, y] pairs in order and returns the last result. */
function playAll(game, points) {
  let result = null;
  for (const [x, y] of points) {
    result = game.play(x, y);
    assert.ok(result.ok, `move ${x},${y}`);
  }
  return result;
}

test('a new game is empty with black to move', () => {
  const game = createGame();
  const state = game.getState();
  assert.equal(state.size, SIZE);
  assert.equal(state.cells.length, SIZE * SIZE);
  assert.ok(state.cells.every((c) => c === EMPTY));
  assert.deepEqual(
    [state.mode, state.level, state.rule, state.humanColor, state.aiColor, state.turn],
    [MODES.AI, 'medium', RULES.FREESTYLE, BLACK, WHITE, BLACK],
  );
  assert.deepEqual([state.winner, state.winLine, state.draw, state.over, state.lastMove], [EMPTY, null, false, false, null]);
  assert.equal(game.isAiTurn(), false);
  assert.equal(game.canUndo(), false);
});

test('unknown options fall back to the defaults', () => {
  const state = createGame({ mode: 'x', level: 'constructor', humanColor: 7, rule: 'nope' }).getState();
  assert.deepEqual([state.mode, state.level, state.humanColor, state.rule], [MODES.AI, 'medium', BLACK, RULES.FREESTYLE]);
  const custom = createGame({ mode: MODES.PVP, level: 'hard', humanColor: WHITE, rule: RULES.EXACT }).getState();
  assert.deepEqual([custom.mode, custom.level, custom.humanColor, custom.aiColor, custom.rule], [MODES.PVP, 'hard', WHITE, EMPTY, RULES.EXACT]);
});

test('moves alternate colors and illegal moves are rejected', () => {
  const game = createGame({ mode: MODES.PVP });
  assert.deepEqual(game.play(7, 7), { ok: true, x: 7, y: 7, color: BLACK, winner: EMPTY, line: null, draw: false });
  assert.deepEqual(game.play(7, 7), { ok: false, reason: 'occupied' });
  assert.deepEqual(game.play(-1, 0), { ok: false, reason: 'bounds' });
  assert.deepEqual(game.play(15, 3), { ok: false, reason: 'bounds' });
  assert.deepEqual(game.play(1.5, 3), { ok: false, reason: 'bounds' });
  assert.equal(game.play(8, 8).color, WHITE);
  const state = game.getState();
  assert.deepEqual(state.lastMove, { x: 8, y: 8, color: WHITE });
  assert.equal(state.cells[8 * SIZE + 8], WHITE);
  assert.equal(state.turn, BLACK);
});

test('five in a row wins and ends the game', () => {
  const game = createGame({ mode: MODES.PVP });
  const result = playAll(game, [[0, 7], [0, 8], [1, 7], [1, 8], [2, 7], [2, 8], [3, 7], [3, 8], [4, 7]]);
  assert.equal(result.winner, BLACK);
  assert.deepEqual(result.line.map((p) => p.x), [0, 1, 2, 3, 4]);
  const state = game.getState();
  assert.deepEqual([state.winner, state.over, state.draw], [BLACK, true, false]);
  assert.equal(state.winLine.length, 5);
  assert.deepEqual(game.play(9, 9), { ok: false, reason: 'over' });
});

test('the exact rule ignores overlines', () => {
  const moves = [[0, 7], [0, 9], [1, 7], [1, 9], [2, 7], [2, 9], [3, 7], [10, 9], [5, 7], [12, 12], [4, 7]];
  const exact = createGame({ mode: MODES.PVP, rule: RULES.EXACT });
  assert.equal(playAll(exact, moves).winner, EMPTY);
  assert.equal(exact.getState().over, false);
  const freestyle = createGame({ mode: MODES.PVP });
  assert.equal(playAll(freestyle, moves).line.length, 6);
});

test('undo takes back one move in two-player mode', () => {
  const game = createGame({ mode: MODES.PVP });
  playAll(game, [[7, 7], [8, 8]]);
  assert.equal(game.undo(), 1);
  assert.deepEqual(game.getState().moves, [{ x: 7, y: 7, color: BLACK }]);
  assert.equal(game.undo(), 1);
  assert.equal(game.undo(), 0);
});

test('undo against the AI goes back to the human turn', () => {
  const game = createGame({ mode: MODES.AI, humanColor: BLACK });
  game.play(7, 7);
  assert.equal(game.isAiTurn(), true);
  game.play(8, 8);
  assert.equal(game.undo(), 2);
  assert.equal(game.getState().moves.length, 0);
  game.play(7, 7);
  assert.equal(game.undo(), 1);

  const asWhite = createGame({ mode: MODES.AI, humanColor: WHITE });
  assert.equal(asWhite.isAiTurn(), true);
  asWhite.play(7, 7);
  assert.equal(asWhite.canUndo(), false);
  assert.equal(asWhite.undo(), 0);
  asWhite.play(6, 6);
  asWhite.play(8, 8);
  assert.equal(asWhite.undo(), 2);
  assert.deepEqual(asWhite.getState().moves, [{ x: 7, y: 7, color: BLACK }]);
});

test('undo after a win reopens the game', () => {
  const game = createGame({ mode: MODES.PVP });
  playAll(game, [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0]]);
  assert.equal(game.getState().winner, BLACK);
  game.undo();
  const state = game.getState();
  assert.deepEqual([state.winner, state.winLine, state.over, state.turn], [EMPTY, null, false, BLACK]);
});

test('a full board without five is a draw', () => {
  const black = [];
  const white = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) ((x + 2 * y) % 4 < 2 ? black : white).push([x, y]);
  }
  assert.deepEqual([black.length, white.length], [113, 112]);
  const game = createGame({ mode: MODES.PVP });
  const order = black.flatMap((point, i) => (white[i] ? [point, white[i]] : [point]));
  const result = playAll(game, order);
  assert.equal(result.draw, true);
  const state = game.getState();
  assert.deepEqual([state.draw, state.over, state.winner], [true, true, EMPTY]);
  assert.equal(game.isAiTurn(), false);
});

test('getState returns an independent snapshot', () => {
  const game = createGame({ mode: MODES.PVP });
  game.play(7, 7);
  const state = game.getState();
  state.cells[0] = WHITE;
  state.moves.push({ x: 1, y: 1, color: WHITE });
  state.lastMove.x = 0;
  const fresh = game.getState();
  assert.equal(fresh.cells[0], EMPTY);
  assert.equal(fresh.moves.length, 1);
  assert.equal(fresh.lastMove.x, 7);
});

test('aiRequest describes the position for the AI worker', () => {
  const game = createGame({ level: 'hard', rule: RULES.EXACT });
  game.play(7, 7);
  const request = game.aiRequest(9);
  assert.deepEqual(
    [request.size, request.player, request.rule, request.level, request.seed],
    [SIZE, WHITE, RULES.EXACT, 'hard', 9],
  );
  assert.ok(Array.isArray(request.cells));
  assert.equal(request.cells[7 * SIZE + 7], BLACK);
});

test('options.moves replays a game and rejects illegal input', () => {
  const state = createGame({ moves: [{ x: 7, y: 7 }, { x: 8, y: 7 }] }).getState();
  assert.equal(state.moves.length, 2);
  assert.equal(state.turn, BLACK);
  assert.throws(() => createGame({ moves: [{ x: 7, y: 7 }, { x: 7, y: 7 }] }), /Illegal move/);
});

test('the demo is a 20-stone mid-game with a threat building', () => {
  const game = createDemoGame();
  const state = game.getState();
  assert.equal(state.moves.length, DEMO_MOVES.length);
  assert.ok(state.moves.length >= 18 && state.moves.length <= 22);
  assert.deepEqual([state.winner, state.over, state.turn, state.humanColor], [EMPTY, false, BLACK, BLACK]);
  assert.equal(game.isAiTurn(), false);
  assert.equal(state.lastMove.color, WHITE);
  const position = Position.from(state.cells);
  assert.equal(position.count[WHITE][PATTERN.OPEN_THREE], 1, 'white has an open three');
  assert.equal(position.hasFour(BLACK) || position.hasFour(WHITE), false);
  assert.deepEqual(createDemoGame().getState(), state);
});
