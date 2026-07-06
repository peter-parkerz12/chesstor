import { Chess } from "chess.js";

export type Classification =
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

export const CLASS_ORDER: Classification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "missed_win",
  "missed_tactic",
];

export const CLASS_META: Record<
  Classification,
  { label: string; icon: string; color: string; short: string }
> = {
  brilliant:     { label: "Brilliant",     icon: "💎", short: "!!",  color: "oklch(0.78 0.14 210)" },
  great:         { label: "Great",         icon: "⭐", short: "!",   color: "oklch(0.82 0.14 260)" },
  best:          { label: "Best",          icon: "✅", short: "★",   color: "oklch(0.78 0.13 145)" },
  excellent:     { label: "Excellent",     icon: "🟢", short: "+",   color: "oklch(0.75 0.12 145)" },
  good:          { label: "Good",          icon: "🔵", short: "·",   color: "oklch(0.72 0.10 230)" },
  inaccuracy:    { label: "Inaccuracy",    icon: "🟡", short: "?!",  color: "oklch(0.82 0.15 90)" },
  mistake:       { label: "Mistake",       icon: "🟠", short: "?",   color: "oklch(0.78 0.16 55)" },
  blunder:       { label: "Blunder",       icon: "🔴", short: "??",  color: "oklch(0.68 0.20 25)" },
  missed_win:    { label: "Missed Win",    icon: "⚫", short: "×",   color: "oklch(0.60 0.03 80)" },
  missed_tactic: { label: "Missed Tactic", icon: "⚠️", short: "!?",  color: "oklch(0.80 0.15 75)" },
};

export type MoveEval = {
  /** Best-line eval (white perspective) from position BEFORE the move. */
  cpBefore: number;
  /** Best-line eval (white perspective) of the position AFTER the played move. */
  cpAfter: number;
  /** Engine best move from fenBefore, in UCI. */
  bestMoveUci: string;
  /** Second-best line score (white perspective), if available. */
  secondCp?: number;
  played: string;
  side: "w" | "b";
  fenBefore: string;
};

const PIECE_VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

function scoreForSide(cpWhite: number, side: "w" | "b") {
  return side === "w" ? cpWhite : -cpWhite;
}

/** Approximate sacrifice detector: move places piece where net exchange is negative. */
function isSacrifice(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promo = uci.length >= 5 ? uci[4] : undefined;
  const moving = chess.get(from as never);
  if (!moving) return false;
  const captured = chess.get(to as never);
  const capturedVal = captured ? PIECE_VAL[captured.type] : 0;
  const movedVal = PIECE_VAL[moving.type];
  try {
    chess.move({ from, to, promotion: promo as never });
  } catch {
    return false;
  }
  const opp = moving.color === "w" ? "b" : "w";
  const attackers = chess.attackers(to as never, opp);
  if (attackers.length === 0) return false;
  // Under-defended and material-negative — treat as sacrifice.
  return capturedVal + 40 < movedVal;
}

/** Does the engine's best move look tactical (capture of >=minor or gives check)? */
function bestIsTactical(fenBefore: string, uci: string): boolean {
  if (!uci) return false;
  const chess = new Chess(fenBefore);
  const to = uci.slice(2, 4);
  const target = chess.get(to as never);
  if (target && PIECE_VAL[target.type] >= 300) return true;
  try {
    chess.move({ from: uci.slice(0, 2), to, promotion: uci[4] as never });
    if (chess.inCheck()) return true;
  } catch {
    /* noop */
  }
  return false;
}

export function classifyMove(m: MoveEval): { kind: Classification; cpl: number } {
  const bestForSide = scoreForSide(m.cpBefore, m.side);
  const afterForSide = scoreForSide(m.cpAfter, m.side);
  const cpl = Math.max(0, Math.round(bestForSide - afterForSide));
  const isBest = !!m.bestMoveUci && m.played === m.bestMoveUci;

  // Missed win: was clearly winning, now unclear or worse.
  if (bestForSide >= 300 && afterForSide < 100 && !isBest) {
    return { kind: "missed_win", cpl };
  }

  if (isBest) {
    // Great/Brilliant only in non-crushing positions.
    const critical = Math.abs(bestForSide) < 400;
    const gap =
      m.secondCp !== undefined
        ? scoreForSide(m.cpBefore, m.side) - scoreForSide(m.secondCp, m.side)
        : 0;
    const onlyMove = gap >= 150;
    if (critical && onlyMove) {
      if (isSacrifice(m.fenBefore, m.played) && bestForSide >= -50) {
        return { kind: "brilliant", cpl };
      }
      return { kind: "great", cpl };
    }
    return { kind: "best", cpl };
  }

  if (cpl <= 20) return { kind: "excellent", cpl };
  if (cpl <= 50) return { kind: "good", cpl };
  if (cpl >= 60 && bestIsTactical(m.fenBefore, m.bestMoveUci) && cpl < 300) {
    return { kind: "missed_tactic", cpl };
  }
  if (cpl <= 100) return { kind: "inaccuracy", cpl };
  if (cpl <= 300) return { kind: "mistake", cpl };
  return { kind: "blunder", cpl };
}

export function explainMove(a: {
  classification: Classification;
  cpl: number;
  bestSan?: string;
  san: string;
  side: "w" | "b";
}): string {
  const best = a.bestSan;
  const pawns = (a.cpl / 100).toFixed(1);
  switch (a.classification) {
    case "brilliant":
      return "A stunning idea — the only move that keeps the game alive, and it involves a genuine sacrifice. Very hard to find over the board.";
    case "great":
      return `The only move that maintains your position${best ? ` (${best})` : ""}. Every alternative gave the opponent real chances.`;
    case "best":
      return "Engine's top choice. Clean, precise, no compromise.";
    case "excellent":
      return "Nearly as good as the top engine line — no meaningful loss of evaluation.";
    case "good":
      return "A reasonable move. Not the sharpest continuation, but it doesn't spoil the position.";
    case "inaccuracy":
      return `Slightly imprecise — about ${pawns} pawns lost.${best ? ` ${best} was more accurate.` : ""}`;
    case "mistake":
      return `A tangible mistake — roughly ${pawns} pawns of evaluation dropped.${best ? ` ${best} was stronger.` : ""}`;
    case "blunder":
      return `A serious blunder (${pawns} pawns lost).${best ? ` ${best} would have kept the position balanced.` : ""}`;
    case "missed_win":
      return `You were winning and let the advantage slip.${best ? ` ${best} converts cleanly.` : ""}`;
    case "missed_tactic":
      return `A concrete tactic was on the board.${best ? ` ${best} wins material or delivers a decisive blow.` : ""}`;
  }
}
