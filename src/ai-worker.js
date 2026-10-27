/**
 * Module Web Worker that computes AI moves off the main thread.
 * Create it with: new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' })
 * Post game.aiRequest(seed) plus an optional id; the reply is { id, move }.
 */
import { handleAiMessage } from './ai.js';

self.addEventListener('message', (event) => {
  self.postMessage(handleAiMessage(event.data));
});
