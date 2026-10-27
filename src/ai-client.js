/**
 * Asks the AI for moves without blocking the page: searches run in a module
 * Web Worker, or on the main thread when workers are unavailable. Only the
 * latest request is answered, and replies wait a moment so the computer's
 * move never appears instantly.
 */
import { handleAiMessage } from './ai.js';

/** Shortest time between asking and showing the computer's move. */
const MIN_THINK_MS = 350;

/**
 * Creates the AI connection used by the UI.
 * @returns {{prepare: () => void, ask: (request: object, onMove: (move: object | null) => void) => void,
 *   cancel: () => void}}
 */
export function createAiClient() {
  let worker = null;
  let workerFailed = false;
  let busy = false;
  let job = null;
  let lastId = 0;

  function spawn() {
    if (worker || workerFailed || typeof Worker !== 'function') return worker;
    try {
      worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event) => {
        busy = false;
        settle(event.data.id, event.data.move);
      });
      worker.addEventListener('error', onWorkerError);
    } catch {
      workerFailed = true;
      worker = null;
    }
    return worker;
  }

  function onWorkerError(event) {
    event.preventDefault();
    workerFailed = true;
    stopWorker();
    if (job) runLocally(job);
  }

  function stopWorker() {
    worker?.terminate();
    worker = null;
    busy = false;
  }

  function runLocally(current) {
    current.timer = setTimeout(() => {
      const reply = handleAiMessage(current.request);
      settle(reply.id, reply.move);
    }, 0);
  }

  function settle(id, move) {
    const current = job;
    if (!current || current.request.id !== id) return;
    const wait = Math.max(0, MIN_THINK_MS - (performance.now() - current.started));
    current.timer = setTimeout(() => {
      if (job !== current) return;
      job = null;
      current.onMove(move);
    }, wait);
  }

  /** Starts the worker early so the first answer is not delayed by loading it. */
  function prepare() {
    spawn();
  }

  /**
   * Requests a move; a newer request or cancel() drops this one.
   * @param {object} request from game.aiRequest(seed)
   * @param {(move: object | null) => void} onMove receives chooseMove's result
   */
  function ask(request, onMove) {
    cancel();
    job = { request: { ...request, id: ++lastId }, onMove, started: performance.now(), timer: 0 };
    const target = spawn();
    if (!target) {
      runLocally(job);
      return;
    }
    busy = true;
    target.postMessage(job.request);
  }

  /** Forgets the pending request; a worker still searching is replaced. */
  function cancel() {
    if (!job) return;
    clearTimeout(job.timer);
    job = null;
    if (busy) stopWorker();
  }

  return { prepare, ask, cancel };
}
