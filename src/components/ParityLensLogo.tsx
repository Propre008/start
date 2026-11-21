"use client";

import { useId } from "react";

interface ParityLensLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 26, text: "text-sm" },
  md: { box: 32, text: "text-base" },
  lg: { box: 38, text: "text-lg" },
};

/**
 * Custom geometric ParityLens optical aperture & parity-prism brand mark.
 * Represents competing issuer rails converging onto a calibrated gold equilibrium axis.
 */
export function ParityLensLogo({
  size = "md",
  showWordmark = true,
  className = "",
}: ParityLensLogoProps) {
  const uid = useId().replace(/:/g, "");
  const dim = SIZE_MAP[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={dim.box}
        height={dim.box}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="shrink-0 drop-shadow-[0_2px_10px_rgba(56,97,251,0.35)]"
      >
        <defs>
          <linearGradient id={`${uid}-bg`} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1B2542" />
            <stop offset="100%" stopColor="#0C1322" />
          </linearGradient>
          <linearGradient id={`${uid}-ring`} x1="10" y1="10" x2="54" y2="54" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3861FB" />
            <stop offset="55%" stopColor="#13B2CF" />
            <stop offset="100%" stopColor="#F3BA2F" />
          </linearGradient>
          <linearGradient id={`${uid}-axis`} x1="16" y1="32" x2="48" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6188FF" />
            <stop offset="50%" stopColor="#F3BA2F" />
            <stop offset="100%" stopColor="#16C784" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="16"
          fill={`url(#${uid}-bg)`}
          stroke="rgba(97, 136, 255, 0.35)"
          strokeWidth="2"
        />
        <circle
          cx="32"
          cy="32"
          r="20"
          stroke={`url(#${uid}-ring)`}
          strokeWidth="3.2"
          strokeOpacity="0.95"
        />
        {/* Upper competing issuer rail */}
        <path d="M18 24.5H39.5" stroke="#6188FF" strokeWidth="3" strokeLinecap="round" />
        {/* Lower competing issuer rail */}
        <path d="M24.5 39.5H46" stroke="#16C784" strokeWidth="3" strokeLinecap="round" />
        {/* Calibrated zero-parity axis */}
        <path
          d="M16 32H48"
          stroke={`url(#${uid}-axis)`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="2 3"
        />
        {/* Central equilibrium prism */}
        <polygon points="32,26.2 37.8,32 32,37.8 26.2,32" fill="#F3BA2F" />
        <circle cx="32" cy="32" r="2.1" fill="#0B111E" />
      </svg>

      {showWordmark && (
        <span className={`font-semibold tracking-tight text-white ${dim.text}`}>
          Parity<span className="text-[#F3BA2F]">Lens</span>
        </span>
      )}
    </span>
  );
}
