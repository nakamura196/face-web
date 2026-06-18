/**
 * 軽量 i18n (ja / en)。依存なし。Context で現在言語と t() を配る。
 * 言語は localStorage に保存。未設定ならブラウザ言語から推定。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ja" | "en";
const LS = "kuzushiji-web:lang";

type Dict = Record<string, { ja: string; en: string }>;

// キーは画面横断で共有。{n} などは t() の引数で置換。
const DICT: Dict = {
  "nav.home": { ja: "トップ", en: "Home" },
  "nav.app": { ja: "検出アプリ", en: "App" },
  "nav.privacy": { ja: "プライバシー", en: "Privacy" },
  "nav.start": { ja: "使ってみる", en: "Try it" },
  "header.theme": { ja: "テーマ", en: "Theme" },

  // Landing hero
  "hero.title": { ja: "顔検出", en: "Face Detection" },
  "hero.tagline": {
    ja: "絵巻・浮世絵・近現代美人画などの資料画像から顔を検出。複数の検出モデルを切り替えて試せます。推論はすべてブラウザ内で完結。",
    en: "Detect faces in historical and art images (emaki, ukiyo-e, modern bijinga). Switch between detection models — all inference runs in your browser.",
  },
  "hero.badge1": { ja: "🔒 画像は送信しない", en: "🔒 No image upload" },
  "hero.badge2": { ja: "⚡ WebGPU / 無料", en: "⚡ WebGPU / Free" },
  "hero.badge3": { ja: "🎨 史料・美術資料の顔向け", en: "🎨 For faces in art & archives" },
  "hero.cta": { ja: "▶ 使ってみる", en: "▶ Try it now" },
  "hero.ctaMobile": { ja: "📱 スマホは非対応", en: "📱 Not available on phones" },
  "hero.ctaMobileNote": {
    ja: "特化モデル（YOLO）は大きいため、スマホ・タブレットではメモリ不足になり得ます。PC（Chrome / Edge）でのご利用を推奨します。",
    en: "The specialized YOLO models are large and may run out of memory on phones/tablets. A PC (Chrome / Edge) is recommended.",
  },
  "hero.howto": { ja: "使い方を見る", en: "Watch tutorial" },

  // Landing features
  "feat.title": { ja: "特徴", en: "Features" },
  "feat.1.t": { ja: "顔の検出と一覧化", en: "Detect and gallery faces" },
  "feat.1.b": {
    ja: "検出した顔を矩形で示し、切り出してグリッドに並べます。どの顔をどう拾ったかを視覚的に確認でき、データセット作りや点検に向きます。",
    en: "Detected faces are boxed and cropped into a grid, so you can visually check what was picked up — handy for building datasets and reviewing results.",
  },
  "feat.2.t": { ja: "様式ごとに検出モデルを切替", en: "Switch detectors per style" },
  "feat.2.b": {
    ja: "写真学習の汎用 YuNet と、顔貌コレクション等で学習した様式特化 YOLO を切り替え。前近代の様式化された顔から近現代の写実的な顔まで、対象に合った検出器を選べます。",
    en: "Switch between general-purpose YuNet (trained on photos) and style-specialized YOLO models (e.g. KaoKore). Pick the detector for stylized pre-modern faces or realistic modern ones.",
  },
  "feat.3.t": { ja: "完全ローカル", en: "Fully local" },
  "feat.3.b": {
    ja: "推論はすべてブラウザ内で実行され、画像をサーバに送信しません。研究・公開デモ・下調べに安心して使えます。",
    en: "All inference runs in your browser; images are never sent to a server. Safe for research, demos and quick checks.",
  },

  // マスコット紹介
  "mascot.title": { ja: "案内役の「筆くん」", en: "Meet Fude-kun" },
  "mascot.name": { ja: "筆くん（ふでくん）", en: "Fude-kun" },
  "mascot.greet": {
    ja: "やあ！案内役の筆くんだよ。\nいっしょに顔をさがそう！",
    en: "Hi! I'm Fude-kun, your guide.\nLet's find faces together!",
  },
  "mascot.greet2": {
    ja: "絵巻でも浮世絵でも、\n顔をていねいに拾っていくよ。",
    en: "Emaki or ukiyo-e —\nI'll pick out the faces carefully.",
  },
  "mascot.greet3": {
    ja: "画像は外に送らないよ。\n安心して使ってね。",
    en: "Your images never leave your\nbrowser. Use me with ease!",
  },
  "mascot.greet4": {
    ja: "アプリの左下にいるよ。\n困ったら呼んでね！",
    en: "Find me at the app's\nbottom-left. Call me anytime!",
  },
  "mascot.more": { ja: "筆くんについて →", en: "About Fude-kun →" },
  "mascot.body": {
    ja: "このサイトの案内役のマスコットです。アプリ画面の左下に常駐し、操作の手順や状況をひとことで解説します。吹き出しの「×」や本体のクリックで、解説の表示・非表示を切り替えられます。",
    en: "This site's guide mascot. It sits at the bottom-left of the app and gives a one-line note on each step. Toggle the guide on/off via the bubble's “×” or by clicking it.",
  },

  "howto.title": { ja: "使い方", en: "How to use" },
  "news.title": { ja: "お知らせ", en: "News" },
  "ack.title": { ja: "謝辞・使用モデル", en: "Acknowledgements & models" },
  "ack.infer": {
    ja: "onnxruntime-web（WebGPU 優先 / WASM フォールバック）を CDN からロード。検出モデルは取得後 IndexedDB にキャッシュ。画像は外部に送信しません。",
    en: "onnxruntime-web (WebGPU first, WASM fallback) is loaded from a CDN. Detection models are cached in IndexedDB after the first download. Images are never uploaded.",
  },
  "ack.models": { ja: "使用モデル / 配信 URL", en: "Models / distribution URLs" },
  "ack.credits": { ja: "謝辞", en: "Credits" },

  "footer.privacy": { ja: "プライバシーポリシー", en: "Privacy Policy" },
  "footer.backTop": { ja: "← トップ", en: "← Home" },

  // Segmenter (core)
  "app.stepUse": { ja: "① 用途を選ぶ（検出モデル）", en: "① Choose use case (detector)" },
  "app.stepImg": { ja: "② 画像を入力", en: "② Add an image" },
  "app.usecase": { ja: "用途", en: "Use case" },
  "app.samples": { ja: "またはサンプルで試す（{p}向け）", en: "Or try a sample (for {p})" },
  "app.drop": { ja: "画像をドラッグ＆ドロップ／クリックで選択", en: "Drag & drop an image / click to select" },
  "app.dropHere": { ja: "ここにドロップ", en: "Drop here" },
  "app.recognize": { ja: "読みも表示する", en: "Also show readings" },
  "app.recognizeSub": { ja: "単字認識（Metom・初回のみ +約22MB）", en: "Character recognition (Metom · +~22MB first time)" },
  "app.run": { ja: "② 文字を切り出す", en: "② Segment characters" },
  "app.running": { ja: "解析中…", en: "Working…" },
  "app.preparing": { ja: "モデル準備中…", en: "Preparing model…" },
  "app.advanced": { ja: "⚙️ 詳しい設定（上級者向け）", en: "⚙️ Advanced settings" },
  "app.result": { ja: "検出結果", en: "Result" },
  "app.legendChar": { ja: "緑＝文字", en: "Green = character" },
  "app.legendLine": { ja: " ／ 青＝行", en: " / Blue = line" },
  "app.placeholder": { ja: "史料画像をどうぞ！", en: "Drop a document image!" },
  "app.placeholderSub": { ja: "サンプル選択 or アップロード", en: "Pick a sample or upload" },
  "app.copy": { ja: "📋 テキストをコピー", en: "📋 Copy text" },
  "app.copied": { ja: "✅ コピーしました", en: "✅ Copied" },
  "app.transcript": { ja: "📝 読み順テキスト", en: "📝 Reading-order text" },
  "app.montage": { ja: "✂️ 切り出した文字一覧", en: "✂️ Segmented characters" },
  "app.saveImg": { ja: "⬇️ 画像を保存", en: "⬇️ Save image" },
  "app.dlJson": { ja: "⬇️ 取得結果（JSON）をダウンロード", en: "⬇️ Download result (JSON)" },
  "app.companion": { ja: "🖌 筆くんの解説", en: "🖌 Fude-kun's guide" },

  // エクスポート
  "exp.title": { ja: "エクスポート", en: "Export" },
  "exp.json": { ja: "JSON", en: "JSON" },
  "exp.csv": { ja: "CSV", en: "CSV" },
  "exp.txt": { ja: "テキスト (.txt)", en: "Text (.txt)" },
  "exp.iiif": { ja: "IIIF アノテーション", en: "IIIF annotations" },
  "exp.hint": {
    ja: "JSON は box 座標・読み順・候補・修正の生データ（再学習素材にも使える形式）。CSV は表計算向け。IIIF は Web Annotation（AnnotationPage）形式です。",
    en: "JSON holds raw boxes, reading order, candidates and your corrections (reusable as training data). CSV opens in spreadsheets. IIIF is a Web Annotation (AnnotationPage).",
  },

  // 読みの修正
  "edit.title": { ja: "✏️ 読みを修正", en: "✏️ Edit reading" },
  "edit.hint": {
    ja: "画像の枠、または下の文字一覧をクリックすると、候補から読みを直せます。",
    en: "Click a box on the image or a cell in the grid below to fix the reading.",
  },
  "edit.cands": { ja: "候補（モデル出力）", en: "Candidates (model)" },
  "edit.free": { ja: "自由入力", en: "Custom" },
  "edit.apply": { ja: "反映", en: "Apply" },
  "edit.revert": { ja: "モデルの読みに戻す", en: "Revert to model" },
  "edit.prev": { ja: "前の字", en: "Prev" },
  "edit.next": { ja: "次の字", en: "Next" },
  "edit.corrected": { ja: "✏️ 修正 {n} 字", en: "✏️ {n} corrected" },

  // 共有画像
  "share.open": { ja: "📣 共有画像を作る", en: "📣 Make a share image" },
  "share.title": { ja: "📣 共有用画像（ビフォーアフター）", en: "📣 Share image (before/after)" },
  "share.save": { ja: "⬇️ 画像を保存", en: "⬇️ Save image" },
  "share.share": { ja: "共有…", en: "Share…" },
  "share.hint": {
    ja: "原本と解読結果を並べた1枚画像です。生成もブラウザ内で完結します。",
    en: "A single image pairing the original with the decoded view — generated locally in your browser.",
  },

  // クイズ
  "quiz.open": { ja: "🎮 くずし字クイズに挑戦", en: "🎮 Kuzushiji quiz" },
  "quiz.title": { ja: "くずし字クイズ", en: "Kuzushiji quiz" },
  "quiz.question": { ja: "この字はなに？", en: "What is this character?" },
  "quiz.progress": { ja: "第 {i} 問 / {n} 問", en: "Question {i} of {n}" },
  "quiz.scoreSoFar": { ja: "正解 {s}", en: "Score {s}" },
  "quiz.right": { ja: "⭕ 正解！", en: "⭕ Correct!" },
  "quiz.wrong": { ja: "❌ ざんねん… 答えは「{a}」", en: "❌ Not quite… it was “{a}”" },
  "quiz.next": { ja: "次の問題 ▶", en: "Next ▶" },
  "quiz.showResult": { ja: "結果を見る", en: "Show result" },
  "quiz.scoreLine": { ja: "{n} 問中 {s} 問正解！", en: "{s} / {n} correct!" },
  "quiz.retry": { ja: "🔁 もう一度", en: "🔁 Play again" },
  "quiz.copyResult": { ja: "📋 結果をコピー", en: "📋 Copy result" },
  "quiz.share": { ja: "共有…", en: "Share…" },
  "quiz.close": { ja: "閉じる", en: "Close" },
  "quiz.disclaimer": {
    ja: "※「正解」はAIの認識結果（修正済みを含む）です。誤りを見つけたら読みの修正で直してください。",
    en: "“Answers” come from the AI's recognition (incl. your corrections) and may contain errors.",
  },

  // IIIF
  "iiif.pages": { ja: "{t} — ページを選択（{n}ページ）", en: "{t} — choose a page ({n} pages)" },
  "iiif.hint": {
    ja: "IIIF マニフェスト（manifest.json）や info.json の URL も読み込めます。",
    en: "IIIF manifest (manifest.json) and info.json URLs are also supported.",
  },
  "iiif.more": { ja: "（最初の {n} ページを表示しています）", en: "(showing the first {n} pages)" },

  // モバイル非対応の案内画面（App レベルのガード）
  "mobile.title": { ja: "📱 スマホは非対応です", en: "📱 Not available on phones" },
  "mobile.body": {
    ja: "このアプリは検出モデルをブラウザ内に読み込んで動きます。特化モデル（YOLO）は大きく、スマホ・タブレットではメモリが足りずタブが落ちることがあるため、PC（Chrome / Edge）でご利用ください。",
    en: "This app loads detection models into your browser. The specialized YOLO models are large and can crash the tab on phones/tablets due to memory limits, so please use a PC (Chrome / Edge).",
  },
  "mobile.back": { ja: "← トップへ戻る", en: "← Back to home" },
};

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
const I18nContext = createContext<Ctx | null>(null);

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LS);
    if (saved === "ja" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && navigator.language?.startsWith("en") ? "en" : "ja";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LS, l);
    } catch {
      /* ignore */
    }
  };
  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = DICT[key]?.[lang] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n は I18nProvider の中で使ってください");
  return c;
}
