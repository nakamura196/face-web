import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * COOP/COEP (クロスオリジン隔離) は付与しない。
 * 以前は WASM マルチスレッド(SharedArrayBuffer)用に COEP を付けていたが、
 *  - 物体検出は WebGPU で動く
 *  - 認識(Metom)も WebGPU 優先、スレッドは WASM fallback 時のみ
 * とスレッドの恩恵が小さい一方、COEP があると YouTube 等の外部 iframe 埋め込みが
 * ブロックされ、GitHub Pages(ヘッダ設定不可)でも動かしにくい。よって COEP を外す。
 * モデル取得は HF/CDN とも CORS(ACAO:*) で問題なく動く。
 */
export default defineConfig({
  // 相対パスにして GitHub Pages のサブパス配信でも壊れないようにする
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
});
