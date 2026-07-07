import { Chess } from "chess.js";

export type PosMove = {
  ply: number;
  san: string;
  from: string;
  to: string;
  uci: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
  side: "w" | "b";
};

export type ParsedGame = {
  headers: Record<string, string>;
  moves: PosMove[];
  result: string;
};

function normalizePgn(pgnText: string): string {
  return (pgnText ?? "")
    .replace(/\b(e\.p\.|ep)\b/gi, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

/** Parse PGN text into a fully replayed, validated game. Throws on invalid input. */
export function parsePGN(pgnText: string): ParsedGame {
  const clean = normalizePgn(pgnText);
  if (!clean) throw new Error("PGN is empty. Paste or upload a valid PGN.");

  const chess = new Chess();
  try {
    // chess.js 1.x is lenient by default; unknown headers/comments are tolerated.
    chess.loadPgn(clean);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "could not parse PGN";
    throw new Error(`Invalid PGN — ${msg}`);
  }

  const headersRaw = (chess.header?.() ?? {}) as Record<string, unknown>;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(headersRaw)) {
    if (v !== null && v !== undefined && String(v) !== "?") headers[k] = String(v);
  }

  const verbose = chess.history({ verbose: true }) as Array<{
    san: string;
    from: string;
    to: string;
    color: "w" | "b";
    promotion?: string;
  }>;
  if (!verbose.length) throw new Error("PGN parsed but contains no moves.");

  // Replay to compute FENs. Start from FEN header if present.
  const startFen = headers.FEN && headers.SetUp === "1" ? headers.FEN : undefined;
  const replay = startFen ? new Chess(startFen) : new Chess();

  const moves: PosMove[] = verbose.map((m, i) => {
    const fenBefore = replay.fen();
    let applied;
    try {
      applied = replay.move({ from: m.from, to: m.to, promotion: m.promotion });
    } catch {
      applied = null;
    }
    if (!applied) throw new Error(`Illegal move in PGN at ply ${i + 1}: ${m.san}`);
    return {
      ply: i,
      san: applied.san,
      from: m.from,
      to: m.to,
      uci: `${m.from}${m.to}${m.promotion ?? ""}`,
      promotion: m.promotion,
      fenBefore,
      fenAfter: replay.fen(),
      side: m.color,
    };
  });

  return { headers, moves, result: headers.Result || "*" };
}

export function formatDate(headers: Record<string, string>): string {
  const raw = headers.Date || headers.UTCDate || "";
  if (!raw || raw.includes("?")) return "—";
  return raw.replace(/\./g, "-");
}
