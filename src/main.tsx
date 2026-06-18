import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyTheme, getTheme } from "./theme";
import "./index.css";

// 保存済みテーマ(ライト/ダーク/自動)を初期適用
applyTheme(getTheme());

// StrictMode は使わない: dev の二重マウントで推論ワーカが2つ生成され、
// 218MB モデルを二重ダウンロードしてしまうため。
createRoot(document.getElementById("root")!).render(<App />);
