import { useState } from "react";
import { BrushMascot } from "./Mascot";
import { useI18n } from "./i18n";
import { getTheme, applyTheme, type Theme } from "./theme";

export function Header({ view }: { view: "home" | "app" | "privacy" | "mascot" }) {
  const { lang, setLang, t } = useI18n();
  const [theme, setTheme] = useState<Theme>(getTheme());

  function cycleTheme() {
    const next: Theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    setTheme(next);
    applyTheme(next);
  }
  const themeIcon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🌓";

  const navA = (id: "home" | "app" | "privacy", href: string, label: string) => (
    <a className={view === id ? "nav-a sel" : "nav-a"} href={href}>{label}</a>
  );

  return (
    <header className="appbar">
      <div className="appbar-inner">
        <a className="appbar-brand" href="#">
          <BrushMascot size={26} delay={0.1} label="筆くん" />
          {t("hero.title")}
        </a>
        <nav className="nav">
          {navA("home", "#", t("nav.home"))}
          {navA("app", "#app", t("nav.app"))}
          {navA("privacy", "#privacy", t("nav.privacy"))}
        </nav>
        <div className="appbar-right">
          <button className="icon-btn" onClick={cycleTheme} title={t("header.theme")} aria-label={t("header.theme")}>
            {themeIcon}
          </button>
          <button
            className="icon-btn lang"
            onClick={() => setLang(lang === "ja" ? "en" : "ja")}
            aria-label="Switch language"
          >
            {lang === "ja" ? "EN" : "日本語"}
          </button>
        </div>
      </div>
    </header>
  );
}
