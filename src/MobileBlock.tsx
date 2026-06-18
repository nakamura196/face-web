import { BrushMascot } from "./Mascot";
import { useI18n } from "./i18n";

/**
 * モバイル非対応の案内画面。約218MB のモデルを端末メモリに載せるため
 * スマホ・タブレットではタブが落ちる。#app への全入口（CTA・ナビ・直接URL）が
 * ここに着地し、クラッシュさせる代わりに理由を提示して PC 利用を促す。
 */
export default function MobileBlock() {
  const { t } = useI18n();
  return (
    <main className="wrap mobile-block">
      <BrushMascot size={120} mood="sleepy" delay={0.2} />
      <h1>{t("mobile.title")}</h1>
      <p>{t("mobile.body")}</p>
      <a className="hero-cta" href="#">{t("mobile.back")}</a>
    </main>
  );
}
