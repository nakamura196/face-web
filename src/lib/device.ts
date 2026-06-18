/**
 * 端末判定。スマホ/タブレットは 218MB の FP32 モデルを load する瞬間に
 * メモリ不足でタブごと落ちやすい（iOS Safari のタブ単位メモリ上限）。
 * 実行はブロックせず、PC 推奨の注意バナーを出すための判定に使う。
 */
export function isMobileLike(): boolean {
  if (typeof navigator === "undefined") return false;
  // Client Hints が使える環境（Chromium 系）はこれが最も正確
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPod|Mobile|Silk|Kindle/i.test(ua)) return true;
  // iPadOS 13+ は Mac を詐称するので touch points で拾う
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}
