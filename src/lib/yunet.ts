/**
 * YuNet (face_detection_yunet_2023mar) の onnxruntime-web 推論。
 *
 * ※元の ONNX は入力 640×640 固定だが、本プロジェクトでは spatial を dynamic 化した版を使う
 *   (public/models/face_detection_yunet_2023mar.onnx)。YuNet は全層畳み込みなので任意の
 *   H,W (32の倍数) を受け付ける。640 だと大判画像の小顔が落ちるため、既定で 1280 角に縮小する。
 *
 * ONNX 仕様:
 *   input  input    [1, 3, H, W] float32  ※BGR・生ピクセル(0-255, 正規化なし)
 *   output cls_{s}  [1, (H/s)*(W/s), 1]   stride s∈{8,16,32}
 *          obj_{s}  [1, N, 1]
 *          bbox_{s} [1, N, 4]   (dx, dy, dw, dh) アンカー相対
 *          kps_{s}  [1, N, 10]  5点ランドマーク (本デモでは未使用)
 *
 * デコード (OpenCV FaceDetectorYN と同じ):
 *   anchor idx = row*cols + col,  cols = W/s, rows = H/s
 *   score = sqrt(cls * obj)
 *   cx = (col + dx)*s,  cy = (row + dy)*s,  w = exp(dw)*s,  h = exp(dh)*s
 * 入力角空間の座標を、元画像へ x*(W0/size), y*(H0/size) で戻す (直接リサイズ方式)。
 */
import { getOrt, type Ort } from "./ort";
import type { Box } from "./types";

export const YUNET_DEFAULT_SIZE = 1280;
const STRIDES = [8, 16, 32] as const;

let session: Ort.InferenceSession | null = null;
export function setYunetSession(s: Ort.InferenceSession): void {
  session = s;
}
export function hasYunetSession(): boolean {
  return session != null;
}
function requireSession(): Ort.InferenceSession {
  if (!session) throw new Error("YuNet セッションが未初期化です");
  return session;
}

export type Drawable = ImageBitmap | OffscreenCanvas;

const work = new OffscreenCanvas(YUNET_DEFAULT_SIZE, YUNET_DEFAULT_SIZE);

/** src を size×size に直接リサイズし、BGR 生ピクセルの NCHW テンソルにする。 */
function toTensor(src: Drawable, W: number, H: number, size: number): Float32Array {
  if (work.width !== size) { work.width = size; work.height = size; }
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(src, 0, 0, W, H, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size); // RGBA Uint8
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = data[i * 4 + 2]; // B
    out[plane + i] = data[i * 4 + 1]; // G
    out[2 * plane + i] = data[i * 4]; // R
  }
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 画像全体に対して 1 回推論し、box を元画像座標で返す (NMS 前)。
 * size は 32 の倍数 (各 stride のグリッドが整数になる) であること。
 */
export async function detectYunet(
  src: Drawable, W: number, H: number, conf: number, size = YUNET_DEFAULT_SIZE,
): Promise<Box[]> {
  size = Math.max(32, Math.round(size / 32) * 32); // 32 の倍数に丸める
  const tensor = toTensor(src, W, H, size);
  const sess = requireSession();
  const input = new (getOrt().Tensor)("float32", tensor, [1, 3, size, size]);
  const out = await sess.run({ [sess.inputNames[0]]: input });

  const sx = W / size;
  const sy = H / size;
  const boxes: Box[] = [];
  for (const s of STRIDES) {
    const cls = out[`cls_${s}`].data as Float32Array;
    const obj = out[`obj_${s}`].data as Float32Array;
    const bbox = out[`bbox_${s}`].data as Float32Array;
    const cols = size / s;
    const n = cols * cols;
    for (let i = 0; i < n; i++) {
      const score = Math.sqrt(clamp01(cls[i]) * clamp01(obj[i]));
      if (score < conf) continue;
      const col = i % cols;
      const row = (i / cols) | 0;
      const cx = (col + bbox[i * 4]) * s;
      const cy = (row + bbox[i * 4 + 1]) * s;
      const w = Math.exp(bbox[i * 4 + 2]) * s;
      const h = Math.exp(bbox[i * 4 + 3]) * s;
      const x1 = (cx - w / 2) * sx;
      const y1 = (cy - h / 2) * sy;
      const x2 = (cx + w / 2) * sx;
      const y2 = (cy + h / 2) * sy;
      boxes.push({ xyxy: [x1, y1, x2, y2], conf: score });
    }
  }
  return boxes;
}
