/**
 * 顔検出結果のエクスポート整形。
 *  - toCSV            : 1 box = 1 行の CSV (Excel 互換 BOM 付き)
 *  - toJSONExport     : 生データ JSON (schemaVersion 付き)
 *  - toIIIFAnnotations: W3C Web Annotation (IIIF Presentation 3 AnnotationPage)
 */
import type { DetectResult } from "./types";

/** JSON エクスポートの版。フィールドを変えたら上げる。 */
export const EXPORT_SCHEMA_VERSION = "face-1.0";
const APP_URL = "https://nakamura196.github.io/face-web/";

function orderOf(result: DetectResult): number[] {
  return result.order.length ? result.order : result.boxes.map((_, i) => i);
}

function csvEscape(v: string | number | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 1 box = 1 行の CSV。order は表示順 (0 始まり)、index は boxes 配列の添字。 */
export function toCSV(result: DetectResult): string {
  const head = ["order", "index", "x1", "y1", "x2", "y2", "w", "h", "conf"];
  const rows = [head.join(",")];
  orderOf(result).forEach((idx, ord) => {
    const b = result.boxes[idx];
    const [x1, y1, x2, y2] = b.xyxy;
    rows.push(
      [ord, idx, x1, y1, x2, y2, Math.round((x2 - x1) * 100) / 100, Math.round((y2 - y1) * 100) / 100, b.conf]
        .map(csvEscape)
        .join(","),
    );
  });
  // BOM 付き: Excel でそのまま開いても文字化けしない
  return "\uFEFF" + rows.join("\n") + "\n";
}

export interface ExportMeta {
  modelId: string;
  modelName: string;
  /** 画像の出所 (ファイル名 or URL or IIIF canvas id) */
  source?: string | null;
}

/** 生データ JSON。 */
export function toJSONExport(
  result: DetectResult & { elapsedMs?: number },
  meta: ExportMeta,
): string {
  const data = {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    app: { name: "face-web", url: APP_URL },
    source: meta.source ?? null,
    model: { id: meta.modelId, name: meta.modelName },
    imageSize: result.imageSize,
    method: result.method,
    nFaces: result.nFaces,
    elapsedMs: result.elapsedMs,
    order: result.order,
    boxes: result.boxes,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * W3C Web Annotation (IIIF Presentation API 3 の AnnotationPage)。
 * 各顔を `#xywh=` フラグメントで対象画像に紐づける。source には
 * IIIF canvas id (あれば) か画像 URL/ファイル名を入れる。
 */
export function toIIIFAnnotations(result: DetectResult, source: string): string {
  const items = orderOf(result).map((idx, ord) => {
    const b = result.boxes[idx];
    const [x1, y1, x2, y2] = b.xyxy;
    return {
      id: `${APP_URL}annotation/${ord}`,
      type: "Annotation",
      motivation: "tagging",
      generator: { id: APP_URL, type: "Software", name: "face-web" },
      body: [
        { type: "TextualBody", value: "face", format: "text/plain", purpose: "tagging" },
        { type: "TextualBody", value: b.conf.toFixed(4), format: "text/plain", purpose: "assessing" },
      ],
      target: {
        source,
        selector: {
          type: "FragmentSelector",
          conformsTo: "http://www.w3.org/TR/media-frags/",
          value: `xywh=${Math.round(x1)},${Math.round(y1)},${Math.round(x2 - x1)},${Math.round(y2 - y1)}`,
        },
      },
    };
  });
  const page = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: `${APP_URL}annotations`,
    type: "AnnotationPage",
    items,
  };
  return JSON.stringify(page, null, 2);
}
