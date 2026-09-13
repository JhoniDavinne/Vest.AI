import * as React from "react";

export interface LogoProps {
  size?: number;
  tone?: "ink" | "ivory";
  withMark?: boolean;
  className?: string;
}

/** Logotipo textual elegante: VESTE.AI (ponto em terracota). */
export function Logo({ size = 22, tone = "ink", withMark = true, className }: LogoProps) {
  const color = tone === "ink" ? "#141416" : "#F7F4EF";
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.4,
        fontFamily: '"Fraunces", Georgia, serif',
        fontWeight: 600,
        letterSpacing: "0.02em",
        fontSize: size,
        lineHeight: 1,
        color,
      }}
      aria-label="VESTE.AI"
    >
      {withMark ? (
        <svg width={size * 1.1} height={size * 1.1} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M6 8.5 12 5l4 3 4-3 6 3.5-2.5 5-3.5-1.5V27h-8V12l-3.5 1.5L6 8.5Z"
            stroke={color}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="24.5" cy="24.5" r="3.5" fill="#C4623A" />
        </svg>
      ) : null}
      <span>
        VESTE<span style={{ color: "#C4623A" }}>.</span>AI
      </span>
    </span>
  );
}
