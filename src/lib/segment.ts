/**
 * 顔検出のオーケストレータ (ブラウザ)。
 * モデルの種類 (YuNet / YOLO) に応じて推論パスを切り替え、box を元画像座標で返す。
 *   - YuNet : 640×640 直接リサイズ → 3-stride デコード → NMS
 *   - YOLO  : letterbox → [b,5,N] デコード → NMS (顔コレ/浮世絵/混合モデル, 提供後)
 */
import { detectRegion, nms, IMGSZ, type Drawable } from "./ort-yolo";
import { detectYunet } from "./yunet";
import { detectRetina } from "./retinaface";
import type { Box, DetectResult, Mode } from "./types";
import type { DetectorKind } from "./config";

export interface SegmentOptions {
  kind: DetectorKind;
  /** スコアしきい値 */
  conf: number;
  /** YOLO の入力一辺 (YuNet は無視) */
  imgsz?: number;
  modelId: string;
  modelName: string;
  /** 予約: YOLO 大判時の手法選択 (現状は baseline のみ) */
  mode?: Mode;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** 表示順: 上→下、同じ高さ帯なら左→右。 */
function rasterOrder(boxes: Box[]): number[] {
  const idx = boxes.map((_, i) => i);
  const rowH = boxes.length
    ? Math.max(24, median(boxes.map((b) => b.xyxy[3] - b.xyxy[1])) * 0.6)
    : 1;
  return idx.sort((a, b) => {
    const ba = boxes[a].xyxy;
    const bb = boxes[b].xyxy;
    const ra = Math.floor(ba[1] / rowH);
    const rb = Math.floor(bb[1] / rowH);
    return ra !== rb ? ra - rb : ba[0] - bb[0];
  });
}

export async function detect(
  src: Drawable, width: number, height: number, opts: SegmentOptions,
): Promise<DetectResult> {
  const W = width;
  const H = height;

  let boxes: Box[];
  if (opts.kind === "yunet") {
    const raw = await detectYunet(src, W, H, opts.conf, opts.imgsz);
    boxes = nms(raw, 0.3);
  } else if (opts.kind === "retinaface") {
    const raw = await detectRetina(src, W, H, opts.conf, opts.imgsz);
    boxes = nms(raw, 0.4);
  } else {
    const raw = await detectRegion(src, 0, 0, W, H, {
      conf: opts.conf,
      imgsz: opts.imgsz ?? IMGSZ,
    });
    boxes = nms(raw, 0.45);
  }

  boxes = boxes.map((b) => ({
    xyxy: b.xyxy.map((v) => Math.round(v * 100) / 100) as Box["xyxy"],
    conf: Math.round(b.conf * 10000) / 10000,
  }));

  return {
    imageSize: { width: W, height: H },
    method: "baseline",
    methodSelection: "自動判定",
    nFaces: boxes.length,
    boxes,
    order: rasterOrder(boxes),
    modelId: opts.modelId,
    modelName: opts.modelName,
  };
}
