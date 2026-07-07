// Dedicated Stockfish analyzer with MultiPV support.
// Reuses same CDN blob-worker approach as src/lib/engine/stockfish.ts.

const STOCKFISH_CDN = "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

export type PVLine = {
  /** Centipawns from WHITE's perspective. Mate encoded as ±10000∓n. */
  cp: number;
  mate: number | null;
  /** Best move in UCI long algebraic. */
  move: string;
};

export type AnalyzeOut = {
  fen: string;
  multipv: PVLine[];
  depth: number;
};

type Current = {
  fen: string;
  sideToMove: "w" | "b";
  lines: Map<number, { cp: number; mate: number | null; move: string }>;
  depth: number;
  multipv: number;
  resolve: (r: AnalyzeOut) => void;
};

class AnalyzerEngine {
  private worker: Worker | null = null;
  private ready = false;
  private current: Current | null = null;
  private queue: Array<() => void> = [];

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const code = `self.importScripts("${STOCKFISH_CDN}");`;
    const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    const w = new Worker(url);
    w.onmessage = (e) => this.onMessage(typeof e.data === "string" ? e.data : String(e.data));
    w.onerror = (e) => console.error("Analyzer worker error", e);
    this.worker = w;
    w.postMessage("uci");
    w.postMessage("isready");
    return w;
  }

  private send(cmd: string) {
    this.ensure().postMessage(cmd);
  }

  private onMessage(line: string) {
    if (!line) return;
    if (line === "readyok") {
      this.ready = true;
      const n = this.queue.shift();
      if (n) n();
      return;
    }
    if (!this.current) return;
    if (line.startsWith("info")) {
      const depthM = line.match(/\bdepth (\d+)/);
      const mpvM = line.match(/multipv (\d+)/);
      const cpM = line.match(/score cp (-?\d+)/);
      const mateM = line.match(/score mate (-?\d+)/);
      const pvM = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/);
      if (!pvM || !depthM) return;
      const mpv = mpvM ? parseInt(mpvM[1], 10) : 1;
      let cp = 0;
      let mate: number | null = null;
      if (cpM) cp = parseInt(cpM[1], 10);
      else if (mateM) {
        mate = parseInt(mateM[1], 10);
        cp = mate > 0 ? 10000 - mate : -10000 - mate;
      } else return;
      this.current.lines.set(mpv, { cp, mate, move: pvM[1] });
      this.current.depth = parseInt(depthM[1], 10); } else if (line === "uciok") { this.ready = true; this.send("isready"); } else if (line === "readyok") {
    } else if (line.startsWith("bestmove")) {
      const cur = this.current;
      this.current = null;
      const out: PVLine[] = [];
      for (let i = 1; i <= cur.multipv; i++) {
        const l = cur.lines.get(i);
        if (!l) continue;
        const cpWhite = cur.sideToMove === "w" ? l.cp : -l.cp;
        out.push({ cp: cpWhite, mate: l.mate, move: l.move });
      }
      cur.resolve({ fen: cur.fen, multipv: out, depth: cur.depth });
      const n = this.queue.shift();
      if (n) n();
    }
  }

  async init(): Promise<void> {
    this.ensure();
    if (this.ready) return;
    await new Promise<void>((resolve) => {
      const check = () => (this.ready ? resolve() : setTimeout(check, 40));
      check();
    });
    this.send("setoption name Threads value 1");
    this.send("setoption name Hash value 32");
  }

  analyze(
    fen: string,
    opts: { depth?: number; multipv?: number } = {},
  ): Promise<AnalyzeOut> {
    const depth = opts.depth ?? 14;
    const multipv = opts.multipv ?? 1;
    return new Promise<AnalyzeOut>((resolve) => {
      const run = () => {
        const side = (fen.split(" ")[1] as "w" | "b") ?? "w";
        this.current = {
          fen,
          sideToMove: side,
          lines: new Map(),
          depth: 0,
          multipv,
          resolve,
        };
        this.send(`setoption name MultiPV value ${multipv}`);
        this.send("ucinewgame");
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      };
      if (this.current) this.queue.push(run);
      else run();
    });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.current = null;
    this.queue = [];
  }
}

let instance: AnalyzerEngine | null = null;
export function getAnalyzer(): AnalyzerEngine {
  if (!instance) instance = new AnalyzerEngine();
  return instance;
}
