import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE, BLACK, WHITE, RULES, opponent, inBounds, findWin,
} from '../src/board.js';

/** Flat board with stones given as [x, y, color] (color defaults to black). */
function boardWith(stones) {
  const cells = new Uint8Array(SIZE * SIZE);
  for (const [x, y, color = BLACK] of stones) cells[y * SIZE + x] = color;
  return cells;
}

/** A straight run of `length` stones starting at (x, y) and stepping (dx, dy). */
function run(x, y, dx, dy, length, color = BLACK) {
  return Array.from({ length }, (_, i) => [x + i * dx, y + i * dy, color]);
}

const sameStones = (line, stones) =>
  assert.deepEqual(
    line.map((p) => `${p.x},${p.y}`).sort(),
    stones.map(([x, y]) => `${x},${y}`).sort(),
  );

test('opponent and inBounds helpers', () => {
  assert.equal(opponent(BLACK), WHITE);
  assert.equal(opponent(WHITE), BLACK);
  assert.equal(inBounds(0, 0), true);
  assert.equal(inBounds(14, 14), true);
  assert.equal(inBounds(15, 3), false);
  assert.equal(inBounds(3, -1), false);
});

test('detects five in all four directions, including along edges and corners', () => {
  const cases = {
    'horizontal, top edge': run(0, 0, 1, 0, 5),
    'horizontal, bottom-right corner': run(10, 14, 1, 0, 5),
    'horizontal, middle': run(5, 7, 1, 0, 5),
    'vertical, left edge': run(0, 10, 0, 1, 5),
    'vertical, right edge': run(14, 0, 0, 1, 5),
    'diagonal, top-left corner': run(0, 0, 1, 1, 5),
    'diagonal, bottom-right corner': run(10, 10, 1, 1, 5),
    'anti-diagonal, top-right corner': run(14, 0, -1, 1, 5),
    'anti-diagonal, bottom-left corner': run(4, 10, -1, 1, 5),
    'anti-diagonal, white stones': run(9, 3, -1, 1, 5, WHITE),
  };
  for (const [name, stones] of Object.entries(cases)) {
    const cells = boardWith(stones);
    for (const rule of Object.values(RULES)) {
      for (const [x, y] of stones) {
        const line = findWin(cells, x, y, { rule });
        assert.ok(line, `${name} (${rule}) from ${x},${y}`);
        sameStones(line, stones);
      }
    }
  }
});

test('four in a row, a broken five and mixed colors are not wins', () => {
  const cases = {
    four: run(3, 3, 1, 1, 4),
    broken: [...run(2, 6, 1, 0, 4), [7, 6]],
    mixed: [...run(2, 9, 0, 1, 4), [2, 13, WHITE]],
  };
  for (const [name, stones] of Object.entries(cases)) {
    const cells = boardWith(stones);
    for (const rule of Object.values(RULES)) {
      for (const [x, y] of stones) assert.equal(findWin(cells, x, y, { rule }), null, `${name} (${rule}) from ${x},${y}`);
    }
  }
});

test('overlines win under freestyle but not under the exact-five rule', () => {
  for (const stones of [run(4, 7, 1, 0, 6), run(0, 0, 0, 1, 7), run(14, 8, -1, 1, 6)]) {
    const cells = boardWith(stones);
    const [x, y] = stones[2];
    const line = findWin(cells, x, y, { rule: RULES.FREESTYLE });
    assert.equal(line.length, stones.length);
    assert.equal(findWin(cells, x, y, { rule: RULES.EXACT }), null);
  }
});

test('the exact rule accepts a five that crosses an overline', () => {
  const sixAcross = run(2, 7, 1, 0, 6);
  const fiveDown = run(5, 3, 0, 1, 5).filter(([x, y]) => !(x === 5 && y === 7));
  const cells = boardWith([...sixAcross, ...fiveDown]);
  sameStones(findWin(cells, 5, 7, { rule: RULES.EXACT }), run(5, 3, 0, 1, 5));
});

test('the exact rule accepts five next to a separate stone', () => {
  const cells = boardWith([...run(1, 1, 1, 0, 5), [7, 1]]);
  assert.equal(findWin(cells, 3, 1, { rule: RULES.EXACT }).length, 5);
});

test('findWin ignores empty and out-of-range points', () => {
  const cells = boardWith(run(0, 0, 1, 0, 5));
  assert.equal(findWin(cells, 6, 6), null);
  assert.equal(findWin(cells, -1, 0), null);
  assert.equal(findWin(cells, 0, SIZE), null);
});
