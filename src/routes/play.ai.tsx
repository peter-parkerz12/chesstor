import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Board } from "@/components/chess/Board";
import { EvalBar } from "@/components/chess/EvalBar";
import { FeedbackPanel } from "@/components/chess/FeedbackPanel";
import { GameLayout } from "@/components/chess/GameLayout";
import { ResultModal } from "@/components/chess/ResultModal";
import { ClayCard } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTY_TIERS, getOpponentEngine, type DifficultyId } from "@/lib/engine/stockfish";
import { analyzeMove, type CoachReport } from "@/lib/coach/feedback";
import { buildPGN, downloadPGN } from "@/lib/pgn";
import { saveGame } from "@/lib/db/idb";

export const Route = createFileRoute("/play/ai")({
  head: () => ({
    meta: [
      { title: "Play vs AI — ChessCoach" },
      { name: "description", content: "Play chess against Stockfish at 6 difficulty levels with instant coaching after every move." },
    ],
  }),
  ssr: false,
  component: PlayAI,
});

type SideChoice = "white" | "black";

function PlayAI() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [side, setSide] = useState<SideChoice>("white");
  const [difficulty, setDifficulty] = useState<DifficultyId>("easy");
  const [started, setStarted] = useState(false);

  const [report, setReport] = useState<CoachReport | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [engineThinking, setEngineThinking] = useState(false);
  const [evalCp, setEvalCp] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [arrows, setArrows] = useState<{ startSquare: string; endSquare: string; color: string }[]>([]);
  const [resultOpen, setResultOpen] = useState(false);

  const cplHistory = useRef<number[]>([]);
  const phaseCpl = useRef({ opening: [] as number[], middlegame: [] as number[], endgame: [] as number[] });
  const mistakeBuckets = useRef({ development: 0, tactics: 0, kingSafety: 0, endgame: 0 });

  const tier = useMemo(() => DIFFICULTY_TIERS.find((t) => t.id === difficulty)!, [difficulty]);

  const userColor: "w" | "b" = side === "white" ? "w" : "b";

  const reset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setReport(null);
    setLastMove(null);
    setArrows([]);
    setResultOpen(false);
    setEvalCp(0);
    cplHistory.current = [];
    phaseCpl.current = { opening: [], middlegame: [], endgame: [] };
    mistakeBuckets.current = { development: 0, tactics: 0, kingSafety: 0, endgame: 0 };
  }, [chess]);

  const start = useCallback(() => {
    reset();
    setStarted(true);
  }, [reset]);

  // Persist game on end.
  const finishGame = useCallback(async () => {
    let result: "win" | "loss" | "draw" | "unfinished" = "unfinished";
    if (chess.isCheckmate()) {
      // Side to move is checkmated => other side won
      const loser = chess.turn();
      result = loser === userColor ? "loss" : "win";
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      result = "draw";
    }
    const cplAvg = cplHistory.current.length
      ? Math.round(cplHistory.current.reduce((a, b) => a + b, 0) / cplHistory.current.length)
      : 0;
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const pgn = buildPGN({
      white: side === "white" ? "You" : `Stockfish (${tier.label})`,
      black: side === "white" ? `Stockfish (${tier.label})` : "You",
      result: result === "win" ? (userColor === "w" ? "1-0" : "0-1") : result === "loss" ? (userColor === "w" ? "0-1" : "1-0") : result === "draw" ? "1/2-1/2" : "*",
      moves: chess.history(),
    });
    await saveGame({
      id: crypto.randomUUID(),
      mode: "ai",
      side,
      difficulty,
      result,
      pgn,
      moves: chess.history(),
      cplAvg,
      cplByPhase: {
        opening: avg(phaseCpl.current.opening),
        middlegame: avg(phaseCpl.current.middlegame),
        endgame: avg(phaseCpl.current.endgame),
      },
      mistakeBuckets: { ...mistakeBuckets.current },
      date: Date.now(),
    });
    setResultOpen(true);
  }, [chess, difficulty, side, tier, userColor]);

  // Engine plays when it's its turn.
  useEffect(() => {
    if (!started) return;
    if (chess.isGameOver()) {
      finishGame();
      return;
    }
    if (chess.turn() === userColor) return;
    const eng = getOpponentEngine();
    let cancelled = false;
    setEngineThinking(true);
    (async () => {
      await eng.init();
      eng.setSkill(tier.skill);
      const move = await eng.pickMove(chess.fen(), tier.movetime);
      if (cancelled || !move) return;
      try {
        const mv = chess.move({
          from: move.slice(0, 2),
          to: move.slice(2, 4),
          promotion: move.length > 4 ? move[4] : undefined,
        });
        if (mv) {
          setFen(chess.fen());
          setLastMove({ from: mv.from, to: mv.to });
        }
      } catch {
        // ignore
      } finally {
        setEngineThinking(false);
      }
    })();
    return () => {
      cancelled = true;
      setEngineThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, started]);

  const onMove = useCallback(
    (from: string, to: string) => {
      if (!started) return false;
      if (chess.turn() !== userColor) return false;
      const fenBefore = chess.fen();
      let mv;
      try {
        mv = chess.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!mv) return false;
      setFen(chess.fen());
      setLastMove({ from: mv.from, to: mv.to });
      setArrows([]);
      // Run coach asynchronously.
      setCoachLoading(true);
      setReport(null);
      const history = chess.history({ verbose: true }).map((h) => ({
        from: h.from, to: h.to, san: h.san, piece: h.piece,
      }));
      analyzeMove({
        fenBefore,
        fenAfter: chess.fen(),
        playedSAN: mv.san,
        history,
        side: userColor,
      })
        .then((r) => {
          setReport(r);
          setEvalCp(r.evalAfter);
          cplHistory.current.push(r.cpl);
          phaseCpl.current[r.phase].push(r.cpl);
          if (r.cpl > 100) {
            if (r.phase === "opening") mistakeBuckets.current.development++;
            else if (r.phase === "middlegame") {
              if (/king|undefended|hanging/i.test(r.message)) mistakeBuckets.current.kingSafety++;
              else mistakeBuckets.current.tactics++;
            } else mistakeBuckets.current.endgame++;
          }
          if (r.bestMove && r.cpl > 30) {
            setArrows([{
              startSquare: r.bestMove.slice(0, 2),
              endSquare: r.bestMove.slice(2, 4),
              color: "#E2B96F",
            }]);
          }
        })
        .catch(() => null)
        .finally(() => setCoachLoading(false));
      return true;
    },
    [chess, started, userColor],
  );

  if (!started) {
    return (
      <div className="mx-auto w-full max-w-md px-5 pt-10 pb-nav lg:pt-16">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <ClayCard>
            <h2 className="text-2xl font-bold">Play vs Stockfish</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose your side and difficulty. The coach watches every move you make.
            </p>
            <div className="mt-6 space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as DifficultyId)}>
                  <SelectTrigger className="mt-2 h-12 rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_TIERS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} · ~{t.elo} Elo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Play as</label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(["white", "black"] as SideChoice[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className={`rounded-2xl border px-4 py-4 text-sm font-semibold capitalize transition-all ${
                        side === s
                          ? "border-gold/60 bg-gold/10 text-gold shadow-[0_0_0_4px_oklch(0.82_0.13_80/0.1)]"
                          : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={start} className="h-12 w-full rounded-2xl bg-gold text-primary-foreground hover:bg-gold/90">
                Start game
              </Button>
            </div>
          </ClayCard>
        </motion.div>
      </div>
    );
  }

  const result = chess.isCheckmate()
    ? (chess.turn() === userColor ? "You lost" : "You won!")
    : chess.isDraw() ? "Draw" : "";

  return (
    <>
      <GameLayout
        topBar={
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-white/5 px-3 py-1">
                Stockfish · {tier.label}
              </span>
              <Button size="sm" variant="ghost" onClick={() => { setStarted(false); reset(); }}>
                <RotateCcw className="h-4 w-4" /> New
              </Button>
            </div>
          </div>
        }
        board={
          <div className="flex gap-3">
            <Board
              fen={fen}
              orientation={side}
              onMove={onMove}
              lastMove={lastMove}
              arrows={arrows}
            />
            <div className="hidden sm:block">
              <EvalBar cp={evalCp} orientation={side} />
            </div>
          </div>
        }
        side={
          <FeedbackPanel
            report={report}
            loading={coachLoading}
            thinking={engineThinking || coachLoading}
            emptyHint="Make your first move — I'll analyze it instantly."
          />
        }
      />
      <ResultModal
        open={resultOpen}
        title={result || "Game over"}
        subtitle={`vs Stockfish · ${tier.label}`}
        cplAvg={cplHistory.current.length ? Math.round(cplHistory.current.reduce((a, b) => a + b, 0) / cplHistory.current.length) : undefined}
        onPlayAgain={() => start()}
        onExportPGN={() => {
          const pgn = buildPGN({
            white: side === "white" ? "You" : `Stockfish (${tier.label})`,
            black: side === "white" ? `Stockfish (${tier.label})` : "You",
            result: chess.isCheckmate() ? (chess.turn() === "w" ? "0-1" : "1-0") : chess.isDraw() ? "1/2-1/2" : "*",
            moves: chess.history(),
          });
          downloadPGN(pgn, `chesscoach-${Date.now()}.pgn`);
        }}
      />
    </>
  );
}
