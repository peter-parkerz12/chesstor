import { Chess } from "chess.js";

import { getAnalyzer } from "./engine";
import { classifyMove, type Classification, type MoveEval, CLASS_ORDER } from "./classify";
import type { ParsedGame, PosMove } from "./pgn";

export type AnalyzedMove = PosMove & {
  eval: MoveEval;
  classification: Classification;
  cpl: number;
  bestSan?: string;
};

export type GameReport = {
  parsed: ParsedGame;
  moves: AnalyzedMove[];
  /** White-relative eval at every position: length = moves.length + 1. */
  evalTimeline: number[];
  accuracy: { white: number; black: number; overall: number };
  avgCpl: { white: number; black: number };
  counts: Record<Classification, number>;
};

export type AnalysisProgress = {
  label: string;
  done: number;
  total: number;
};

function uciToSan(fenBefore: string, uci: string): string | undefined {
  if (!uci || uci === "(none)") return undefined;
  const c = new Chess(fenBefore);
  try {
    const m = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: (uci.length >= 5 ? uci[4] : undefined) as never,
    });
    return m?.san;
  } catch {
    return undefined;
  }
}

// Lichess-style logistic: cp → win% for side to move.
function winPercent(cpWhite: number, side: "w" | "b"): number {
  const cp = side === "w" ? cpWhite : -cpWhite;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function moveAccuracy(beforeWP: number, afterWP: number): number {
  const acc = 103.1668 * Math.exp(-0.04354 * (beforeWP - afterWP)) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

export async function analyzeGame(
  parsed: ParsedGame,
  opts: {
    depth?: number;
    signal?: AbortSignal;
    onProgress?: (progress: AnalysisProgress) => void;
  } = {},
): Promise<GameReport> {
  if (!parsed.moves.length) throw new Error("PGN parsed, but no moves were available to analyze.");
  opts.onProgress?.({ label: "Generating positions…", done: 1, total: 100 });
  const positionCount = parsed.moves.length + 1;
  const depth = opts.depth ?? (positionCount > 160 ? 9 : positionCount > 90 ? 10 : 12);
  const engine = getAnalyzer();
  opts.onProgress?.({ label: "Initializing Stockfish…", done: 4, total: 100 });
  await engine.init();

  // Unique positions in order: initial (before first move) + fen after every move.
  const positions: string[] = [
    parsed.moves[0].fenBefore,
    ...parsed.moves.map((m) => m.fenAfter),
  ];

  const evals: Array<{ cp: number; second?: number; move: string }> = [];
  const total = positions.length;
  for (let i = 0; i < positions.length; i++) {
    if (opts.signal?.aborted) throw new Error("Analysis cancelled.");
    const r = await engine.analyze(positions[i], { depth, multipv: 2, signal: opts.signal });
    evals.push({
      cp: r.multipv[0]?.cp ?? 0,
      second: r.multipv[1]?.cp,
      move: r.multipv[0]?.move ?? "",
    });
    const analyzedDone = i + 1;
    opts.onProgress?.({
      label: `Analyzing move ${Math.min(analyzedDone, parsed.moves.length)} / ${parsed.moves.length}`,
      done: 8 + Math.round((analyzedDone / total) * 86),
      total: 100,
    });
    // Yield to the event loop to keep the UI responsive.
    await new Promise((res) => setTimeout(res, 0));
  }

  opts.onProgress?.({ label: "Generating review…", done: 96, total: 100 });

  const analyzed: AnalyzedMove[] = parsed.moves.map((m, i) => {
    const evalObj: MoveEval = {
      cpBefore: evals[i].cp,
      cpAfter: evals[i + 1].cp,
      bestMoveUci: evals[i].move,
      secondCp: evals[i].second,
      played: m.uci,
      side: m.side,
      fenBefore: m.fenBefore,
    };
    const { kind, cpl } = classifyMove(evalObj);
    return {
      ...m,
      eval: evalObj,
      classification: kind,
      cpl,
      bestSan: uciToSan(m.fenBefore, evals[i].move),
    };
  });

  const wAcc: number[] = [];
  const bAcc: number[] = [];
  const wCpl: number[] = [];
  const bCpl: number[] = [];
  const counts = Object.fromEntries(CLASS_ORDER.map((k) => [k, 0])) as Record<Classification, number>;
  for (const m of analyzed) {
    counts[m.classification]++;
    const wpBefore = winPercent(m.eval.cpBefore, m.side);
    const wpAfter = winPercent(m.eval.cpAfter, m.side);
    const acc = moveAccuracy(wpBefore, wpAfter);
    if (m.side === "w") {
      wAcc.push(acc);
      wCpl.push(m.cpl);
    } else {
      bAcc.push(acc);
      bCpl.push(m.cpl);
    }
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);

  return {
    parsed,
    moves: analyzed,
    evalTimeline: evals.map((e) => e.cp),
    accuracy: {
      white: avg(wAcc),
      black: avg(bAcc),
      overall: avg([...wAcc, ...bAcc]),
    },
    avgCpl: { white: avg(wCpl), black: avg(bCpl) },
    counts,
  };
}
