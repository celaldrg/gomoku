import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SETTINGS, sanitizeSettings, sanitizeMoves } from '../src/settings.js';
import { BLACK, WHITE, SIZE } from '../src/board.js';
import { createGame } from '../src/game.js';

test('valid settings are kept', () => {
  const settings = { mode: 'pvp', level: 'hard', humanColor: WHITE, rule: 'exact', numbers: true };
  assert.deepEqual(sanitizeSettings(settings), settings);
});

test('missing or broken settings fall back to the defaults', () => {
  for (const raw of [null, undefined, 'x', 42, [], {}]) assert.deepEqual(sanitizeSettings(raw), DEFAULT_SETTINGS);
  const repaired = sanitizeSettings({ mode: 'online', level: 'constructor', humanColor: '2', rule: 'renju', numbers: 'yes' });
  assert.deepEqual(repaired, DEFAULT_SETTINGS);
  assert.equal(sanitizeSettings({ humanColor: BLACK, level: 'easy' }).level, 'easy');
});

test('every settings control in index.html maps to a valid setting', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const radios = [...html.matchAll(/<input type="radio" name="(\w+)" value="(\w+)"/g)];
  assert.equal(radios.length, 9);
  for (const [, name, value] of radios) {
    assert.ok(Object.hasOwn(DEFAULT_SETTINGS, name), `unknown setting ${name}`);
    const parsed = name === 'humanColor' ? Number(value) : value;
    assert.equal(sanitizeSettings({ [name]: parsed })[name], parsed, `${name}=${value}`);
  }
});

test('a clean saved move list is kept as plain points', () => {
  const moves = sanitizeMoves([{ x: 7, y: 7, color: BLACK }, { x: 0, y: 14 }]);
  assert.deepEqual(moves, [{ x: 7, y: 7 }, { x: 0, y: 14 }]);
  assert.equal(createGame({ moves }).getState().moves.length, 2);
});

test('any malformed move empties the list instead of shifting colors', () => {
  const broken = [
    null, 'moves', {}, [{ x: 7 }], [{ x: 1, y: 1 }, null], [{ x: 15, y: 0 }], [{ x: -1, y: 3 }],
    [{ x: 1.5, y: 2 }], [{ x: '1', y: 2 }], new Array(SIZE * SIZE + 1).fill({ x: 0, y: 0 }),
  ];
  for (const raw of broken) assert.deepEqual(sanitizeMoves(raw), [], JSON.stringify(raw)?.slice(0, 40));
});
