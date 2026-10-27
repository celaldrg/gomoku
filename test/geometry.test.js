import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boardGeometry, cellCenter, pointToCell, columnLabel, rowLabel, pointLabel, starPoints, stepCursor,
} from '../src/geometry.js';
import { SIZE } from '../src/board.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

test('the 15 lines fill the board with an even margin', () => {
  const geometry = boardGeometry(620);
  close(geometry.cell, 40);
  close(geometry.origin, 30);
  close(cellCenter(geometry, SIZE - 1, SIZE - 1).px + geometry.origin, 620);
  assert.ok(geometry.radius < geometry.cell / 2, 'neighbouring stones do not overlap');
});

test('every intersection hits itself, even half a cell off', () => {
  for (const pixels of [359, 640]) {
    const geometry = boardGeometry(pixels);
    const nudge = geometry.cell * 0.45;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const { px, py } = cellCenter(geometry, x, y);
        assert.deepEqual(pointToCell(geometry, px, py), { x, y });
        assert.deepEqual(pointToCell(geometry, px + nudge, py - nudge), { x, y });
      }
    }
  }
});

test('the margin snaps to the edge lines and off-board points miss', () => {
  const geometry = boardGeometry(310);
  assert.deepEqual(pointToCell(geometry, 0, 0), { x: 0, y: 0 });
  assert.deepEqual(pointToCell(geometry, 310, 155), { x: 14, y: 7 });
  for (const [px, py] of [[-1, 10], [10, -0.5], [311, 10], [10, 400], [NaN, 3]]) {
    assert.equal(pointToCell(geometry, px, py), null, `${px},${py}`);
  }
});

test('coordinates use letters A-O and rows 1-15 from the bottom', () => {
  assert.equal(pointLabel(7, 7), 'H8');
  assert.equal(pointLabel(0, 14), 'A1');
  assert.equal(pointLabel(14, 0), 'O15');
  assert.deepEqual(Array.from({ length: SIZE }, (_, x) => columnLabel(x)).join(''), 'ABCDEFGHIJKLMNO');
  assert.equal(rowLabel(0), '15');
  assert.equal(rowLabel(14), '1');
});

test('star points sit on the centre and the fourth lines', () => {
  assert.deepEqual(starPoints(), [{ x: 3, y: 3 }, { x: 11, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 11 }, { x: 11, y: 11 }]);
});

test('the keyboard cursor moves one step and stops at the edges', () => {
  assert.deepEqual(stepCursor({ x: 7, y: 7 }, 'ArrowLeft'), { x: 6, y: 7 });
  assert.deepEqual(stepCursor({ x: 7, y: 7 }, 'ArrowRight'), { x: 8, y: 7 });
  assert.deepEqual(stepCursor({ x: 7, y: 7 }, 'ArrowUp'), { x: 7, y: 6 });
  assert.deepEqual(stepCursor({ x: 7, y: 7 }, 'ArrowDown'), { x: 7, y: 8 });
  assert.deepEqual(stepCursor({ x: 0, y: 0 }, 'ArrowLeft'), { x: 0, y: 0 });
  assert.deepEqual(stepCursor({ x: 14, y: 14 }, 'ArrowDown'), { x: 14, y: 14 });
  for (const key of ['Enter', 'a', 'toString', 'constructor']) assert.equal(stepCursor({ x: 1, y: 1 }, key), null);
});
