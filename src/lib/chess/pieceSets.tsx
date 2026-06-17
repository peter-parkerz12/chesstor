import type { PieceRenderObject } from "react-chessboard";
import type { PieceSetId } from "@/lib/settings/preferences";

/**
 * Real piece-set rendering. Each set produces a visually distinct
 * SVG so the board updates the actual pieces — not just a CSS filter.
 *
 * Codes follow react-chessboard convention: uppercase = white, lowercase = black.
 *   wK wQ wR wB wN wP / bK bQ bR bB bN bP
 *
 * We render Unicode chess glyphs as <text> in a 100x100 viewBox.
 * Different sets use different glyph variants, fills, strokes, and weights,
 * giving each a genuinely different silhouette and feel.
 */

const WHITE = { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" } as const;
const SOLID = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" } as const;

type Piece = "K" | "Q" | "R" | "B" | "N" | "P";

function makeRenderer({
  variant,
  whiteFill,
  blackFill,
  whiteStroke,
  blackStroke,
  strokeWidth = 0,
  fontWeight = 400,
  fontSize = 92,
  glyph,
}: {
  variant: "outline" | "solid";
  whiteFill: string;
  blackFill: string;
  whiteStroke?: string;
  blackStroke?: string;
  strokeWidth?: number;
  fontWeight?: number;
  fontSize?: number;
  /** Override glyph set per color. */
  glyph?: { white: Record<Piece, string>; black: Record<Piece, string> };
}): PieceRenderObject {
  const g = glyph ?? {
    white: variant === "solid" ? SOLID : WHITE,
    black: SOLID,
  };

  const make =
    (color: "w" | "b", piece: Piece) =>
    () => {
      const isWhite = color === "w";
      const fill = isWhite ? whiteFill : blackFill;
      const stroke = isWhite ? whiteStroke : blackStroke;
      const ch = isWhite ? g.white[piece] : g.black[piece];
      return (
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          style={{ display: "block", pointerEvents: "none" }}
        >
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily='"Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", "Noto Sans Symbols 2", system-ui, sans-serif'
            fontWeight={fontWeight}
            fontSize={fontSize}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            paintOrder="stroke"
            style={{
              filter: isWhite
                ? "drop-shadow(0 1px 1px rgba(0,0,0,0.45))"
                : "drop-shadow(0 1px 1px rgba(0,0,0,0.55))",
            }}
          >
            {ch}
          </text>
        </svg>
      );
    };

  const out: PieceRenderObject = {};
  (["K", "Q", "R", "B", "N", "P"] as const).forEach((p) => {
    out[`w${p}`] = make("w", p);
    out[`b${p}`] = make("b", p);
  });
  return out;
}

/** Premium Staunton — classical, high contrast, the tournament default. */
const stauntonSet = makeRenderer({
  variant: "solid",
  whiteFill: "#F5F1E8",
  blackFill: "#0A0A0B",
  whiteStroke: "#0A0A0B",
  blackStroke: "#F5F1E8",
  strokeWidth: 2.2,
  fontWeight: 600,
  fontSize: 90,
});

/** Modern Minimal — clean silhouettes, no outline, contemporary. */
const modernSet = makeRenderer({
  variant: "solid",
  whiteFill: "#FAFAF7",
  blackFill: "#111214",
  fontWeight: 400,
  fontSize: 88,
});

/** Elite Glass — refined hairline outline, light interior. */
const glassSet = makeRenderer({
  variant: "outline",
  whiteFill: "rgba(255,255,255,0.18)",
  blackFill: "rgba(0,0,0,0.55)",
  whiteStroke: "#F5F1E8",
  blackStroke: "#0A0A0B",
  strokeWidth: 1.6,
  fontWeight: 300,
  fontSize: 92,
  glyph: { white: WHITE, black: SOLID },
});

export function getPieceRenderer(id: PieceSetId): PieceRenderObject {
  switch (id) {
    case "modern":
      return modernSet;
    case "glass":
      return glassSet;
    case "staunton":
    default:
      return stauntonSet;
  }
}

/** Compact 6-piece preview row used in Settings. */
export function PieceSetPreview({ id }: { id: PieceSetId }) {
  const r = getPieceRenderer(id);
  const order: Array<keyof typeof r> = ["wK", "wQ", "wR", "wB", "wN", "wP"];
  return (
    <div className="flex items-center justify-center gap-1">
      {order.map((k) => {
        const R = r[k];
        return (
          <div key={k} className="h-9 w-9 sm:h-10 sm:w-10">
            <R />
          </div>
        );
      })}
    </div>
  );
}
