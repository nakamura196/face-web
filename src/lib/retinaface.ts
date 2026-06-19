/**
 * RetinaFace (biubug6/Pytorch_Retinaface, ResNet50, MIT) の onnxruntime-web 推論。
 *
 * ONNX 仕様 (spatial dynamic で export):
 *   input  input   [1, 3, H, W] float32  ※BGR・平均減算 (B-104, G-117, R-123)、スケールなし
 *   output loc     [1, N, 4]   アンカー相対 (dx, dy, dw, dh)
 *          conf    [1, N, 2]   softmax 済 (背景, 顔)
 *          landms  [1, N, 10]  5点ランドマーク (本デモでは未使用)
 *
 * デコード (biubug6 PriorBox + box_utils.decode と一致, variance=[0.1,0.2]):
 *   priors: stride 8/16/32, min_sizes [[16,32],[64,128],[256,512]], 各位置2アンカー (正規化)
 *   cx = pr_cx + loc_dx*0.1*pr_w ; cy = pr_cy + loc_dy*0.1*pr_h
 *   w  = pr_w*exp(loc_dw*0.2)    ; h  = pr_h*exp(loc_dh*0.2)
 *   box(正規化, 中心形)→角形→×size→元画像へ ×(W0/size),(H0/size)
 * 640 だと大判の小顔が落ちるため既定 1280 角で推論する (OpenCV/Python と数値一致を確認)。
 */
import { getOrt, type Ort } from "./ort";
import type { Box } from "./types";

export const RETINA_DEFAULT_SIZE = 1280;
const STEPS = [8, 16, 32] as const;
const MIN_SIZES = [[16, 32], [64, 128], [256, 512]] as const;
const VAR0 = 0.1;
const VAR1 = 0.2;

let session: Ort.InferenceSession | null = null;
export function setRetinaSession(s: Ort.InferenceSession): void {
  session = s;
}
export function hasRetinaSession(): boolean {
  return session != null;
}
function requireSession(): Ort.InferenceSession {
  if (!session) throw new Error("RetinaFace セッションが未初期化です");
  return session;
}

export type Drawable = ImageBitmap | OffscreenCanvas;

const work = new OffscreenCanvas(RETINA_DEFAULT_SIZE, RETINA_DEFAULT_SIZE);

/** size×size の prior boxes (正規化 [cx,cy,w,h])。size ごとにキャッシュ。 */
const priorCache = new Map<number, Float32Array>();
function priorsFor(size: number): Float32Array {
  let p = priorCache.get(size);
  if (p) return p;
  const arr: number[] = [];
  for (let k = 0; k < STEPS.length; k++) {
    const step = STEPS[k];
    const f = Math.ceil(size / step);
    for (let i = 0; i < f; i++) {
      for (let j = 0; j < f; j++) {
        for (const ms of MIN_SIZES[k]) {
          const s = ms / size;
          arr.push((j + 0.5) * step / size, (i + 0.5) * step / size, s, s);
        }
      }
    }
  }
  p = new Float32Array(arr);
  priorCache.set(size, p);
  return p;
}

/** src を size×size に直接リサイズし、BGR 平均減算の NCHW テンソルにする。 */
function toTensor(src: Drawable, W: number, H: number, size: number): Float32Array {
  if (work.width !== size) { work.width = size; work.height = size; }
  const ctx = work.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(src, 0, 0, W, H, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size); // RGBA Uint8
  const plane = size * size;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    out[i] = data[i * 4 + 2] - 104; // B
    out[plane + i] = data[i * 4 + 1] - 117; // G
    out[2 * plane + i] = data[i * 4] - 123; // R
  }
  return out;
}

/** 画像全体に対して 1 回推論し、box を元画像座標で返す (NMS 前)。 */
export async function detectRetina(
  src: Drawable, W: number, H: number, conf: number, size = RETINA_DEFAULT_SIZE,
): Promise<Box[]> {
  size = Math.max(32, Math.round(size / 32) * 32);
  const tensor = toTensor(src, W, H, size);
  const sess = requireSession();
  const input = new (getOrt().Tensor)("float32", tensor, [1, 3, size, size]);
  const out = await sess.run({ [sess.inputNames[0]]: input });
  const loc = out["loc"].data as Float32Array;
  const cf = out["conf"].data as Float32Array;

  const pr = priorsFor(size);
  const n = pr.length / 4;
  const sx = W / size;
  const sy = H / size;
  const boxes: Box[] = [];
  for (let i = 0; i < n; i++) {
    const score = cf[i * 2 + 1]; // 顔クラス (softmax 済)
    if (score < conf) continue;
    const pcx = pr[i * 4], pcy = pr[i * 4 + 1], pw = pr[i * 4 + 2], ph = pr[i * 4 + 3];
    const cx = pcx + loc[i * 4] * VAR0 * pw;
    const cy = pcy + loc[i * 4 + 1] * VAR0 * ph;
    const w = pw * Math.exp(loc[i * 4 + 2] * VAR1);
    const h = ph * Math.exp(loc[i * 4 + 3] * VAR1);
    const x1 = (cx - w / 2) * size * sx;
    const y1 = (cy - h / 2) * size * sy;
    const x2 = (cx + w / 2) * size * sx;
    const y2 = (cy + h / 2) * size * sy;
    boxes.push({ xyxy: [x1, y1, x2, y2], conf: score });
  }
  return boxes;
}
