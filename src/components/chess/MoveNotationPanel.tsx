import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "missed_win"
  | "missed_tactic";

export const CLASSIFICATION_META: Record<
  MoveClassification,
  { label: string; icon: string; bg: string; text: string; border: string }
> = {
  brilliant: { label: "Brilliant", icon: "💎", bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30" },
  great: { label: "Great", icon: "⭐", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  best: { label: "Best", icon: "✅", bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  excellent: { label: "Excellent", icon: "🟢", bg: "bg-emerald-600/10", text: "text-emerald-500", border: "border-emerald-600/30" },
  good: { label: "Good", icon: "🔵", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  inaccuracy: { label: "Inaccuracy", icon: "🟡", bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  mistake: { label: "Mistake", icon: "🟠", bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  blunder: { label: "Blunder", icon: "🔴", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  missed_win: { label: "Missed Win", icon: "⚫", bg: "bg-neutral-800", text: "text-neutral-300", border: "border-neutral-700" },
  missed_tactic: { label: "Missed Tactic", icon: "⚠️", bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30" },
};

type Props = {
  /** Array of moves in SAN format */
  moves: string[];
  /** Index of currently displayed move (-1 = starting board position) */
  selectedMoveIndex: number;
  /** Callback when user clicks/taps a move */
  onSelectMove: (index: number) => void;
  /** Optional dictionary mapping move index to Stockfish classification */
  classifications?: Record<number, MoveClassification>;
  /** Whether notation is rendered during active gameplay (shows navigation warning / resume button) */
  liveGame?: boolean;
  className?: string;
};

export function MoveNotationPanel({
  moves,
  selectedMoveIndex,
  onSelectMove,
  classifications = {},
  liveGame = false,
  className,
}: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to selected move
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedMoveIndex]);

  const totalMoves = moves.length;
  const isLatest = selectedMoveIndex === totalMoves - 1;

  // Group moves into white/black pairs
  const movePairs: Array<{
    moveNumber: number;
    whiteIndex: number;
    whiteSAN: string;
    blackIndex?: number;
    blackSAN?: string;
  }> = [];

  for (let i = 0; i < totalMoves; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      whiteIndex: i,
      whiteSAN: moves[i],
      blackIndex: i + 1 < totalMoves ? i + 1 : undefined,
      blackSAN: i + 1 < totalMoves ? moves[i + 1] : undefined,
    });
  }

  // Navigation helpers
  const handleFirst = () => onSelectMove(-1);
  const handlePrev = () => onSelectMove(Math.max(-1, selectedMoveIndex - 1));
  const handleNext = () => onSelectMove(Math.min(totalMoves - 1, selectedMoveIndex + 1));
  const handleLast = () => onSelectMove(totalMoves - 1);

  return (
    <div className={cn("flex h-full flex-col rounded-2xl bg-surface-2/40 border border-white/5 shadow-clay-sm p-4", className)}>
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live Move List</h4>
        {liveGame && !isLatest && totalMoves > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleLast}
            className="h-6 gap-1 rounded-full border-gold/30 bg-gold/10 px-2.5 text-[10px] font-semibold text-gold hover:bg-gold/20"
          >
            <Play className="h-2.5 w-2.5 fill-gold" />
            Live
          </Button>
        )}
      </div>

      {/* Move list body */}
      <div
        ref={containerRef}
        className="mt-3 flex-1 overflow-y-auto no-scrollbar space-y-1.5 min-h-[160px] max-h-[280px] lg:max-h-[380px]"
      >
        {totalMoves === 0 ? (
          <div className="flex h-full items-center justify-center py-8 text-center text-xs text-muted-foreground">
            No moves played yet.
          </div>
        ) : (
          movePairs.map((pair) => {
            const isWhiteActive = selectedMoveIndex === pair.whiteIndex;
            const isBlackActive = pair.blackIndex !== undefined && selectedMoveIndex === pair.blackIndex;

            const whiteClass = classifications[pair.whiteIndex];
            const blackClass = pair.blackIndex !== undefined ? classifications[pair.blackIndex] : undefined;

            return (
              <div key={pair.moveNumber} className="grid grid-cols-[2.5rem_1fr_1fr] gap-2 px-2 py-1 items-center hover:bg-white/[0.02] rounded-lg">
                <span className="font-mono text-xs text-muted-foreground/60">{pair.moveNumber}.</span>
                
                {/* White Move Button */}
                <button
                  ref={isWhiteActive ? activeRef : null}
                  onClick={() => onSelectMove(pair.whiteIndex)}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1 text-left font-mono text-xs font-medium transition-all",
                    isWhiteActive
                      ? "bg-gold/15 text-gold font-bold shadow-[inset_0_0_0_1px_oklch(0.82_0.1_80/0.25)]"
                      : "text-foreground/80 hover:bg-white/5"
                  )}
                >
                  <span>{pair.whiteSAN}</span>
                  {whiteClass && (
                    <span
                      title={CLASSIFICATION_META[whiteClass].label}
                      className="ml-1 text-[11px]"
                    >
                      {CLASSIFICATION_META[whiteClass].icon}
                    </span>
                  )}
                </button>

                {/* Black Move Button */}
                {pair.blackSAN && pair.blackIndex !== undefined ? (
                  <button
                    ref={isBlackActive ? activeRef : null}
                    onClick={() => onSelectMove(pair.blackIndex as number)}
                    className={cn(
                      "flex items-center justify-between rounded px-2 py-1 text-left font-mono text-xs font-medium transition-all",
                      isBlackActive
                        ? "bg-gold/15 text-gold font-bold shadow-[inset_0_0_0_1px_oklch(0.82_0.1_80/0.25)]"
                        : "text-foreground/80 hover:bg-white/5"
                    )}
                  >
                    <span>{pair.blackSAN}</span>
                    {blackClass && (
                      <span
                        title={CLASSIFICATION_META[blackClass].label}
                        className="ml-1 text-[11px]"
                      >
                        {CLASSIFICATION_META[blackClass].icon}
                      </span>
                    )}
                  </button>
                ) : (
                  <div />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Navigation Controls */}
      {totalMoves > 0 && (
        <div className="mt-3 flex items-center justify-between gap-1 border-t border-white/5 pt-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleFirst}
            disabled={selectedMoveIndex === -1}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="First position"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handlePrev}
            disabled={selectedMoveIndex === -1}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Previous move"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-[11px] font-mono text-muted-foreground tracking-wider font-semibold uppercase">
            {selectedMoveIndex === -1 ? "Start" : `${Math.floor(selectedMoveIndex / 2) + 1}${selectedMoveIndex % 2 === 0 ? "W" : "B"}`} / {totalMoves}
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleNext}
            disabled={selectedMoveIndex === totalMoves - 1}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Next move"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLast}
            disabled={selectedMoveIndex === totalMoves - 1}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-30"
            aria-label="Last position"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
