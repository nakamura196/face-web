/** メインスレッド ⇄ 推論ワーカ間のメッセージ型定義。 */
import type { DetectResult } from "../lib/types";
import type { DetectorKind } from "../lib/config";

/** 検出モデル1つぶんの worker 用記述。 */
export interface ModelSpec {
  url: string;
  kind: DetectorKind;
  conf: number;
  imgsz?: number;
  modelId: string;
  modelName: string;
}

// main → worker
export type ToWorker =
  /** 利用可能な全モデルの spec を渡し、active を先にロードする */
  | { type: "init"; specs: ModelSpec[]; activeId: string }
  /** active モデルを切り替える (未ロードならロード) */
  | { type: "setActive"; modelId: string }
  /** modelIds のモデルで検出する (1個=単独, 複数=比較) */
  | { type: "segment"; bitmap: ImageBitmap; modelIds: string[] };

// worker → main
export type FromWorker =
  | { type: "download"; modelId: string; loaded: number; total: number; cached: boolean }
  | { type: "ready"; ep: string }
  /** 1モデルの検出が終わるたびの速報 (比較時に順次反映) */
  | { type: "partial"; result: DetectResult; elapsedMs: number }
  /** 要求した全モデルの検出が完了 */
  | { type: "result"; results: DetectResult[]; elapsedMs: number }
  | { type: "error"; message: string };
