import { OPENINGS } from "@/lib/openings/database";
import type { GameReport } from "./analyzer";

export type Recommendation = { title: string; reason: string };
export type KeyMoment = {
  ply: number;
  label: string;
  note: string;
  side: "w" | "b";
  san: string;
};
export type OpeningReview = {
  name: string;
  eco?: string;
  deviationPly?: number;
  note: string;
};

export type Report = {
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
  keyMoments: KeyMoment[];
  opening: OpeningReview;
  quality: string;
};

function quality(overallAcc: number): string {
  if (overallAcc >= 92) return "Masterclass";
  if (overallAcc >= 85) return "Excellent";
  if (overallAcc >= 75) return "Solid";
  if (overallAcc >= 65) return "Uneven";
  return "Rough";
}

export function buildReport(g: GameReport): Report {
  const c = g.counts;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recs: Recommendation[] = [];

  if (g.accuracy.overall >= 85)
    strengths.push(`High overall accuracy — ${g.accuracy.overall.toFixed(1)}%.`);
  if (c.brilliant + c.great >= 1)
    strengths.push(
      `Found ${c.brilliant + c.great} standout move${c.brilliant + c.great > 1 ? "s" : ""} that required real calculation.`,
    );
  if (c.best + c.excellent >= g.moves.length * 0.5)
    strengths.push("Consistent engine-level moves across the game.");
  if (g.avgCpl.white < 30 && g.avgCpl.black < 30)
    strengths.push("Low average centipawn loss for both sides — precise play.");

  if (c.blunder >= 1)
    weaknesses.push(
      `${c.blunder} blunder${c.blunder > 1 ? "s" : ""} — critical evaluation lapses that changed the game.`,
    );
  if (c.mistake >= 2)
    weaknesses.push(`${c.mistake} mistakes — repeated tactical inaccuracies.`);
  if (c.missed_win >= 1)
    weaknesses.push(
      `${c.missed_win} missed win${c.missed_win > 1 ? "s" : ""} — winning positions weren't converted.`,
    );
  if (c.missed_tactic >= 1)
    weaknesses.push(
      `${c.missed_tactic} missed tactic${c.missed_tactic > 1 ? "s" : ""} — concrete forcing lines went unfound.`,
    );
  if (c.inaccuracy >= 4)
    weaknesses.push("Frequent small imprecisions — sharpen candidate move selection.");

  // Opening lookup: longest SAN prefix match.
  let bestMatch: { name: string; eco: string; deviation: number } | null = null;
  for (const o of OPENINGS) {
    let dev = 0;
    const cap = Math.min(o.moves.length, g.parsed.moves.length);
    while (dev < cap && o.moves[dev].san === g.parsed.moves[dev].san) dev++;
    if (dev >= 3 && (!bestMatch || dev > bestMatch.deviation)) {
      bestMatch = { name: o.name, eco: o.eco, deviation: dev };
    }
  }
  const opening: OpeningReview = bestMatch
    ? {
        name: bestMatch.name,
        eco: bestMatch.eco,
        deviationPly: bestMatch.deviation < g.parsed.moves.length ? bestMatch.deviation : undefined,
        note:
          bestMatch.deviation >= g.parsed.moves.length
            ? "You followed the main theoretical line throughout the opening."
            : `Left theory around move ${Math.floor(bestMatch.deviation / 2) + 1}${bestMatch.deviation % 2 === 0 ? "" : "…"}.`,
      }
    : {
        name: g.parsed.headers.Opening || "Unclassified opening",
        eco: g.parsed.headers.ECO,
        note: "Opening not recognized from the built-in database. Consider following an annotated repertoire.",
      };

  if (bestMatch) {
    recs.push({
      title: `Study the ${bestMatch.name}`,
      reason: "Deepen your repertoire with annotated main lines and typical middlegame plans.",
    });
  }
  if (c.blunder + c.mistake >= 2) {
    recs.push({
      title: "Train tactical patterns — Forks & Pins",
      reason: "Recurring tactical oversights suggest focused pattern drills will pay off.",
    });
  }
  if (c.missed_win >= 1) {
    recs.push({
      title: "Practice fundamental endgames",
      reason: "Winning positions dropped — study opposition, Lucena, and rook technique.",
    });
  }
  if (c.missed_tactic >= 2) {
    recs.push({
      title: "Calculation training",
      reason: "Multiple missed tactics — practice visualization and forcing-move discipline.",
    });
  }
  if (recs.length === 0) {
    recs.push({
      title: "Keep sharpening",
      reason: "Clean game overall — push complexity: study middlegame strategy and prophylaxis.",
    });
  }

  // Key moments: top by severity.
  const key: (KeyMoment & { score: number })[] = [];
  for (const m of g.moves) {
    let score = 0;
    let label = "";
    switch (m.classification) {
      case "brilliant":     score = 1000;              label = "💎 Brilliant"; break;
      case "great":         score = 800;               label = "⭐ Great move"; break;
      case "missed_win":    score = 700;               label = "⚫ Missed win"; break;
      case "blunder":       score = 500 + m.cpl;       label = "🔴 Blunder"; break;
      case "missed_tactic": score = 350 + m.cpl;       label = "⚠️ Missed tactic"; break;
      case "mistake":       score = 200 + m.cpl / 2;   label = "🟠 Mistake"; break;
      default: continue;
    }
    key.push({
      ply: m.ply,
      side: m.side,
      san: m.san,
      label,
      note: `${m.side === "w" ? "White" : "Black"} ${m.san}${m.bestSan ? ` · best was ${m.bestSan}` : ""}`,
      score,
    });
  }
  key.sort((a, b) => b.score - a.score);
  const keyMoments: KeyMoment[] = key.slice(0, 6).map(({ ply, label, note, side, san }) => ({
    ply,
    label,
    note,
    side,
    san,
  }));

  return {
    strengths,
    weaknesses,
    recommendations: recs,
    keyMoments,
    opening,
    quality: quality(g.accuracy.overall),
  };
}
