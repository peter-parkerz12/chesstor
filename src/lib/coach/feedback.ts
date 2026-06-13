import { Chess } from "chess.js";
import { getCoachEngine } from "@/lib/engine/stockfish";
import {
  detectPhase,
  cplForMove,
  severityFromCPL,
  findHangingPieces,
  movedSamePieceTwice,
  notCastledBy,
  lacksCenterControl,
  undevelopedMinors,
  kingActivity,
  type Severity,
  type Phase,
} from "./rules";

export type CoachReport = {
  severity: Severity;
  cpl: number;
  phase: Phase;
  title: string;
  message: string;
  bestMove: string | null;
  bestMoveSAN: string | null;
  evalAfter: number;
  evalBest: number;
};

export type AnalyzeArgs = {
  /** FEN before the player's move. */
  fenBefore: string;
  /** FEN after the player's move. */
  fenAfter: string;
  /** The SAN of the move the player played. */
  playedSAN: string;
  /** Full move history (for opening rules). */
  history: { from: string; to: string; san: string; piece: string }[];
  /** Side that just moved. */
  side: "w" | "b";
};

export async function analyzeMove(args: AnalyzeArgs): Promise<CoachReport> {
  const coach = getCoachEngine();
  await coach.init();
  coach.setSkill(20);

  const [beforeRes, afterRes] = await Promise.all([
    coach.analyze(args.fenBefore, { depth: 13 }),
    coach.analyze(args.fenAfter, { depth: 13 }),
  ]);
  const evalBest = beforeRes.cp; // White-relative score after the best move from beforeFen
  const evalAfter = afterRes.cp; // White-relative score after the actual move
  const cpl = cplForMove(evalBest, evalBest, evalAfter, args.side);
  const severity = severityFromCPL(cpl);
  const chessBefore = new Chess(args.fenBefore);
  const fullmove = chessBefore.moveNumber();
  const phase = detectPhase(args.fenAfter, fullmove);

  let bestSAN: string | null = null;
  if (beforeRes.bestMove) {
    try {
      const t = new Chess(args.fenBefore);
      const mv = t.move({
        from: beforeRes.bestMove.slice(0, 2),
        to: beforeRes.bestMove.slice(2, 4),
        promotion: beforeRes.bestMove.length > 4 ? beforeRes.bestMove[4] : undefined,
      });
      bestSAN = mv?.san ?? null;
    } catch {
      bestSAN = null;
    }
  }

  // Phase-specific advice (overrides generic CPL message when relevant).
  let title = severityTitle(severity);
  let message = severityMessage(severity, bestSAN);

  if (phase === "opening") {
    if (movedSamePieceTwice(args.history, args.side)) {
      title = "Develop new pieces";
      message = "You moved the same piece twice in the opening. Bring out new minor pieces — knights and bishops before rooks — to control more squares.";
    } else if (lacksCenterControl(args.fenAfter, args.side) && fullmove >= 4) {
      title = "Fight for the center";
      message = "You don't have a pawn on e4/d4 (or e5/d5). Central pawns give your pieces room to breathe.";
    } else if (notCastledBy(args.history, args.side, 10) && fullmove >= 10) {
      title = "Castle your king";
      message = "Your king is still in the center after move 10. Castling tucks it to safety and connects your rooks.";
    } else if (undevelopedMinors(args.fenAfter, args.side) >= 2 && fullmove >= 6) {
      title = "Develop your minors";
      message = "Two or more knights/bishops are still on their starting squares. Get them out before launching attacks.";
    }
  } else if (phase === "middlegame") {
    const hanging = findHangingPieces(args.fenAfter, args.side);
    if (hanging.length > 0) {
      title = "Piece left undefended";
      message = `Your piece on ${hanging[0]} is attacked and not defended. Your opponent can win it for free.`;
    } else if (severity === "blunder" || severity === "mistake") {
      title = "Tactic missed";
      message = `${bestSAN ? `The strongest move was ${bestSAN}. ` : ""}Look for forks, pins, and undefended pieces every move.`;
    }
  } else if (phase === "endgame") {
    const activity = kingActivity(args.fenAfter, args.side);
    if (activity > 2) {
      title = "Activate your king";
      message = "In endgames the king is a powerful piece. March it toward the center or your passed pawns.";
    }
  }

  return {
    severity,
    cpl,
    phase,
    title,
    message,
    bestMove: beforeRes.bestMove,
    bestMoveSAN: bestSAN,
    evalAfter,
    evalBest,
  };
}

function severityTitle(s: Severity): string {
  switch (s) {
    case "good": return "Good move";
    case "inaccuracy": return "Inaccuracy";
    case "mistake": return "Mistake";
    case "blunder": return "Blunder";
  }
}
function severityMessage(s: Severity, bestSAN: string | null): string {
  if (s === "good") return "Solid choice — you kept your evaluation strong.";
  const tail = bestSAN ? ` A stronger move was ${bestSAN}.` : "";
  if (s === "inaccuracy") return `Small slip.${tail}`;
  if (s === "mistake") return `That gave away a real advantage.${tail}`;
  return `That move loses significant material or position.${tail}`;
}
