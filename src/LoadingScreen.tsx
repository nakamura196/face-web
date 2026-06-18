/**
 * 初回モデルダウンロード中に表示する全画面ローディング。
 *
 * 演出: 資料 (絵巻・浮世絵・美人画) から「顔を検出」する様子を待ち時間に見せる。
 * 進捗バーは worker が送る実際の loaded/total に同期。長い DL を退屈させないよう、
 *   顔検出・資料の豆知識を数秒ごとにローテーションする。
 *
 * 表示条件: 「キャッシュに無い実ダウンロード」中のみ。2 回目以降 (IndexedDB ヒット)
 *   は一瞬で ready になるため全画面は出さず、従来のバナーに任せる。
 */
import { useEffect, useState } from "react";
import type { SegmenterState } from "./useSegmenter";

const fmtMB = (b: number) => (b / 1024 / 1024).toFixed(0);

/** 演出デモ: 資料の様式 (左) → 顔を検出 (右)。 */
const DECIPHER: { glyph: string; read: string }[] = [
  { glyph: "絵巻", read: "顔を検出" },
  { glyph: "絵本", read: "顔を検出" },
  { glyph: "浮世絵", read: "顔を検出" },
  { glyph: "美人画", read: "顔を検出" },
  { glyph: "肖像", read: "顔を検出" },
];

/** 待ち時間に流す豆知識 (顔検出・資料)。 */
const TRIVIA: string[] = [
  "YuNet は写真で学習した軽量な顔検出器。近現代の写実的な顔に強い。",
  "顔貌コレクション (KaoKore) は中世の絵巻・絵本の顔を集めたデータセット。",
  "浮世絵の大首絵など、様式化の強い顔は写真学習の検出器が苦手なことも。",
  "比較モードでは、複数モデルの検出結果を色分けして重ねられます。",
  "推論はすべてブラウザ内。アップロードした画像は外部に送信されません。",
  "検出結果は JSON / CSV / IIIF アノテーションでエクスポートできます。",
  "NDLイメージバンクの近現代美人画は、すべてパブリックドメイン。",
];

export function LoadingScreen({ state }: { state: SegmenterState }) {
  const d = state.download;
  // キャッシュからの即時ロードでは全画面を出さない (バナーに任せる)。
  const active =
    !!d && !d.cached && (state.phase === "downloading" || state.phase === "initializing");

  const [glyphIdx, setGlyphIdx] = useState(0);
  const [triviaIdx, setTriviaIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    const g = setInterval(() => setGlyphIdx((i) => (i + 1) % DECIPHER.length), 2600);
    const t = setInterval(() => setTriviaIdx((i) => (i + 1) % TRIVIA.length), 6000);
    return () => {
      clearInterval(g);
      clearInterval(t);
    };
  }, [active]);

  if (!active) return null;

  const pct = d && d.total ? Math.min(100, Math.round((d.loaded / d.total) * 100)) : null;
  const initializing = state.phase === "initializing";
  const cur = DECIPHER[glyphIdx];

  return (
    <div className="ls" role="status" aria-live="polite">
      {/* 背景に漂う文字 (雰囲気づくり) */}
      <div className="ls-bg" aria-hidden>
        {["雲", "花", "月", "美", "絵", "顔", "画", "粧"].map((c, i) => (
          <span key={i} className={`ls-float ls-float-${i % 4}`}>{c}</span>
        ))}
      </div>

      <div className="ls-card">
        <div className="ls-title">🙂 顔を見つける準備をしています</div>

        {/* 解読アニメ: 筆くん (マスコット) が墨を置く → 活字に解読 */}
        <div className="ls-decipher" aria-hidden>
          <BrushMascot />
          <span className="ls-arrow">→</span>
          <span key={`r-${glyphIdx}`} className="ls-read">
            <span className="ls-read-char">{cur.glyph}</span>
            <span className="ls-read-yomi">{cur.read}</span>
          </span>
        </div>
        <div className="ls-caption">筆(ふで)くんが 顔をさがす準備をしています…</div>

        {/* 進捗 (実 DL に同期) */}
        <div className="ls-bar">
          <div
            className="ls-bar-fill"
            style={{ width: pct !== null ? `${pct}%` : "40%" }}
          />
        </div>
        <div className="ls-status">
          {initializing ? (
            <span>🔧 ONNX セッションを初期化中…</span>
          ) : (
            <span>
              ⬇️ モデルを取得中 {d ? `${fmtMB(d.loaded)}${d.total ? ` / ${fmtMB(d.total)}` : ""} MB` : ""}
            </span>
          )}
          {pct !== null && <span className="ls-pct">{pct}%</span>}
        </div>
        <div className="ls-note">初回のみ。完了後はブラウザにキャッシュされ、次回から即起動します。</div>

        {/* 豆知識 */}
        <div className="ls-trivia" key={triviaIdx}>
          <span className="ls-trivia-tag">豆知識</span>
          {TRIVIA[triviaIdx]}
        </div>
      </div>
    </div>
  );
}

/**
 * 筆のマスコット「筆くん」。ひょこひょこ揺れて、和紙に墨でちょんちょん字を書く。
 * すべてインライン SVG + CSS アニメ (依存なし)。動きは index.css の .bm-* 参照。
 */
function BrushMascot() {
  return (
    <svg className="bm" viewBox="0 0 130 192" width="116" height="172" role="img" aria-label="筆のマスコット">
      <defs>
        <linearGradient id="bm-wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9d6aa" />
          <stop offset="0.5" stopColor="#d8bf86" />
          <stop offset="1" stopColor="#c6a865" />
        </linearGradient>
        <linearGradient id="bm-tip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3b42" />
          <stop offset="1" stopColor="#0c0c10" />
        </linearGradient>
      </defs>

      {/* 紙の地 (うっすら基準線) */}
      <line x1="22" y1="178" x2="108" y2="178" stroke="#cdbf9c" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.7" />
      {/* 紙にのる墨 (筆くんの動きに合わせて一画ぶん描かれる) */}
      <path
        className="bm-stroke"
        d="M34 168 q12 -20 30 -10 q11 7 5 19 q-4 9 9 7 q14 -2 24 -15"
        fill="none"
        stroke="#1c2230"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="bm-dot bm-dot-0" cx="35" cy="170" r="2.8" fill="#1c2230" />
      <circle className="bm-dot bm-dot-1" cx="106" cy="153" r="2.2" fill="#1c2230" />

      <g className="bm-mascot">
        {/* 柄 (竹) */}
        <rect x="50" y="14" width="30" height="76" rx="15" fill="url(#bm-wood)" stroke="#b8975a" strokeWidth="1.5" />
        <line x1="50" y1="40" x2="80" y2="40" stroke="#b8975a" strokeWidth="1.2" opacity="0.55" />
        <line x1="50" y1="62" x2="80" y2="62" stroke="#b8975a" strokeWidth="1.2" opacity="0.55" />
        {/* 吊り紐の輪 */}
        <path d="M65 14 q0 -9 6 -9 q7 0 7 7" fill="none" stroke="#c6a865" strokeWidth="2.5" />
        {/* 口金 */}
        <rect x="47" y="88" width="36" height="12" rx="3" fill="#d3bd95" stroke="#a98f57" strokeWidth="1" />
        {/* 穂先 */}
        <path d="M50 98 q15 7 30 0 q-2 32 -15 47 q-13 -15 -15 -47z" fill="url(#bm-tip)" />
        <path d="M62 103 q4 2 8 0 q-2 22 -4 33 q-2 -11 -4 -33z" fill="#4c4c55" opacity="0.5" />
        {/* 穂先の墨のしずく */}
        <circle className="bm-drop" cx="65" cy="146" r="3" fill="#1f2430" />

        {/* 顔 */}
        <g className="bm-eyes">
          <ellipse cx="60" cy="52" rx="3.3" ry="4.2" fill="#23262e" />
          <ellipse cx="70" cy="52" rx="3.3" ry="4.2" fill="#23262e" />
          <circle cx="61.2" cy="50.4" r="1" fill="#fff" />
          <circle cx="71.2" cy="50.4" r="1" fill="#fff" />
        </g>
        <circle cx="54" cy="59" r="3" fill="#f0a9a0" opacity="0.55" />
        <circle cx="76" cy="59" r="3" fill="#f0a9a0" opacity="0.55" />
        <path d="M61 59 q4 4.5 8 0" fill="none" stroke="#23262e" strokeWidth="1.7" strokeLinecap="round" />
      </g>
    </svg>
  );
}
