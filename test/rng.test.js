import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, randomInt } from '../src/rng.js';

test('the same seed gives the same sequence', () => {
  const a = createRng(123);
  const b = createRng(123);
  const c = createRng(124);
  const first = Array.from({ length: 20 }, () => a());
  assert.deepEqual(Array.from({ length: 20 }, () => b()), first);
  assert.notDeepEqual(Array.from({ length: 20 }, () => c()), first);
});

test('values stay in range and cover every integer', () => {
  const rng = createRng(5);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const value = rng();
    assert.ok(value >= 0 && value < 1);
    const n = randomInt(rng, 7);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 7);
    seen.add(n);
  }
  assert.equal(seen.size, 7);
});
