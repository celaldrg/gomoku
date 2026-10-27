/**
 * User interface strings in English and Turkish.
 * Pure module: the UI looks strings up with translate(); placeholders are
 * written as {name} and filled from the params object.
 */

/** Every UI string, per language. English is the default and the fallback. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    'doc.title': 'Gomoku: five in a row',
    title: 'Gomoku',
    newGame: 'New game',
    'lang.switch': 'Switch to Turkish',
    undo: 'Undo',
    numbers: 'Numbers',
    'numbers.label': 'Show move numbers',
    settings: 'Settings',
    'settings.mode': 'Mode',
    'mode.ai': 'vs computer',
    'mode.pvp': '2 players',
    'settings.level': 'Level',
    'level.easy': 'Easy',
    'level.medium': 'Medium',
    'level.hard': 'Hard',
    'settings.color': 'You play',
    'settings.rule': 'Winning line',
    'rule.freestyle': '5 or more',
    'rule.exact': 'Exactly 5',
    'color.black': 'Black',
    'color.white': 'White',
    'status.yourTurn': 'Your move',
    'status.thinking': 'Computer is thinking',
    'status.blackToMove': 'Black to move',
    'status.whiteToMove': 'White to move',
    'status.youWin': 'You win!',
    'status.aiWins': 'Computer wins',
    'status.blackWins': 'Black wins!',
    'status.whiteWins': 'White wins!',
    'status.draw': 'Draw: the board is full',
    'status.move': 'Move {n}',
    'status.moves': '{n} moves',
    'hint.mouse': 'Click a point to place a stone. Keyboard: arrows + Enter.',
    'hint.touch': 'Tap a point to aim, then tap it again to place.',
    'hint.confirm': 'Tap the marked point again to place your stone.',
    'hint.over': 'Start a new game, or undo to try again.',
    'board.label': 'Gomoku board, 15 by 15. Arrow keys move the cursor, Enter places a stone.',
    'announce.move': '{color} {point}',
    'announce.cursor': '{point}: {content}',
    'cell.empty': 'empty',
    footer: 'MIT · Source on GitHub',
  }),
  tr: Object.freeze({
    'doc.title': 'Gomoku: beşi yan yana',
    title: 'Gomoku',
    newGame: 'Yeni oyun',
    'lang.switch': 'İngilizceye geç',
    undo: 'Geri al',
    numbers: 'Numaralar',
    'numbers.label': 'Hamle numaralarını göster',
    settings: 'Ayarlar',
    'settings.mode': 'Mod',
    'mode.ai': 'Bilgisayara karşı',
    'mode.pvp': 'İki oyuncu',
    'settings.level': 'Seviye',
    'level.easy': 'Kolay',
    'level.medium': 'Orta',
    'level.hard': 'Zor',
    'settings.color': 'Senin rengin',
    'settings.rule': 'Kazanan sıra',
    'rule.freestyle': '5 ve üzeri',
    'rule.exact': 'Tam 5',
    'color.black': 'Siyah',
    'color.white': 'Beyaz',
    'status.yourTurn': 'Sıra sende',
    'status.thinking': 'Bilgisayar düşünüyor',
    'status.blackToMove': 'Sıra siyahta',
    'status.whiteToMove': 'Sıra beyazda',
    'status.youWin': 'Kazandın!',
    'status.aiWins': 'Bilgisayar kazandı',
    'status.blackWins': 'Siyah kazandı!',
    'status.whiteWins': 'Beyaz kazandı!',
    'status.draw': 'Berabere: tahta doldu',
    'status.move': 'Hamle {n}',
    'status.moves': '{n} hamle',
    'hint.mouse': 'Taş koymak için bir noktaya tıkla. Klavye: ok tuşları + Enter.',
    'hint.touch': 'Nişan almak için bir noktaya dokun, koymak için tekrar dokun.',
    'hint.confirm': 'Taşını koymak için işaretli noktaya tekrar dokun.',
    'hint.over': 'Yeni oyun başlat ya da geri alıp tekrar dene.',
    'board.label': 'Gomoku tahtası, 15’e 15. Ok tuşları imleci taşır, Enter taş koyar.',
    'announce.move': '{color} {point}',
    'announce.cursor': '{point}: {content}',
    'cell.empty': 'boş',
    footer: 'MIT · Kaynak kod GitHub’da',
  }),
});

/** Language used when nothing (or something unknown) is stored. */
const DEFAULT_LANG = 'en';

/**
 * Returns a supported language code.
 * @param {unknown} value stored or requested language
 * @returns {string} a key of STRINGS
 */
export function normalizeLang(value) {
  return typeof value === 'string' && Object.hasOwn(STRINGS, value) ? value : DEFAULT_LANG;
}

/**
 * The language the toggle switches to: the next one in STRINGS order.
 * @param {string} lang current language
 * @returns {string}
 */
export function nextLang(lang) {
  const langs = Object.keys(STRINGS);
  return langs[(langs.indexOf(normalizeLang(lang)) + 1) % langs.length];
}

/**
 * Looks up a string and fills its {placeholders}.
 * Missing keys fall back to English, then to the key itself.
 * @param {string} lang language code
 * @param {string} key string id
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const template = STRINGS[normalizeLang(lang)][key] ?? STRINGS[DEFAULT_LANG][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}
