# 顔検出（face-web）

絵巻・浮世絵・近現代美人画などの資料画像から**顔をブラウザ内で検出**するデモ。
推論はすべてクライアントサイド（onnxruntime-web, WebGPU 優先 / WASM フォールバック）で、
画像はサーバに送信しない。`kuzushiji-web`（くずし字OCR）の UI / 配信基盤を流用し、
検出コアを顔検出に差し替えたもの。

公開: https://nakamura196.github.io/face-web/

## できること

- **複数の検出モデルを切り替え**て試せる（YuNet / 顔コレ YOLO / 浮世絵・混合は準備中）
- **比較モード**: 利用可能な全モデルを同時に走らせ、結果を色分けで重ね表示
- 入力: ドラッグ&ドロップ / URL / IIIF マニフェスト / 同梱サンプル
- 出力: 顔 bbox オーバーレイ、切り出し顔の一覧（モンタージュ）、JSON / CSV / IIIF アノテーション、共有画像

## モデル

| id | 種類 | 入力 | 状態 | 配信 |
|---|---|---|---|---|
| `yunet` | YuNet（写真学習・全層畳み込み） | 1280角に縮小 | ✅ 公開 | 同梱（227KB） |
| `kaokore` | YOLO11x（顔コレFT, mAP50=0.899, 単一クラス face） | 1024 letterbox | ✅ 公開 | [🤗 HF](https://huggingface.co/nakamura196/yolov11x-kaokore-face) |
| `ukiyoe` | YOLO11x（浮世絵・江戸） | — | ⏳ 準備中 | — |
| `ansample` | YOLO11x（3時代混合・アンサンブル） | — | ⏳ 準備中 | — |

モデル URL・有効化は `src/lib/config.ts` の `MODELS` を編集する。
モデルは初回 DL → IndexedDB キャッシュ（2回目以降は通信なし）。

### 推論パスの違い（重要）

- **YuNet** (`src/lib/yunet.ts`): 入力 `[1,3,H,W]`（BGR・生ピクセル）。3 stride（8/16/32）を
  `score=sqrt(cls*obj)` でデコード。元 ONNX は 640 固定入力だが、大判画像の小顔が落ちるため
  **spatial を dynamic 化した版**（`public/models/face_detection_yunet_2023mar.onnx`）を同梱し、
  1280 角で推論する。OpenCV `FaceDetectorYN` と数値一致を確認済み。
- **YOLO** (`src/lib/ort-yolo.ts`): 入力 letterbox `[b,3,imgsz,imgsz]`、出力 `[b,5,N]=(cx,cy,w,h,score)`。
  ultralytics の単一クラス検出 ONNX をそのまま使える。

`src/lib/segment.ts` が kind で振り分け、`src/worker/segment.worker.ts` が kind ごとに 1 セッションを保持する
（同 kind の別モデルを比較する場合は実行直前に載せ替え。将来複数 YOLO を比較するときはセッションを
modelId キーの registry 化する余地あり）。

## モデルの追加（YOLO .pt → ONNX）

```bash
# ultralytics で ONNX 化（dynamic 入力・単一クラス face を想定）
python3 -c "from ultralytics import YOLO; YOLO('runs/.../best.pt').export(format='onnx', dynamic=True, simplify=True, opset=12)"
# best.onnx を Hugging Face にアップロードし、config.ts の該当モデルを available:true + detect URL(HF) に
```

YuNet を別アスペクト/サイズで使う場合の spatial dynamic 化:
```python
import onnx
m = onnx.load("yunet.onnx"); d = m.graph.input[0].type.tensor_type.shape.dim
d[2].dim_param="H"; d[2].ClearField("dim_value"); d[3].dim_param="W"; d[3].ClearField("dim_value")
for o in m.graph.output: o.type.tensor_type.ClearField("shape")
onnx.save(m, "yunet_dyn.onnx")
```

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit && vite build
npm test         # vitest
```

WebGPU 対応（Chrome / Edge）推奨。WebGPU が無くても WASM で動くが遅い
（巨大な YOLO モデルはスマホでメモリ不足になり得るため PC 推奨）。

## デプロイ

`main` への push で `.github/workflows/deploy-pages.yml` が `npm run build` → GitHub Pages 公開。
`public/models/` の巨大 ONNX はコミットしない（YuNet 227KB のみ同梱、YOLO は HF 配信）。
