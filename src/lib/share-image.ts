/**
 * 共有用「ビフォーアフター」画像の生成。
 * 原本 (before) と、bbox + 読みを焼き込んだ解読版 (after) を並べ、
 * アプリ名と URL の帯を付けた 1 枚の PNG を canvas で作る。
 * SNS 等にそのまま貼れる成果物にする (推論同様すべてローカルで完結)。
 */
import { paintBoxes, type DrawOpts } from "./draw";
import type { DetectResult } from "./types";

const APP_TITLE = "顔検出";
const APP_URL = "nakamura196.github.io/face-web";
const BLUE = "#0b8bee";

export function buildShareCanvas(
  img: CanvasImageSource & { naturalWidth?: number; width?: number },
  result: DetectResult,
  opts: DrawOpts = {},
): HTMLCanvasElement {
  const { width: iw, height: ih } = result.imageSize;
  const landscape = iw > ih * 1.3; // 横長の史料は上下、縦長・普通は左右に並べる
  const OUT_W = 1200;
  const M = 24; // 余白
  const HEAD = 64;
  const FOOT = 48;
  const GAP = 16;

  // パネル寸法: 画像全体が入るよう等比で縮小
  let pw: number, ph: number;
  if (landscape) {
    pw = OUT_W - M * 2;
    ph = Math.min(Math.round((pw / iw) * ih), 430);
  } else {
    pw = Math.round((OUT_W - M * 2 - GAP) / 2);
    ph = Math.min(Math.round((pw / iw) * ih), 760);
  }
  const s = Math.min(pw / iw, ph / ih);
  const dw = Math.round(iw * s);
  const dh = Math.round(ih * s);

  const H = HEAD + M + (landscape ? dh * 2 + GAP : dh) + M + FOOT;
  const cv = document.createElement("canvas");
  cv.width = OUT_W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;

  // 背景 (和紙風) とヘッダ帯
  ctx.fillStyle = "#f6f1e4";
  ctx.fillRect(0, 0, OUT_W, H);
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, OUT_W, HEAD);
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 26px "Noto Sans JP", sans-serif';
  ctx.textBaseline = "middle";
  ctx.fillText(`🖌 ${APP_TITLE}`, M, HEAD / 2);
  ctx.font = '500 16px "Noto Sans JP", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText("ブラウザ完結・画像は送信しません", OUT_W - M, HEAD / 2);
  ctx.textAlign = "left";

  // パネル位置
  const p1 = { x: landscape ? M + Math.round((pw - dw) / 2) : M, y: HEAD + M };
  const p2 = landscape
    ? { x: p1.x, y: HEAD + M + dh + GAP }
    : { x: M + pw + GAP + Math.round((pw - dw) / 2), y: HEAD + M };
  if (!landscape) p1.x = M + Math.round((pw - dw) / 2);

  const panel = (x: number, y: number, tag: string, annotate: boolean) => {
    ctx.save();
    ctx.shadowColor = "rgba(11,43,95,.18)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 4, y - 4, dw + 8, dh + 8);
    ctx.restore();
    ctx.drawImage(img, x, y, dw, dh);
    if (annotate) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(s, s);
      paintBoxes(ctx, result, opts);
      ctx.restore();
    }
    // 左上タグ
    ctx.font = '700 15px "Noto Sans JP", sans-serif';
    const tw = ctx.measureText(tag).width;
    ctx.fillStyle = annotate ? BLUE : "rgba(40,40,40,.82)";
    ctx.fillRect(x, y, tw + 18, 28);
    ctx.fillStyle = "#fff";
    ctx.fillText(tag, x + 9, y + 14);
  };
  panel(p1.x, p1.y, "原本", false);
  panel(p2.x, p2.y, "検出", true);

  // フッタ
  ctx.fillStyle = "#4b4636";
  ctx.font = '600 16px "Noto Sans JP", sans-serif';
  ctx.fillText(`${result.nFaces} 件の顔を検出（${result.modelName}）`, M, H - FOOT / 2 - 4);
  ctx.fillStyle = BLUE;
  ctx.textAlign = "right";
  ctx.font = '700 16px "Noto Sans JP", sans-serif';
  ctx.fillText(APP_URL, OUT_W - M, H - FOOT / 2 - 4);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return cv;
}

export function canvasToBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}
