import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Lightbulb, LightbulbOff } from "lucide-react";

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
import { useGameMode } from "@/components/nav/island-context";
import { usePreferences } from "@/lib/settings/preferences";
import { playMoveSfx, playSfx } from "@/lib/audio/sfx";
import { findKingSquare } from "@/lib/chess/squares";

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
  useGameMode(started);

  const [prefs, setPrefs] = usePreferences();

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

  const finishGame = useCallback(async () => {
    let result: "win" | "loss" | "draw" | "unfinished" = "unfinished";
    if (chess.isCheckmate()) {
      const loser = chess.turn();
      result = loser === userColor ? "loss" : "win";
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
      result = "draw";
    }
    if (result === "win") playSfx("win");
    else if (result === "loss") playSfx("loss");
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
          playMoveSfx(mv);
        }
      } catch { /* noop */ } finally {
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
      playMoveSfx(mv);
      setArrows([]);
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
          if (prefs.aiHints && r.bestMove && r.cpl > 30) {
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
    [chess, started, userColor, prefs.aiHints],
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
                      onClick={() => { setSide(s); playSfx("click"); }}
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

              <button
                type="button"
                onClick={() => { setPrefs({ aiHints: !prefs.aiHints }); playSfx("click"); }}
                className="flex w-full items-center justify-between rounded-2xl bg-white/3 px-4 py-3.5 text-left ring-1 ring-white/8 transition-colors hover:bg-white/5"
                aria-pressed={prefs.aiHints}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${prefs.aiHints ? "bg-gold/15 text-gold" : "bg-white/5 text-muted-foreground"}`}>
                    {prefs.aiHints ? <Lightbulb className="h-4 w-4" /> : <LightbulbOff className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Real-Time Move Hints</p>
                    <p className="text-xs text-muted-foreground">{prefs.aiHints ? "On — best moves shown after slips." : "Off — pure play."}</p>
                  </div>
                </div>
                <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${prefs.aiHints ? "bg-gold" : "bg-white/15"}`}>
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${prefs.aiHints ? "right-0.5" : "left-0.5"}`}
                  />
                </span>
              </button>

              <Button onClick={() => { start(); playSfx("click"); }} className="h-12 w-full rounded-2xl bg-gold text-primary-foreground hover:bg-gold/90">
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
              <button
                type="button"
                onClick={() => { setPrefs({ aiHints: !prefs.aiHints }); playSfx("click"); }}
                aria-pressed={prefs.aiHints}
                aria-label="Toggle real-time move hints"
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 transition-colors ${
                  prefs.aiHints
                    ? "bg-gold/15 text-gold ring-gold/30"
                    : "bg-white/5 text-muted-foreground ring-white/10 hover:text-foreground"
                }`}
              >
                {prefs.aiHints ? <Lightbulb className="h-3.5 w-3.5" /> : <LightbulbOff className="h-3.5 w-3.5" />}
                Hints {prefs.aiHints ? "on" : "off"}
              </button>
              <span className="hidden rounded-full bg-white/5 px-3 py-1 sm:inline">
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
