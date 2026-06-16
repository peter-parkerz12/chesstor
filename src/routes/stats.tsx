import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trophy, Target, Brain, Swords, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import { listGames, listOpeningProgress, type GameRecord, type OpeningProgress } from "@/lib/db/idb";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Progress — ChessCoach" },
      { name: "description", content: "Your chess progress: games, accuracy, openings mastered, and most common mistakes." },
    ],
  }),
  ssr: false,
  component: Stats,
});

function Stats() {
  const [games, setGames] = useState<GameRecord[]>([]);
  const [openings, setOpenings] = useState<OpeningProgress[]>([]);

  useEffect(() => {
    Promise.all([listGames(), listOpeningProgress()])
      .then(([g, o]) => { setGames(g); setOpenings(o); })
      .catch(() => null);
  }, []);

  const agg = useMemo(() => {
    const total = games.length;
    const wins = games.filter((g) => g.result === "win").length;
    const losses = games.filter((g) => g.result === "loss").length;
    const draws = games.filter((g) => g.result === "draw").length;
    const cpls = games.map((g) => g.cplAvg).filter((x) => x > 0);
    const avgCpl = cpls.length ? Math.round(cpls.reduce((a, b) => a + b, 0) / cpls.length) : 0;
    const phase = { opening: [] as number[], middlegame: [] as number[], endgame: [] as number[] };
    const buckets = { development: 0, tactics: 0, kingSafety: 0, endgame: 0 };
    for (const g of games) {
      if (g.cplByPhase.opening) phase.opening.push(g.cplByPhase.opening);
      if (g.cplByPhase.middlegame) phase.middlegame.push(g.cplByPhase.middlegame);
      if (g.cplByPhase.endgame) phase.endgame.push(g.cplByPhase.endgame);
      buckets.development += g.mistakeBuckets.development;
      buckets.tactics += g.mistakeBuckets.tactics;
      buckets.kingSafety += g.mistakeBuckets.kingSafety;
      buckets.endgame += g.mistakeBuckets.endgame;
    }
    const phaseScore = (arr: number[]) => {
      if (!arr.length) return null;
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      // CPL → 0–100 score: 0 cpl = 100%, 300+ cpl = 0%
      return Math.max(0, Math.min(100, Math.round(100 - (avg / 3))));
    };
    const mostCommon = (Object.entries(buckets) as Array<[keyof typeof buckets, number]>)
      .sort((a, b) => b[1] - a[1])[0];
    return {
      total, wins, losses, draws, avgCpl,
      openingScore: phaseScore(phase.opening),
      middlegameScore: phaseScore(phase.middlegame),
      endgameScore: phaseScore(phase.endgame),
      mostCommonMistake: mostCommon && mostCommon[1] > 0 ? mostCommon[0] : null,
    };
  }, [games]);

  const winRate = agg.total ? Math.round((agg.wins / agg.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-10 pb-nav lg:px-8 lg:pt-16">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <h1 className="text-3xl font-bold sm:text-4xl">Your progress</h1>
      <p className="mt-2 text-sm text-muted-foreground">All your data stays on this device.</p>

      {agg.total === 0 ? (
        <ClayCard className="mt-10 text-center">
          <p className="text-muted-foreground">No games yet — play your first to start tracking.</p>
        </ClayCard>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard icon={Swords} label="Games" value={agg.total.toString()} />
            <StatCard icon={Trophy} label="Win rate" value={`${winRate}%`} accent />
            <StatCard icon={Target} label="Avg CPL" value={agg.avgCpl ? agg.avgCpl.toString() : "—"} hint="Lower = better" />
            <StatCard
              icon={Brain}
              label="Top weakness"
              value={agg.mostCommonMistake ? prettyBucket(agg.mostCommonMistake) : "—"}
            />
          </div>

          <SmartRecommendation
            mistake={agg.mostCommonMistake}
            openingScore={agg.openingScore}
            middlegameScore={agg.middlegameScore}
            endgameScore={agg.endgameScore}
          />

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PhaseScore label="Opening" value={agg.openingScore} />
            <PhaseScore label="Middlegame" value={agg.middlegameScore} />
            <PhaseScore label="Endgame" value={agg.endgameScore} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ClayCard>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Results</h3>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/5">
                <div className="bg-success" style={{ width: `${(agg.wins / agg.total) * 100}%` }} />
                <div className="bg-warning/70" style={{ width: `${(agg.draws / agg.total) * 100}%` }} />
                <div className="bg-danger/80" style={{ width: `${(agg.losses / agg.total) * 100}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span><span className="font-mono text-foreground">{agg.wins}</span> wins</span>
                <span><span className="font-mono text-foreground">{agg.draws}</span> draws</span>
                <span><span className="font-mono text-foreground">{agg.losses}</span> losses</span>
              </div>
            </ClayCard>

            <ClayCard>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Openings drilled</h3>
              {openings.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Try the opening trainer to track per-line accuracy.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {openings.sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 6).map((o) => (
                    <li key={o.id} className="flex items-center justify-between text-sm">
                      <span>{o.name}</span>
                      <span className="font-mono text-gold">{Math.round(o.accuracy * 100)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </ClayCard>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: typeof Trophy; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <ClayCard className={`!p-5 ${accent ? "glow-gold" : ""}`}>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent ? "bg-gold/15 text-gold" : "bg-white/5 text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </ClayCard>
    </motion.div>
  );
}

function PhaseScore({ label, value }: { label: string; value: number | null }) {
  return (
    <GlassPanel>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">{label}</h4>
        <span className="font-mono text-lg font-bold text-gold">{value !== null ? `${value}%` : "—"}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-gold to-success"
          initial={{ width: 0 }}
          animate={{ width: value !== null ? `${value}%` : "0%" }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </GlassPanel>
  );
}

function prettyBucket(b: string): string {
  switch (b) {
    case "development": return "Development";
    case "tactics": return "Tactics";
    case "kingSafety": return "King safety";
    case "endgame": return "Endgame";
    default: return b;
  }
}

function SmartRecommendation({
  mistake, openingScore, middlegameScore, endgameScore,
}: {
  mistake: string | null;
  openingScore: number | null;
  middlegameScore: number | null;
  endgameScore: number | null;
}) {
  const scores = [
    { label: "opening", value: openingScore },
    { label: "middlegame", value: middlegameScore },
    { label: "endgame", value: endgameScore },
  ].filter((s): s is { label: string; value: number } => s.value !== null);
  const weakest = scores.length ? scores.reduce((a, b) => (a.value < b.value ? a : b)) : null;

  let title = "Keep playing to unlock recommendations";
  let body = "Play a few more games and the coach will suggest where to focus your training.";
  let to: "/openings" | "/play/ai" = "/play/ai";
  let cta = "Play a game";

  if (mistake === "development" || (weakest && weakest.label === "opening" && weakest.value < 70)) {
    title = "Focus: opening principles";
    body = "Your opening accuracy is the weakest part of your play. Drill the London System or Italian Game to sharpen development and central control.";
    to = "/openings"; cta = "Train openings";
  } else if (mistake === "tactics" || (weakest && weakest.label === "middlegame" && weakest.value < 70)) {
    title = "Focus: piece safety & tactics";
    body = "You're dropping pieces or missing tactics in the middlegame. Slow down — check every move for threats and undefended pieces.";
    to = "/play/ai"; cta = "Practice vs AI";
  } else if (mistake === "kingSafety") {
    title = "Focus: king safety";
    body = "Castle earlier and watch for threats around your king. Avoid weakening pawn moves in front of your castled king.";
    to = "/openings"; cta = "Drill safer openings";
  } else if (mistake === "endgame" || (weakest && weakest.label === "endgame" && weakest.value < 70)) {
    title = "Focus: endgame technique";
    body = "Your endgame accuracy is the weakest. Activate your king, push passed pawns, and convert advantages into queens.";
    to = "/play/ai"; cta = "Play more endgames";
  } else if (weakest) {
    title = "You're playing well — keep it up";
    body = `Your strongest area is ${scores.reduce((a, b) => (a.value > b.value ? a : b)).label}. Push the difficulty up for a tougher challenge.`;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.1 }} className="mt-6">
      <ClayCard className="ring-1 ring-gold/20 glow-gold">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coach recommends</p>
              <h3 className="mt-1 text-lg font-bold">{title}</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </div>
          <Link
            to={to}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-2xl bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            {cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </ClayCard>
    </motion.div>
  );
}
