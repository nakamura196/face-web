/**
 * モデル (best.onnx ≈ 218MB) を取得する。
 *  1. IndexedDB にあればそれを返す (通信なし)
 *  2. 無ければ fetch して進捗を報告しつつ DL → IndexedDB に保存 → 返す
 */
import { idbGet, idbPut } from "./idb";

export interface DownloadProgress {
  loaded: number;
  total: number; // 0 = 不明 (Content-Length が無い)
  cached: boolean;
}

export async function loadModelBuffer(
  url: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<ArrayBuffer> {
  const cached = await idbGet(url);
  if (cached) {
    onProgress({ loaded: cached.byteLength, total: cached.byteLength, cached: true });
    return cached;
  }

  const resp = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!resp.ok) {
    throw new Error(`モデル取得に失敗しました: HTTP ${resp.status} (${url})`);
  }
  const total = Number(resp.headers.get("content-length")) || 0;

  if (!resp.body) {
    // ストリーム不可な環境: 一括取得
    const buf = await resp.arrayBuffer();
    await idbPut(url, buf);
    onProgress({ loaded: buf.byteLength, total: buf.byteLength, cached: false });
    return buf;
  }

  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress({ loaded, total, cached: false });
  }

  const out = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  const buf = out.buffer;
  // 取得できたら永続化 (失敗してもアプリは続行可能)
  try {
    await idbPut(url, buf);
  } catch {
    /* QuotaExceeded 等は無視 */
  }
  return buf;
}
