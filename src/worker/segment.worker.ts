/**
 * 推論ワーカ。モデル DL / ONNX 推論を UI スレッド外で実行する。
 *  - init     : ort 環境設定 → active モデルをロード
 *  - setActive: 別モデルに切替 (未ロードならロード)
 *  - segment  : ImageBitmap を modelIds の各モデルで検出して結果を返す
 *               (1個=単独、複数=比較。比較では順次 partial を返してから result)
 *
 * YuNet と YOLO で出力デコードが異なるため、kind ごとに session を保持する
 * (yunet.ts / ort-yolo.ts がそれぞれ module 内に session を持つ)。
 * 現状 kind ごとに 1 セッションなので「同 kind の別モデル」を比較する場合は
 * 実行直前に必要なら載せ替える (将来複数 YOLO を比較するとき用)。
 */
import { loadOrt } from "../lib/ort";
import { loadModelBuffer } from "../lib/model-cache";
import { setSession } from "../lib/ort-yolo";
import { setYunetSession } from "../lib/yunet";
import { setRetinaSession } from "../lib/retinaface";
import { detect } from "../lib/segment";
import type { FromWorker, ToWorker, ModelSpec } from "./protocol";

const post = (msg: FromWorker, transfer?: Transferable[]) =>
  (self as unknown as Worker).postMessage(msg, transfer ?? []);

const specs = new Map<string, ModelSpec>();
/** kind ごとに現在 session に載っている modelId */
const resident: Partial<Record<ModelSpec["kind"], string>> = {};
let envReady: Promise<void> | null = null;
let lastEp = "wasm";

async function setupEnv(): Promise<void> {
  const ort = await loadOrt();
  const isolated = (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated;
  const cores = self.navigator?.hardwareConcurrency ?? 4;
  ort.env.wasm.numThreads = isolated ? Math.min(4, Math.max(1, cores - 1)) : 1;
  ort.env.wasm.simd = true;
  // dynamic 入力の YuNet は出力形状メタが古く VerifyOutputSizes 警告を多発させるが
  // 実出力は正しい。コンソールを汚さないよう警告以下を抑制する。
  ort.env.logLevel = "error";
}

/** spec の kind の session に、そのモデルを (必要なら DL して) 載せる。 */
async function ensureResident(spec: ModelSpec): Promise<void> {
  if (resident[spec.kind] === spec.modelId) return;
  if (!spec.url) throw new Error(`モデル「${spec.modelName}」は準備中です（ONNX 未提供）`);
  const ort = await loadOrt();
  const buf = await loadModelBuffer(spec.url, (p) =>
    post({ type: "download", modelId: spec.modelId, loaded: p.loaded, total: p.total, cached: p.cached }),
  );
  const bin = new Uint8Array(buf);

  const hasWebGPU = typeof (self.navigator as unknown as { gpu?: unknown }).gpu !== "undefined";
  let ep = "wasm";
  let session: Awaited<ReturnType<typeof ort.InferenceSession.create>> | null = null;
  if (hasWebGPU) {
    try {
      session = await ort.InferenceSession.create(bin, {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "all",
        logSeverityLevel: 3,
      });
      ep = "webgpu";
    } catch (e) {
      console.warn("WebGPU 初期化に失敗、WASM にフォールバックします:", e);
      session = null;
    }
  }
  if (!session) {
    session = await ort.InferenceSession.create(bin, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
      logSeverityLevel: 3,
    });
    const nt = ort.env.wasm.numThreads ?? 1;
    ep = `wasm${nt > 1 ? ` (${nt} threads)` : ""}`;
  }

  if (spec.kind === "yunet") setYunetSession(session);
  else if (spec.kind === "retinaface") setRetinaSession(session);
  else setSession(session);
  resident[spec.kind] = spec.modelId;
  lastEp = ep;
}

async function runModel(spec: ModelSpec, bitmap: ImageBitmap) {
  await ensureResident(spec);
  return detect(bitmap, bitmap.width, bitmap.height, {
    kind: spec.kind,
    conf: spec.conf,
    imgsz: spec.imgsz,
    modelId: spec.modelId,
    modelName: spec.modelName,
  });
}

self.onmessage = async (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      specs.clear();
      for (const s of msg.specs) specs.set(s.modelId, s);
      if (!envReady) envReady = setupEnv();
      await envReady;
      const active = specs.get(msg.activeId);
      if (active) await ensureResident(active);
      post({ type: "ready", ep: lastEp });
      return;
    }
    if (msg.type === "setActive") {
      await envReady;
      const spec = specs.get(msg.modelId);
      if (!spec) throw new Error(`未知のモデル: ${msg.modelId}`);
      await ensureResident(spec);
      post({ type: "ready", ep: lastEp });
      return;
    }
    if (msg.type === "segment") {
      await envReady;
      const targets = msg.modelIds.map((id) => specs.get(id)).filter((s): s is ModelSpec => !!s);
      if (targets.length === 0) throw new Error("検出対象のモデルがありません");
      const t0 = performance.now();
      const results = [];
      // 比較時は同 kind の載せ替えが起き得るため逐次実行 (順次 partial を返す)
      for (const spec of targets) {
        const result = await runModel(spec, msg.bitmap);
        results.push(result);
        post({ type: "partial", result, elapsedMs: performance.now() - t0 });
      }
      msg.bitmap.close();
      post({ type: "result", results, elapsedMs: performance.now() - t0 });
      return;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "推論に失敗しました";
    post({ type: "error", message });
  }
};
