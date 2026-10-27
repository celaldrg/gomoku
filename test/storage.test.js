import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save } from '../src/storage.js';

/** Runs `body` with globalThis.localStorage replaced by `value`, then restores it. */
function withStorage(value, body) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });
  try {
    body();
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
}

function memoryStorage() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('values round-trip as JSON under the app prefix', () => {
  const storage = memoryStorage();
  withStorage(storage, () => {
    assert.equal(save('settings', { level: 'hard', numbers: true }), true);
    assert.deepEqual(load('settings', null), { level: 'hard', numbers: true });
    assert.equal(storage.data.get('gomoku:settings'), '{"level":"hard","numbers":true}');
    assert.equal(load('missing', 'fallback'), 'fallback');
  });
});

test('broken JSON gives the fallback', () => {
  const storage = memoryStorage();
  storage.data.set('gomoku:moves', '[{"x":');
  withStorage(storage, () => assert.deepEqual(load('moves', []), []));
});

test('blocked or missing storage never throws', () => {
  const blocked = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  for (const storage of [blocked, undefined, null]) {
    withStorage(storage, () => {
      assert.equal(load('lang', 'en'), 'en');
      assert.equal(save('lang', 'tr'), false);
    });
  }
});
