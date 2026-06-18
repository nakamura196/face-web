import { describe, expect, it } from "vitest";
import { nms } from "./ort-yolo";
import type { Box } from "./types";

const box = (xyxy: Box["xyxy"], conf: number): Box => ({ xyxy, conf });

describe("nms (クラス非依存 greedy)", () => {
  it("高 IoU の重複は確信度が高い方を残す", () => {
    const boxes = [
      box([0, 0, 10, 10], 0.9), // A
      box([1, 1, 11, 11], 0.5), // A とほぼ重なる(低conf)
      box([100, 100, 110, 110], 0.8), // 離れた別 box
    ];
    const kept = nms(boxes, 0.5);
    expect(kept).toHaveLength(2);
    expect(kept[0].conf).toBe(0.9); // conf 降順で先頭
    expect(kept.map((b) => b.xyxy[0]).sort((a, b) => a - b)).toEqual([0, 100]);
  });

  it("重ならない box はすべて残る", () => {
    const boxes = [box([0, 0, 10, 10], 0.9), box([20, 20, 30, 30], 0.8)];
    expect(nms(boxes, 0.5)).toHaveLength(2);
  });

  it("maxDet で打ち切る", () => {
    const boxes = Array.from({ length: 5 }, (_, i) =>
      box([i * 100, 0, i * 100 + 10, 10], 1 - i * 0.1),
    );
    expect(nms(boxes, 0.5, 3)).toHaveLength(3);
  });
});
