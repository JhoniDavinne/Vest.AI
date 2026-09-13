"use client";

import { motion } from "framer-motion";
import { cn, formatScore, SCORE_TONE_COLOR, scoreTone } from "@/lib/utils";

export function ScoreRing({
  score,
  size = 168,
  stroke = 10,
  label = "/ 10",
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(10, score)) / 10;
  const color = SCORE_TONE_COLOR[scoreTone(score)];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--mist)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display font-medium leading-none"
          style={{ fontSize: size * 0.3 }}
        >
          {formatScore(score)}
        </motion.span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.16em] text-stone">{label}</span>
      </div>
    </div>
  );
}
