/**
 * 顔検出モデルの設定。
 *
 * このアプリは「顔検出モデルを選んで画像内の顔(=絵画・浮世絵・近現代美人画の顔)を
 * ブラウザ内で検出する」デモ。検出器は3系統 (kind ごとにデコードが異なる):
 *   - yunet      : OpenCV 標準の軽量顔検出器 (227KB)。写真学習。3-stride デコード。
 *   - retinaface : RetinaFace ResNet50 (biubug6, MIT)。写真学習・高精度。prior-box デコード。
 *   - yolo       : 顔コレ/浮世絵/混合データで学習する特化検出器 (ultralytics, 単一クラス)。
 *                  出力 [b,5,N]=(cx,cy,w,h,score)。
 *
 * モデルは URL から fetch → IndexedDB キャッシュ (差し替え時は ?v= を上げる)。
 * YuNet はローカル同梱 (public/models)、YOLO 3種は配布先 (HF 等) を後から差す。
 */

const BASE = import.meta.env.BASE_URL;

/** 検出器の種類。推論パス (decode) が異なる。 */
export type DetectorKind = "yunet" | "yolo" | "retinaface";

export interface FaceModel {
  id: "yunet" | "retinaface" | "kaokore" | "ukiyoe" | "ansample";
  /** セレクタのカード見出し */
  label: string;
  short: string;
  emoji: string;
  /** 技術名 (カード下に小さく出す) */
  detectName: string;
  desc: string;
  kind: DetectorKind;
  /** モデル URL。available=false の間は空でよい (UI で無効化) */
  detect: string;
  /** YOLO の入力一辺 (letterbox 正方)。YuNet は固定 640 のため無視。 */
  imgsz?: number;
  /** 検出スコアの既定しきい値 */
  conf: number;
  /** false = まだ ONNX 未提供 (UI では「準備中」で選べない) */
  available: boolean;
}

// YuNet 2023mar (入力 [1,3,640,640] 固定 / 3-stride 出力)。public/models 同梱。
const YUNET_URL = `${BASE}models/face_detection_yunet_2023mar.onnx`;

// RetinaFace ResNet50 (biubug6/Pytorch_Retinaface, MIT)。dynamic入力に変換し HF 配信 (109MB)。
const RETINA_URL =
  "https://huggingface.co/nakamura196/retinaface-r50-onnx/resolve/main/retinaface_r50.onnx";

// 特化 YOLO11x (best.pt → ONNX, 単一クラス face)。217MB のため HF 配信
// (CORS 対応, 初回 DL → IndexedDB キャッシュ)。
const KAOKORE_URL =
  "https://huggingface.co/nakamura196/yolov11x-kaokore-face/resolve/main/best.onnx";
const UKIYOE_URL =
  "https://huggingface.co/nakamura196/yolov11x-ukiyoe-face/resolve/main/best.onnx";

// --- まだ ONNX 未提供の YOLO 検出器 ---
const COMING_SOON = "";

export const MODELS: FaceModel[] = [
  {
    id: "yunet",
    label: "YuNet（汎用・写真学習）",
    short: "YuNet",
    emoji: "🙂",
    detectName: "YuNet 2023mar",
    desc: "OpenCV 標準の軽量顔検出器（227KB）。写真で学習。明治〜昭和の写実的な顔（近現代美人画）に強い。まずはこれで動作確認。",
    kind: "yunet",
    detect: YUNET_URL,
    imgsz: 1280, // 入力を 1280 角に縮小して検出 (640 だと大判の小顔が落ちる)
    conf: 0.6,
    available: true,
  },
  {
    id: "retinaface",
    label: "RetinaFace（高精度・写真学習）",
    short: "RetinaFace",
    emoji: "🎯",
    detectName: "RetinaFace-R50",
    desc: "RetinaFace（ResNet50, MIT）。写真で学習した高精度な顔検出器。YuNetより精度寄りで、近現代の写実的な顔に強い。",
    kind: "retinaface",
    detect: RETINA_URL,
    imgsz: 1280, // 640 だと大判の小顔が落ちる。1280 角で推論。
    conf: 0.6,
    available: true,
  },
  {
    id: "kaokore",
    label: "顔コレ（絵巻・絵本）",
    short: "顔コレ",
    emoji: "📜",
    detectName: "YOLO11x-kaokore",
    desc: "顔貌コレクション（KaoKore＝中世絵巻・絵本）でファインチューンした特化検出器（YOLO11x, mAP50=0.899）。引目鉤鼻など様式化の強い前近代の顔向け。",
    kind: "yolo",
    detect: KAOKORE_URL,
    imgsz: 1280, // HF の best.onnx は入力 1280×1280 固定 (これ以外を渡すと OrtRun が次元不一致で失敗)
    conf: 0.25,
    available: true,
  },
  {
    id: "ukiyoe",
    label: "浮世絵（江戸）",
    short: "浮世絵",
    emoji: "🎴",
    detectName: "YOLO11x-ukiyoe",
    desc: "浮世絵の顔でファインチューンした特化検出器（YOLO11x, 単一クラス face）。大首絵など中〜大の様式化に。",
    kind: "yolo",
    detect: UKIYOE_URL,
    imgsz: 1536, // HF の best.onnx は入力 1536×1536 固定 (学習サイズで export)
    conf: 0.25,
    available: true,
  },
  {
    id: "ansample",
    label: "アンサンブル（3時代混合）",
    short: "混合",
    emoji: "🧬",
    detectName: "YOLO-ensemble（準備中）",
    desc: "顔コレ＋浮世絵＋近現代を混ぜて学習する統合検出器。時代横断で一貫した1器として測るための本命。ONNX 提供後に有効化。",
    kind: "yolo",
    detect: COMING_SOON,
    imgsz: 640,
    conf: 0.25,
    available: false,
  },
];

const LS_MODEL = "face-web:model";

export function getModelId(): FaceModel["id"] {
  try {
    const v = localStorage.getItem(LS_MODEL);
    if (v && MODELS.some((m) => m.id === v && m.available)) return v as FaceModel["id"];
  } catch {
    /* ignore */
  }
  return "yunet"; // 既定 = 動作する YuNet
}

export function setModelId(id: FaceModel["id"]): void {
  try {
    localStorage.setItem(LS_MODEL, id);
  } catch {
    /* ignore */
  }
}

export function activeModel(): FaceModel {
  const id = getModelId();
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/** お知らせ (新しいものを上に)。空配列ならお知らせ欄は出ない。 */
export interface Announcement {
  date: string;
  text: string;
  url?: string;
}
export const ANNOUNCEMENTS: Announcement[] = [
  { date: "2026-06-19", text: "YuNet・RetinaFace・顔コレ・浮世絵 の4モデルを公開（混合は準備中）。全モデル同時比較も可能です。" },
];

// 使い方チュートリアル動画 (YouTube)。空なら「使い方」導線は非表示。
export const TUTORIAL_VIDEO_ID = "HYk8_Ya3Cc4";
