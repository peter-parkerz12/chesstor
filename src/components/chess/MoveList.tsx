import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Undo2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { GlassPanel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** SAN history of all played plies. */
  history: string[];
  /** Currently displayed ply (0-indexed). -1 = initial position. */
  currentPly: number;
  /** True if the board is showing a past position (review). */
  reviewing: boolean;
  onJump?: (ply: number) => void;
  onReturnLive?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  /** Hide undo button entirely. */
  hideUndo?: boolean;
};

export function MoveList({
  history,
  currentPly,
  reviewing,
  onJump,
  onReturnLive,
  onUndo,
  canUndo,
  hideUndo,
}: Props) {
  const pairs = useMemo(() => {
    const out: Array<{ n: number; white?: string; black?: string; wPly: number; bPly?: number }> =
      [];
    for (let i = 0; i < history.length; i += 2) {
      out.push({
        n: i / 2 + 1,
        white: history[i],
        black: history[i + 1],
        wPly: i,
        bPly: i + 1 < history.length ? i + 1 : undefined,
      });
    }
    return out;
  }, [history]);

  // Mobile collapsible — default closed below md.
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    setOpen(!mq.matches);
  }, []);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll active move into view.
    const active = el.querySelector<HTMLElement>("[data-active=\"true\"]");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  }, [currentPly, history.length]);

  return (
    <GlassPanel className="!p-0">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Moves
          </h4>
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {history.length}
          </span>
          {reviewing && (
            <button
              type="button"
              onClick={onReturnLive}
              className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold ring-1 ring-gold/30 transition hover:bg-gold/20"
            >
              Return to live
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!hideUndo && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onUndo}
              disabled={!canUndo}
              className="h-8 px-2 text-xs"
              title="Undo last move"
              aria-label="Undo last move"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-foreground lg:hidden"
            aria-label={open ? "Collapse move list" : "Expand move list"}
            aria-expanded={open}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "rotate-0")}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="no-scrollbar max-h-[min(46vh,18rem)] overflow-y-auto px-4 pb-4 pt-1"
            >
              {pairs.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No moves yet.</p>
              ) : (
                <ol className="space-y-0.5 font-mono text-sm">
                  {pairs.map((p) => (
                    <li
                      key={p.n}
                      className="grid grid-cols-[2.25rem_1fr_1fr] items-center gap-1.5"
                    >
                      <span className="text-xs text-muted-foreground tabular-nums">{p.n}.</span>
                      <MoveCell
                        san={p.white}
                        ply={p.wPly}
                        active={currentPly === p.wPly}
                        onJump={onJump}
                      />
                      <MoveCell
                        san={p.black}
                        ply={p.bPly}
                        active={p.bPly !== undefined && currentPly === p.bPly}
                        onJump={onJump}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassPanel>
  );
}

function MoveCell({
  san,
  ply,
  active,
  onJump,
}: {
  san?: string;
  ply?: number;
  active: boolean;
  onJump?: (ply: number) => void;
}) {
  if (!san || ply === undefined) return <span className="text-muted-foreground/40">—</span>;
  return (
    <button
      type="button"
      data-active={active || undefined}
      onClick={() => onJump?.(ply)}
      className={cn(
        "truncate rounded-md px-1.5 py-0.5 text-left transition-colors",
        active
          ? "bg-gold/15 text-gold ring-1 ring-gold/30"
          : "text-foreground/90 hover:bg-white/5 hover:text-foreground",
      )}
    >
      {san}
    </button>
  );
}
