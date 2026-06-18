/**
 * 伴奏モード: 案内役マスコットのセリフと表情を、推論状態から導出する。
 * 副作用なし(推論ロジックには一切介入しない)。テキストとmoodを返すだけ。
 */
import type { MascotMood } from "./Mascot";
import type { SegmenterState } from "./useSegmenter";

const LS = "face-web:companion";

export function getCompanionOn(): boolean {
  try {
    return localStorage.getItem(LS) !== "0"; // 既定 ON
  } catch {
    return true;
  }
}
export function setCompanionOn(on: boolean): void {
  try {
    localStorage.setItem(LS, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const mb = (b?: number) => (b ? `約${Math.round(b / 1024 / 1024)}MB` : "数十MB");

export interface CompanionLine {
  mood: MascotMood;
  line: string;
}

/** 状態(+画像の有無)から一言を決める。 */
export function companionMessage(state: SegmenterState, hasFile: boolean): CompanionLine {
  if (state.phase === "error") {
    return { mood: "sleepy", line: "おっと、つまずいちゃった。もう一度試すか、画像を変えてみてね。" };
  }
  if (state.phase === "downloading") {
    return {
      mood: "default",
      line: `顔を見つける“目”(モデル)を取り寄せ中…（${mb(state.download?.total)}・初回だけだよ）`,
    };
  }
  if (state.phase === "initializing") {
    return { mood: "default", line: "準備運動してるよ。もうすぐ！" };
  }
  if (state.phase === "running") {
    return { mood: "default", line: "いま画像の中の顔をさがしてるよ…ちょっと待ってね。" };
  }
  // ready
  if (state.results.length > 0) {
    const total = state.results.reduce((n, r) => n + r.nFaces, 0);
    if (total === 0) {
      return {
        mood: "sleepy",
        line: "うーん、顔が見つからなかった…別の画像か、別のモデルを試してみて。",
      };
    }
    if (state.results.length > 1) {
      return {
        mood: "happy",
        line: `${state.results.length}モデルで比較したよ！色ごとの枠と件数を見くらべてね。`,
      };
    }
    return {
      mood: "happy",
      line: `${state.results[0].nFaces}件の顔をみつけたよ！右の枠と、下の一覧を見てね。`,
    };
  }
  if (hasFile) {
    return { mood: "happy", line: "いい画像だね！準備できたら『顔を検出』を押してね。" };
  }
  return { mood: "happy", line: "まずは画像をえらんでね。サンプルからでも試せるよ！" };
}
