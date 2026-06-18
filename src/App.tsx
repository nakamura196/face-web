import { useEffect, useState } from "react";
import { I18nProvider } from "./i18n";
import { Header } from "./Header";
import { Footer } from "./Footer";
import Landing from "./Landing";
import Segmenter from "./Segmenter";
import PrivacyPage from "./PrivacyPage";
import MascotPage from "./MascotPage";
import MobileBlock from "./MobileBlock";
import { isMobileLike } from "./lib/device";

type View = "home" | "app" | "privacy" | "mascot";

function readView(): View {
  const h = location.hash.replace(/^#/, "");
  if (h === "app") return "app";
  if (h === "privacy") return "privacy";
  if (h === "mascot") return "mascot";
  return "home";
}

export default function App() {
  const [view, setView] = useState<View>(readView);
  // スマホ/タブレットは 218MB モデルでメモリ不足→タブ落ちするため #app には入れない。
  const mobile = isMobileLike();

  useEffect(() => {
    const on = () => setView(readView());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // ビューが切り替わった時だけ先頭へ (ページ内 #howto 等のアンカーは妨げない)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  return (
    <I18nProvider>
      <Header view={view} />
      {view === "app"
        ? mobile
          ? <MobileBlock />
          : <Segmenter />
        : view === "privacy" ? <PrivacyPage />
        : view === "mascot" ? <MascotPage />
        : <Landing />}
      <Footer />
    </I18nProvider>
  );
}
