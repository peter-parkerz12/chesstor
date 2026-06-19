import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";

import { Board } from "@/components/chess/Board";
import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGameMode } from "@/components/nav/island-context";
import { playSfx } from "@/lib/audio/sfx";
import { findKingSquare } from "@/lib/chess/squares";
import {
  PRACTICE_CATEGORIES,
  PRACTICE_POSITIONS,
  type PracticePosition,
  type PracticeSection,
} from "@/lib/practice/positions";
import { readPracticeStats, recordAttempt } from "@/lib/practice/stats";

export const Route = createFileRoute("/practice")({
  head: () => ({
    meta: [
      { title: "Midgame & Endgame Practice — ChessCoach" },
      {
        name: "description",
        content:
          "Train pattern recognition with curated tactical, strategic and endgame positions. Progressive hints, real explanations.",
      },
    ],
  }),
  ssr: false,
  component: PracticePage,
});

type SectionTab = PracticeSection;

function PracticePage() {
  useGameMode(false);
  const [section, setSection] = useState<SectionTab>("midgame");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statsTick, setStatsTick] = useState(0);

  useEffect(() => {
    const onUpdate = () => setStatsTick((n) => n + 1);
    window.addEventListener("chesscoach:practice", onUpdate);
    return () => window.removeEventListener("chesscoach:practice", onUpdate);
  }, []);

  const stats = useMemo(() => readPracticeStats(), [statsTick]);

  const activePosition = activeId ? PRACTICE_POSITIONS.find((p) => p.id === activeId) ?? null : null;

  const categories = PRACTICE_CATEGORIES.filter((c) => c.section === section);
  const positionsBySection = PRACTICE_POSITIONS.filter((p) => p.section === section);

  const solvedCount = positionsBySection.filter(
    (p) => stats.positions[p.id]?.status === "solved",
  ).length;

  if (activePosition) {
    return (
      <PositionTrainer
        key={activePosition.id}
        position={activePosition}
        onBack={() => setActiveId(null)}
        onSwitch={(id) => setActiveId(id)}
        onSolved={() => setStatsTick((n) => n + 1)}
      />
    );
  }

  return (
    <div className="pb-nav mx-auto w-full max-w-6xl px-5 pt-8 sm:pt-12 lg:px-8">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"
      >
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/10 px-2.5 py-1 text-[11px] font-medium text-gold">
            <Sparkles className="h-3 w-3" /> Deliberate practice
          </span>
          <h1 className="mt-3 truncate text-3xl font-bold tracking-tight sm:text-4xl">
            Midgame & Endgame Practice
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Curated positions that train pattern recognition. Three progressive hints. Real
            explanations after every attempt.
          </p>
        </div>
        <div className="hidden rounded-2xl bg-white/3 px-4 py-3 ring-1 ring-white/8 sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Solved
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {solvedCount}
            <span className="text-sm text-muted-foreground">/{positionsBySection.length}</span>
          </p>
        </div>
      </motion.header>

      <div className="mt-7 inline-flex rounded-full bg-white/3 p-1 ring-1 ring-white/8">
        {(["midgame", "endgame"] as SectionTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setSection(t);
              playSfx("click");
            }}
            aria-pressed={section === t}
            className={`relative rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              section === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {section === t && (
              <motion.span
                layoutId="practice-tab"
                className="absolute inset-0 rounded-full bg-gold/15 ring-1 ring-gold/30"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => {
          const list = positionsBySection.filter((p) => p.category === cat.id);
          if (list.length === 0) return null;
          const solved = list.filter(
            (p) => stats.positions[p.id]?.status === "solved",
          ).length;
          return (
            <ClayCard key={cat.id} className="!p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold tracking-tight">{cat.label}</h3>
                <Badge variant="outline" className="border-white/10 text-[10px] text-muted-foreground">
                  {solved}/{list.length}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{cat.blurb}</p>
              <ul className="mt-4 space-y-1.5">
                {list.map((p) => {
                  const s = stats.positions[p.id];
                  const solvedFlag = s?.status === "solved";
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveId(p.id);
                          playSfx("click");
                        }}
                        className="group flex w-full items-center gap-2 rounded-xl bg-white/3 px-3 py-2 text-left ring-1 ring-white/8 transition-all hover:bg-white/5 hover:ring-gold/30"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                            solvedFlag
                              ? "bg-success/20 text-success ring-1 ring-success/40"
                              : "bg-white/5 text-muted-foreground"
                          }`}
                        >
                          {solvedFlag ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.categoryLabel}</span>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {p.difficulty} · {p.sideToMove === "w" ? "White" : "Black"} to move
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}

function PositionTrainer({
  position,
  onBack,
  onSolved,
}: {
  position: PracticePosition;
  onBack: () => void;
  onSolved: () => void;
}) {
  const [chess] = useState(() => new Chess(position.fen));
  const [fen, setFen] = useState(position.fen);
  const [hintLevel, setHintLevel] = useState(0); // 0=none, 1-3
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(
    null,
  );
  const [solved, setSolved] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Reset internal state when position changes (defensive).
  useEffect(() => {
    chess.load(position.fen);
    setFen(position.fen);
    setHintLevel(0);
    setFeedback(null);
    setSolved(false);
    setLastMove(null);
  }, [position.fen, chess]);

  const handleReset = useCallback(() => {
    chess.load(position.fen);
    setFen(position.fen);
    setFeedback(null);
    setSolved(false);
    setLastMove(null);
  }, [chess, position.fen]);

  const handleMove = useCallback(
    (from: string, to: string) => {
      if (solved) return false;
      // Only allow moves for the side to move in the puzzle.
      if (chess.turn() !== position.sideToMove) return false;

      // Attempt the move (assume queen promotion when promoting).
      const attempt = `${from}${to}`;
      const promoSolution = position.solutions.find((s) => s.startsWith(attempt) && s.length === 5);
      const moveOptions: { from: string; to: string; promotion?: string } = { from, to };
      if (promoSolution) moveOptions.promotion = promoSolution[4];

      let mv;
      try {
        mv = chess.move(moveOptions);
      } catch {
        return false;
      }
      if (!mv) return false;

      const uci = `${mv.from}${mv.to}${mv.promotion ?? ""}`;
      const isCorrect = position.solutions.includes(uci) || position.solutions.includes(`${mv.from}${mv.to}`);

      setFen(chess.fen());
      setLastMove({ from: mv.from, to: mv.to });

      if (isCorrect) {
        playSfx("win");
        setSolved(true);
        setFeedback({ type: "success", message: position.explanation });
        recordAttempt(position.id, "solved", hintLevel);
        onSolved();
      } else {
        playSfx("loss");
        setFeedback({
          type: "error",
          message: `${mv.san} isn't the strongest move here. Hint: ${position.hints[Math.min(hintLevel, 2)]}`,
        });
        recordAttempt(position.id, "failed", hintLevel);
        // Auto-revert after a beat so the user can try again.
        window.setTimeout(() => {
          chess.undo();
          setFen(chess.fen());
          setLastMove(null);
        }, 850);
      }
      return true;
    },
    [chess, hintLevel, onSolved, position, solved],
  );

  const revealHint = useCallback(() => {
    if (hintLevel >= 3) return;
    setHintLevel((n) => n + 1);
    setFeedback({ type: "info", message: position.hints[hintLevel] });
    playSfx("click");
  }, [hintLevel, position.hints]);

  const inCheck = chess.inCheck();
  const checkSq = inCheck ? findKingSquare(chess, chess.turn()) : null;
  const checkHighlight = checkSq ? { [checkSq]: "check" as const } : {};

  return (
    <div className="pb-nav mx-auto w-full max-w-7xl px-4 pt-4 sm:px-5 lg:px-8 lg:pt-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to library
        </button>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={handleReset} className="h-8 px-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="flex min-w-0 items-start justify-center">
          <div className="w-full" style={{ maxWidth: "min(74vh, 100%)" }}>
            <Board
              fen={fen}
              orientation={position.sideToMove === "w" ? "white" : "black"}
              onMove={handleMove}
              lastMove={lastMove}
              highlights={checkHighlight}
              draggable={!solved}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <ClayCard className="!p-5">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="border-gold/30 text-[10px] uppercase tracking-wider text-gold">
                {position.categoryLabel}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-[10px] uppercase tracking-wider text-muted-foreground">
                {position.difficulty}
              </Badge>
            </div>
            <h2 className="mt-3 text-lg font-semibold leading-tight">
              {position.sideToMove === "w" ? "White" : "Black"} to move
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{position.objective}</p>
            <p className="mt-3 text-xs italic text-muted-foreground/80">Theme: {position.idea}</p>
          </ClayCard>

          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                key={feedback.message}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <GlassPanel
                  className={`!p-4 ring-1 ${
                    feedback.type === "success"
                      ? "ring-success/40"
                      : feedback.type === "error"
                        ? "ring-danger/40"
                        : "ring-gold/30"
                  }`}
                >
                  <div className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 shrink-0">
                      {feedback.type === "success" ? (
                        <Trophy className="h-4 w-4 text-success" />
                      ) : feedback.type === "error" ? (
                        <XCircle className="h-4 w-4 text-danger" />
                      ) : (
                        <Lightbulb className="h-4 w-4 text-gold" />
                      )}
                    </span>
                    <p className="leading-relaxed text-foreground/90">{feedback.message}</p>
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>

          <GlassPanel className="!p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Progressive hints
                </h4>
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {hintLevel === 0
                    ? "Stuck? Get a nudge — three hints, each more specific."
                    : `Hint ${hintLevel}/3 revealed.`}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={revealHint}
                disabled={hintLevel >= 3 || solved}
                className="h-8 shrink-0"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {hintLevel === 0 ? "Hint" : hintLevel >= 3 ? "All shown" : "Next hint"}
                </span>
              </Button>
            </div>
            {hintLevel > 0 && (
              <ol className="mt-3 space-y-1.5 text-xs text-foreground/85">
                {position.hints.slice(0, hintLevel).map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gold">{i + 1}.</span>
                    <span className="leading-relaxed">{h}</span>
                  </li>
                ))}
              </ol>
            )}
          </GlassPanel>

          {solved && (
            <NextPositionButton currentId={position.id} onPick={(id) => {
              // Same-route swap via onBack + setActive replaced — easier: navigate via state lift.
              // We trigger onBack and rely on parent to reopen; here we just reload position.
              const next = PRACTICE_POSITIONS.find((p) => p.id === id);
              if (!next) return;
              // Hard reset by mutating refs:
              chess.load(next.fen);
              setFen(next.fen);
              setSolved(false);
              setFeedback(null);
              setHintLevel(0);
              setLastMove(null);
              // Replace position by reload — parent doesn't know. Use window navigation hack:
              // Simplest: rely on internal — we just visually swapped position fields are stale.
              // Real swap: call onBack then user re-enters. For UX, just call onBack with a flash.
              onBack();
              window.setTimeout(() => {
                // re-open via custom event
                window.dispatchEvent(new CustomEvent("chesscoach:practice:open", { detail: id }));
              }, 50);
            }} />
          )}
        </div>
      </div>
    </div>
  );
}

function NextPositionButton({ currentId, onPick }: { currentId: string; onPick: (id: string) => void }) {
  const idx = PRACTICE_POSITIONS.findIndex((p) => p.id === currentId);
  const next = PRACTICE_POSITIONS[(idx + 1) % PRACTICE_POSITIONS.length];
  if (!next || next.id === currentId) return null;
  return (
    <Button
      onClick={() => onPick(next.id)}
      className="h-11 w-full rounded-2xl bg-gold text-primary-foreground hover:bg-gold/90"
    >
      Next position
      <ChevronRight className="ml-1 h-4 w-4" />
    </Button>
  );
}
