import { BrushMascot } from "./Mascot";
import { useI18n } from "./i18n";

/** 「筆くんについて」ページ（SPA 内・日本語/英語）。 */
export default function MascotPage() {
  const { lang } = useI18n();
  const ja = lang === "ja";
  return (
    <main className="wrap doc">
      <a className="doc-back" href="#">{ja ? "← トップ" : "← Home"}</a>

      <div className="mascot-hero">
        <BrushMascot size={140} mood="happy" delay={0.2} />
        <h1>{ja ? "筆くんについて" : "About Fude-kun"}</h1>
        <p className="lead">
          {ja
            ? "「筆くん」は、顔検出アプリの案内役マスコットです。"
            : "Fude-kun is the guide mascot of this face-detection app."}
        </p>
      </div>

      <h2>{ja ? "名前の由来" : "About the name"}</h2>
      <p>
        {ja
          ? "絵巻や浮世絵、美人画も、もとは毛筆で描かれた絵です。その筆をそのままキャラクターにしました。だから名前は「筆くん」。穂先の墨、竹の柄、吊り紐まで、本物の筆をかたどっています。"
          : "Emaki, ukiyo-e and bijinga are all painted with a brush. We turned that brush itself into a character — hence “Fude-kun” (fude means brush). The ink tip, bamboo handle and hanging loop all mimic a real brush."}
      </p>

      <h2>{ja ? "役割" : "What he does"}</h2>
      <ul>
        <li>
          {ja
            ? "アプリ画面の左下に常駐し、操作の手順や状況をひとことで解説します。"
            : "He sits at the bottom-left of the app and gives a one-line note on each step."}
        </li>
        <li>
          {ja
            ? "吹き出しの「×」や筆くん本体のクリックで、解説の表示・非表示を切り替えられます。"
            : "Toggle his guide on/off via the bubble's “×” or by clicking him."}
        </li>
        <li>
          {ja
            ? "モデル読み込み中の画面では、資料の中から顔をさがす様子を演じます。"
            : "While models load, he acts out searching for faces in the image."}
        </li>
      </ul>

      <h2>{ja ? "表情" : "Moods"}</h2>
      <p>
        {ja
          ? "状況に応じて表情が変わります。準備完了や検出成功はうれしい顔、エラーや文字なしは眠そうな顔に。"
          : "His face changes with the situation — happy when ready or on success, sleepy on errors or when nothing is found."}
      </p>
      <div className="mascot-moods">
        <figure>
          <BrushMascot size={84} mood="default" delay={0.1} />
          <figcaption>{ja ? "ふつう" : "Default"}</figcaption>
        </figure>
        <figure>
          <BrushMascot size={84} mood="happy" delay={0.5} />
          <figcaption>{ja ? "うれしい" : "Happy"}</figcaption>
        </figure>
        <figure>
          <BrushMascot size={84} mood="sleepy" delay={0.9} />
          <figcaption>{ja ? "ねむい" : "Sleepy"}</figcaption>
        </figure>
      </div>

      <h2>{ja ? "デザイン" : "Design"}</h2>
      <p>
        {ja
          ? "筆くんはすべて SVG で描かれ、画像ファイルを使いません。色は本サイトの基調色（UTokyo ブルー）に合わせています。アニメーションも含めてブラウザ内で完結し、軽量です。"
          : "Fude-kun is drawn entirely in SVG — no image files. His colors follow this site's accent (UTokyo Blue), and everything, including the animation, runs lightweight in your browser."}
      </p>

      <p className="mascot-back-cta">
        <a className="hero-cta" href="#app">{ja ? "▶ アプリを使ってみる" : "▶ Try the app"}</a>
      </p>
    </main>
  );
}
