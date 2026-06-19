const KEY = "chesscoach:practice:v1";

export type AttemptResult = "solved" | "failed";

export type PracticeStats = {
  /** Per-position best status. */
  positions: Record<string, { status: AttemptResult; hintsUsed: number; attempts: number; firstSolved?: number }>;
  /** Counters by section. */
  totals: { attempts: number; solved: number };
};

const DEFAULT: PracticeStats = { positions: {}, totals: { attempts: 0, solved: 0 } };

export function readPracticeStats(): PracticeStats {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as PracticeStats;
    return {
      positions: parsed.positions ?? {},
      totals: parsed.totals ?? { attempts: 0, solved: 0 },
    };
  } catch {
    return DEFAULT;
  }
}

export function recordAttempt(positionId: string, result: AttemptResult, hintsUsed: number) {
  if (typeof window === "undefined") return;
  const stats = readPracticeStats();
  const prev = stats.positions[positionId] ?? { status: "failed" as AttemptResult, hintsUsed: 0, attempts: 0 };
  const next: PracticeStats = {
    positions: {
      ...stats.positions,
      [positionId]: {
        status: result === "solved" ? "solved" : prev.status,
        hintsUsed: Math.max(prev.hintsUsed, hintsUsed),
        attempts: prev.attempts + 1,
        firstSolved: prev.firstSolved ?? (result === "solved" ? Date.now() : undefined),
      },
    },
    totals: {
      attempts: stats.totals.attempts + 1,
      solved: stats.totals.solved + (result === "solved" && prev.status !== "solved" ? 1 : 0),
    },
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("chesscoach:practice"));
  } catch {
    /* noop */
  }
}
