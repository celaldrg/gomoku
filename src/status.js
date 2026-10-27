/**
 * Turns a game snapshot into what the status line says.
 * Pure module: returns i18n keys, the UI translates them.
 */
import { BLACK, EMPTY } from './board.js';
import { MODES } from './game.js';

/**
 * Describes whose turn it is or how the game ended.
 * @param {{mode: string, humanColor: number, turn: number, winner: number, draw: boolean}} state
 *   a snapshot from game.getState()
 * @returns {{key: string, tone: 'turn'|'thinking'|'win'|'loss'|'draw', stone: number}}
 *   key: i18n key of the message; tone: how to style it; stone: color to show (EMPTY for none)
 */
export function describeStatus(state) {
  const vsAi = state.mode === MODES.AI;
  if (state.winner !== EMPTY) {
    if (!vsAi) return { key: state.winner === BLACK ? 'status.blackWins' : 'status.whiteWins', tone: 'win', stone: state.winner };
    const human = state.winner === state.humanColor;
    return { key: human ? 'status.youWin' : 'status.aiWins', tone: human ? 'win' : 'loss', stone: state.winner };
  }
  if (state.draw) return { key: 'status.draw', tone: 'draw', stone: EMPTY };
  if (vsAi) {
    const human = state.turn === state.humanColor;
    return { key: human ? 'status.yourTurn' : 'status.thinking', tone: human ? 'turn' : 'thinking', stone: state.turn };
  }
  return { key: state.turn === BLACK ? 'status.blackToMove' : 'status.whiteToMove', tone: 'turn', stone: state.turn };
}
