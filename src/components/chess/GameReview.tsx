import { useEffect, useState, useMemo, useRef } from "react";
import { Chess, type Square } from "chess.js";
import { ArrowLeft, Play, AlertTriangle, BarChart2, ShieldAlert, Award, Star, CheckCircle, ArrowRight, Info } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip as ChartTooltip,
} from "recharts";

import { Board } from "@/components/chess/Board";
import { EvalBar } from "@/components/chess/EvalBar";
import { Button } from "@/components/ui/button";
import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import { getCoachEngine } from "@/lib/engine/stockfish";
import { MoveNotationPanel, CLASSIFICATION_META, type MoveClassification } from "./MoveNotationPanel";
import { playSfx } from "@/lib/audio/sfx";
import { cn } from "@/lib/utils";

// Explanation Type
type Explanation = {
  whatHappened: string;
  whyGoodOrBad: string;
  whatWasMissed?: string;
  betterMove?: string;
  idea?: string;
};

// Analyzed Move Type
type AnalyzedMove = {
  moveNumber: number;
  san: string;
  from: string;
  to: string;
  side: "w" | "b";
  classification: MoveClassification;
  evalBefore: number;
  evalAfter: number;
  bestMove: string;
  bestMoveSAN: string;
  cpl: number;
  explanation: Explanation;
};

type Props = {
  moves: string[];
  side: "white" | "black";
  difficulty: string;
  onClose: () => void;
};

export function GameReview({ moves, side, difficulty, onClose }: Props) {
  const [analyzedMoves, setAnalyzedMoves] = useState<AnalyzedMove[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1); // -1 = Start position
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Re-create the board states
  const positions = useMemo(() => {
    const tempChess = new Chess();
    const fens = [tempChess.fen()];
    const verboseHistory = [];

    for (const move of moves) {
      try {
        const mv = tempChess.move(move);
        verboseHistory.push(mv);
        fens.push(tempChess.fen());
      } catch (err) {
        console.error("Error recreating move history FEN:", err);
      }
    }
    return { fens, verboseHistory };
  }, [moves]);

  // Run sequential post-game analysis on mount
  useEffect(() => {
    let active = true;
    const coach = getCoachEngine();

    const runAnalysis = async () => {
      try {
        await coach.init();
        coach.setSkill(20);

        const fens = positions.fens;
        const total = fens.length;
        const rawEvals: { cp: number; mate: number | null; bestMove: string | null }[] = [];

        // 1. Analyze every single position in the game sequence exactly once
        for (let i = 0; i < total; i++) {
          if (!active) return;
          const result = await coach.analyze(fens[i], { depth: 13 });
          rawEvals.push({
            cp: result.cp,
            mate: result.mate,
            bestMove: result.bestMove,
          });
          setAnalysisProgress(Math.round(((i + 1) / total) * 100));
        }

        if (!active) return;

        // 2. Compute classifications, centipawn losses, and explanations for each move
        const tempChess = new Chess();
        const results: AnalyzedMove[] = [];

        for (let i = 0; i < positions.verboseHistory.length; i++) {
          const move = positions.verboseHistory[i];
          const beforeFen = positions.fens[i];
          const afterFen = positions.fens[i + 1];
          const beforeEval = rawEvals[i];
          const afterEval = rawEvals[i + 1];
          
          const moveSide = move.color;
          const playedUCI = move.from + move.to + (move.promotion ?? "");
          const bestUCI = beforeEval.bestMove ?? "";

          // Get SAN of best move
          let bestSAN = "";
          if (bestUCI) {
            try {
              const testBoard = new Chess(beforeFen);
              const bestMv = testBoard.move({
                from: bestUCI.slice(0, 2),
                to: bestUCI.slice(2, 4),
                promotion: bestUCI.length > 4 ? bestUCI[4] : undefined,
              });
              bestSAN = bestMv?.san ?? "";
            } catch {
              bestSAN = "";
            }
          }

          // Calculate Centipawn Loss (CPL)
          const sign = moveSide === "w" ? 1 : -1;
          const bestForSide = sign * beforeEval.cp;
          const actualForSide = sign * afterEval.cp;
          const cpl = Math.max(0, bestForSide - actualForSide);

          // Get Piece Type Name
          const pieceNames: Record<string, string> = {
            p: "pawn",
            n: "knight",
            b: "bishop",
            r: "rook",
            q: "queen",
            k: "king",
          };
          const pieceType = pieceNames[move.piece] || "piece";

          // Detect Sacrifice for Brilliant classification
          const isSacrifice = detectSacrifice(new Chess(beforeFen), playedUCI);

          // Classify the move
          const classification = classifyMoveLogic({
            side: moveSide,
            cpl,
            playedUCI,
            bestUCI,
            evalBefore: beforeEval.cp,
            evalAfter: afterEval.cp,
            isSacrifice,
          });

          // Detect Phase
          let phase: "opening" | "middlegame" | "endgame" = "middlegame";
          const pieceCount = tempChess.board().flat().filter(Boolean).length;
          const moveNum = Math.floor(i / 2) + 1;
          if (pieceCount < 7 || moveNum >= 40) phase = "endgame";
          else if (moveNum <= 10) phase = "opening";

          // Generate Explanation
          const explanation = generateExplanation({
            classification,
            playedSAN: move.san,
            bestSAN: bestSAN || bestUCI,
            pieceType,
            phase,
            cpl,
            side: moveSide,
          });

          results.push({
            moveNumber: Math.floor(i / 2) + 1,
            san: move.san,
            from: move.from,
            to: move.to,
            side: moveSide,
            classification,
            evalBefore: beforeEval.cp,
            evalAfter: afterEval.cp,
            bestMove: bestUCI,
            bestMoveSAN: bestSAN || bestUCI,
            cpl,
            explanation,
          });

          // Advance temporary board state
          tempChess.move(move);
        }

        if (active) {
          setAnalyzedMoves(results);
          setIsAnalyzing(false);
          setCurrentMoveIndex(-1); // start at beginning
          playSfx("win");
        }
      } catch (err) {
        console.error("Game review analysis failure:", err);
        if (active) {
          setAnalysisError("Could not complete Stockfish engine analysis. Please try again.");
          setIsAnalyzing(false);
        }
      }
    };

    runAnalysis();
    return () => {
      active = false;
    };
  }, [positions]);

  // Sacrifice detection helper
  const detectSacrifice = (chessBefore: Chess, moveUCI: string) => {
    const from = moveUCI.slice(0, 2);
    const to = moveUCI.slice(2, 4);
    const piece = chessBefore.get(from as never);
    if (!piece || piece.type === "k") return false;

    const temp = new Chess(chessBefore.fen());
    try {
      const mv = temp.move({ from, to, promotion: moveUCI.length > 4 ? moveUCI[4] : undefined });
      if (!mv) return false;
    } catch {
      return false;
    }

    const color = piece.color;
    const opp = color === "w" ? "b" : "w";

    const attackers = temp.attackers(to as Square, opp);
    if (attackers.length === 0) return false;

    const defenders = temp.attackers(to as Square, color);
    if (defenders.length === 0) return true; // undefended capture/move (sacrifice)

    // Attacked by lower value piece
    const pieceValue = getPieceVal(piece.type);
    for (const attSq of attackers) {
      const attPiece = temp.get(attSq as never);
      if (attPiece && getPieceVal(attPiece.type) < pieceValue) {
        return true;
      }
    }
    return false;
  };

  const getPieceVal = (type: string) => {
    const vals: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };
    return vals[type] || 0;
  };

  // Move Classification logic
  const classifyMoveLogic = ({
    side,
    cpl,
    playedUCI,
    bestUCI,
    evalBefore,
    evalAfter,
    isSacrifice,
  }: {
    side: "w" | "b";
    cpl: number;
    playedUCI: string;
    bestUCI: string;
    evalBefore: number;
    evalAfter: number;
    isSacrifice: boolean;
  }): MoveClassification => {
    const isBest = playedUCI === bestUCI || cpl <= 5;
    const sign = side === "w" ? 1 : -1;
    const pEvalBefore = evalBefore * sign;
    const pEvalAfter = evalAfter * sign;

    // Missed Win: had a clear winning advantage (>2.5) but threw it away (<=0.8) with significant CPL
    if (pEvalBefore > 200 && pEvalAfter < 80 && cpl > 120) {
      return "missed_win";
    }

    // Blunder
    if (cpl > 200) return "blunder";

    // Mistake
    if (cpl > 80) return "mistake";

    // Inaccuracy
    if (cpl > 40) return "inaccuracy";

    // Brilliant
    if (isBest && isSacrifice && pEvalAfter > 80) {
      return "brilliant";
    }

    // Great (significantly improved position or tough save)
    if (isBest) {
      if (pEvalAfter - pEvalBefore > 80) return "great";
      if (pEvalBefore < -100 && pEvalAfter > -20) return "great";
      return "best";
    }

    // Excellent
    if (cpl <= 15) return "excellent";

    // Good
    if (cpl <= 40) return "good";

    return "good";
  };

  // Explanation generator
  const generateExplanation = ({
    classification,
    playedSAN,
    bestSAN,
    pieceType,
    phase,
    cpl,
    side,
  }: {
    classification: MoveClassification;
    playedSAN: string;
    bestSAN: string;
    pieceType: string;
    phase: "opening" | "middlegame" | "endgame";
    cpl: number;
    side: "w" | "b";
  }): Explanation => {
    const isCapture = playedSAN.includes("x");
    const isCastling = playedSAN === "O-O" || playedSAN === "O-O-O";
    const isCheck = playedSAN.includes("+") || playedSAN.includes("#");

    let whatHappened = `You played ${playedSAN}, moving your ${pieceType}.`;
    if (isCastling) whatHappened = "You castled your king to safety and activated your rook.";
    else if (isCapture) whatHappened = `You captured with your ${pieceType} on the board (${playedSAN}).`;

    let whyGoodOrBad = "This move is solid and keeps your position steady.";
    let whatWasMissed = undefined;
    let betterMove = undefined;
    let idea = undefined;

    switch (classification) {
      case "brilliant":
        whyGoodOrBad = "A brilliant stroke! You sacrificed material to secure a decisive advantage or force checkmate. Exceptional tactical vision.";
        idea = "Capitalize on the tactical advantage you've created.";
        break;
      case "great":
        whyGoodOrBad = `A great move! You found the best continuation in a critical position, significantly improving your control.`;
        idea = "Maintain this pressure on your opponent.";
        break;
      case "best":
        whyGoodOrBad = "This was the engine's top choice. It maximizes your positioning and minimizes opponent options.";
        break;
      case "excellent":
        whyGoodOrBad = "An excellent move! It maintains a strong position and is highly practical.";
        break;
      case "good":
        whyGoodOrBad = "A good, natural move. You kept the game balanced with minimal loss of centipawns.";
        break;
      case "inaccuracy":
        whyGoodOrBad = `A slight slip. While it doesn't lose immediately, it was less precise than the alternatives.`;
        betterMove = bestSAN;
        if (phase === "opening") {
          idea = "Focus on rapid development and grabbing central space early.";
        } else {
          idea = "Look to consolidate your structure and coordinates.";
        }
        break;
      case "mistake":
        whyGoodOrBad = `A mistake that yields key coordinates or central squares to your opponent.`;
        whatWasMissed = `You missed a stronger line with ${bestSAN} which would have maintained balance.`;
        betterMove = bestSAN;
        idea = "Scan for unprotected pieces and tactical targets before moving.";
        break;
      case "blunder":
        whyGoodOrBad = `A blunder that severely harms your position or directly hangs material.`;
        whatWasMissed = `Instead of ${playedSAN}, playing ${bestSAN} would have kept your position safe.`;
        betterMove = bestSAN;
        idea = "Always calculate the opponent's direct replies (checks, captures, threats).";
        break;
      case "missed_win":
        whyGoodOrBad = `You had a winning line but failed to convert it, letting your opponent back in.`;
        whatWasMissed = `You missed the winning continuation: ${bestSAN}, which would have secured victory.`;
        betterMove = bestSAN;
        idea = "In winning positions, take your time to calculate the cleanest knockout blow.";
        break;
      case "missed_tactic":
        whyGoodOrBad = `You overlooked a tactical resource (a pin, fork, or capture) available in the position.`;
        whatWasMissed = `There was a tactical sequence starting with ${bestSAN} that you could have exploited.`;
        betterMove = bestSAN;
        idea = "Analyze unprotected pieces and checks on every move.";
        break;
    }

    return {
      whatHappened,
      whyGoodOrBad,
      whatWasMissed,
      betterMove,
      idea,
    };
  };

  // Navigations
  const handleSelectMove = (index: number) => {
    if (index >= -1 && index < positions.fens.length) {
      setCurrentMoveIndex(index);
      playSfx("click");
    }
  };

  // highlights for board
  const getBoardHighlights = () => {
    const highlights: Record<string, "best" | "mistake" | "blunder" | "good" | "selected" | "check" | "brilliant" | "great"> = {};
    if (currentMoveIndex >= 0 && currentMoveIndex < analyzedMoves.length) {
      const currentMove = analyzedMoves[currentMoveIndex];
      // Map classification to board highlight type
      const cls = currentMove.classification;
      if (cls === "brilliant") highlights[currentMove.to] = "brilliant";
      else if (cls === "great") highlights[currentMove.to] = "great";
      else if (cls === "best" || cls === "excellent") highlights[currentMove.to] = "best";
      else if (cls === "good") highlights[currentMove.to] = "good";
      else if (cls === "inaccuracy" || cls === "mistake" || cls === "missed_tactic") highlights[currentMove.to] = "mistake";
      else if (cls === "blunder" || cls === "missed_win") highlights[currentMove.to] = "blunder";
    }
    return highlights;
  };

  // Get active FEN and move
  const activeFEN = currentMoveIndex === -1 ? positions.fens[0] : positions.fens[currentMoveIndex + 1];
  const activeMove = currentMoveIndex >= 0 ? analyzedMoves[currentMoveIndex] : null;

  // Highlights Summary (Highlights / Moments)
  const highlightsSummary = useMemo(() => {
    const counts = { brilliant: 0, great: 0, blunder: 0, mistake: 0, missed_win: 0 };
    let turningPointIdx = -1;
    let maxCpl = 0;

    analyzedMoves.forEach((m, idx) => {
      if (m.classification === "brilliant") counts.brilliant++;
      if (m.classification === "great") counts.great++;
      if (m.classification === "blunder") counts.blunder++;
      if (m.classification === "mistake") counts.mistake++;
      if (m.classification === "missed_win") counts.missed_win++;

      // Identify turning point as the move with largest evaluation swing
      const swing = m.cpl;
      if (swing > maxCpl && swing > 150) {
        maxCpl = swing;
        turningPointIdx = idx;
      }
    });

    return { counts, turningPointIdx };
  }, [analyzedMoves]);

  // Chart data formatting
  const chartData = useMemo(() => {
    return positions.fens.map((_, idx) => {
      const moveIndex = idx - 1;
      let score = 0; // Starting position or default

      if (moveIndex >= 0 && moveIndex < analyzedMoves.length) {
        const mv = analyzedMoves[moveIndex];
        // Convert to White advantage scale: + means White better, - means Black better
        score = mv.evalAfter / 100;
      } else if (idx === 0 && analyzedMoves.length > 0) {
        // Initial start position eval
        score = analyzedMoves[0].evalBefore / 100;
      }

      // Cap at +/- 8 pawns so graph doesn't squish swings
      const val = Math.max(-8, Math.min(8, score));

      return {
        name: idx === 0 ? "Start" : `${Math.floor((idx - 1) / 2) + 1}${ (idx - 1) % 2 === 0 ? "W" : "B" }`,
        val,
        moveIndex,
      };
    });
  }, [positions, analyzedMoves]);

  // Loading analysis screen
  if (isAnalyzing) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center p-8 text-center pt-24 pb-nav min-h-dvh">
        <ClayCard className="w-full max-w-md p-8">
          <div className="flex justify-center mb-6 relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-t-2 border-gold" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-gold">
              {analysisProgress}%
            </div>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Stockfish Game Review</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Evaluating every move in depth with the Stockfish engine…
          </p>
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
            <div
              className="h-full bg-gold transition-all duration-300 ease-out rounded-full"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>Analyzing positions</span>
            <span>{Math.min(moves.length + 1, Math.round((analysisProgress / 100) * (moves.length + 1)))} / {moves.length + 1} FENs</span>
          </div>
        </ClayCard>
      </div>
    );
  }

  // Analysis Error screen
  if (analysisError) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center p-8 text-center pt-24 pb-nav min-h-dvh">
        <ClayCard className="w-full max-w-md p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 border border-danger/20 text-danger mb-4">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Analysis Failed</h2>
          <p className="mt-2 text-sm text-muted-foreground">{analysisError}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={onClose} className="w-full bg-gold text-primary-foreground hover:bg-gold/90 rounded-2xl h-11">
              Go back
            </Button>
          </div>
        </ClayCard>
      </div>
    );
  }

  // SAN move notation strings array
  const moveSANs = analyzedMoves.map((m) => m.san);

  return (
    <div className="pb-nav mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pt-4 sm:px-5 lg:px-8 lg:pt-6">
      {/* Top Header Row */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Game
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stockfish Game Review
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-full bg-white/5 px-3 py-1 border border-white/5">
            AI level: {difficulty}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1 border border-white/5 capitalize">
            Side: {side}
          </span>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px] items-start">
        {/* Left Side: Board, EvalBar, Navigation, Highlights */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            {/* The Chessboard Frame */}
            <div className="flex-1 min-w-0 max-w-[min(70vh,100%)]">
              <Board
                fen={activeFEN}
                orientation={side}
                lastMove={
                  activeMove
                    ? { from: activeMove.from, to: activeMove.to }
                    : null
                }
                highlights={getBoardHighlights()}
                draggable={false}
              />
            </div>
            {/* Live Eval Bar */}
            <div className="shrink-0 flex items-stretch">
              <EvalBar
                cp={activeMove ? activeMove.evalAfter : (analyzedMoves[0]?.evalBefore || 0)}
                orientation={side}
              />
            </div>
          </div>

          {/* Quick Nav Timeline & Nav controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-2/40 border border-white/5 rounded-2xl p-4 shadow-clay-sm">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-xl border-white/8 bg-white/3 hover:bg-white/5 text-xs"
                onClick={() => handleSelectMove(-1)}
                disabled={currentMoveIndex === -1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-xl border-white/8 bg-white/3 hover:bg-white/5 text-xs"
                onClick={() => handleSelectMove(currentMoveIndex - 1)}
                disabled={currentMoveIndex === -1}
              >
                Prev
              </Button>
              <span className="text-xs font-mono font-semibold px-2 text-foreground/80">
                {currentMoveIndex === -1
                  ? "Start Position"
                  : `Move ${Math.floor(currentMoveIndex / 2) + 1}${currentMoveIndex % 2 === 0 ? "W" : "B"}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-xl border-white/8 bg-white/3 hover:bg-white/5 text-xs"
                onClick={() => handleSelectMove(currentMoveIndex + 1)}
                disabled={currentMoveIndex === analyzedMoves.length - 1}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 rounded-xl border-white/8 bg-white/3 hover:bg-white/5 text-xs"
                onClick={() => handleSelectMove(analyzedMoves.length - 1)}
                disabled={currentMoveIndex === analyzedMoves.length - 1}
              >
                Last
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Accuracy:</span>
              <span className="font-semibold text-gold font-mono">
                {analyzedMoves.length > 0
                  ? Math.round(
                      100 -
                        analyzedMoves.reduce((acc, m) => acc + m.cpl, 0) /
                          analyzedMoves.length /
                          10
                    )
                  : 100}%
              </span>
            </div>
          </div>

          {/* Highlights/Key Moments Summary Block */}
          <ClayCard className="p-4!">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Game Highlights</h4>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10 text-center">
                <span className="text-lg">💎</span>
                <span className="text-xs text-muted-foreground mt-1">Brilliant</span>
                <span className="text-base font-bold text-cyan-400 font-mono mt-0.5">{highlightsSummary.counts.brilliant}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                <span className="text-lg">⭐</span>
                <span className="text-xs text-muted-foreground mt-1">Great</span>
                <span className="text-base font-bold text-amber-400 font-mono mt-0.5">{highlightsSummary.counts.great}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                <span className="text-lg">🟠</span>
                <span className="text-xs text-muted-foreground mt-1">Mistakes</span>
                <span className="text-base font-bold text-orange-400 font-mono mt-0.5">{highlightsSummary.counts.mistake}</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-center">
                <span className="text-lg">🔴</span>
                <span className="text-xs text-muted-foreground mt-1">Blunders</span>
                <span className="text-base font-bold text-red-400 font-mono mt-0.5">{highlightsSummary.counts.blunder}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3 rounded-xl bg-neutral-800 border border-neutral-700 text-center">
                <span className="text-lg">⚫</span>
                <span className="text-xs text-muted-foreground mt-1">Missed Wins</span>
                <span className="text-base font-bold text-neutral-300 font-mono mt-0.5">{highlightsSummary.counts.missed_win}</span>
              </div>
            </div>
            
            {highlightsSummary.turningPointIdx !== -1 && (
              <div className="mt-3 flex items-center justify-between gap-3 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-400" />
                  <div className="text-xs text-left">
                    <span className="font-semibold text-rose-400">Critical Turning Point:</span> Move {Math.floor(highlightsSummary.turningPointIdx / 2) + 1}
                    {highlightsSummary.turningPointIdx % 2 === 0 ? "W" : "B"} ({analyzedMoves[highlightsSummary.turningPointIdx].san})
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 hover:bg-rose-500/10 text-rose-400 font-semibold text-[10px] rounded-lg border border-rose-500/20"
                  onClick={() => handleSelectMove(highlightsSummary.turningPointIdx)}
                >
                  View Moment
                </Button>
              </div>
            )}
          </ClayCard>
        </div>

        {/* Right Side: Analysis panels, MoveNotation list, Evaluation Graph */}
        <div className="flex flex-col gap-4">
          
          {/* Recharts Evaluation Graph */}
          <GlassPanel className="p-4!">
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" /> Evaluation Swing
              </h4>
              <span className="text-[10px] text-muted-foreground/60">(Capped at ±8.0 pawns)</span>
            </div>
            
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 2, right: 2, left: -25, bottom: 2 }}
                  onClick={(props) => {
                    if (props && props.activePayload && props.activePayload[0]) {
                      const idx = props.activePayload[0].payload.moveIndex;
                      handleSelectMove(idx);
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="colorEval" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.96 0.005 80)" stopOpacity={0.4} />
                      <stop offset="50%" stopColor="oklch(0.96 0.005 80)" stopOpacity={0.05} />
                      <stop offset="50%" stopColor="oklch(0.185 0 0)" stopOpacity={0.05} />
                      <stop offset="95%" stopColor="oklch(0.185 0 0)" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" hide />
                  <YAxis
                    domain={[-8, 8]}
                    tickCount={5}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#6E6E6E", fontSize: 9, fontFamily: "monospace" }}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const score = payload[0].value as number;
                        const label = payload[0].payload.name;
                        return (
                          <div className="bg-surface border border-white/10 px-2.5 py-1.5 rounded-lg shadow-md text-[10px] font-mono">
                            <p className="font-semibold text-foreground">{label}</p>
                            <p className="text-gold mt-0.5">
                              {score >= 0 ? "+" : ""}{score.toFixed(2)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={0} stroke="oklch(0.82 0.1 80 / 0.25)" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke="oklch(0.82 0.1 80)"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorEval)"
                    activeDot={{ r: 4.5, strokeWidth: 0, fill: "oklch(0.82 0.1 80)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassPanel>

          {/* Move Explanation Card */}
          <div className="min-h-[160px]">
            {activeMove ? (
              <ClayCard className="p-5! border-gold/15 bg-gold/[0.02] shadow-[0_4px_20px_-10px_rgba(226,185,111,0.1)]">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CLASSIFICATION_META[activeMove.classification].icon}</span>
                    <span className={cn("text-xs font-bold uppercase tracking-wider", CLASSIFICATION_META[activeMove.classification].text)}>
                      {CLASSIFICATION_META[activeMove.classification].label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/60">CPL {activeMove.cpl}</span>
                </div>
                
                <div className="mt-3.5 space-y-3.5 text-left">
                  <div>
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                      <Info className="h-3 w-3" /> What happened
                    </h5>
                    <p className="mt-1 text-sm text-foreground/90">{activeMove.explanation.whatHappened}</p>
                  </div>

                  <div>
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Why it was classified</h5>
                    <p className="mt-1 text-sm text-foreground/90 leading-relaxed">{activeMove.explanation.whyGoodOrBad}</p>
                  </div>

                  {activeMove.explanation.whatWasMissed && (
                    <div className="p-3 rounded-xl bg-danger/5 border border-danger/10 text-xs">
                      <span className="font-bold text-danger">What was missed:</span> {activeMove.explanation.whatWasMissed}
                    </div>
                  )}

                  {activeMove.explanation.betterMove && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Better Alternative:</span>
                        <div className="font-mono font-bold text-gold text-sm mt-0.5">
                          {activeMove.bestMoveSAN}
                        </div>
                      </div>
                      {activeMove.explanation.idea && (
                        <div className="text-[11px] text-right text-muted-foreground max-w-[200px] leading-snug">
                          <span className="font-bold text-foreground">Idea:</span> {activeMove.explanation.idea}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ClayCard>
            ) : (
              <ClayCard className="p-5! flex flex-col justify-center items-center text-center py-10">
                <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-3">
                  <Play className="h-4 w-4 text-muted-foreground fill-muted-foreground/30" />
                </div>
                <h5 className="text-sm font-semibold text-foreground">Initial Position</h5>
                <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
                  Start of the game. Tap any move in the timeline below to inspect evaluations.
                </p>
              </ClayCard>
            )}
          </div>

          {/* Interactive Move List (Notation Panel) */}
          <MoveNotationPanel
            moves={moveSANs}
            selectedMoveIndex={currentMoveIndex}
            onSelectMove={handleSelectMove}
            classifications={analyzedMoves.reduce<Record<number, MoveClassification>>((acc, m, idx) => {
              acc[idx] = m.classification;
              return acc;
            }, {})}
            liveGame={false}
          />
        </div>
      </div>
    </div>
  );
}
