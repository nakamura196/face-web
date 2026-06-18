/**
 * SAHI 風タイル分割推論。高解像度画像を 1024×1024 のタイルに 20% オーバーラップで
 * 分割し、タイルごとに原寸近くで推論 → 元座標に戻して集約 → NMS で重複統合する。
 *
 * 高速化: タイルを BATCH 枚ずつ 1 回の推論にまとめる(detectBatch)。ONNX の batch 軸が
 * dynamic なので [B,3,1024,1024] で投入でき、逐次 detectRegion より run() 回数と
 * GPU 同期が減って速い(特に WebGPU)。
 */
import { detectBatch, nms, type Drawable, type Tile } from "./ort-yolo";
import type { Box } from "./types";

const SLICE = 1024;
const OVERLAP = 0.2;
const BATCH = 4; // 1回の推論にまとめるタイル数 (メモリ: 約 12.6MB×B)

function sliceStarts(total: number, slice: number, overlap: number): number[] {
  if (total <= slice) return [0];
  const step = Math.max(1, Math.round(slice * (1 - overlap)));
  const starts: number[] = [];
  for (let s = 0; s + slice < total; s += step) starts.push(s);
  starts.push(total - slice); // 末尾は右端/下端に揃える
  return Array.from(new Set(starts));
}

export async function runSahi(
  src: Drawable, width: number, height: number,
  opts: {
    conf?: number;
    mergeIou?: number;
    onTile?: (done: number, total: number) => void;
    /** バッチごとに「ここまでの暫定 box」(NMS 前) を通知。UI の段階表示用。 */
    onTileBoxes?: (boxes: Box[]) => void;
  } = {},
): Promise<Box[]> {
  const conf = opts.conf ?? 0.3;
  const mergeIou = opts.mergeIou ?? 0.3;
  const xs = sliceStarts(width, SLICE, OVERLAP);
  const ys = sliceStarts(height, SLICE, OVERLAP);

  const tiles: Tile[] = [];
  for (const sy of ys) {
    for (const sx of xs) {
      tiles.push({
        sx, sy,
        sw: Math.min(SLICE, width - sx),
        sh: Math.min(SLICE, height - sy),
        offsetX: sx, offsetY: sy,
      });
    }
  }

  const total = tiles.length;
  const all: Box[] = [];
  let done = 0;
  for (let i = 0; i < total; i += BATCH) {
    const group = tiles.slice(i, i + BATCH);
    const boxes = await detectBatch(src, group, { conf, imgsz: SLICE });
    all.push(...boxes);
    done += group.length;
    opts.onTile?.(done, total);
    if (done < total) opts.onTileBoxes?.(all.slice());
  }

  for (const b of all) {
    b.xyxy[0] = Math.max(0, b.xyxy[0]);
    b.xyxy[1] = Math.max(0, b.xyxy[1]);
    b.xyxy[2] = Math.min(width, b.xyxy[2]);
    b.xyxy[3] = Math.min(height, b.xyxy[3]);
  }
  return nms(all, mergeIou);
}
