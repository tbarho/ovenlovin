import type { Transition } from "framer-motion";

/** Shared motion tokens. CSS mirrors these in :root (--motion-*). */
export const MOTION_EASE = [0.2, 0.7, 0.2, 1] as const;

export const MOTION_SECONDS = {
  fast: 0.12,
  base: 0.18,
  sheet: 0.22,
} as const;

export function presenceTransition(
  reduce: boolean | null,
  kind: "chip" | "sheet" | "toast" | "mark" = "chip"
): Transition {
  if (reduce) return { duration: 0 };
  if (kind === "sheet") return { duration: MOTION_SECONDS.sheet, ease: MOTION_EASE };
  if (kind === "toast") return { duration: MOTION_SECONDS.base, ease: MOTION_EASE };
  return { duration: MOTION_SECONDS.fast, ease: MOTION_EASE };
}
