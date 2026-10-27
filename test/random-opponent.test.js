import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseMove, LEVELS } from '../src/ai.js';
import { SIZE, EMPTY, BLACK, WHITE, RULES, findWin } from '../src/board.js';
import { createRng, randomInt } from '../src/rng.js';

const GAMES = 100;
/** The AI plays with the Medium level's settings, the level a first visit gets. */
const LEVEL = 'medium';
/** No time limit: every search runs to the level's full depth, so each game is reproducible. */
const SEARCH = { level: LEVEL, timeLimitMs: 0 };

function hasNeighbour(cells, index) {
  const x0 = index % SIZE;
  const y0 = Math.floor(index / SIZE);
  for (let y = Math.max(0, y0 - 2); y <= Math.min(SIZE - 1, y0 + 2); y++) {
    for (let x = Math.max(0, x0 - 2); x <= Math.min(SIZE - 1, x0 + 2); x++) {
      if (cells[y * SIZE + x] !== EMPTY) return true;
    }
  }
  return false;
}

/** Seeded random opponent: any empty cell, or one near the stones when `near` is set. */
function randomMove(cells, rng, near) {
  const empty = [...cells.keys()].filter((i) => cells[i] === EMPTY);
  const close = near ? empty.filter((i) => hasNeighbour(cells, i)) : [];
  const pool = close.length > 0 ? close : empty;
  return pool[randomInt(rng, pool.length)];
}

/**
 * Plays one game: even games the AI is black, odd games white; the rule
 * alternates every two games; the second half uses a nearby random opponent.
 * @returns {'win' | 'draw' | 'loss'} from the AI's point of view
 */
function playGame(index) {
  const rng = createRng(1000 + index);
  const aiColor = index % 2 === 0 ? BLACK : WHITE;
  const rule = index % 4 < 2 ? RULES.FREESTYLE : RULES.EXACT;
  const near = index >= GAMES / 2;
  const cells = new Uint8Array(SIZE * SIZE);
  for (let ply = 0; ply < cells.length; ply++) {
    const color = ply % 2 === 0 ? BLACK : WHITE;
    let cell;
    if (color === aiColor) {
      const move = chooseMove(cells, color, { ...SEARCH, rule });
      cell = move.y * SIZE + move.x;
    } else {
      cell = randomMove(cells, rng, near);
    }
    assert.equal(cells[cell], EMPTY);
    cells[cell] = color;
    if (findWin(cells, cell % SIZE, Math.floor(cell / SIZE), { rule })) {
      return color === aiColor ? 'win' : 'loss';
    }
  }
  return 'draw';
}

test(`the AI never loses to a seeded random opponent over ${GAMES} games (${LEVEL} level, fixed depth ${LEVELS[LEVEL].depth})`, () => {
  const lost = [];
  let wins = 0;
  for (let game = 0; game < GAMES; game++) {
    const result = playGame(game);
    if (result === 'loss') lost.push(game);
    if (result === 'win') wins++;
  }
  assert.deepEqual(lost, [], 'games lost by the AI');
  assert.equal(wins, GAMES, 'every game should end in an AI win');
});
