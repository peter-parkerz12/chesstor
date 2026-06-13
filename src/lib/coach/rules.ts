import { Chess } from "chess.js";

export type Phase = "opening" | "middlegame" | "endgame";

export function detectPhase(fen: string, fullmoveNumber: number): Phase {
  const chess = new Chess(fen);
  const board = chess.board();
  let pieceCount = 0;
  for (const row of board) for (const sq of row) if (sq) pieceCount++;
  if (pieceCount < 7 || fullmoveNumber >= 41) return "endgame";
  if (fullmoveNumber <= 15) return "opening";
  return "middlegame";
}

/** Convert engine cp (White-relative) into "winning-side" view for a player. */
export function cplForMove(
  evalBefore: number,
  evalBest: number,
  evalAfter: number,
  side: "w" | "b",
): number {
  // All evaluations are White-relative.
  // From the moving side's perspective, higher is better.
  const sign = side === "w" ? 1 : -1;
  const bestForSide = sign * evalBest;
  const actualForSide = sign * evalAfter;
  // CPL is how much worse the played move is vs best.
  const loss = bestForSide - actualForSide;
  // Sanity clamp
  if (!Number.isFinite(loss)) return 0;
  return Math.max(0, Math.round(loss));
}

export type Severity = "good" | "inaccuracy" | "mistake" | "blunder";

export function severityFromCPL(cpl: number): Severity {
  if (cpl <= 30) return "good";
  if (cpl <= 100) return "inaccuracy";
  if (cpl <= 300) return "mistake";
  return "blunder";
}

export const SEVERITY_META: Record<Severity, { label: string; icon: string; tone: string }> = {
  good: { label: "Good move", icon: "✅", tone: "success" },
  inaccuracy: { label: "Inaccuracy", icon: "⚠️", tone: "warning" },
  mistake: { label: "Mistake", icon: "❌", tone: "danger" },
  blunder: { label: "Blunder", icon: "💀", tone: "danger" },
};

/** Squares of pieces of `color` that are attacked by the opponent and not defended. */
export function findHangingPieces(fen: string, color: "w" | "b"): string[] {
  const chess = new Chess(fen);
  const opp = color === "w" ? "b" : "w";
  const hanging: string[] = [];
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (!sq || sq.color !== color) continue;
      if (sq.type === "k") continue;
      const square = sq.square;
      const attackers = chess.attackers(square, opp);
      if (attackers.length === 0) continue;
      const defenders = chess.attackers(square, color);
      if (defenders.length === 0) hanging.push(square);
    }
  }
  return hanging;
}

/** Did the player move the same piece twice in the opening? */
export function movedSamePieceTwice(history: { from: string; to: string; piece: string }[], side: "w" | "b"): boolean {
  const myMoves = history.filter((_, i) => (side === "w" ? i % 2 === 0 : i % 2 === 1));
  if (myMoves.length < 2) return false;
  // Last move: did the piece on `to` previously move?
  const last = myMoves[myMoves.length - 1];
  for (let i = 0; i < myMoves.length - 1; i++) {
    if (myMoves[i].to === last.from && myMoves[i].piece === last.piece) return true;
  }
  return false;
}

export function notCastledBy(history: { san: string }[], side: "w" | "b", byMove: number): boolean {
  const myMoves = history.filter((_, i) => (side === "w" ? i % 2 === 0 : i % 2 === 1));
  if (myMoves.length < byMove) return false;
  return !myMoves.some((m) => m.san === "O-O" || m.san === "O-O-O");
}

export function lacksCenterControl(fen: string, side: "w" | "b"): boolean {
  const chess = new Chess(fen);
  const targets = side === "w" ? ["e4", "d4"] : ["e5", "d5"];
  return !targets.some((sq) => {
    const piece = chess.get(sq as never);
    return piece && piece.color === side && piece.type === "p";
  });
}

export function undevelopedMinors(fen: string, side: "w" | "b"): number {
  const chess = new Chess(fen);
  const rank = side === "w" ? "1" : "8";
  const homeSquares = [`b${rank}`, `g${rank}`, `c${rank}`, `f${rank}`];
  let count = 0;
  for (const sq of homeSquares) {
    const p = chess.get(sq as never);
    if (p && p.color === side && (p.type === "n" || p.type === "b")) count++;
  }
  return count;
}

/** Distance from king to center (Chebyshev), lower = more active in endgame. */
export function kingActivity(fen: string, side: "w" | "b"): number {
  const chess = new Chess(fen);
  const board = chess.board();
  for (const row of board) for (const sq of row) {
    if (sq && sq.type === "k" && sq.color === side) {
      const file = sq.square.charCodeAt(0) - 97;
      const rank = parseInt(sq.square[1], 10) - 1;
      return Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5));
    }
  }
  return 99;
}
