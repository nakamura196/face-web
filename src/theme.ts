/** ライト/ダーク/自動のテーマ切替。<html data-theme> で制御し localStorage に保存。 */
export type Theme = "light" | "dark" | "auto";
const LS = "kuzushiji-web:theme";

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(LS);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function applyTheme(t: Theme): void {
  const el = document.documentElement;
  if (t === "auto") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
  try {
    localStorage.setItem(LS, t);
  } catch {
    /* ignore */
  }
}
