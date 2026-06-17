// Centralized anime.js helpers.
// Anime.js v4 ESM API.
import { animate, createTimeline, stagger, eases, type AnimationParams } from "animejs";

export { animate, createTimeline, stagger, eases };

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Run animation respecting reduced-motion (snap to final state instead). */
export function motionSafe<T extends Element | Element[] | NodeListOf<Element> | string>(
  targets: T,
  params: AnimationParams,
) {
  if (prefersReducedMotion()) {
    return animate(targets, { ...params, duration: 0.01 });
  }
  return animate(targets, params);
}

/** Apple-style spring-ish ease (cubic-bezier 0.22,1,0.36,1) — for entrances. */
export const easeEntry = "cubicBezier(0.22, 1, 0.36, 1)";
/** Smooth exit — material-like accelerate. */
export const easeExit = "cubicBezier(0.4, 0, 1, 1)";
