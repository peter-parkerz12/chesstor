import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";

import {
  BOARD_SIZE_MAX,
  BOARD_SIZE_MIN,
  clampBoardSize,
  usePreferences,
} from "@/lib/settings/preferences";

type Props = {
  board: ReactNode;
  side: ReactNode;
  topBar?: ReactNode;
};

/**
 * GameLayout owns board sizing. The board honors the user's preferred
 * width when there is room, otherwise it clamps to the container width
 * and 74vh — so the side panel and controls always stay in view.
 *
 * Desktop shows a subtle corner drag handle for chess.com-style resize.
 */
export function GameLayout({ board, side, topBar }: Props) {
  const [prefs, setPrefs] = usePreferences();
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardColRef = useRef<HTMLDivElement>(null);
  const [maxAvail, setMaxAvail] = useState<number>(BOARD_SIZE_MAX);
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const pendingSizeRef = useRef<number | null>(null);

  // Track the space the board column actually has, so we clamp to it.
  useEffect(() => {
    const col = boardColRef.current;
    if (!col || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        const h = Math.floor(window.innerHeight * 0.82);
        setMaxAvail(Math.max(BOARD_SIZE_MIN, Math.min(BOARD_SIZE_MAX, Math.min(w, h))));
      }
    });
    ro.observe(col);
    return () => ro.disconnect();
  }, []);

  const desiredSize = clampBoardSize(prefs.boardSize);
  const effectiveSize = Math.min(desiredSize, maxAvail);

  const commit = useCallback(
    (next: number) => {
      pendingSizeRef.current = next;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const value = pendingSizeRef.current;
        if (value != null) setPrefs({ boardSize: clampBoardSize(value) });
      });
    },
    [setPrefs],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = effectiveSize;
      setDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "nwse-resize";

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const delta = (dx + dy) / 2;
        const next = Math.min(maxAvail, Math.max(BOARD_SIZE_MIN, startSize + delta));
        commit(next);
      };
      const up = (ev: PointerEvent) => {
        setDragging(false);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* noop */
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [commit, effectiveSize, maxAvail],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="pb-nav mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-4 sm:px-5 lg:px-8 lg:pt-8"
    >
      {topBar}
      <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div ref={boardColRef} className="flex min-w-0 items-start justify-center">
          <div
            className="relative w-full"
            style={{ maxWidth: `min(74vh, 100%, ${effectiveSize}px)` }}
          >
            {board}
            {/* Desktop-only resize handle. Hidden on touch/small screens. */}
            <button
              type="button"
              aria-label="Resize board"
              onPointerDown={onPointerDown}
              className={`absolute -bottom-2 -right-2 hidden h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/40 text-muted-foreground shadow-md backdrop-blur transition hover:text-foreground lg:flex ${
                dragging ? "cursor-nwse-resize text-gold" : "cursor-nwse-resize"
              }`}
              style={{ touchAction: "none" }}
            >
              <GripHorizontal className="h-3.5 w-3.5 rotate-45" />
            </button>
          </div>
        </div>
        <div className="min-w-0">{side}</div>
      </div>
    </div>
  );
}
