"use client";

import { type ReactNode, useRef, useState } from "react";

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  maxTiltDeg?: number;
  glareColor?: string;
}

/**
 * Lightweight 60fps CSS 3D perspective card with cursor-tracked specular sheen.
 * Respects `prefers-reduced-motion` cleanly via CSS + guarded transforms.
 */
export function Tilt3DCard({
  children,
  className = "",
  maxTiltDeg = 6,
  glareColor = "rgba(56, 97, 251, 0.16)",
}: Tilt3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState(
    "perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)"
  );
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * (maxTiltDeg * 2);
    const rotateX = (0.5 - py) * (maxTiltDeg * 2);

    setTransform(
      `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.008, 1.008, 1.008)`
    );
    setGlare({ x: px * 100, y: py * 100, opacity: 1 });
  }

  function handleMouseLeave() {
    setTransform("perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform,
        transformStyle: "preserve-3d",
        transition: glare.opacity
          ? "transform 110ms cubic-bezier(0.22, 1, 0.36, 1)"
          : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
      className={`relative will-change-transform ${className}`}
    >
      {/* Dynamic cursor-tracking specular glass sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(420px circle at ${glare.x}% ${glare.y}%, ${glareColor}, transparent 68%)`,
        }}
      />
      {children}
    </div>
  );
}
