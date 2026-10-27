/**
 * Canvas drawing: wooden board, grid, stones, last-move marker, move
 * numbers, winning line, ghost stone and keyboard cursor.
 * The board and the stones are painted once per size into offscreen layers;
 * a frame only copies them and adds the markers.
 */
import { BLACK, WHITE, EMPTY } from './board.js';
import { cellCenter, columnLabel, rowLabel, starPoints } from './geometry.js';
import { createRng } from './rng.js';

const ACCENT = '#fbbf24';
const INK = 'rgba(62, 36, 12, 0.82)';
/** Coordinate labels are drawn only when cells are at least this wide (CSS px). */
const LABEL_MIN_CELL = 28;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const STONE_STOPS = {
  [BLACK]: [[0, '#6b7280'], [0.32, '#2a2e35'], [1, '#07080a']],
  [WHITE]: [[0, '#ffffff'], [0.55, '#efebe3'], [1, '#c3bba9']],
};

/**
 * Creates a renderer for one canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {{resize: (geometry: object, dpr: number) => void, draw: (scene: object) => void}}
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let geometry = null;
  let dpr = 1;
  let background = null;
  let sprites = null;

  /**
   * Matches the canvas to its CSS size and repaints the cached layers.
   * @param {ReturnType<import('./geometry.js').boardGeometry>} next
   * @param {number} pixelRatio window.devicePixelRatio
   */
  function resize(next, pixelRatio) {
    geometry = next;
    dpr = pixelRatio;
    const side = Math.max(1, Math.round(geometry.pixels * dpr));
    canvas.width = side;
    canvas.height = side;
    background = paintBackground(geometry, dpr, side);
    sprites = { [BLACK]: paintStone(BLACK, geometry.radius, dpr), [WHITE]: paintStone(WHITE, geometry.radius, dpr) };
  }

  /**
   * Draws one frame.
   * @param {{cells: number[], moves: {x: number, y: number, color: number}[],
   *   lastMove: object | null, winLine: {x: number, y: number}[] | null, numbers: boolean,
   *   ghost: {x: number, y: number, color: number, aim: boolean} | null,
   *   cursor: {x: number, y: number} | null, drop: {x: number, y: number, t: number} | null,
   *   winProgress: number}} scene
   */
  function draw(scene) {
    if (!geometry) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(background, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scene.ghost?.aim) drawGuides(ctx, geometry, scene.ghost);
    drawStones(ctx, geometry, sprites, scene);
    if (scene.numbers) drawNumbers(ctx, geometry, scene.moves);
    else if (scene.lastMove) drawLastMarker(ctx, geometry, scene.lastMove);
    if (scene.winLine) drawWinLine(ctx, geometry, scene.winLine, scene.winProgress, dpr);
    if (scene.ghost) drawGhost(ctx, geometry, sprites, scene.ghost);
    if (scene.cursor) drawCursor(ctx, geometry, scene.cursor);
  }

  return { resize, draw };
}

function createLayer(side) {
  const layer = document.createElement('canvas');
  layer.width = side;
  layer.height = side;
  return layer;
}

/** Wood, grid, star points and labels, painted once per size. */
function paintBackground(geometry, dpr, side) {
  const layer = createLayer(side);
  const g = layer.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintWood(g, geometry.pixels);
  paintGrid(g, geometry, dpr);
  if (geometry.cell >= LABEL_MIN_CELL) paintLabels(g, geometry);
  return layer;
}

/** Warm gradient with seeded, gently waving grain lines and a soft vignette. */
function paintWood(g, size) {
  const base = g.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, '#ebc684');
  base.addColorStop(0.5, '#dfb26c');
  base.addColorStop(1, '#cf9d57');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const rng = createRng(20);
  for (let i = 0; i < 70; i++) paintGrain(g, size, rng);
  const middle = size / 2;
  const vignette = g.createRadialGradient(middle, middle, size * 0.2, middle, middle, size * 0.78);
  vignette.addColorStop(0, 'rgba(255, 240, 205, 0.12)');
  vignette.addColorStop(1, 'rgba(92, 50, 14, 0.24)');
  g.fillStyle = vignette;
  g.fillRect(0, 0, size, size);
}

function paintGrain(g, size, rng) {
  const y0 = rng() * size;
  const amplitude = 1 + rng() * size * 0.012;
  const wave = size * (0.12 + rng() * 0.3);
  const phase = rng() * Math.PI * 2;
  const dark = rng() < 0.7;
  g.beginPath();
  for (let x = -12; x <= size + 12; x += 6) {
    const y = y0 + Math.sin(x / wave + phase) * amplitude + Math.sin(x / (wave * 0.37) + phase * 2) * amplitude * 0.35;
    if (x === -12) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokeStyle = dark ? `rgba(122, 72, 26, ${0.05 + rng() * 0.09})` : `rgba(255, 238, 200, ${0.06 + rng() * 0.08})`;
  g.lineWidth = 0.6 + rng() * 2.2;
  g.stroke();
}

/** Lines snapped to device pixels so they stay sharp, plus star points. */
function paintGrid(g, geometry, dpr) {
  const { size, cell, origin } = geometry;
  const border = snapWidth(2, dpr);
  const start = snap(origin, border, dpr);
  const end = snap(origin + (size - 1) * cell, border, dpr);
  g.strokeStyle = INK;
  g.lineCap = 'square';
  for (let i = 0; i < size; i++) {
    const line = i === 0 || i === size - 1 ? border : snapWidth(1, dpr);
    const at = snap(origin + i * cell, line, dpr);
    g.lineWidth = line;
    g.beginPath();
    g.moveTo(at, start);
    g.lineTo(at, end);
    g.moveTo(start, at);
    g.lineTo(end, at);
    g.stroke();
  }
  g.fillStyle = INK;
  for (const point of starPoints(size)) {
    const { px, py } = cellCenter(geometry, point.x, point.y);
    g.beginPath();
    g.arc(px, py, Math.max(2.5, cell * 0.1), 0, Math.PI * 2);
    g.fill();
  }
}

function snapWidth(width, dpr) {
  return Math.max(1, Math.round(width * dpr)) / dpr;
}

/** Centre of a line of the given width on whole device pixels. */
function snap(value, width, dpr) {
  const device = Math.round(width * dpr);
  return (Math.round(value * dpr - device / 2) + device / 2) / dpr;
}

/** Column letters below the board and row numbers on its left. */
function paintLabels(g, geometry) {
  const { size, cell, origin, pixels } = geometry;
  g.fillStyle = 'rgba(62, 36, 12, 0.62)';
  g.font = `600 ${Math.round(Math.min(13, cell * 0.3))}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < size; i++) {
    const along = origin + i * cell;
    g.fillText(columnLabel(i), along, pixels - origin * 0.48);
    g.fillText(rowLabel(i, size), origin * 0.48, along);
  }
}

/** A stone with its shadow, drawn once per color and size. */
function paintStone(color, radius, dpr) {
  const half = radius * 1.5;
  const side = Math.ceil(half * 2 * dpr);
  const layer = createLayer(side);
  const g = layer.getContext('2d');
  const centre = side / 2;
  const r = radius * dpr;
  g.shadowColor = 'rgba(28, 14, 0, 0.45)';
  g.shadowBlur = r * 0.35;
  g.shadowOffsetX = r * 0.08;
  g.shadowOffsetY = r * 0.16;
  const fill = g.createRadialGradient(centre - r * 0.35, centre - r * 0.4, r * 0.08, centre, centre, r);
  for (const [stop, value] of STONE_STOPS[color]) fill.addColorStop(stop, value);
  g.fillStyle = fill;
  g.beginPath();
  g.arc(centre, centre, r, 0, Math.PI * 2);
  g.fill();
  if (color === WHITE) {
    g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(96, 74, 44, 0.35)';
    g.lineWidth = Math.max(1, dpr * 0.75);
    g.stroke();
  }
  return { image: layer, half: side / dpr / 2 };
}

function drawSprite(ctx, geometry, sprite, x, y, scale = 1) {
  const { px, py } = cellCenter(geometry, x, y);
  const half = sprite.half * scale;
  ctx.drawImage(sprite.image, px - half, py - half, half * 2, half * 2);
}

function drawStones(ctx, geometry, sprites, { cells, drop }) {
  const { size } = geometry;
  for (let index = 0; index < cells.length; index++) {
    const color = cells[index];
    if (color === EMPTY) continue;
    const x = index % size;
    const y = Math.floor(index / size);
    if (drop && drop.x === x && drop.y === y) {
      const eased = 1 - (1 - drop.t) ** 3;
      ctx.globalAlpha = 0.35 + 0.65 * eased;
      drawSprite(ctx, geometry, sprites[color], x, y, 1.25 - 0.25 * eased);
      ctx.globalAlpha = 1;
    } else {
      drawSprite(ctx, geometry, sprites[color], x, y);
    }
  }
}

function drawLastMarker(ctx, geometry, { x, y }) {
  const { px, py } = cellCenter(geometry, x, y);
  ctx.beginPath();
  ctx.arc(px, py, Math.max(3, geometry.radius * 0.24), 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.6)';
  ctx.stroke();
}

function drawNumbers(ctx, geometry, moves) {
  const last = moves.length - 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  moves.forEach((move, index) => {
    const { px, py } = cellCenter(geometry, move.x, move.y);
    const label = String(index + 1);
    const scale = label.length > 2 ? 0.72 : 0.92;
    ctx.font = `700 ${Math.max(8, Math.round(geometry.radius * scale))}px ${FONT}`;
    const black = move.color === BLACK;
    if (index === last) ctx.fillStyle = black ? ACCENT : '#b45309';
    else ctx.fillStyle = black ? '#f1f5f9' : '#1e293b';
    ctx.fillText(label, px, py + geometry.radius * 0.04);
  });
}

function drawWinLine(ctx, geometry, line, progress, dpr) {
  if (progress <= 0) return;
  const first = cellCenter(geometry, line[0].x, line[0].y);
  const last = cellCenter(geometry, line[line.length - 1].x, line[line.length - 1].y);
  const reach = Math.min(1, progress);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
  ctx.lineWidth = geometry.radius * 0.42;
  ctx.beginPath();
  ctx.moveTo(first.px, first.py);
  ctx.lineTo(first.px + (last.px - first.px) * reach, first.py + (last.py - first.py) * reach);
  ctx.stroke();
  ctx.shadowColor = 'rgba(251, 191, 36, 0.85)';
  ctx.shadowBlur = 10 * dpr;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = Math.max(2, geometry.radius * 0.16);
  line.forEach((point, index) => {
    if (index / (line.length - 1) > reach + 1e-6) return;
    const { px, py } = cellCenter(geometry, point.x, point.y);
    ctx.beginPath();
    ctx.arc(px, py, geometry.radius + ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}

/** Thin row and column lines through the aimed point (touch). */
function drawGuides(ctx, geometry, { x, y }) {
  const { origin, cell, size } = geometry;
  const end = origin + (size - 1) * cell;
  const { px, py } = cellCenter(geometry, x, y);
  ctx.save();
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(origin, py);
  ctx.lineTo(end, py);
  ctx.moveTo(px, origin);
  ctx.lineTo(px, end);
  ctx.stroke();
  ctx.restore();
}

function drawGhost(ctx, geometry, sprites, ghost) {
  ctx.globalAlpha = ghost.aim ? 0.72 : 0.45;
  drawSprite(ctx, geometry, sprites[ghost.color], ghost.x, ghost.y);
  ctx.globalAlpha = 1;
  if (!ghost.aim) return;
  const { px, py } = cellCenter(geometry, ghost.x, ghost.y);
  ctx.beginPath();
  ctx.arc(px, py, geometry.radius + 3, 0, Math.PI * 2);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

/** Corner brackets around the keyboard cursor. */
function drawCursor(ctx, geometry, { x, y }) {
  const { px, py } = cellCenter(geometry, x, y);
  const reach = geometry.cell * 0.5;
  const arm = geometry.cell * 0.2;
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = px + sx * reach;
    const cy = py + sy * reach;
    ctx.moveTo(cx - sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - sy * arm);
  }
  ctx.stroke();
  ctx.restore();
}
