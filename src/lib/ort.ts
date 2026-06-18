/**
 * onnxruntime-web を CDN から実行時ロードする。
 *
 * なぜバンドルしないか:
 *  - WebGPU 用 wasm (ort-wasm-simd-threaded.jsep.wasm) は約26MB あり、
 *    Cloudflare Pages の「1ファイル25MiB」制限を超えてデプロイできない。
 *  - CDN から読めば、アプリ本体は数百KB に収まり、どの無料ホストにも置ける。
 *
 * 型だけ npm の onnxruntime-web から import する (実コードはバンドルされない)。
 * COEP: credentialless により cross-origin の JS/wasm 取得が通る。
 */
import type * as Ort from "onnxruntime-web";

export type { Ort };
export type OrtModule = typeof Ort;

const VERSION = "1.26.0";
const CDN_DIR = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${VERSION}/dist/`;

let mod: OrtModule | null = null;

export async function loadOrt(): Promise<OrtModule> {
  if (mod) return mod;
  // 変数経由の specifier にして TS/Vite の静的解決を回避 (CDN を実行時 import)
  const entry = CDN_DIR + "ort.webgpu.bundle.min.mjs";
  mod = (await import(/* @vite-ignore */ entry)) as OrtModule;
  // .wasm バイナリも同じ CDN から取得する
  mod.env.wasm.wasmPaths = CDN_DIR;
  return mod;
}

export function getOrt(): OrtModule {
  if (!mod) throw new Error("onnxruntime-web が未ロードです (loadOrt を先に呼ぶ)");
  return mod;
}
