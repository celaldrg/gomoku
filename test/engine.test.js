import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, EMPTY, BLACK, WHITE, RULES } from '../src/board.js';
import { Position, WIN } from '../src/engine.js';
import { PATTERN } from '../src/patterns.js';
import { createRng, randomInt } from '../src/rng.js';

const cell = (x, y) => y * SIZE + x;

function positionWith({ black = [], white = [] }, rule = RULES.FREESTYLE) {
  const cells = new Uint8Array(SIZE * SIZE);
  for (const [x, y] of black) cells[cell(x, y)] = BLACK;
  for (const [x, y] of white) cells[cell(x, y)] = WHITE;
  return Position.from(cells, SIZE, rule);
}

test('incremental place/remove matches a fresh rebuild', () => {
  for (const rule of Object.values(RULES)) {
    const rng = createRng(rule === RULES.EXACT ? 11 : 7);
    const pos = new Position(SIZE, rule);
    for (let step = 0; step < 400; step++) {
      const occupied = [...pos.cells.keys()].filter((i) => pos.cells[i] !== EMPTY);
      if (occupied.length > 0 && rng() < 0.35) {
        pos.remove(occupied[randomInt(rng, occupied.length)]);
      } else {
        const empty = [...pos.cells.keys()].filter((i) => pos.cells[i] === EMPTY);
        pos.place(empty[randomInt(rng, empty.length)], step % 2 === 0 ? BLACK : WHITE);
      }
      const fresh = Position.from(pos.cells, SIZE, rule);
      for (const color of [BLACK, WHITE]) {
        assert.deepEqual(Array.from(pos.count[color]), Array.from(fresh.count[color]), `${rule} step ${step}`);
        assert.equal(pos.score[color], fresh.score[color]);
      }
      assert.deepEqual(pos.near, fresh.near);
      assert.equal(pos.stones, fresh.stones);
    }
  }
});

test('fivePoints lists every completing cell once', () => {
  const pos = positionWith({
    black: [[3, 7], [4, 7], [5, 7], [6, 7], [7, 3], [7, 4], [7, 5], [7, 6]],
    white: [[0, 0], [14, 14], [0, 14], [14, 0], [10, 10], [11, 11], [12, 12], [13, 13]],
  });
  const out = new Int16Array(SIZE * SIZE);
  const found = pos.fivePoints(BLACK, out);
  assert.deepEqual(Array.from(out.subarray(0, found)).sort((a, b) => a - b), [cell(7, 2), cell(2, 7), cell(7, 7)]);
  assert.equal(pos.fivePoints(WHITE, out), 0);
});

test('gainAt reports the strongest pattern a move creates', () => {
  const pos = positionWith({ black: [[6, 7], [7, 7], [8, 7]], white: [[3, 3], [11, 11]] });
  assert.ok(pos.gainAt(cell(5, 7), BLACK) > 0);
  assert.equal(pos.gainPattern, PATTERN.OPEN_FOUR);
  pos.gainAt(cell(4, 7), BLACK);
  assert.equal(pos.gainPattern, PATTERN.FOUR);
  pos.gainAt(cell(5, 7), WHITE);
  assert.ok(pos.gainPattern < PATTERN.THREE);
  assert.equal(pos.count[BLACK][PATTERN.OPEN_THREE], 1);
});

test('evaluate returns proven scores for forced positions', () => {
  const four = positionWith({ black: [[3, 7], [4, 7], [5, 7], [6, 7]], white: [[2, 7], [9, 9], [10, 9]] });
  assert.equal(four.evaluate(BLACK, 0), WIN - 1);
  const openFour = positionWith({ black: [[3, 7], [4, 7], [5, 7], [6, 7]], white: [[9, 9], [10, 9], [11, 9]] });
  assert.equal(openFour.evaluate(WHITE, 0), -(WIN - 2));
  const openThree = positionWith({ black: [[6, 7], [7, 7], [8, 7]], white: [[3, 3], [11, 11], [3, 11]] });
  assert.equal(openThree.evaluate(BLACK, 0), WIN - 3);
  const quiet = positionWith({ black: [[7, 7]], white: [[8, 8]] });
  assert.ok(Math.abs(quiet.evaluate(BLACK, 0)) < 1000);
});

test('rejects unsupported board sizes', () => {
  assert.throws(() => new Position(4), RangeError);
  assert.throws(() => new Position(16), RangeError);
  assert.equal(new Position(9).area, 81);
});
