import { useEffect, useState } from "react";
import { Chessboard } from "react-chessboard";
import type { Arrow } from "react-chessboard";

import { usePreferences, getBoardTheme, getPieceSet } from "@/lib/settings/preferences";

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

  const [prefs] = usePreferences();
  const theme = getBoardTheme(prefs.boardTheme);
  const pieceSet = getPieceSet(prefs.pieceSet);

  const lastMoveStyle: React.CSSProperties = {
    background: "oklch(0.82 0.13 80 / 0.22)",
    boxShadow: "inset 0 0 0 2px oklch(0.82 0.13 80 / 0.55)",
  };

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    squareStyles[lastMove.from] = lastMoveStyle;
    squareStyles[lastMove.to] = lastMoveStyle;
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
    <div className="board-frame" data-piece-set={pieceSet.id} style={{ ["--piece-filter" as never]: pieceSet.filter }}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: draggable,
          showAnimations: true,
          animationDurationInMs: 220,
          arrows,
          darkSquareStyle: { backgroundColor: theme.dark },
          lightSquareStyle: { backgroundColor: theme.light },
          dropSquareStyle: { boxShadow: "inset 0 0 0 3px oklch(0.82 0.13 80 / 0.85)" },
          squareStyles,
          boardStyle: {
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 18px 50px -25px rgba(0,0,0,0.7)",
          },
          darkSquareNotationStyle: { color: theme.darkText, opacity: 0.6, fontWeight: 600 },
          lightSquareNotationStyle: { color: theme.lightText, opacity: 0.7, fontWeight: 600 },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || !onMove) return false;
            return onMove(sourceSquare, targetSquare);
          },
        }}
      />
    </div>
  );
}
