// Stockfish WebWorker wrapper using UCI protocol.
// Loads Stockfish from CDN via a same-origin blob worker (importScripts CDN).

export type EvalResult = {
  /** Centipawns from White's perspective. Positive = White is better. */
  cp: number;
  /** Mate in N moves from side-to-move's perspective. null if no mate. */
  mate: number | null;
  /** Best move in UCI long algebraic, e.g. "e2e4". */
  bestMove: string | null;
  depth: number;
};

const STOCKFISH_CDN = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

type Pending = {
  fen: string;
  resolve: (r: EvalResult) => void;
  cp: number;
  mate: number | null;
  depth: number;
  bestMove: string | null;
};

class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private current: Pending | null = null;
  private queue: Array<() => void> = [];
  private skill = 20;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const code = `self.importScripts("${STOCKFISH_CDN}");`;
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    w.onmessage = (e) => this.onMessage(typeof e.data === "string" ? e.data : String(e.data));
    w.onerror = (e) => {
      console.error("Stockfish worker error", e);
    };
    this.worker = w;
    this.send("uci");
    this.send("isready");
    return w;
  }

  private send(cmd: string) {
    this.ensureWorker().postMessage(cmd);
  }

  private onMessage(line: string) {
    if (!line) return;
    if (line === "readyok") {
      this.ready = true;
      const next = this.queue.shift();
      if (next) next();
      return;
    }
    if (!this.current) return;
    if (line.startsWith("info")) {
      // info depth N score cp X / score mate Y ... pv ...
      const depthMatch = line.match(/\bdepth (\d+)/);
      const cpMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      const pvMatch = line.match(/\bpv ([a-h1-8a-z0-9]+)/);
      if (depthMatch) this.current.depth = parseInt(depthMatch[1], 10);
      if (cpMatch) {
        this.current.cp = parseInt(cpMatch[1], 10);
        this.current.mate = null;
      }
      if (mateMatch) {
        this.current.mate = parseInt(mateMatch[1], 10);
        // Encode mate as ±10000 in cp so consumers can sort.
        this.current.cp = this.current.mate > 0 ? 10000 - this.current.mate : -10000 - this.current.mate;
      }
      if (pvMatch) this.current.bestMove = pvMatch[1];
    } else if (line.startsWith("bestmove")) {
      const parts = line.split(/\s+/);
      const best = parts[1];
      if (best && best !== "(none)") this.current.bestMove = best;
      const cur = this.current;
      this.current = null;
      // Adjust cp to "White's perspective": engine reports from side-to-move.
      const fenParts = cur.fen.split(" ");
      const sideToMove = fenParts[1] as "w" | "b";
      const cpWhite = sideToMove === "w" ? cur.cp : -cur.cp;
      cur.resolve({
        cp: cpWhite,
        mate: cur.mate,
        bestMove: cur.bestMove,
        depth: cur.depth,
      });
      const next = this.queue.shift();
      if (next) next();
    }
  }

  async init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<void>((resolve) => {
      this.ensureWorker();
      const check = () => {
        if (this.ready) resolve();
        else setTimeout(check, 50);
      };
      check();
    });
    return this.readyPromise;
  }

  setSkill(level: number) {
    const clamped = Math.max(0, Math.min(20, Math.round(level)));
    this.skill = clamped;
    this.send(`setoption name Skill Level value ${clamped}`);
  }

  /** Analyze a FEN to a fixed depth. Queues if engine busy. */
  analyze(fen: string, opts: { depth?: number; movetime?: number } = {}): Promise<EvalResult> {
    return new Promise<EvalResult>((resolve) => {
      const run = () => {
        this.current = { fen, resolve, cp: 0, mate: null, depth: 0, bestMove: null };
        this.send("ucinewgame");
        this.send(`position fen ${fen}`);
        if (opts.movetime) this.send(`go movetime ${opts.movetime}`);
        else this.send(`go depth ${opts.depth ?? 12}`);
      };
      if (this.current) this.queue.push(run);
      else run();
    });
  }

  /** Pick a move for AI play at the configured skill level. */
  pickMove(fen: string, movetime = 500): Promise<string | null> {
    return this.analyze(fen, { movetime }).then((r) => r.bestMove);
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.readyPromise = null;
    this.current = null;
    this.queue = [];
  }
}

// Two singletons: one for the opponent (skill varies), one for the coach (always max).
let opponent: StockfishEngine | null = null;
let coach: StockfishEngine | null = null;

export function getOpponentEngine(): StockfishEngine {
  if (!opponent) opponent = new StockfishEngine();
  return opponent;
}
export function getCoachEngine(): StockfishEngine {
  if (!coach) {
    coach = new StockfishEngine();
    coach.init().then(() => coach!.setSkill(20));
  }
  return coach;
}

export const DIFFICULTY_TIERS = [
  { id: "beginner", label: "Beginner", skill: 2, elo: 400, movetime: 200 },
  { id: "easy", label: "Easy", skill: 5, elo: 800, movetime: 300 },
  { id: "medium", label: "Medium", skill: 8, elo: 1200, movetime: 500 },
  { id: "hard", label: "Hard", skill: 13, elo: 1600, movetime: 700 },
  { id: "expert", label: "Expert", skill: 17, elo: 2000, movetime: 1000 },
  { id: "master", label: "Master", skill: 20, elo: 2500, movetime: 1500 },
] as const;

export type DifficultyId = (typeof DIFFICULTY_TIERS)[number]["id"];
