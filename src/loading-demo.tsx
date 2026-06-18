/**
 * LoadingScreen を単体で動かす録画/確認用デモ。
 * 偽の DL 進捗 (0→100% → 初期化) を 13 秒周期でループさせる。
 * 本番ビルドには含めない (root の loading-demo.html からのみ参照)。
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LoadingScreen } from "./LoadingScreen";
import type { SegmenterState } from "./useSegmenter";
import "./index.css";

const TOTAL = 218 * 1024 * 1024;

function Demo() {
  const [t, setT] = useState(0); // 秒 (0..13 ループ)
  useEffect(() => {
    const id = setInterval(() => setT((x) => Math.round((x + 0.1) * 10) / 10 % 13), 100);
    return () => clearInterval(id);
  }, []);

  const phase: SegmenterState["phase"] = t < 10 ? "downloading" : "initializing";
  const loaded = t < 10 ? TOTAL * (t / 10) : TOTAL;

  const state: SegmenterState = {
    phase,
    ep: null,
    download: { modelId: "yunet", loaded, total: TOTAL, cached: false },
    results: [],
    elapsedMs: 0,
    error: null,
  };
  return <LoadingScreen state={state} />;
}

createRoot(document.getElementById("root")!).render(<Demo />);
