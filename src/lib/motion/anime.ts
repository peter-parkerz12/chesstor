// Centralized anime.js helpers.
import { animate, createTimeline, stagger } from "animejs";

export { animate, createTimeline, stagger };

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Apple-style cubic-bezier — soft entrance ease. */
export const easeEntry = "cubicBezier(0.22, 1, 0.36, 1)";
/** Quick accelerate — exits. */
export const easeExit = "cubicBezier(0.4, 0, 1, 1)";
