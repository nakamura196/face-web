/**
 * 筆のマスコット「筆くん」— UI のあちこちに登場させる汎用コンポーネント。
 *
 * ローディング画面 (LoadingScreen.tsx) の「字を書く」演出付き筆くんとは別に、
 * こちらは単体アイコンとして使う版 (墨を書く演出なし・ゆったり揺れる + まばたき)。
 * size(高さ px) と mood(表情) と delay(揺れの位相ずらし) を指定できる。
 *
 * gradient の id は useId で一意化し、複数個置いても干渉しないようにする。
 */
import { useId } from "react";

export type MascotMood = "default" | "happy" | "sleepy";

export function BrushMascot({
  size = 48,
  mood = "default",
  idle = true,
  delay = 0,
  className = "",
  label = "筆くん",
}: {
  size?: number;
  mood?: MascotMood;
  idle?: boolean;
  /** 揺れアニメの位相をずらす秒数 (複数個を同期させないため) */
  delay?: number;
  className?: string;
  label?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const wood = `${uid}-wood`;
  const tip = `${uid}-tip`;
  const aspect = 130 / 150;

  return (
    <svg
      className={`mascot ${className}`}
      viewBox="0 0 130 150"
      width={Math.round(size * aspect)}
      height={size}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={wood} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e9d6aa" />
          <stop offset="0.5" stopColor="#d8bf86" />
          <stop offset="1" stopColor="#c6a865" />
        </linearGradient>
        <linearGradient id={tip} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b3b42" />
          <stop offset="1" stopColor="#0c0c10" />
        </linearGradient>
      </defs>

      <g
        className={idle ? "mascot-bob" : undefined}
        style={idle && delay ? { animationDelay: `${delay}s` } : undefined}
      >
        {/* 柄 (竹) */}
        <rect x="50" y="14" width="30" height="76" rx="15" fill={`url(#${wood})`} stroke="#b8975a" strokeWidth="1.5" />
        <line x1="50" y1="40" x2="80" y2="40" stroke="#b8975a" strokeWidth="1.2" opacity="0.55" />
        <line x1="50" y1="62" x2="80" y2="62" stroke="#b8975a" strokeWidth="1.2" opacity="0.55" />
        {/* 吊り紐の輪 */}
        <path d="M65 14 q0 -9 6 -9 q7 0 7 7" fill="none" stroke="#c6a865" strokeWidth="2.5" />
        {/* 口金 */}
        <rect x="47" y="88" width="36" height="12" rx="3" fill="#d3bd95" stroke="#a98f57" strokeWidth="1" />
        {/* 穂先 */}
        <path d="M50 98 q15 7 30 0 q-2 32 -15 47 q-13 -15 -15 -47z" fill={`url(#${tip})`} />
        <path d="M62 103 q4 2 8 0 q-2 22 -4 33 q-2 -11 -4 -33z" fill="#4c4c55" opacity="0.5" />
        {/* 穂先の墨のしずく (静的) */}
        <circle cx="65" cy="146" r="2.6" fill="#1f2430" />

        {/* 顔 */}
        <Face mood={mood} />
        {/* ほっぺ */}
        <circle cx="54" cy="59" r="3" fill="#f0a9a0" opacity="0.55" />
        <circle cx="76" cy="59" r="3" fill="#f0a9a0" opacity="0.55" />
      </g>
    </svg>
  );
}

function Face({ mood }: { mood: MascotMood }) {
  if (mood === "happy") {
    return (
      <>
        {/* ＾ ＾ のうれしい目 */}
        <path d="M56 53 q4 -5 8 0" fill="none" stroke="#23262e" strokeWidth="2" strokeLinecap="round" />
        <path d="M66 53 q4 -5 8 0" fill="none" stroke="#23262e" strokeWidth="2" strokeLinecap="round" />
        {/* にっこり開いた口 */}
        <path d="M60 58 q5 7 10 0 q-5 4 -10 0z" fill="#9a4d44" />
      </>
    );
  }
  if (mood === "sleepy") {
    return (
      <>
        <line x1="57" y1="53" x2="63" y2="53" stroke="#23262e" strokeWidth="2" strokeLinecap="round" />
        <line x1="67" y1="53" x2="73" y2="53" stroke="#23262e" strokeWidth="2" strokeLinecap="round" />
        <path d="M62 60 q3 2.5 6 0" fill="none" stroke="#23262e" strokeWidth="1.7" strokeLinecap="round" />
      </>
    );
  }
  // default
  return (
    <>
      <g className="mascot-eyes">
        <ellipse cx="60" cy="52" rx="3.3" ry="4.2" fill="#23262e" />
        <ellipse cx="70" cy="52" rx="3.3" ry="4.2" fill="#23262e" />
        <circle cx="61.2" cy="50.4" r="1" fill="#fff" />
        <circle cx="71.2" cy="50.4" r="1" fill="#fff" />
      </g>
      <path d="M61 59 q4 4.5 8 0" fill="none" stroke="#23262e" strokeWidth="1.7" strokeLinecap="round" />
    </>
  );
}
