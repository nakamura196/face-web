export interface Box {
  /** [x1, y1, x2, y2] in original image pixel coordinates */
  xyxy: [number, number, number, number];
  conf: number;
}

export type Method = "baseline" | "SAHI";
export type Mode = "auto" | "baseline" | "SAHI";

/** 顔検出の結果 (1 画像ぶん)。 */
export interface DetectResult {
  imageSize: { width: number; height: number };
  /** 検出手法 (YuNet は常に baseline。YOLO で大判時に SAHI を選ぶ余地) */
  method: Method;
  methodSelection: "自動判定" | "手動選択";
  /** 検出した顔の数 (= boxes.length) */
  nFaces: number;
  boxes: Box[];
  /** 表示順 (上→下・左→右) に並べた boxes の index 配列 */
  order: number[];
  /** 使用した検出モデル */
  modelId: string;
  modelName: string;
}
