/**
 * 推論ワーカを管理する React フック。
 * モデルのロード進捗 / 実行プロバイダ (EP) / 検出結果 (1個 or 比較複数) を state に公開する。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FromWorker, ToWorker, ModelSpec } from "./worker/protocol";
import type { DetectResult } from "./lib/types";

export type Phase = "idle" | "downloading" | "initializing" | "ready" | "running" | "error";

export interface SegmenterState {
  phase: Phase;
  ep: string | null;
  download: { modelId: string; loaded: number; total: number; cached: boolean } | null;
  /** 検出結果 (単独=1件、比較=モデルごとに複数)。実行中は順次追加される。 */
  results: DetectResult[];
  elapsedMs: number;
  error: string | null;
}

const initialState: SegmenterState = {
  phase: "idle",
  ep: null,
  download: null,
  results: [],
  elapsedMs: 0,
  error: null,
};

/**
 * @param specs   利用可能な全モデルの spec (worker が登録・遅延ロードする)
 * @param activeId 既定でロード/切替する active モデル
 */
export function useSegmenter(specs: ModelSpec[], activeId: string) {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<SegmenterState>(initialState);
  const sentActive = useRef(activeId);

  useEffect(() => {
    const worker = new Worker(new URL("./worker/segment.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (ev: MessageEvent<FromWorker>) => {
      const msg = ev.data;
      switch (msg.type) {
        case "download":
          setState((s) => ({
            ...s,
            phase: msg.cached ? "initializing" : "downloading",
            download: { modelId: msg.modelId, loaded: msg.loaded, total: msg.total, cached: msg.cached },
          }));
          break;
        case "ready":
          setState((s) => ({ ...s, phase: "ready", ep: msg.ep, download: null }));
          break;
        case "partial":
          setState((s) => {
            const rest = s.results.filter((r) => r.modelId !== msg.result.modelId);
            return { ...s, results: [...rest, msg.result], elapsedMs: msg.elapsedMs };
          });
          break;
        case "result":
          setState((s) => ({
            ...s,
            phase: "ready",
            results: msg.results,
            elapsedMs: msg.elapsedMs,
          }));
          break;
        case "error":
          setState((s) => ({ ...s, phase: "error", error: msg.message }));
          break;
      }
    };

    setState((s) => ({ ...s, phase: "downloading" }));
    worker.postMessage({ type: "init", specs, activeId } satisfies ToWorker);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
    // 初回マウント時のみ。以降の active 変更は下の effect で setActive。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // active モデルの差し替え (セレクタ切替・リロードなし)
  useEffect(() => {
    const w = workerRef.current;
    if (!w || activeId === sentActive.current) return;
    sentActive.current = activeId;
    setState((s) => ({ ...s, phase: "downloading", ep: null, results: [], error: null }));
    w.postMessage({ type: "setActive", modelId: activeId } satisfies ToWorker);
  }, [activeId]);

  /** modelIds のモデルで検出 (1個=単独、複数=比較)。 */
  const run = useCallback(async (file: File, modelIds: string[]) => {
    const worker = workerRef.current;
    if (!worker) return;
    setState((s) => ({ ...s, phase: "running", results: [], error: null }));
    const bitmap = await createImageBitmap(file);
    worker.postMessage({ type: "segment", bitmap, modelIds } satisfies ToWorker, [bitmap]);
  }, []);

  /** 入力画像を切り替えたときに前回の結果/エラーを消す。 */
  const reset = useCallback(() => {
    setState((s) => ({ ...s, results: [], error: null }));
  }, []);

  return { state, run, reset };
}
