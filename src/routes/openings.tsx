import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

import { Board } from "@/components/chess/Board";
import { GameLayout } from "@/components/chess/GameLayout";
import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { OPENINGS, findOpening, type Opening } from "@/lib/openings/database";
import { recordOpeningAttempt, listOpeningProgress, type OpeningProgress } from "@/lib/db/idb";
import { useGameMode } from "@/components/nav/island-context";

export const Route = createFileRoute("/openings")({
  head: () => ({
    meta: [
      { title: "Opening Trainer — ChessCoach" },
      { name: "description", content: "Drill the Italian, Sicilian, French, London, Queen's Gambit, and Ruy Lopez move by move." },
    ],
  }),
  ssr: false,
  component: OpeningsRoute,
});

function OpeningsRoute() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<OpeningProgress[]>([]);

  useEffect(() => {
    listOpeningProgress().then(setProgress).catch(() => null);
  }, [selectedId]);

  if (selectedId) {
    const opening = findOpening(selectedId);
    if (opening) return <OpeningDrill opening={opening} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-10 pb-nav lg:px-8 lg:pt-16">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <h1 className="text-3xl font-bold sm:text-4xl">Opening Trainer</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Pick an opening to drill. Play the mainline move by move — every deviation shows the book continuation.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OPENINGS.map((o, i) => {
          const p = progress.find((x) => x.id === o.id);
          return (
            <motion.button
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              onClick={() => setSelectedId(o.id)}
              className="group text-left"
            >
              <ClayCard className="h-full transition-transform group-hover:-translate-y-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold">{o.name}</h3>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{o.eco}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{o.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{o.moves.length} book moves</span>
                  {p && (
                    <span className="text-xs font-mono text-gold">{Math.round(p.accuracy * 100)}%</span>
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
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [moveIdx, setMoveIdx] = useState(0);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string; expected: string; played: string } | null>(null);
  const [done, setDone] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const orientation = "white"; // Show from White's perspective for simplicity.

  const reset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setMoveIdx(0);
    setFeedback(null);
    setDone(false);
    setLastMove(null);
  }, [chess]);

  const advanceComputerSide = useCallback((idx: number) => {
    // For each move, after the user plays a White move (even index), auto-play the
    // book Black reply (odd index) so the user always responds to the mainline.
    // For Sicilian/French where Black drills, we'd flip — keeping White-only training here.
    if (idx >= opening.moves.length) {
      setDone(true);
      return;
    }
    const next = opening.moves[idx];
    setTimeout(() => {
      try {
        const mv = chess.move(next);
        if (mv) {
          setFen(chess.fen());
          setLastMove({ from: mv.from, to: mv.to });
        }
        setMoveIdx(idx + 1);
        if (idx + 1 >= opening.moves.length) setDone(true);
      } catch {
        // book move illegal? skip
      }
    }, 350);
  }, [chess, opening.moves]);

  const onMove = useCallback((from: string, to: string) => {
    if (done) return false;
    const expectedSAN = opening.moves[moveIdx];
    if (!expectedSAN) return false;
    // Try the user's move
    let mv;
    try {
      mv = chess.move({ from, to, promotion: "q" });
    } catch { return false; }
    if (!mv) return false;
    const playedSAN = mv.san;
    const ok = playedSAN === expectedSAN;
    if (!ok) {
      // Undo so they can try again
      chess.undo();
      setFeedback({
        ok: false,
        message: "Not the book move.",
        expected: expectedSAN,
        played: playedSAN,
      });
      recordOpeningAttempt(opening.id, opening.name, false);
      return false;
    }
    setFen(chess.fen());
    setLastMove({ from: mv.from, to: mv.to });
    setFeedback({ ok: true, message: "Book move ✓", expected: expectedSAN, played: playedSAN });
    recordOpeningAttempt(opening.id, opening.name, true);
    const nextIdx = moveIdx + 1;
    setMoveIdx(nextIdx);
    advanceComputerSide(nextIdx);
    return true;
  }, [advanceComputerSide, chess, done, moveIdx, opening.id, opening.moves, opening.name]);

  const expected = opening.moves[moveIdx];
  const userTurn = chess.turn() === "w"; // White-only training assumption

  const sidePanel = (
    <div className="flex flex-col gap-4">
      <ClayCard className="!p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{opening.eco}</p>
        <h3 className="mt-1 text-xl font-bold">{opening.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{opening.description}</p>
      </ClayCard>

      <GlassPanel>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress</h4>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-gold">{Math.min(moveIdx, opening.moves.length)}</span>
          <span className="text-sm text-muted-foreground">/ {opening.moves.length} moves</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full bg-gold"
            animate={{ width: `${(Math.min(moveIdx, opening.moves.length) / opening.moves.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        {expected && userTurn && !done && (
          <p className="mt-3 text-xs text-muted-foreground">Your move. Look for the book line.</p>
        )}
      </GlassPanel>

      {feedback && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <ClayCard className={`!p-4 ring-1 ${feedback.ok ? "ring-success/30" : "ring-danger/30"}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {feedback.ok ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-danger" />
              )}
              {feedback.message}
            </div>
            {!feedback.ok && (
              <p className="mt-2 text-xs text-muted-foreground">
                Mainline was <span className="font-mono text-gold">{feedback.expected}</span>. You played <span className="font-mono">{feedback.played}</span>.
              </p>
            )}
          </ClayCard>
        </motion.div>
      )}

      {done && (
        <ClayCard className="!p-5 ring-1 ring-gold/30">
          <h4 className="text-lg font-bold text-gold">Opening complete</h4>
          <p className="mt-1 text-sm text-muted-foreground">You played the full mainline. Try another or replay this one.</p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={reset} className="bg-gold text-primary-foreground hover:bg-gold/90">
              <RotateCcw className="h-4 w-4" /> Replay
            </Button>
            <Button size="sm" variant="outline" onClick={onBack}>Choose another</Button>
          </div>
        </ClayCard>
      )}
    </div>
  );

  return (
    <GameLayout
      topBar={
        <div className="flex items-center justify-between gap-3">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
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
