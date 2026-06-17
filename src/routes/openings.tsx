import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lightbulb,
  BookOpen,
  Target,
} from "lucide-react";

import { Board } from "@/components/chess/Board";
import { GameLayout } from "@/components/chess/GameLayout";
import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { OPENINGS, findOpening, type Opening, type MoveNote } from "@/lib/openings/database";
import { recordOpeningAttempt, listOpeningProgress, type OpeningProgress } from "@/lib/db/idb";
import { useGameMode } from "@/components/nav/island-context";
import { usePreferences } from "@/lib/settings/preferences";
import { playMoveSfx, playSfx } from "@/lib/audio/sfx";

export const Route = createFileRoute("/openings")({
  head: () => ({
    meta: [
      { title: "Opening Trainer — ChessCoach" },
      {
        name: "description",
        content: "Learn 20 classical openings move by move with grandmaster-style coaching.",
      },
    ],
  }),
  ssr: false,
  component: OpeningsRoute,
});

function OpeningsRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<OpeningProgress[]>([]);
  const [filter, setFilter] = useState<"all" | "white" | "black">("all");

  useEffect(() => {
    listOpeningProgress()
      .then(setProgress)
      .catch(() => null);
  }, [selectedId]);

  if (selectedId) {
    const opening = findOpening(selectedId);
    if (opening) return <OpeningDrill opening={opening} onBack={() => setSelectedId(null)} />;
  }

  const filtered = filter === "all" ? OPENINGS : OPENINGS.filter((o) => o.trainAs === filter);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-nav lg:px-8 lg:pt-16">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Opening Trainer</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Twenty classical openings, taught move by move. Every move shows the idea, the goal, and
            the mistake to avoid.
          </p>
        </div>
        <div className="inline-flex shrink-0 self-start rounded-full bg-white/5 p-1 ring-1 ring-white/10">
          {(["all", "white", "black"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`relative rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter === f && (
                <motion.span
                  layoutId="opening-filter-pill"
                  className="absolute inset-0 rounded-full bg-gold/15 ring-1 ring-gold/30"
                  transition={{ type: "spring", stiffness: 480, damping: 36 }}
                />
              )}
              <span className="relative">{f === "all" ? "All" : `As ${f}`}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((o, i) => {
          const p = progress.find((x) => x.id === o.id);
          return (
            <motion.button
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.3) }}
              onClick={() => {
                playSfx("click");
                setSelectedId(o.id);
              }}
              className="group text-left"
            >
              <ClayCard className="h-full transition-transform group-hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold leading-tight">{o.name}</h3>
                    <p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      {o.eco} · As {o.trainAs}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      o.trainAs === "white"
                        ? "bg-foreground/10 text-foreground"
                        : "bg-black/40 text-muted-foreground ring-1 ring-white/10"
                    }`}
                  >
                    {o.trainAs === "white" ? "♔" : "♚"}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {o.description}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{o.moves.length} guided moves</span>
                  {p && p.attempts > 0 && (
                    <span className="font-mono text-gold">{Math.round(p.accuracy * 100)}%</span>
                  )}
                </div>
              </ClayCard>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function OpeningDrill({ opening, onBack }: { opening: Opening; onBack: () => void }) {
  useGameMode(true);
  const [prefs] = usePreferences();
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [moveIdx, setMoveIdx] = useState(0);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    expected: MoveNote;
    played: string;
  } | null>(null);
  const [done, setDone] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [showHint, setShowHint] = useState(false);

  const orientation = opening.trainAs;
  // For "as white" → user plays even indices, for "as black" → user plays odd indices.
  const userMoveParity = opening.trainAs === "white" ? 0 : 1;

  const reset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setMoveIdx(0);
    setFeedback(null);
    setDone(false);
    setLastMove(null);
    setShowHint(false);
  }, [chess]);

  // If the user trains as Black, auto-play White's first move.
  useEffect(() => {
    if (opening.trainAs !== "black") return;
    if (moveIdx !== 0) return;
    const first = opening.moves[0];
    if (!first) return;
    const t = setTimeout(() => {
      try {
        const mv = chess.move(first.san);
        if (mv) {
          setFen(chess.fen());
          setLastMove({ from: mv.from, to: mv.to });
          playMoveSfx(mv);
          setMoveIdx(1);
        }
      } catch {
        /* noop */
      }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening.id]);

  const advanceBookSide = useCallback(
    (nextIdx: number) => {
      if (nextIdx >= opening.moves.length) {
        setDone(true);
        playSfx("puzzleSuccess");
        return;
      }
      const isUserNext = nextIdx % 2 === userMoveParity;
      if (isUserNext) return;
      const next = opening.moves[nextIdx];
      setTimeout(() => {
        try {
          const mv = chess.move(next.san);
          if (mv) {
            setFen(chess.fen());
            setLastMove({ from: mv.from, to: mv.to });
            playMoveSfx(mv);
          }
          const after = nextIdx + 1;
          setMoveIdx(after);
          if (after >= opening.moves.length) {
            setDone(true);
            playSfx("puzzleSuccess");
          }
        } catch {
          /* noop */
        }
      }, 420);
    },
    [chess, opening.moves, userMoveParity],
  );

  const onMove = useCallback(
    (from: string, to: string) => {
      if (done) return false;
      const expected = opening.moves[moveIdx];
      if (!expected) return false;
      let mv;
      try {
        mv = chess.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!mv) return false;
      const ok = mv.san === expected.san;
      if (!ok) {
        chess.undo();
        setFeedback({ ok: false, expected, played: mv.san });
        playSfx("puzzleFail");
        recordOpeningAttempt(opening.id, opening.name, false);
        return false;
      }
      setFen(chess.fen());
      setLastMove({ from: mv.from, to: mv.to });
      playMoveSfx(mv);
      setFeedback({ ok: true, expected, played: mv.san });
      setShowHint(false);
      recordOpeningAttempt(opening.id, opening.name, true);
      const nextIdx = moveIdx + 1;
      setMoveIdx(nextIdx);
      advanceBookSide(nextIdx);
      return true;
    },
    [advanceBookSide, chess, done, moveIdx, opening.id, opening.moves, opening.name],
  );

  const expected = opening.moves[moveIdx];
  const isUserTurn = !done && expected && moveIdx % 2 === userMoveParity;
  const progressPct = (Math.min(moveIdx, opening.moves.length) / opening.moves.length) * 100;
  const movePairs = useMemo(() => {
    const pairs: Array<{ n: number; white?: MoveNote; black?: MoveNote }> = [];
    for (let i = 0; i < opening.moves.length; i += 2) {
      pairs.push({ n: i / 2 + 1, white: opening.moves[i], black: opening.moves[i + 1] });
    }
    return pairs;
  }, [opening.moves]);

  const sidePanel = (
    <div className="flex flex-col gap-4">
      <ClayCard className="!p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {opening.eco} · As {opening.trainAs}
            </p>
            <h3 className="mt-1 text-xl font-bold leading-tight">{opening.name}</h3>
          </div>
          <span className="shrink-0 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-gold">
            Move {Math.min(moveIdx + 1, opening.moves.length)} / {opening.moves.length}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-gold to-success"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </ClayCard>

      <AnimatePresence mode="wait">
        {isUserTurn && prefs.coachEnabled && (
          <motion.div
            key={`coach-${moveIdx}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <GlassPanel>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5 text-gold" /> Your move
              </div>
              <p className="mt-2 text-sm text-foreground/90 leading-relaxed">
                <span className="text-muted-foreground">Idea — </span>
                {expected.why}
              </p>
              {expected.goal && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="text-success">Goal · </span>
                  {expected.goal}
                </p>
              )}
              {expected.mistake && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="text-warning">Avoid · </span>
                  {expected.mistake}
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowHint((v) => !v);
                    playSfx("click");
                  }}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  {showHint ? "Hide move" : "Show move"}
                </Button>
                {showHint && (
                  <span className="font-mono text-sm font-bold text-gold">{expected.san}</span>
                )}
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
      {prefs.coachEnabled && feedback && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <ClayCard className={`!p-4 ring-1 ${feedback.ok ? "ring-success/30" : "ring-danger/30"}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {feedback.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-success">Book move</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {feedback.played}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-danger" />
                  <span className="text-danger">Not the mainline</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {feedback.played}
                  </span>
                </>
              )}
            </div>
            {!feedback.ok && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                The book continues with{" "}
                <span className="font-mono text-gold">{feedback.expected.san}</span>.{" "}
                {feedback.expected.why}
              </p>
            )}
            {feedback.ok && feedback.expected.tip && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                <span className="text-gold">Tip · </span>
                {feedback.expected.tip}
              </p>
            )}
          </ClayCard>
        </motion.div>
      )}

      {prefs.coachEnabled && (
        <>
          <GlassPanel>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-gold" /> Middlegame plan
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/85">
              {opening.plans.slice(0, 3).map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {opening.motifs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {opening.motifs.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-white/10"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </GlassPanel>

          <GlassPanel>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mainline
            </h4>
            <ol className="mt-3 max-h-48 space-y-1 overflow-y-auto pr-1 text-sm no-scrollbar">
              {movePairs.map((p, i) => {
                const wIdx = i * 2;
                const bIdx = i * 2 + 1;
                return (
                  <li key={p.n} className="grid grid-cols-[2rem_1fr_1fr] gap-2 font-mono">
                    <span className="text-muted-foreground">{p.n}.</span>
                    <span
                      className={wIdx < moveIdx ? "text-foreground" : "text-muted-foreground/60"}
                    >
                      {p.white?.san ?? ""}
                    </span>
                    <span
                      className={bIdx < moveIdx ? "text-foreground" : "text-muted-foreground/60"}
                    >
                      {p.black?.san ?? ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </GlassPanel>
        </>
      )}

      {done && (
        <ClayCard className="!p-5 ring-1 ring-gold/30 glow-gold">
          <h4 className="text-lg font-bold text-gold">Mainline complete</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            You played the full {opening.name} mainline. Replay it to lock it in, or try another
            opening.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={reset}
              className="bg-gold text-primary-foreground hover:bg-gold/90"
            >
              <RotateCcw className="h-4 w-4" /> Replay
            </Button>
            <Button size="sm" variant="outline" onClick={onBack}>
              Choose another
            </Button>
          </div>
        </ClayCard>
      )}
    </div>
  );

  return (
    <GameLayout
      topBar={
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Openings
          </button>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        </div>
      }
      board={<Board fen={fen} orientation={orientation} onMove={onMove} lastMove={lastMove} />}
      side={sidePanel}
    />
  );
}
