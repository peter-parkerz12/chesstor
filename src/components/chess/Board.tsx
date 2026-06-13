import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard";

type Props = {
  fen: string;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string) => boolean;
  arrows?: Arrow[];
  lastMove?: { from: string; to: string } | null;
  highlights?: Record<string, "best" | "mistake" | "blunder" | "good" | "selected">;
  draggable?: boolean;
};

const HIGHLIGHT_STYLES: Record<string, React.CSSProperties> = {
  best:     { background: "radial-gradient(circle, oklch(0.82 0.13 80 / 0.55) 60%, transparent 70%)" },
  good:     { background: "radial-gradient(circle, oklch(0.82 0.18 145 / 0.45) 60%, transparent 70%)" },
  mistake:  { background: "radial-gradient(circle, oklch(0.78 0.16 55 / 0.45) 60%, transparent 70%)" },
  blunder:  { background: "radial-gradient(circle, oklch(0.72 0.2 25 / 0.5) 60%, transparent 70%)" },
  selected: { background: "oklch(0.82 0.13 80 / 0.25)" },
};

const LAST_MOVE_STYLE: React.CSSProperties = {
  background: "oklch(0.82 0.13 80 / 0.18)",
  boxShadow: "inset 0 0 0 2px oklch(0.82 0.13 80 / 0.5)",
};

export function Board({
  fen,
  orientation = "white",
  onMove,
  arrows = [],
  lastMove,
  highlights = {},
  draggable = true,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = LAST_MOVE_STYLE;
    squareStyles[lastMove.to] = LAST_MOVE_STYLE;
  }
  for (const [sq, kind] of Object.entries(highlights)) {
    squareStyles[sq] = { ...(squareStyles[sq] ?? {}), ...HIGHLIGHT_STYLES[kind] };
  }

  if (!mounted) {
    return (
      <div className="board-frame">
        <div
          className="w-full aspect-square rounded-xl clay-inset animate-pulse"
          aria-label="Loading chess board"
        />
      </div>
    );
  }

  return (
    <div className="board-frame">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: draggable,
          showAnimations: true,
          animationDurationInMs: 220,
          arrows,
          darkSquareStyle: { backgroundColor: "#1A1A2E" },
          lightSquareStyle: { backgroundColor: "#F0ECE3" },
          dropSquareStyle: { boxShadow: "inset 0 0 0 3px oklch(0.82 0.13 80 / 0.85)" },
          squareStyles,
          boardStyle: {
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 18px 50px -25px rgba(0,0,0,0.7)",
          },
          darkSquareNotationStyle: { color: "oklch(0.95 0.02 80 / 0.55)", fontWeight: 600 },
          lightSquareNotationStyle: { color: "oklch(0.18 0.03 270 / 0.7)", fontWeight: 600 },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || !onMove) return false;
            return onMove(sourceSquare, targetSquare);
          },
        }}
      />
    </div>
  );
}
