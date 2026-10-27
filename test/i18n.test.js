import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS, translate, normalizeLang, nextLang } from '../src/i18n.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

/** Keys named in index.html (data-i18n, data-i18n-label, data-i18n-title). */
function htmlKeys() {
  return [...read('index.html').matchAll(/data-i18n(?:-label|-title)?="([^"]+)"/g)].map((match) => match[1]);
}

/** Dotted string literals in the UI code, such as 'status.move'. */
function codeKeys() {
  return readdirSync(new URL('src/', root))
    .flatMap((file) => [...read(`src/${file}`).matchAll(/'([a-z]+\.[a-z][A-Za-z]*)'/g)].map((match) => match[1]))
    .filter((literal) => !literal.endsWith('.js'));
}

test('English and Turkish have the same keys and placeholders', () => {
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
  for (const key of Object.keys(STRINGS.en)) {
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
    assert.ok(STRINGS.tr[key].trim() !== '', `empty Turkish string: ${key}`);
  }
});

test('Turkish strings are translated, not copied', () => {
  const sameOnPurpose = new Set(['title', 'announce.move', 'announce.cursor']);
  for (const key of Object.keys(STRINGS.en)) {
    if (!sameOnPurpose.has(key)) assert.notEqual(STRINGS.tr[key], STRINGS.en[key], key);
  }
});

test('every key the page and the code use exists, and every string is used', () => {
  const used = new Set([...htmlKeys(), ...codeKeys()]);
  for (const key of used) assert.ok(Object.hasOwn(STRINGS.en, key), `missing string: ${key}`);
  for (const key of Object.keys(STRINGS.en)) assert.ok(used.has(key), `unused string: ${key}`);
});

test('translate fills placeholders and falls back safely', () => {
  assert.equal(translate('en', 'status.move', { n: 21 }), 'Move 21');
  assert.equal(translate('tr', 'status.move', { n: 21 }), 'Hamle 21');
  assert.equal(translate('tr', 'announce.move', { color: 'Siyah', point: 'H8' }), 'Siyah H8');
  assert.equal(translate('en', 'status.move'), 'Move {n}');
  assert.equal(translate('xx', 'newGame'), 'New game');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
});

test('language codes are normalised and the toggle alternates', () => {
  assert.equal(normalizeLang('tr'), 'tr');
  for (const value of [null, undefined, 'de', 42, 'constructor']) assert.equal(normalizeLang(value), 'en');
  assert.equal(nextLang('en'), 'tr');
  assert.equal(nextLang('tr'), 'en');
  assert.equal(nextLang('??'), 'tr');
});
