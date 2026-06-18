import { useI18n } from "./i18n";

/** プライバシーポリシー (SPA 内ページ)。日本語/英語。 */
export default function PrivacyPage() {
  const { lang } = useI18n();
  const ja = lang === "ja";
  return (
    <main className="wrap doc">
      <a className="doc-back" href="#">{ja ? "← トップ" : "← Home"}</a>
      <h1>{ja ? "プライバシーポリシー" : "Privacy Policy"}</h1>
      <p className="lead">
        {ja
          ? "顔検出（以下「本サービス」）における利用者情報の取り扱いについて、以下のとおり定めます。"
          : "This page describes how the face-detection app (the “Service”) handles user information."}
      </p>

      <div className="doc-highlight">
        <strong>{ja ? "画像と推論について（重要）" : "Images & inference (important)"}</strong>
        <br />
        {ja
          ? "本サービスは、顔検出をすべて利用者のブラウザ内で処理します。アップロードした画像や検出結果を外部サーバに送信・保存することはありません。モデルは Hugging Face / jsDelivr から取得しブラウザ内にキャッシュしますが、これはモデルのダウンロードのみで、利用者の画像は送信されません。"
          : "All face detection runs entirely in your browser. Uploaded images and results are never sent to or stored on any server. Models are fetched from Hugging Face / jsDelivr and cached locally; only the model files are downloaded — your images are never transmitted."}
      </div>

      <h2>{ja ? "アクセス解析（Google Analytics）" : "Analytics (Google Analytics)"}</h2>
      <p>
        {ja
          ? "本サービスは利用状況の把握と改善のため Google Analytics 4 を使用します。Cookie を利用しますが、個人を特定する情報や、利用者がアップロードした画像は含まれません。"
          : "The Service uses Google Analytics 4 to understand usage and improve. It uses cookies but does not collect personally identifying information, nor any uploaded images."}
      </p>

      <h2>{ja ? "外部送信について" : "Data sent externally"}</h2>
      <ul>
        <li>
          {ja
            ? "Google LLC（アクセス解析）：閲覧ページ・参照元・匿名化IP・端末/ブラウザ種別・おおよその地域など。"
            : "Google LLC (analytics): pages viewed, referrer, anonymized IP, device/browser type, approximate region, etc."}
        </li>
        <li>
          {ja
            ? "Hugging Face / jsDelivr（モデル配信）：モデルファイル取得のための通常の HTTP リクエスト（取得のみ・画像は送信しません）。"
            : "Hugging Face / jsDelivr (model hosting): standard HTTP requests to download model files (download only — no images sent)."}
        </li>
        <li>
          {ja
            ? "画像プロキシ images.weserv.nl（任意・URL入力時のみ）：CORS 非対応サイトの「公開画像URL」を入力した場合に限り、その公開URLをプロキシ経由で取得します（利用者がアップロードした画像は対象外）。"
            : "Image proxy images.weserv.nl (optional, URL input only): only when you enter a public image URL from a non-CORS site is that public URL fetched via the proxy (your uploaded images are never involved)."}
        </li>
      </ul>
      <p>
        {ja ? "Google の取り扱い：" : "Google’s handling: "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          {ja ? "Google プライバシーポリシー" : "Google Privacy Policy"}
        </a>
      </p>

      <h2>{ja ? "オプトアウト" : "Opt-out"}</h2>
      <p>
        {ja ? "ブラウザの Cookie 無効化、または " : "Disable cookies in your browser, or use the "}
        <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">
          {ja ? "Google アナリティクス オプトアウト アドオン" : "Google Analytics Opt-out Add-on"}
        </a>
        {ja ? " で収集を無効化できます。" : "."}
      </p>

      <h2>{ja ? "お問い合わせ" : "Contact"}</h2>
      <p>
        <a href="https://github.com/nakamura196" target="_blank" rel="noopener noreferrer">
          GitHub（@nakamura196）
        </a>
      </p>

      <p className="doc-date">{ja ? "制定日：2026年6月10日" : "Effective: 2026-06-10"}</p>
    </main>
  );
}
