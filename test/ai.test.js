import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove, handleAiMessage, LEVELS } from '../src/ai.js';
import { SIZE, EMPTY, BLACK, WHITE, RULES } from '../src/board.js';
import { DEMO_MOVES } from '../src/game.js';
import { createRng } from '../src/rng.js';

/** Flat board from black and white [x, y] lists. */
function board({ black = [], white = [] }) {
  const cells = new Uint8Array(SIZE * SIZE);
  for (const [x, y] of black) cells[y * SIZE + x] = BLACK;
  for (const [x, y] of white) cells[y * SIZE + x] = WHITE;
  return cells;
}

const FIXED = { depth: 4, timeLimitMs: 0 };

function assertMove(move, allowed, message) {
  assert.ok(move, message);
  const key = `${move.x},${move.y}`;
  assert.ok(allowed.some(([x, y]) => `${x},${y}` === key), `${message}: got ${key}`);
}

function demoCells() {
  const cells = new Uint8Array(SIZE * SIZE);
  DEMO_MOVES.forEach(({ x, y }, i) => {
    cells[y * SIZE + x] = i % 2 === 0 ? BLACK : WHITE;
  });
  return cells;
}

test('takes an immediate win', () => {
  const cases = [
    ['closed four in a row', { black: [[3, 7], [4, 7], [5, 7], [6, 7]], white: [[2, 7], [10, 10], [11, 3], [1, 13]] }, [7, 7]],
    ['broken diagonal four', { black: [[5, 5], [6, 6], [8, 8], [9, 9]], white: [[1, 13], [13, 1], [2, 10], [12, 4]] }, [7, 7]],
    ['along the left edge', { black: [[0, 10], [0, 11], [0, 12], [0, 13]], white: [[0, 9], [7, 7], [9, 3], [12, 12]] }, [0, 14]],
    ['into the corner', { black: [[10, 10], [11, 11], [12, 12], [13, 13]], white: [[9, 9], [3, 3], [5, 11], [11, 2]] }, [14, 14]],
  ];
  for (const [name, stones, expected] of cases) {
    for (const level of Object.keys(LEVELS)) {
      const move = chooseMove(board(stones), BLACK, { level, ...FIXED });
      assertMove(move, [expected], `${name} (${level})`);
      assert.equal(move.reason, 'win');
    }
  }
});

test('an overline is a win under freestyle only', () => {
  const stones = {
    black: [[2, 7], [3, 7], [4, 7], [5, 7], [7, 7], [10, 2]],
    white: [[1, 7], [10, 3], [10, 4], [10, 5], [10, 6], [13, 13]],
  };
  const free = chooseMove(board(stones), BLACK, { rule: RULES.FREESTYLE, ...FIXED });
  assertMove(free, [[6, 7]], 'freestyle completes six');
  assert.equal(free.reason, 'win');
  const exact = chooseMove(board(stones), BLACK, { rule: RULES.EXACT, ...FIXED });
  assertMove(exact, [[10, 7]], 'exact rule blocks instead');
  assert.equal(exact.reason, 'block');
});

test('blocks an opponent four', () => {
  const cases = [
    ['closed four', { black: [[3, 7], [4, 7], [5, 7], [6, 7]], white: [[2, 7], [9, 12], [12, 3]] }, [7, 7]],
    ['broken four', { black: [[4, 4], [5, 5], [7, 7], [8, 8]], white: [[1, 12], [12, 1], [10, 3]] }, [6, 6]],
    ['four on the bottom edge', { black: [[9, 14], [10, 14], [11, 14], [12, 14]], white: [[13, 14], [3, 3], [6, 9]] }, [8, 14]],
  ];
  for (const [name, stones, expected] of cases) {
    for (const level of Object.keys(LEVELS)) {
      const move = chooseMove(board(stones), WHITE, { level, ...FIXED });
      assertMove(move, [expected], `${name} (${level})`);
      assert.equal(move.reason, 'block');
    }
  }
});

test('prefers its own five over blocking', () => {
  const stones = {
    white: [[2, 2], [3, 2], [4, 2], [5, 2], [2, 7]],
    black: [[3, 7], [4, 7], [5, 7], [6, 7], [12, 12], [12, 10]],
  };
  const move = chooseMove(board(stones), WHITE, FIXED);
  assertMove(move, [[1, 2], [6, 2]], 'completes its own five');
  assert.equal(move.reason, 'win');
});

test('answers an open three correctly', () => {
  const far = [[3, 3], [11, 11]];
  const cases = [
    ['straight three', [[6, 7], [7, 7], [8, 7]], far, [[5, 7], [9, 7]]],
    ['split three', [[5, 7], [6, 7], [8, 7]], far, [[4, 7], [7, 7], [9, 7]]],
    ['vertical three', [[7, 5], [7, 6], [7, 7]], [[3, 11], [11, 3]], [[7, 4], [7, 8]]],
    ['three touching the edge', [[1, 1], [2, 2], [3, 3]], [[10, 3], [3, 10]], [[0, 0], [4, 4], [5, 5]]],
  ];
  for (const [name, black, white, defences] of cases) {
    for (const level of ['medium', 'hard']) {
      const move = chooseMove(board({ black, white }), WHITE, { level, ...FIXED });
      assertMove(move, defences, `${name} (${level})`);
    }
  }
});

test('attacks with an open four when both sides have an open three', () => {
  const stones = { black: [[6, 7], [7, 7], [8, 7]], white: [[3, 3], [4, 4], [5, 5]] };
  const move = chooseMove(board(stones), BLACK, FIXED);
  assertMove(move, [[5, 7], [9, 7]], 'makes an open four');
  assert.ok(move.score > 0);
});

test('opens in the centre and returns null when no move is possible', () => {
  const opening = chooseMove(new Uint8Array(SIZE * SIZE), BLACK);
  assert.deepEqual([opening.x, opening.y, opening.reason], [7, 7, 'opening']);
  const won = board({ black: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], white: [[0, 5], [1, 5], [2, 5], [3, 5]] });
  assert.equal(chooseMove(won, WHITE), null);
  const full = new Uint8Array(SIZE * SIZE).map((_, i) => (((i % SIZE) + 2 * Math.floor(i / SIZE)) % 4 < 2 ? BLACK : WHITE));
  assert.equal(chooseMove(full, BLACK), null);
});

test('is deterministic at a fixed depth', () => {
  const first = chooseMove(demoCells(), BLACK, { level: 'hard', depth: 3, timeLimitMs: 0 });
  const second = chooseMove(demoCells(), BLACK, { level: 'hard', depth: 3, timeLimitMs: 0 });
  assert.deepEqual(first, second);
  assert.equal(first.reason, 'search');
});

test('stops at the time limit and keeps the best finished move', () => {
  let clock = 0;
  const now = () => ++clock;
  const cells = board({ black: [[7, 7], [8, 8]], white: [[8, 7], [6, 6]] });
  const move = chooseMove(cells, BLACK, { level: 'hard', timeLimitMs: 30, now });
  assert.equal(cells[move.y * SIZE + move.x], EMPTY);
  assert.ok(move.depth >= 1 && move.depth < LEVELS.hard.depth, `depth ${move.depth}`);
});

test('reads the clock at least once every 64 nodes, so a search stops right after its deadline', () => {
  let reads = 0;
  const now = () => {
    reads++;
    return 0;
  };
  const cells = board({ black: [[7, 7], [8, 8], [6, 9]], white: [[8, 7], [6, 6], [9, 9]] });
  const move = chooseMove(cells, BLACK, { level: 'hard', depth: 6, timeLimitMs: 1e9, now });
  assert.equal(move.depth, 6);
  assert.ok(move.nodes > 5000, `only ${move.nodes} nodes`);
  assert.ok(reads * 64 >= move.nodes, `${reads} clock reads for ${move.nodes} nodes`);
});

test('every level returns a legal move within its budget', () => {
  const cells = demoCells();
  for (const level of Object.keys(LEVELS)) {
    const started = Date.now();
    const move = chooseMove(cells, BLACK, { level, timeLimitMs: 200 });
    assert.equal(cells[move.y * SIZE + move.x], EMPTY, level);
    assert.ok(Date.now() - started < 2000, `${level} took too long`);
  }
});

test('the easy level varies with its seed but still blocks fours', () => {
  const cells = board({ black: [[7, 7], [8, 7], [7, 8]], white: [[6, 6], [9, 9]] });
  const picks = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const move = chooseMove(cells, WHITE, { level: 'easy', rng: createRng(seed), timeLimitMs: 0 });
    picks.add(`${move.x},${move.y}`);
  }
  assert.ok(picks.size > 1, 'easy level should not always pick the same move');
  const four = board({ black: [[3, 7], [4, 7], [5, 7], [6, 7]], white: [[2, 7], [9, 12], [12, 3]] });
  for (let seed = 1; seed <= 5; seed++) {
    assertMove(chooseMove(four, WHITE, { level: 'easy', rng: createRng(seed) }), [[7, 7]], 'easy blocks');
  }
});

test('handleAiMessage answers worker requests', () => {
  const cells = Array.from(demoCells());
  const reply = handleAiMessage({ id: 42, cells, player: BLACK, level: 'easy', seed: 3, timeLimitMs: 0 });
  assert.equal(reply.id, 42);
  assert.equal(cells[reply.move.y * SIZE + reply.move.x], EMPTY);
  const empty = handleAiMessage({ id: 1, cells: new Array(SIZE * SIZE).fill(EMPTY), player: BLACK });
  assert.deepEqual([empty.move.x, empty.move.y], [7, 7]);
});
