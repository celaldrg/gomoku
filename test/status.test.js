import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeStatus } from '../src/status.js';
import { createGame, MODES } from '../src/game.js';
import { BLACK, WHITE, EMPTY } from '../src/board.js';
import { STRINGS } from '../src/i18n.js';

function stateAfter(options, points) {
  const game = createGame(options);
  for (const [x, y] of points) assert.ok(game.play(x, y).ok);
  return game.getState();
}

const ROW_WIN = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0]];
const ROW_WIN_FOR_WHITE = [[9, 9], ...ROW_WIN.slice(0, 8), [4, 0]];

test('turns against the computer', () => {
  assert.deepEqual(describeStatus(stateAfter({}, [])), { key: 'status.yourTurn', tone: 'turn', stone: BLACK });
  assert.deepEqual(describeStatus(stateAfter({}, [[7, 7]])), { key: 'status.thinking', tone: 'thinking', stone: WHITE });
  assert.deepEqual(describeStatus(stateAfter({ humanColor: WHITE }, [])), { key: 'status.thinking', tone: 'thinking', stone: BLACK });
});

test('turns in two-player mode', () => {
  const pvp = { mode: MODES.PVP };
  assert.deepEqual(describeStatus(stateAfter(pvp, [])), { key: 'status.blackToMove', tone: 'turn', stone: BLACK });
  assert.deepEqual(describeStatus(stateAfter(pvp, [[7, 7]])), { key: 'status.whiteToMove', tone: 'turn', stone: WHITE });
});

test('wins and losses', () => {
  assert.deepEqual(describeStatus(stateAfter({}, ROW_WIN)), { key: 'status.youWin', tone: 'win', stone: BLACK });
  assert.deepEqual(describeStatus(stateAfter({ humanColor: WHITE }, ROW_WIN)), { key: 'status.aiWins', tone: 'loss', stone: BLACK });
  assert.deepEqual(describeStatus(stateAfter({ mode: MODES.PVP }, ROW_WIN)), { key: 'status.blackWins', tone: 'win', stone: BLACK });
  const white = stateAfter({ mode: MODES.PVP }, ROW_WIN_FOR_WHITE);
  assert.equal(white.winner, WHITE);
  assert.deepEqual(describeStatus(white), { key: 'status.whiteWins', tone: 'win', stone: WHITE });
});

test('a full board is a draw', () => {
  const state = { mode: MODES.AI, humanColor: BLACK, turn: WHITE, winner: EMPTY, draw: true };
  assert.deepEqual(describeStatus(state), { key: 'status.draw', tone: 'draw', stone: EMPTY });
});

test('every status key has a translation', () => {
  const keys = ['status.yourTurn', 'status.thinking', 'status.blackToMove', 'status.whiteToMove',
    'status.youWin', 'status.aiWins', 'status.blackWins', 'status.whiteWins', 'status.draw'];
  for (const key of keys) assert.ok(Object.hasOwn(STRINGS.en, key) && Object.hasOwn(STRINGS.tr, key), key);
});
