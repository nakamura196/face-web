/**
 * YOLOv11x-codh-char の onnxruntime-web 推論 (ブラウザ/WebWorker)。
 *
 * ONNX 仕様:
 *   input  images   [batch, 3, H, W] float32 (RGB, /255 正規化, letterbox)
 *   output output0   [batch, 5, N]    = (cx, cy, w, h, score) × N アンカー / 1クラス
 *
 * 座標は letterbox 後ピクセル (0..imgsz)。元画像へは pad を引いて scale で割り戻す。
 * kuzushiji-segmenter (onnxruntime-node 版) の yolo.ts を OffscreenCanvas + ort-web へ移植。
 */
import { getOrt, type Ort } from "./ort";
import type { Box } from "./types";

export const IMGSZ = 1280;

let session: Ort.InferenceSession | null = null;
export function setSession(s: Ort.InferenceSession): void {
  session = s;
}
function requireSession(): Ort.InferenceSession {
  if (!session) throw new Error("ONNX セッションが未初期化です");
  return session;
}

export type Drawable = ImageBitmap | OffscreenCanvas;

// letterbox 用の作業 Canvas を size ごとに使い回す (GC 負荷を抑える)
const canvasCache = new Map<number, OffscreenCanvas>();
function workCanvas(size: number): OffscreenCanvas {
  let cv = canvasCache.get(size);
  if (!cv) {
    cv = new OffscreenCanvas(size, size);
    canvasCache.set(size, cv);
  }
  return cv;
}

interface Letterboxed {
  tensor: Float32Array;
  scale: number;
  padLeft: number;
  padTop: number;
}

interface LbMeta {
  scale: number;
  padLeft: number;
  padTop: number;
}

/** src の (sx,sy,sw,sh) を imgsz 角に letterbox し、out の off 位置に NCHW で書き込む。 */
function letterboxAt(
  out: Float32Array, off: number,
  src: Drawable, sx: number, sy: number, sw: number, sh: number, imgsz: number,
): LbMeta {
  const scale = imgsz / Math.max(sw, sh);
  const newW = Math.round(sw * scale);
  const newH = Math.round(sh * scale);
  const padLeft = Math.floor((imgsz - newW) / 2);
  const padTop = Math.floor((imgsz - newH) / 2);

  const canvas = workCanvas(imgsz);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "rgb(114,114,114)"; // ultralytics letterbox の灰色パディング
  ctx.fillRect(0, 0, imgsz, imgsz);
  ctx.drawImage(src, sx, sy, sw, sh, padLeft, padTop, newW, newH);

  const { data } = ctx.getImageData(0, 0, imgsz, imgsz); // RGBA Uint8
  const plane = imgsz * imgsz;
  for (let i = 0; i < plane; i++) {
    out[off + i] = data[i * 4] / 255; // R
    out[off + plane + i] = data[i * 4 + 1] / 255; // G
    out[off + 2 * plane + i] = data[i * 4 + 2] / 255; // B
  }
  return { scale, padLeft, padTop };
}

function letterboxToTensor(
  src: Drawable, sx: number, sy: number, sw: number, sh: number, imgsz: number,
): Letterboxed {
  const tensor = new Float32Array(3 * imgsz * imgsz);
  const m = letterboxAt(tensor, 0, src, sx, sy, sw, sh, imgsz);
  return { tensor, ...m };
}

export interface Tile {
  sx: number; sy: number; sw: number; sh: number; offsetX: number; offsetY: number;
}

/**
 * 複数タイルを 1 回の推論にまとめる (バッチ B = tiles.length)。
 * ONNX の batch 軸は dynamic なので [B,3,imgsz,imgsz] で投入できる。
 * WebGPU では run() 回数とGPU同期が減り、逐次 detectRegion より速い。
 * 返り値は全タイル分の box (元画像座標, NMS 前)。
 */
export async function detectBatch(
  src: Drawable, tiles: Tile[], opts: { conf: number; imgsz?: number },
): Promise<Box[]> {
  const imgsz = opts.imgsz ?? IMGSZ;
  const B = tiles.length;
  const plane = imgsz * imgsz;
  const tensor = new Float32Array(B * 3 * plane);
  const meta = tiles.map((t, b) =>
    letterboxAt(tensor, b * 3 * plane, src, t.sx, t.sy, t.sw, t.sh, imgsz),
  );

  const sess = requireSession();
  const input = new (getOrt().Tensor)("float32", tensor, [B, 3, imgsz, imgsz]);
  const result = await sess.run({ [sess.inputNames[0]]: input });
  const out = result[sess.outputNames[0]];
  const [, ch, n] = out.dims as number[]; // [B, 5, N]
  const d = out.data as Float32Array;
  const perB = ch * n;

  const boxes: Box[] = [];
  for (let b = 0; b < B; b++) {
    const base = b * perB;
    const scoreOff = base + (ch - 1) * n;
    const { scale, padLeft, padTop } = meta[b];
    const ox = tiles[b].offsetX;
    const oy = tiles[b].offsetY;
    for (let i = 0; i < n; i++) {
      const score = d[scoreOff + i];
      if (score < opts.conf) continue;
      const cx = d[base + i];
      const cy = d[base + n + i];
      const w = d[base + 2 * n + i];
      const h = d[base + 3 * n + i];
      const x1 = (cx - w / 2 - padLeft) / scale + ox;
      const y1 = (cy - h / 2 - padTop) / scale + oy;
      const x2 = (cx + w / 2 - padLeft) / scale + ox;
      const y2 = (cy + h / 2 - padTop) / scale + oy;
      boxes.push({ xyxy: [x1, y1, x2, y2], conf: score });
    }
  }
  return boxes;
}

function iou(a: Box["xyxy"], b: Box["xyxy"]): number {
  const ix1 = Math.max(a[0], b[0]);
  const iy1 = Math.max(a[1], b[1]);
  const ix2 = Math.min(a[2], b[2]);
  const iy2 = Math.min(a[3], b[3]);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

/** クラス非依存 greedy NMS。 */
export function nms(boxes: Box[], iouThr: number, maxDet = 2000): Box[] {
  const sorted = [...boxes].sort((p, q) => q.conf - p.conf);
  const keep: Box[] = [];
  const removed = new Array(sorted.length).fill(false);
  for (let i = 0; i < sorted.length; i++) {
    if (removed[i]) continue;
    keep.push(sorted[i]);
    if (keep.length >= maxDet) break;
    for (let j = i + 1; j < sorted.length; j++) {
      if (removed[j]) continue;
      if (iou(sorted[i].xyxy, sorted[j].xyxy) > iouThr) removed[j] = true;
    }
  }
  return keep;
}

/**
 * src の指定領域に対して 1 回推論し、box を「元画像座標」で返す (NMS 前)。
 * offsetX/offsetY はタイルの左上を元画像に戻すためのオフセット (baseline は 0)。
 */
export async function detectRegion(
  src: Drawable, sx: number, sy: number, sw: number, sh: number,
  opts: { conf: number; imgsz?: number; offsetX?: number; offsetY?: number },
): Promise<Box[]> {
  const imgsz = opts.imgsz ?? IMGSZ;
  const offsetX = opts.offsetX ?? 0;
  const offsetY = opts.offsetY ?? 0;
  const { tensor, scale, padLeft, padTop } = letterboxToTensor(src, sx, sy, sw, sh, imgsz);

  const sess = requireSession();
  const input = new (getOrt().Tensor)("float32", tensor, [1, 3, imgsz, imgsz]);
  const inputName = sess.inputNames[0];
  const outputName = sess.outputNames[0];
  const result = await sess.run({ [inputName]: input });
  const out = result[outputName];
  const [, ch, n] = out.dims as number[]; // [1, 5, N]
  const d = out.data as Float32Array;

  const boxes: Box[] = [];
  const scoreOff = (ch - 1) * n; // 最後のチャネルが score
  for (let i = 0; i < n; i++) {
    const score = d[scoreOff + i];
    if (score < opts.conf) continue;
    const cx = d[i];
    const cy = d[n + i];
    const w = d[2 * n + i];
    const h = d[3 * n + i];
    const x1 = (cx - w / 2 - padLeft) / scale + offsetX;
    const y1 = (cy - h / 2 - padTop) / scale + offsetY;
    const x2 = (cx + w / 2 - padLeft) / scale + offsetX;
    const y2 = (cy + h / 2 - padTop) / scale + offsetY;
    boxes.push({ xyxy: [x1, y1, x2, y2], conf: score });
  }
  return boxes;
}
