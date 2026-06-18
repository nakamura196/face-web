import { useI18n } from "./i18n";

/** 全ページ共通フッター。 */
export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <nav className="site-footer-nav">
        <a href="#">{t("nav.home")}</a>
        <span>·</span>
        <a href="#app">{t("nav.app")}</a>
        <span>·</span>
        <a href="#privacy">{t("footer.privacy")}</a>
        <span>·</span>
        <a href="https://github.com/nakamura196/face-web" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </nav>
      <p className="site-footer-credit">
        © nakamura196 ／ 顔検出・ 推論はすべてブラウザ内で実行され、画像は送信されません
      </p>
    </footer>
  );
}
