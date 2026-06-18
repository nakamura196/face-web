/**
 * IIIF 対応: Presentation API (v2/v3) マニフェストと Image API info.json を解釈し、
 * ページ (canvas) ごとの取得用画像 URL とサムネイル URL を返す。
 *
 * 国会図書館デジタルコレクション・国文研・各大学図書館など IIIF 公開機関の
 * マニフェスト URL を貼るだけで認識にかけられるようにするための薄いパーサ。
 * 仕様の全域はカバーせず、実際の公開マニフェストでよく見る形に対応する。
 */

export interface IiifPage {
  /** canvas id (アノテーションの target に使う) */
  id: string;
  label: string;
  /** フル解像度の画像 URL */
  imageUrl: string;
  /** 一覧表示用サムネイル URL */
  thumbUrl: string;
}

export interface IiifDoc {
  label: string;
  pages: IiifPage[];
}

/** JSON らしい URL か (fetch 前の軽い判定。外れても content-type で再判定する)。 */
export function looksLikeIiifUrl(u: string): boolean {
  return /\.json(\?|$)/.test(u) || /\/(manifest|info\.json)(\?|$)/.test(u);
}

type J = Record<string, unknown>;
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** v2 ("ja"/"en" 不問の文字列 or {"@value"}) / v3 ({lang: [..]}) のラベルを平文に。 */
function readLabel(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return readLabel(v[0]);
  if (v && typeof v === "object") {
    const o = v as J;
    if (typeof o["@value"] === "string") return o["@value"];
    for (const k of ["ja", "en", "none"]) {
      const a = o[k];
      if (Array.isArray(a) && a.length) return String(a[0]);
    }
    const first = Object.values(o)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
  }
  return "";
}

/** Image API service の id とバージョン (v2/v3) を取り出す。 */
function readService(v: unknown): { id: string; v3: boolean } | null {
  for (const s of asArray(v)) {
    if (!s || typeof s !== "object") continue;
    const o = s as J;
    const id = (o["@id"] ?? o.id) as string | undefined;
    if (!id) continue;
    const type = String(o["@type"] ?? o.type ?? "");
    const ctx = String(o["@context"] ?? "");
    const profile = JSON.stringify(o.profile ?? "");
    const v3 = type.includes("ImageService3") || ctx.includes("/image/3/") || profile.includes("level") && ctx.includes("image/3");
    return { id: id.replace(/\/$/, ""), v3 };
  }
  return null;
}

function serviceUrls(svc: { id: string; v3: boolean }): { imageUrl: string; thumbUrl: string } {
  const size = svc.v3 ? "max" : "full";
  return {
    imageUrl: `${svc.id}/full/${size}/0/default.jpg`,
    thumbUrl: `${svc.id}/full/,160/0/default.jpg`,
  };
}

/** v3: canvas → items(AnnotationPage) → items(Annotation painting) → body */
function pageFromV3Canvas(c: J, fallbackLabel: string): IiifPage | null {
  const id = String(c.id ?? "");
  for (const ap of asArray(c.items)) {
    for (const an of asArray((ap as J)?.items)) {
      const body = asArray((an as J)?.body)[0] as J | undefined;
      if (!body) continue;
      const svc = readService(body.service);
      const direct = String(body.id ?? "");
      const urls = svc ? serviceUrls(svc) : { imageUrl: direct, thumbUrl: direct };
      if (!urls.imageUrl) continue;
      return { id, label: readLabel(c.label) || fallbackLabel, ...urls };
    }
  }
  return null;
}

/** v2: canvas → images[0].resource */
function pageFromV2Canvas(c: J, fallbackLabel: string): IiifPage | null {
  const id = String(c["@id"] ?? c.id ?? "");
  const img = asArray(c.images)[0] as J | undefined;
  const res = img?.resource as J | undefined;
  if (!res) return null;
  const svc = readService(res.service);
  const direct = String(res["@id"] ?? "");
  const urls = svc ? serviceUrls(svc) : { imageUrl: direct, thumbUrl: direct };
  if (!urls.imageUrl) return null;
  return { id, label: readLabel(c.label) || fallbackLabel, ...urls };
}

/**
 * IIIF の JSON (マニフェスト or info.json) を解釈する。
 * 対応外の形は null (呼び出し側で「IIIF として読めなかった」扱い)。
 */
export function parseIiif(json: unknown): IiifDoc | null {
  if (!json || typeof json !== "object") return null;
  const o = json as J;
  const ctx = String(o["@context"] ?? "");
  const type = String(o["@type"] ?? o.type ?? "");

  // Image API info.json: それ自体が 1 画像のサービス
  if (ctx.includes("/api/image/") && (o["@id"] || o.id)) {
    const svc = readService([o]);
    if (!svc) return null;
    const urls = serviceUrls({ ...svc, v3: ctx.includes("/image/3/") });
    return { label: "IIIF image", pages: [{ id: svc.id, label: "1", ...urls }] };
  }

  // Presentation v3
  if (type === "Manifest" && Array.isArray(o.items)) {
    const pages = (o.items as J[])
      .map((c, i) => pageFromV3Canvas(c, String(i + 1)))
      .filter((p): p is IiifPage => p !== null);
    return pages.length ? { label: readLabel(o.label), pages } : null;
  }

  // Presentation v2
  if (type === "sc:Manifest" || Array.isArray(o.sequences)) {
    const seq = asArray(o.sequences)[0] as J | undefined;
    const canvases = asArray(seq?.canvases) as J[];
    const pages = canvases
      .map((c, i) => pageFromV2Canvas(c, String(i + 1)))
      .filter((p): p is IiifPage => p !== null);
    return pages.length ? { label: readLabel(o.label), pages } : null;
  }

  // v3 Collection 等は対応外
  return null;
}
