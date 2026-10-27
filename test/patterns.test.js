import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERN, PATTERN_SCORE, segmentClassifier } from '../src/patterns.js';

const freestyle = segmentClassifier(false);
const exact = segmentClassifier(true);

/** Classifies a segment written as text: 'X' is our stone, '.' an empty cell. */
function shape(text, classify = freestyle) {
  let mask = 0;
  [...text].forEach((ch, i) => {
    if (ch === 'X') mask |= 1 << i;
  });
  return classify(text.length, mask);
}

function expectShapes(expected, classify = freestyle) {
  for (const [text, pattern] of Object.entries(expected)) {
    assert.equal(shape(text, classify), pattern, `"${text}"`);
  }
}

test('recognises fives and fours', () => {
  expectShapes({
    XXXXX: PATTERN.FIVE,
    '..XXXXX..': PATTERN.FIVE,
    XXXXXX: PATTERN.FIVE,
    '.XXXX.': PATTERN.OPEN_FOUR,
    'X.XXX.X': PATTERN.OPEN_FOUR, // two separate completion points
    'XXXX.': PATTERN.FOUR,
    '.XXXX': PATTERN.FOUR,
    'XX.XX': PATTERN.FOUR,
    'X.XXX..': PATTERN.FOUR,
  });
});

test('recognises open and closed threes', () => {
  expectShapes({
    '..XXX..': PATTERN.OPEN_THREE,
    '..XXX.': PATTERN.OPEN_THREE,
    '.XX.X.': PATTERN.OPEN_THREE,
    '.X.XX.': PATTERN.OPEN_THREE,
    '.XXX.': PATTERN.THREE, // too short to become an open four
    'XXX...': PATTERN.THREE, // blocked by the edge
    '.X.X.X.': PATTERN.THREE,
    'X..XX': PATTERN.THREE,
  });
});

test('recognises twos, single stones and dead segments', () => {
  expectShapes({
    '...XX...': PATTERN.OPEN_TWO,
    '..X.X..': PATTERN.OPEN_TWO,
    '.X..X.': PATTERN.OPEN_TWO,
    'XX...': PATTERN.TWO,
    'XX....': PATTERN.TWO,
    'X.....X': PATTERN.ONE, // never inside the same five
    '....X....': PATTERN.ONE,
    '.....': PATTERN.NONE,
    XXXX: PATTERN.NONE, // no room for five
  });
});

test('the exact-five rule rejects overlines', () => {
  expectShapes({
    XXXXX: PATTERN.FIVE,
    XXXXXX: PATTERN.ONE,
    'XXXX.X': PATTERN.ONE, // filling the gap makes six
    '.XXXX.X': PATTERN.FOUR, // only the left end makes exactly five
    '.XXXX.': PATTERN.OPEN_FOUR,
  }, exact);
  expectShapes({ 'XXXX.X': PATTERN.FOUR, '.XXXX.X': PATTERN.OPEN_FOUR });
});

test('stronger patterns score higher', () => {
  for (let p = 1; p < PATTERN_SCORE.length; p++) {
    assert.ok(PATTERN_SCORE[p] > PATTERN_SCORE[p - 1], `pattern ${p}`);
  }
  assert.equal(PATTERN_SCORE.length, Object.keys(PATTERN).length);
});
