import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as RMouseEvent,
} from "react";
import { useSegmenter } from "./useSegmenter";
import { LoadingScreen } from "./LoadingScreen";
import { BrushMascot } from "./Mascot";
import {
  colorForIndex,
  drawMontage,
  drawOverlayMulti,
  montageHit,
  type MontageLayout,
} from "./lib/draw";
import { MODELS, activeModel, setModelId, type FaceModel } from "./lib/config";
import type { ModelSpec } from "./worker/protocol";
import { toCSV, toIIIFAnnotations, toJSONExport } from "./lib/export";
import { looksLikeIiifUrl, parseIiif, type IiifDoc, type IiifPage } from "./lib/iiif";
import { buildShareCanvas, canvasToBlob } from "./lib/share-image";
import { companionMessage, getCompanionOn, setCompanionOn } from "./companion";
import { idbClear } from "./lib/idb";

const BASE = import.meta.env.BASE_URL;
const SAMPLES: { file: string; label: string; credit: string }[] = [
  { file: "bijinga_01.jpg", label: "三十六佳撰 ①", credit: "水野年方 1893 / 国立国会図書館 PDM" },
  { file: "bijinga_02.jpg", label: "三十六佳撰 ②", credit: "水野年方 1893 / 国立国会図書館 PDM" },
  { file: "bijinga_03.jpg", label: "三十六佳撰 ③", credit: "水野年方 1893 / 国立国会図書館 PDM" },
];

const AVAILABLE = MODELS.filter((m) => m.available);
const IIIF_PAGE_CAP = 150;

const fmtMB = (b: number) => (b / 1024 / 1024).toFixed(2);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function toSpec(m: FaceModel): ModelSpec {
  // 相対 URL (./models/…) は worker 内だと worker のパス基準で解決され 404 になるため、
  // メインスレッドでページ基準の絶対 URL に解決してから worker に渡す。
  const url =
    m.detect && !/^https?:\/\//.test(m.detect)
      ? new URL(m.detect, document.baseURI).href
      : m.detect;
  return { url, kind: m.kind, conf: m.conf, imgsz: m.imgsz, modelId: m.id, modelName: m.detectName };
}

/** 顔検出アプリ本体。このコンポーネントがマウントされた時だけ worker/モデルを初期化する。 */
export default function Segmenter() {
  const [modelId, setModelIdState] = useState<FaceModel["id"]>(activeModel().id);
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
  /** 比較モード: 利用可能な全モデルを同時に走らせて色分け表示 */
  const [compare, setCompare] = useState(false);

  // 利用可能な全モデルの spec を worker に渡す (worker が遅延ロード)。安定参照。
  const specs = useMemo(() => AVAILABLE.map(toSpec), []);
  const { state, run, reset } = useSegmenter(specs, modelId);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [companion, setCompanion] = useState(getCompanionOn());
  const [dragging, setDragging] = useState(false);
  const [imgUrl, setImgUrl] = useState("");
  const [urlErr, setUrlErr] = useState(false);
  const [urlBusy, setUrlBusy] = useState(false);
  const [iiifDoc, setIiifDoc] = useState<IiifDoc | null>(null);
  const [iiifSel, setIiifSel] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [share, setShare] = useState<{ url: string; blob: Blob } | null>(null);

  const overlayRef = useRef<HTMLCanvasElement>(null);
  const montageRef = useRef<HTMLCanvasElement>(null);
  const montageImg = useRef<HTMLImageElement | null>(null);
  const montageLayout = useRef<MontageLayout | null>(null);

  const results = state.results;
  const primary = results.length === 1 ? results[0] : null; // 単独実行時の主結果
  const busy = state.phase === "running";
  const modelReady = state.phase === "ready" || state.phase === "running";
  const comp = companionMessage(state, !!file);

  const selectFile = useCallback(
    (f: File | null, src?: string | null) => {
      reset();
      setSelected(null);
      setFile(f);
      setSource(src ?? f?.name ?? null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return f ? URL.createObjectURL(f) : null;
      });
    },
    [reset],
  );

  const loadSample = useCallback(
    async (s: (typeof SAMPLES)[number]) => {
      const url = `${BASE}samples/${s.file}`;
      const blob = await (await fetch(url)).blob();
      setIiifDoc(null);
      setIiifSel(null);
      selectFile(new File([blob], s.file, { type: blob.type }), s.file);
    },
    [selectFile],
  );

  function runNow() {
    if (!file) return;
    setSelected(null);
    const ids = compare ? AVAILABLE.map((m) => m.id) : [modelId];
    run(file, ids);
  }

  // 直接 fetch → ダメなら画像プロキシ (images.weserv.nl, CORS 付与) で再試行
  async function fetchDirectOrProxy(target: string): Promise<Response> {
    try {
      const res = await fetch(target, { mode: "cors" });
      if (!res.ok) throw new Error(`http ${res.status}`);
      return res;
    } catch {
      const res = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(target)}`);
      if (!res.ok) throw new Error(`http ${res.status}`);
      return res;
    }
  }

  async function loadIiifJson(json: unknown): Promise<void> {
    const doc = parseIiif(json);
    if (!doc) throw new Error("iiif parse");
    setIiifDoc(doc);
    setIiifSel(null);
    if (doc.pages.length === 1) await loadIiifPage(doc.pages[0]);
  }

  async function loadIiifPage(p: IiifPage): Promise<void> {
    setUrlErr(false);
    setUrlBusy(true);
    try {
      const res = await fetchDirectOrProxy(p.imageUrl);
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not image");
      setIiifSel(p.id);
      selectFile(new File([blob], `${p.label || "page"}.jpg`, { type: blob.type }), p.id);
    } catch {
      setUrlErr(true);
    } finally {
      setUrlBusy(false);
    }
  }

  async function loadFromUrl() {
    const u = imgUrl.trim();
    if (!u) return;
    setUrlErr(false);
    setUrlBusy(true);
    try {
      if (looksLikeIiifUrl(u)) {
        const res = await fetch(u, { mode: "cors" });
        if (!res.ok) throw new Error(`http ${res.status}`);
        await loadIiifJson(await res.json());
        return;
      }
      const res = await fetchDirectOrProxy(u);
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        await loadIiifJson(await res.json());
        return;
      }
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) throw new Error("not image");
      setIiifDoc(null);
      setIiifSel(null);
      const name = u.split("/").pop()?.split("?")[0] || "image";
      selectFile(new File([blob], name, { type: blob.type }), u);
    } catch {
      setUrlErr(true);
    } finally {
      setUrlBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setIiifDoc(null);
      setIiifSel(null);
      selectFile(f);
    }
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  // オーバーレイ描画 (単独=緑+確信度、比較=モデルごとに色分け)
  useEffect(() => {
    const cv = overlayRef.current;
    if (!cv) return;
    if (results.length) {
      drawOverlayMulti(cv, results[0].imageSize, results, {
        selected: results.length === 1 ? selected : null,
      });
      return;
    }
    cv.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
  }, [results, selected]);

  const renderMontage = useCallback(() => {
    const cv = montageRef.current;
    const img = montageImg.current;
    if (!cv || !img || !primary || primary.boxes.length === 0) return;
    const w = cv.parentElement?.clientWidth ?? 1200;
    montageLayout.current = drawMontage(cv, img, primary, clamp(Math.floor(w - 4), 480, 3000), {
      selected,
    });
  }, [primary, selected]);

  useEffect(() => {
    if (!previewUrl) {
      montageImg.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      montageImg.current = img;
      renderMontage();
    };
    img.src = previewUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  useEffect(() => {
    renderMontage();
  }, [primary, renderMontage]);

  useEffect(() => {
    let t: number | undefined;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(renderMontage, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
  }, [renderMontage]);

  // 画像クリック → その位置の顔を選択 (単独モード時のみ・最小面積優先)
  function onCanvasClick(e: RMouseEvent<HTMLDivElement>) {
    const cv = overlayRef.current;
    if (!cv || !primary || primary.boxes.length === 0) return;
    const rect = cv.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((e.clientX - rect.left) / rect.width) * primary.imageSize.width;
    const y = ((e.clientY - rect.top) / rect.height) * primary.imageSize.height;
    let best: number | null = null;
    let bestArea = Infinity;
    primary.boxes.forEach((b, i) => {
      const [x1, y1, x2, y2] = b.xyxy;
      if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        const a = (x2 - x1) * (y2 - y1);
        if (a < bestArea) {
          bestArea = a;
          best = i;
        }
      }
    });
    setSelected(best);
  }

  function onMontageClick(e: RMouseEvent<HTMLCanvasElement>) {
    const cv = montageRef.current;
    const layout = montageLayout.current;
    if (!cv || !layout) return;
    const rect = cv.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * cv.width;
    const y = ((e.clientY - rect.top) / rect.height) * cv.height;
    const idx = montageHit(layout, x, y);
    if (idx != null) setSelected(idx);
  }

  async function clearCache() {
    await idbClear();
    location.reload();
  }
  function selectModel(id: FaceModel["id"]) {
    const m = MODELS.find((x) => x.id === id);
    if (!m || !m.available || id === modelId || busy) return;
    setModelIdState(id);
    setModelId(id);
    setSelected(null);
    reset();
  }
  function toggleCompanion(on: boolean) {
    setCompanion(on);
    setCompanionOn(on);
  }

  function downloadBlob(blob: Blob, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function tsName(prefix: string, ext: string) {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    return `${prefix}-${ts}.${ext}`;
  }
  function downloadMontage() {
    montageRef.current?.toBlob((b) => b && downloadBlob(b, tsName("faces-montage", "png")), "image/png");
  }
  function downloadJSON() {
    if (!results.length) return;
    const json = primary
      ? toJSONExport(primary, { modelId: model.id, modelName: model.detectName, source })
      : JSON.stringify(
          {
            schemaVersion: "face-1.0",
            compare: true,
            source,
            imageSize: results[0].imageSize,
            models: results.map((r) => ({
              modelId: r.modelId,
              modelName: r.modelName,
              nFaces: r.nFaces,
              boxes: r.boxes,
            })),
          },
          null,
          2,
        );
    downloadBlob(new Blob([json], { type: "application/json" }), tsName("faces-result", "json"));
  }
  function downloadCSV() {
    if (!primary) return;
    downloadBlob(new Blob([toCSV(primary)], { type: "text/csv;charset=utf-8" }), tsName("faces-result", "csv"));
  }
  function downloadIiif() {
    if (!primary) return;
    const src = iiifSel ?? source ?? "image";
    downloadBlob(
      new Blob([toIIIFAnnotations(primary, src)], { type: "application/json" }),
      tsName("faces-annotations", "json"),
    );
  }

  async function openShare() {
    const img = montageImg.current;
    if (!img || !primary) return;
    const cv = buildShareCanvas(img, primary, { selected });
    const blob = await canvasToBlob(cv);
    setShare((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(blob), blob };
    });
  }
  function closeShare() {
    setShare((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }
  async function shareNow() {
    if (!share) return;
    const f = new File([share.blob], "faces.png", { type: "image/png" });
    const data: ShareData = {
      files: [f],
      title: "顔検出",
      text: "ブラウザ完結の顔検出で資料画像の顔を検出してみました 🙂",
    };
    try {
      if (navigator.canShare?.(data)) await navigator.share(data);
    } catch {
      /* キャンセル等は無視 */
    }
  }

  const multiAvailable = AVAILABLE.length >= 2;

  return (
    <>
      <LoadingScreen state={state} />

      <main className="wrap">
        <ModelStatus state={state} modelName={model.label} />

        <div className="io-grid">
          {/* ===== 左: 入力 ===== */}
          <section className="panel input-pane">
            <h2 className="pane-title">
              <BrushMascot size={24} delay={0.2} />① モデルを選ぶ
            </h2>

            <div className="usecase" role="radiogroup" aria-label="検出モデル">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={
                    (modelId === m.id && !compare ? "usecase-card sel" : "usecase-card") +
                    (m.available ? "" : " disabled")
                  }
                  aria-pressed={modelId === m.id && !compare}
                  disabled={busy || !m.available}
                  title={m.available ? m.desc : `${m.desc}（準備中）`}
                  onClick={() => selectModel(m.id)}
                >
                  <span className="usecase-emoji">{m.emoji}</span>
                  <b>{m.short}{m.available ? "" : "・準備中"}</b>
                  <small>{m.detectName}</small>
                </button>
              ))}
            </div>

            {multiAvailable && (
              <label className="big-toggle">
                <input
                  type="checkbox"
                  checked={compare}
                  disabled={busy}
                  onChange={(e) => { setCompare(e.target.checked); setSelected(null); }}
                />
                <span>
                  🆚 全モデル同時に検出（比較）
                  <small>利用可能な {AVAILABLE.length} モデルを走らせ、結果を色分けで重ね表示します。</small>
                </span>
              </label>
            )}
            <p className="hint">{compare ? "比較モード：各モデルの枠を色分けして重ねます。" : model.desc}</p>

            <h2 className="pane-title">
              <BrushMascot size={24} delay={0.45} />② 画像を入力
            </h2>

            <label
              className={dragging ? "dropzone drag" : "dropzone"}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragEnter={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  setIiifDoc(null);
                  setIiifSel(null);
                  selectFile(e.target.files?.[0] ?? null);
                }}
              />
              <span className="dropzone-icon">⬆️</span>
              <span>{dragging ? "ここにドロップ" : "画像をドラッグ＆ドロップ／クリックで選択"}</span>
            </label>

            <div className="url-input">
              <input
                type="url"
                placeholder="https://… 画像 / IIIF マニフェストのURL"
                value={imgUrl}
                onChange={(e) => { setImgUrl(e.target.value); setUrlErr(false); }}
                onKeyDown={(e) => e.key === "Enter" && loadFromUrl()}
                spellCheck={false}
              />
              <button type="button" onClick={loadFromUrl} disabled={!imgUrl.trim() || urlBusy}>
                {urlBusy ? "取得中…" : "読み込む"}
              </button>
            </div>
            <p className="hint">
              公開画像のURLを直接読み込み。IIIF マニフェスト（manifest.json）や info.json の URL も読み込めます。
              CORS非対応のサイトは画像プロキシ（images.weserv.nl）経由で取得します。
            </p>
            {urlErr && (
              <p className="hint url-err">
                URL から取得できませんでした（画像/IIIFでない、または URL が誤っている可能性）。
              </p>
            )}

            {iiifDoc && iiifDoc.pages.length > 1 && (
              <div className="iiif-pages">
                <span className="sub">
                  {iiifDoc.label || "IIIF"} — ページを選択（{iiifDoc.pages.length}ページ）
                </span>
                <div className="iiif-strip">
                  {iiifDoc.pages.slice(0, IIIF_PAGE_CAP).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={iiifSel === p.id ? "iiif-page sel" : "iiif-page"}
                      onClick={() => loadIiifPage(p)}
                      disabled={urlBusy || busy}
                      title={p.label}
                    >
                      <img src={p.thumbUrl} alt={p.label} loading="lazy" />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
                {iiifDoc.pages.length > IIIF_PAGE_CAP && (
                  <p className="hint">（最初の {IIIF_PAGE_CAP} ページを表示しています）</p>
                )}
              </div>
            )}

            <div className="samples">
              <span className="sub">またはサンプルで試す（近現代美人画・PD）</span>
              <div className="sample-row">
                {SAMPLES.map((s) => (
                  <button
                    key={s.file}
                    type="button"
                    className={file?.name === s.file ? "sample sel" : "sample"}
                    onClick={() => loadSample(s)}
                    title={`${s.label}（${s.credit}）`}
                  >
                    <img src={`${BASE}samples/${s.file}`} alt={s.label} loading="lazy" />
                    <span className="sample-label">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="primary big"
              onClick={runNow}
              disabled={!file || busy || !modelReady}
            >
              {busy ? "検出中…" : modelReady ? (compare ? "🆚 全モデルで検出" : "🙂 顔を検出") : "モデル準備中…"}
            </button>

            {busy && <ProgBar label="顔検出を実行中" done={0} total={0} />}
            {state.error && <p className="error">{state.error}</p>}

            <details className="settings">
              <summary>⚙️ 詳しい設定</summary>
              <p className="hint">
                検出モデル: <b>{model.detectName}</b> ／ 種類:{" "}
                <b>{model.kind === "yunet" ? "YuNet（写真学習）" : "YOLO（特化学習）"}</b> ／ しきい値:{" "}
                <b>{model.conf}</b>
              </p>
              <div className="btnrow">
                <button onClick={clearCache}>キャッシュ削除</button>
              </div>
            </details>
          </section>

          {/* ===== 右: 出力 ===== */}
          <section className="output-pane">
            <div className="output-head">
              <h2 className="pane-title">
                <BrushMascot size={24} delay={0.45} />検出結果
              </h2>
              <span className="legend">
                {results.length > 1 ? "モデルごとに色分け" : "緑＝顔 ／ 数値＝確信度"}
              </span>
            </div>
            <div className="canvas-wrap clickable" onClick={onCanvasClick}>
              {previewUrl ? (
                <img src={previewUrl} alt="入力画像" />
              ) : (
                <div className="placeholder">
                  <BrushMascot size={108} delay={0.3} />
                  <div className="placeholder-bubble">
                    資料画像をどうぞ！
                    <span className="placeholder-sub">サンプル選択 or アップロード</span>
                  </div>
                </div>
              )}
              <canvas ref={overlayRef} className="overlay" />
            </div>

            {results.length > 0 && (
              <div className="stat-chips">
                {results.map((r, i) => (
                  <span className="chip" key={r.modelId}>
                    {results.length > 1 && (
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          marginRight: 5,
                          background: colorForIndex(i),
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                    {results.length > 1 ? r.modelName : "顔"} <b>{r.nFaces}</b> 件
                  </span>
                ))}
                <span className="chip">{results[0].imageSize.width}×{results[0].imageSize.height}</span>
                <span className="chip">{(state.elapsedMs / 1000).toFixed(2)}秒</span>
                {state.ep && <span className="chip ep">{state.ep}</span>}
              </div>
            )}

            {primary && primary.boxes.length > 0 && !busy && (
              <div className="result-actions">
                <button className="dl-btn" onClick={openShare}>📣 共有画像を作る</button>
              </div>
            )}

            {results.length > 0 && results.every((r) => r.boxes.length === 0) && !busy && (
              <p className="hint">顔は検出されませんでした。別の画像か別のモデルをお試しください。</p>
            )}

            {primary && primary.boxes.length > 0 && (
              <div className="montage">
                <div className="section-head">
                  <h2 className="section-title">
                    <BrushMascot size={28} mood="happy" delay={1.3} />
                    ✂️ 切り出した顔一覧（上→下・左→右）
                  </h2>
                  <button className="dl-btn" onClick={downloadMontage}>⬇️ 画像を保存</button>
                </div>
                <canvas ref={montageRef} className="clickable" onClick={onMontageClick} />
              </div>
            )}

            {results.length > 0 && (
              <div className="dev-export">
                <span className="sub">エクスポート:</span>
                <button onClick={downloadJSON}>JSON</button>
                <button onClick={downloadCSV} disabled={!primary}>CSV</button>
                <button onClick={downloadIiif} disabled={!primary}>IIIF アノテーション</button>
                <span className="hint">
                  {primary
                    ? "JSON/CSV は box 座標・確信度。IIIF は Web Annotation（AnnotationPage）形式。"
                    : "比較結果は JSON（全モデル）でエクスポートできます。CSV/IIIF は単独実行時に。"}
                </span>
              </div>
            )}
          </section>
        </div>
      </main>

      {share && (
        <div className="modal-veil" role="dialog" aria-modal="true" aria-label="共有用画像">
          <div className="modal-card share-card">
            <div className="modal-head">
              <h2 className="section-title">📣 共有用画像（ビフォーアフター）</h2>
              <button className="modal-x" onClick={closeShare} aria-label="閉じる">×</button>
            </div>
            <img className="share-preview" src={share.url} alt="共有用画像のプレビュー" />
            <p className="hint">原本と検出結果を並べた1枚画像です。生成もブラウザ内で完結します。</p>
            <div className="btnrow">
              <button
                className="dl-btn"
                onClick={() => downloadBlob(share.blob, tsName("faces-share", "png"))}
              >
                ⬇️ 画像を保存
              </button>
              {"share" in navigator && (
                <button className="dl-btn" onClick={shareNow}>共有…</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== 左下に常駐する案内役 ===== */}
      <aside className="companion-dock" role="status" aria-live="polite">
        <button
          className="companion-mascot-btn"
          type="button"
          onClick={() => toggleCompanion(!companion)}
          title={companion ? "解説を止める" : "解説をつける"}
          aria-pressed={companion}
        >
          <BrushMascot size={88} mood={companion ? comp.mood : "happy"} delay={0.5} label="筆くん" />
        </button>
        {companion ? (
          <div className="companion-bubble" data-mood={comp.mood}>
            {comp.line}
            <button
              className="companion-x"
              type="button"
              onClick={() => toggleCompanion(false)}
              title="解説を止める"
              aria-label="解説を止める"
            >
              ×
            </button>
          </div>
        ) : (
          <button className="companion-on" type="button" onClick={() => toggleCompanion(true)}>
            💬 解説ON
          </button>
        )}
      </aside>
    </>
  );
}

function ProgBar({
  label, done, total, unit = "", mb = false,
}: { label: string; done: number; total: number; unit?: string; mb?: boolean }) {
  const pct = total ? Math.round((done / total) * 100) : null;
  const right = mb
    ? `${fmtMB(done)}${total ? ` / ${fmtMB(total)}` : ""} MB`
    : total
      ? `${done}/${total}${unit}`
      : "";
  return (
    <div className="prog">
      <div className="prog-head">
        <span>{label}</span>
        <span>{right}{pct !== null ? `（${pct}%）` : ""}</span>
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: pct !== null ? `${pct}%` : "100%" }} />
      </div>
    </div>
  );
}

function ModelStatus({
  state, modelName,
}: { state: ReturnType<typeof useSegmenter>["state"]; modelName: string }) {
  if (state.phase === "ready" || state.phase === "running") return null;
  if (state.phase === "error") {
    return <div className="banner err">⚠️ {state.error}</div>;
  }
  const d = state.download;
  const pct = d && d.total ? Math.round((d.loaded / d.total) * 100) : null;
  return (
    <div className="banner">
      <div className="banner-head">
        <span>
          {state.phase === "initializing"
            ? "🔧 ONNX セッションを初期化中…"
            : `⬇️ ${modelName} モデルを読み込み中… 初回のみ。完了後はキャッシュされます`}
        </span>
        {d && (
          <span className="banner-num">
            {fmtMB(d.loaded)}
            {d.total ? ` / ${fmtMB(d.total)}` : ""} MB{pct !== null ? `（${pct}%）` : ""}
          </span>
        )}
      </div>
      <div className="bar">
        <div className="bar-fill" style={{ width: pct !== null ? `${pct}%` : "100%" }} />
      </div>
    </div>
  );
}
