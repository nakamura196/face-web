/**
 * 顔検出結果の描画。
 *  - drawOverlay : 元画像の自然座標で顔の bbox (緑枠) を描く。CSS で img と同幅に伸縮。
 *  - paintBoxes  : 任意の変換行列のまま bbox を描く共通部 (共有画像生成でも使う)。
 *  - drawMontage : 検出した顔を full-res 画像から切り出してグリッドに並べる (顔一覧)。
 */
import type { Box, DetectResult } from "./types";

export interface DrawOpts {
  /** ハイライトする box index */
  selected?: number | null;
}

/** モデルごとの色 (オーバーレイ凡例と一致させる)。比較モードで使用。 */
export const MODEL_COLORS = [
  "rgba(0,200,0,1)",      // green
  "rgba(11,139,238,1)",   // blue
  "rgba(240,90,40,1)",    // orange
  "rgba(170,60,210,1)",   // purple
];
export function colorForIndex(i: number): string {
  return MODEL_COLORS[i % MODEL_COLORS.length];
}

export function drawOverlay(
  cv: HTMLCanvasElement,
  result: DetectResult,
  opts: DrawOpts = {},
): void {
  const { width: W, height: H } = result.imageSize;
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  paintBoxes(ctx, result, opts);
}

/**
 * 複数モデルの結果を色分けで重ねて描く (比較モード)。
 * 1件のときは従来どおり緑＋確信度ラベル。複数のときはモデルごとの色で枠のみ。
 */
export function drawOverlayMulti(
  cv: HTMLCanvasElement,
  imageSize: { width: number; height: number },
  results: DetectResult[],
  opts: DrawOpts = {},
): void {
  const { width: W, height: H } = imageSize;
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  if (results.length <= 1) {
    if (results[0]) paintBoxes(ctx, results[0], opts);
    return;
  }
  const lw = Math.max(2, Math.min(W, H) / 400);
  results.forEach((r, ri) => {
    ctx.strokeStyle = colorForIndex(ri);
    ctx.lineWidth = lw;
    for (const b of r.boxes) {
      const [x1, y1, x2, y2] = b.xyxy;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }
  });
}

/** 現在の変換行列のまま、元画像の自然座標で顔 bbox を描く。 */
export function paintBoxes(
  ctx: CanvasRenderingContext2D,
  result: DetectResult,
  opts: DrawOpts = {},
): void {
  const { width: W, height: H } = result.imageSize;
  const lw = Math.max(2, Math.min(W, H) / 400);

  ctx.strokeStyle = "rgba(0,200,0,0.9)";
  ctx.lineWidth = lw;
  for (const b of result.boxes) {
    const [x1, y1, x2, y2] = b.xyxy;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }

  // 確信度を枠の左上に小さく表示
  ctx.font = `700 ${Math.max(11, Math.round(Math.min(W, H) / 70))}px "Noto Sans JP", sans-serif`;
  ctx.textBaseline = "bottom";
  for (const b of result.boxes) {
    const [x1, y1] = b.xyxy;
    const label = `${Math.round(b.conf * 100)}%`;
    const tw = ctx.measureText(label).width;
    const fs = parseInt(ctx.font, 10) || 12;
    ctx.fillStyle = "rgba(0,160,0,0.85)";
    ctx.fillRect(x1, y1 - fs - 2, tw + 6, fs + 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x1 + 3, y1 - 1);
  }
  ctx.textBaseline = "alphabetic";

  if (opts.selected != null && result.boxes[opts.selected]) {
    const [x1, y1, x2, y2] = result.boxes[opts.selected].xyxy;
    ctx.strokeStyle = "rgba(255,205,0,0.95)";
    ctx.lineWidth = lw * 2;
    ctx.strokeRect(x1 - lw, y1 - lw, x2 - x1 + lw * 2, y2 - y1 + lw * 2);
  }
}

/** モンタージュ canvas 上の座標から box index を返す (セル外/範囲外は null)。 */
export interface MontageLayout {
  cols: number;
  cell: number;
  gap: number;
  margin: number;
  pitch: number;
  /** グリッド順 (= 表示順) → box index */
  order: number[];
}

export function montageHit(layout: MontageLayout, x: number, y: number): number | null {
  const { cols, cell, gap, margin, pitch, order } = layout;
  const c = Math.floor((x - margin) / (cell + gap));
  const r = Math.floor((y - margin) / pitch);
  if (c < 0 || c >= cols || r < 0) return null;
  const cx = x - margin - c * (cell + gap);
  const cy = y - margin - r * pitch;
  if (cx > cell || cy > cell) return null;
  const i = r * cols + c;
  return i < order.length ? order[i] : null;
}

export function drawMontage(
  cv: HTMLCanvasElement,
  src: CanvasImageSource,
  result: DetectResult,
  targetW = 1200,
  opts: DrawOpts = {},
): MontageLayout {
  const order = result.order.length ? result.order : result.boxes.map((_, i) => i);

  const cell = 96;
  const gap = 8;
  const pad = 6;
  const margin = 18;
  const pitch = cell + gap;
  const cols = Math.max(1, Math.floor((targetW - margin * 2 + gap) / (cell + gap)));
  const rows = Math.ceil(order.length / cols);
  const W = margin * 2 + cols * (cell + gap) - gap;
  const H = margin * 2 + rows * pitch - gap;

  cv.width = W;
  cv.height = Math.max(H, margin * 2 + cell);
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, cv.height);
  grad.addColorStop(0, "#f3f6fb");
  grad.addColorStop(1, "#e6edf6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cv.width, cv.height);

  order.forEach((idx, i) => {
    const b = result.boxes[idx];
    if (!b) return;
    const [x1, y1, x2, y2] = b.xyxy;
    const cw = Math.max(1, x2 - x1);
    const ch = Math.max(1, y2 - y1);
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = margin + c * (cell + gap);
    const y = margin + r * pitch;

    roundRect(ctx, x, y, cell, cell, cell / 9);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // 顔の周囲に少し余白をとって切り出す (枠ギリギリだと窮屈なので 12% マージン)
    const mx = cw * 0.12;
    const my = ch * 0.12;
    const sx0 = Math.max(0, x1 - mx);
    const sy0 = Math.max(0, y1 - my);
    const sw = cw + mx * 2;
    const sh = ch + my * 2;
    const fit = cell - 2 * pad;
    const s = fit / Math.max(sw, sh);
    const dw = Math.round(sw * s);
    const dh = Math.round(sh * s);
    ctx.drawImage(src, sx0, sy0, sw, sh, x + (cell - dw) / 2, y + (cell - dh) / 2, dw, dh);

    roundRect(ctx, x + 0.5, y + 0.5, cell - 1, cell - 1, cell / 9);
    const isSel = opts.selected === idx;
    ctx.strokeStyle = isSel ? "rgba(11,139,238,0.95)" : "rgba(150,170,200,0.9)";
    ctx.lineWidth = isSel ? 2.5 : 1;
    ctx.stroke();
  });

  return { cols, cell, gap, margin, pitch, order };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export type { Box };
