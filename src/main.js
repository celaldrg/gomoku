/**
 * Entry point: connects the game, the AI worker, the board view, the
 * controls and the language switch. "?demo" opens a fixed mid-game position
 * (used for the README screenshot) and saves nothing.
 */
import { SIZE, BLACK, WHITE, EMPTY } from './board.js';
import { createGame, createDemoGame, MODES } from './game.js';
import { createAiClient } from './ai-client.js';
import { createBoardView } from './board-view.js';
import { pointLabel } from './geometry.js';
import { nextLang, normalizeLang, translate } from './i18n.js';
import { createRng, randomInt } from './rng.js';
import { DEFAULT_SETTINGS, sanitizeMoves, sanitizeSettings } from './settings.js';
import { describeStatus } from './status.js';
import { load, save } from './storage.js';

const demo = new URLSearchParams(window.location.search).has('demo');
const $ = (selector) => document.querySelector(selector);
const ui = {
  board: $('#board'),
  newGame: $('#new-game'),
  lang: $('#lang'),
  undo: $('#undo'),
  numbers: $('#numbers'),
  settingsToggle: $('#settings-toggle'),
  settings: $('#settings'),
  status: $('#status'),
  statusStone: $('#status-stone'),
  statusText: $('#status-text'),
  statusMeta: $('#status-meta'),
  hint: $('#hint'),
  announcer: $('#announcer'),
};

const ai = createAiClient();
const seeds = createRng(demo ? 1 : Date.now());
let lang = normalizeLang(load('lang', null));
let settings = demo ? { ...DEFAULT_SETTINGS } : sanitizeSettings(load('settings', null));
let game = demo ? createDemoGame() : restoreGame();
let touchInput = window.matchMedia('(pointer: coarse)').matches;
let aiming = false;

const t = (key, params) => translate(lang, key, params);
const colorName = (color) => t(color === BLACK ? 'color.black' : 'color.white');

const view = createBoardView(ui.board, {
  onPlace: humanPlay,
  onCursor: announceCursor,
  onAimChange(active) {
    aiming = active;
    renderStatus(game.getState());
  },
});

/** The saved game, replayed with the saved settings; a fresh game if it does not fit. */
function restoreGame() {
  try {
    return createGame({ ...settings, moves: sanitizeMoves(load('moves', null)) });
  } catch {
    return createGame(settings);
  }
}

function persist() {
  if (demo) return;
  save('settings', settings);
  save('moves', game.getState().moves.map(({ x, y }) => ({ x, y })));
}

function canHumanPlay() {
  return !game.getState().over && !game.isAiTurn();
}

function startGame(next) {
  ai.cancel();
  game = next;
  persist();
  refresh();
  askAi();
}

function newGame() {
  startGame(createGame(settings));
}

function humanPlay(x, y) {
  if (canHumanPlay()) applyMove(x, y);
}

function applyMove(x, y) {
  const result = game.play(x, y);
  if (!result.ok) return;
  persist();
  const state = game.getState();
  const move = t('announce.move', { color: colorName(result.color), point: pointLabel(x, y) });
  announce(state.over ? `${move}. ${t(describeStatus(state).key)}` : move);
  refresh({ x, y });
  askAi();
}

function askAi() {
  if (!game.isAiTurn()) return;
  const seed = randomInt(seeds, 2 ** 31);
  ai.ask(game.aiRequest(seed), (move) => {
    if (move) applyMove(move.x, move.y);
  });
}

function undo() {
  if (!game.canUndo()) return;
  ai.cancel();
  game.undo();
  persist();
  refresh();
  askAi();
}

function changeSetting(name, value) {
  const changed = sanitizeSettings({ ...settings, [name]: name === 'humanColor' ? Number(value) : value });
  const keepMoves = name === 'level';
  settings = changed;
  startGame(createGame({ ...settings, moves: keepMoves ? game.getState().moves : [] }));
}

function toggleNumbers() {
  settings = { ...settings, numbers: !settings.numbers };
  persist();
  refresh();
}

function toggleSettings() {
  const open = ui.settingsToggle.getAttribute('aria-expanded') !== 'true';
  ui.settingsToggle.setAttribute('aria-expanded', String(open));
  ui.settings.classList.toggle('is-open', open);
}

function switchLanguage() {
  lang = nextLang(lang);
  save('lang', lang);
  announce('');
  applyLanguage();
}

function announce(message) {
  ui.announcer.textContent = message;
}

function announceCursor(cell) {
  const color = game.getState().cells[cell.y * SIZE + cell.x];
  const content = color === EMPTY ? t('cell.empty') : colorName(color);
  announce(t('announce.cursor', { point: pointLabel(cell.x, cell.y), content }));
}

function refresh(placed = null) {
  const state = game.getState();
  view.update(state, { interactive: canHumanPlay(), numbers: settings.numbers, placed });
  renderStatus(state);
  renderControls(state);
}

function hintKey(state) {
  if (state.over) return 'hint.over';
  if (aiming) return 'hint.confirm';
  return touchInput ? 'hint.touch' : 'hint.mouse';
}

function renderStatus(state) {
  const status = describeStatus(state);
  ui.status.dataset.tone = status.tone;
  ui.statusStone.dataset.stone = status.stone === BLACK ? 'black' : status.stone === WHITE ? 'white' : 'none';
  ui.statusText.textContent = t(status.key);
  ui.statusMeta.textContent = state.over
    ? t('status.moves', { n: state.moves.length })
    : t('status.move', { n: state.moves.length + 1 });
  ui.hint.textContent = t(hintKey(state));
  ui.newGame.classList.toggle('is-attention', state.over);
}

function renderControls(state) {
  ui.undo.disabled = !game.canUndo();
  ui.numbers.setAttribute('aria-pressed', String(settings.numbers));
  const values = { mode: state.mode, level: state.level, humanColor: String(state.humanColor), rule: state.rule };
  for (const input of ui.settings.querySelectorAll('input[type="radio"]')) {
    input.checked = values[input.name] === input.value;
  }
  for (const group of ui.settings.querySelectorAll('[data-ai-only]')) {
    group.disabled = state.mode !== MODES.AI;
  }
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nLabel));
  }
  for (const element of document.querySelectorAll('[data-i18n-title]')) {
    element.title = t(element.dataset.i18nTitle);
  }
  ui.lang.textContent = nextLang(lang).toUpperCase();
  refresh();
}

function bindControls() {
  ui.newGame.addEventListener('click', newGame);
  ui.undo.addEventListener('click', undo);
  ui.numbers.addEventListener('click', toggleNumbers);
  ui.settingsToggle.addEventListener('click', toggleSettings);
  ui.lang.addEventListener('click', switchLanguage);
  ui.settings.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) changeSetting(event.target.name, event.target.value);
  });
  ui.board.addEventListener('pointerdown', (event) => {
    const touch = event.pointerType === 'touch';
    if (touch === touchInput) return;
    touchInput = touch;
    renderStatus(game.getState());
  });
}

bindControls();
applyLanguage();
if (settings.mode === MODES.AI) ai.prepare();
askAi();
