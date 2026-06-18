import { useEffect, useState } from "react";
import { BrushMascot } from "./Mascot";
import { useI18n } from "./i18n";
import { isMobileLike } from "./lib/device";
import { ANNOUNCEMENTS, TUTORIAL_VIDEO_ID } from "./lib/config";

const TECH_MODELS = [
  {
    name: "YuNet（顔検出・写真学習）",
    url: "https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet",
  },
  {
    name: "顔コレ YOLO（KaoKore FT・準備中）",
    url: "https://github.com/rois-codh/kaokore",
  },
  {
    name: "浮世絵 / 混合 YOLO（準備中）",
    url: "https://www.ndl.go.jp/imagebank/",
  },
];

/** YouTube はサムネ→別タブ（クロスオリジン隔離下で iframe 埋め込み不可のため）。 */
function HowtoLink({ id, label }: { id: string; label: string }) {
  return (
    <a
      className="howto-link"
      href={`https://youtu.be/${id}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="howto-thumb">
        <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
        <span className="howto-play">▶</span>
      </span>
      <span className="howto-link-cap">{label}</span>
    </a>
  );
}

/** 「使ってみる」CTA。スマホ/タブレットはメモリ不足で動かないので押せない無効表示にする。 */
function TryCta({ mobile }: { mobile: boolean }) {
  const { t } = useI18n();
  if (mobile) {
    return (
      <>
        <span className="hero-cta disabled" aria-disabled="true" role="link">
          {t("hero.ctaMobile")}
        </span>
        <p className="cta-mobile-note">{t("hero.ctaMobileNote")}</p>
      </>
    );
  }
  return <a className="hero-cta" href="#app">{t("hero.cta")}</a>;
}

/** 筆くんのあいさつ吹き出し。数秒ごとにセリフをローテーション表示。 */
const GREETS = ["mascot.greet", "mascot.greet2", "mascot.greet3", "mascot.greet4"];
function MascotGreeting() {
  const { t } = useI18n();
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % GREETS.length), 4800);
    return () => clearInterval(id);
  }, []);
  // key で吹き出しのポップイン演出を毎回やり直す
  return <div className="mascot-intro-bubble" key={i}>{t(GREETS[i])}</div>;
}

export default function Landing() {
  const { t } = useI18n();
  const mobile = isMobileLike();
  return (
    <main className="landing">
      {/* ===== Hero ===== */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-mascot">
            <BrushMascot size={150} mood="happy" delay={0.4} />
          </div>
          <h1 className="hero-title">{t("hero.title")}</h1>
          <p className="hero-tagline">{t("hero.tagline")}</p>
          <div className="hero-badges">
            <span className="hero-badge">{t("hero.badge1")}</span>
            <span className="hero-badge">{t("hero.badge2")}</span>
            <span className="hero-badge">{t("hero.badge3")}</span>
          </div>
          <div className="hero-cta-row">
            <TryCta mobile={mobile} />
          </div>
          {TUTORIAL_VIDEO_ID && (
            <div className="hero-howto">
              <HowtoLink id={TUTORIAL_VIDEO_ID} label={t("hero.howto")} />
            </div>
          )}
        </div>
      </section>

      <div className="landing-body">
        {/* ===== 特徴 ===== */}
        <section className="section">
          <h2 className="section-h">{t("feat.title")}</h2>
          <div className="feat-grid">
            <div className="feat-card">
              <div className="feat-emoji">✂️</div>
              <h3>{t("feat.1.t")}</h3>
              <p>{t("feat.1.b")}</p>
            </div>
            <div className="feat-card">
              <div className="feat-emoji">📜</div>
              <h3>{t("feat.2.t")}</h3>
              <p>{t("feat.2.b")}</p>
            </div>
            <div className="feat-card">
              <div className="feat-emoji">🔒</div>
              <h3>{t("feat.3.t")}</h3>
              <p>{t("feat.3.b")}</p>
            </div>
          </div>
        </section>

        {/* ===== マスコット紹介（筆くん） ===== */}
        <section className="section">
          <div className="mascot-intro">
            <div className="mascot-intro-fig">
              <MascotGreeting />
              <BrushMascot size={150} mood="happy" delay={0.2} />
              <span className="mascot-intro-name">{t("mascot.name")}</span>
            </div>
            <div className="mascot-intro-text">
              <h2 className="section-h">{t("mascot.title")}</h2>
              <p>{t("mascot.body")}</p>
              <a className="mascot-more" href="#mascot">{t("mascot.more")}</a>
            </div>
          </div>
        </section>

        {/* ===== お知らせ ===== */}
        {ANNOUNCEMENTS.length > 0 && (
          <section className="section">
            <h2 className="section-h">{t("news.title")}</h2>
            <ul className="news-list">
              {ANNOUNCEMENTS.map((a, i) => (
                <li key={i}>
                  <span className="news-date">{a.date}</span>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer">{a.text}</a>
                  ) : (
                    <span>{a.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ===== 謝辞・使用モデル ===== */}
        <section className="section">
          <h2 className="section-h">{t("ack.title")}</h2>
          <p className="ack-p">{t("ack.infer")}</p>

          <h3 className="tech-h">{t("ack.models")}</h3>
          <ul className="tech-models">
            {TECH_MODELS.map((m) => (
              <li key={m.url}>
                <span className="tech-mn">{m.name}</span>
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  {m.url.replace("https://huggingface.co/", "🤗 ")}
                </a>
              </li>
            ))}
          </ul>

          <h3 className="tech-h">{t("ack.credits")}</h3>
          <ul className="tech-ack">
            <li>
              <a href="https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet" target="_blank" rel="noopener noreferrer">
                <b>YuNet / OpenCV Zoo</b>
              </a>{" "}— 軽量顔検出器（写真学習）。汎用モデルとして利用。
            </li>
            <li>
              <a href="https://github.com/rois-codh/kaokore" target="_blank" rel="noopener noreferrer">
                <b>顔貌コレクション / KaoKore（CODH）</b>
              </a>{" "}— 中世絵巻・絵本の顔データセット。顔コレ検出モデルの学習データ。
            </li>
            <li>
              <a href="https://www.ndl.go.jp/imagebank/" target="_blank" rel="noopener noreferrer">
                <b>NDLイメージバンク</b>
              </a>{" "}— 近現代美人画（パブリックドメイン）。サンプル画像・近現代データ源。
            </li>
            <li>
              <a href="https://github.com/ultralytics/ultralytics" target="_blank" rel="noopener noreferrer">
                <b>Ultralytics YOLO</b>
              </a>{" "}— 特化検出モデルの学習・ONNX 化に使用。
            </li>
            <li>
              <a href="https://github.com/nakamura196/kuzushiji-web" target="_blank" rel="noopener noreferrer">
                <b>kuzushiji-web</b>
              </a>{" "}— UI・ブラウザ推論基盤を流用。
            </li>
          </ul>
        </section>

        <div className="landing-cta-bottom">
          <TryCta mobile={mobile} />
        </div>
      </div>
    </main>
  );
}
