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
  reject: (e: Error) => void;
  timeoutId: number | null;
};

class AnalyzerEngine {
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private uciok = false;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private initResolve: (() => void) | null = null;
  private initReject: ((e: Error) => void) | null = null;
  private current: Current | null = null;
  private queue: Array<() => void> = [];

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const code = `self.importScripts("${STOCKFISH_CDN}");`;
    const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    this.workerUrl = url;
    const w = new Worker(url);
    w.onmessage = (e) => this.onMessage(typeof e.data === "string" ? e.data : String(e.data));
    w.onerror = () => this.fail(new Error("Stockfish failed to load. Check your connection and try again."));
    w.onmessageerror = () => this.fail(new Error("Stockfish returned an unreadable response."));
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
    if (line === "uciok") {
      this.uciok = true;
      return;
    }
    if (line === "readyok") {
      this.ready = true;
      if (this.uciok) {
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
      }
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
      if (cur.timeoutId !== null) window.clearTimeout(cur.timeoutId);
      const out: PVLine[] = [];
      for (let i = 1; i <= cur.multipv; i++) {
        const l = cur.lines.get(i);
        if (!l) continue;
        const cpWhite = cur.sideToMove === "w" ? l.cp : -l.cp;
        out.push({ cp: cpWhite, mate: l.mate, move: l.move });
      }
      if (out.length === 0) {
        const parts = line.split(/\s+/);
        const move = parts[1] && parts[1] !== "(none)" ? parts[1] : "";
        out.push({ cp: 0, mate: null, move });
      }
      cur.resolve({ fen: cur.fen, multipv: out, depth: cur.depth });
      const n = this.queue.shift();
      if (n) n();
    }
  }

  private fail(error: Error) {
    this.initReject?.(error);
    this.initResolve = null;
    this.initReject = null;
    this.initPromise = null;
    if (this.current) {
      const cur = this.current;
      if (cur.timeoutId !== null) window.clearTimeout(cur.timeoutId);
      cur.reject(error);
    }
    const queued = this.queue.splice(0);
    this.destroy();
    queued.forEach(() => undefined);
  }

  async init(): Promise<void> {
    if (this.uciok && this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.ensure();
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
      const timeoutId = window.setTimeout(() => {
        reject(new Error("Stockfish did not become ready in time. Please retry the analysis."));
        this.destroy();
      }, 12_000);
      const done = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      this.initResolve = done;
    });
    await this.initPromise;
    // Do not set Threads here: the stockfish.js build advertises it, but setting it
    // can leave searches permanently silent in some browsers. Hash is safe.
    this.send("setoption name Hash value 16");
    this.send("isready");
    await new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(new Error("Stockfish option setup timed out.")), 5_000);
      const finish = () => {
        window.clearTimeout(timeoutId);
        resolve();
      };
      const previous = this.initResolve;
      this.initResolve = () => {
        previous?.();
        finish();
      };
    });
  }

  analyze(
    fen: string,
    opts: { depth?: number; multipv?: number; timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<AnalyzeOut> {
    const depth = opts.depth ?? 14;
    const multipv = opts.multipv ?? 1;
    const timeoutMs = opts.timeoutMs ?? Math.max(10_000, depth * 3_000);
    return new Promise<AnalyzeOut>((resolve, reject) => {
      const run = () => {
        if (opts.signal?.aborted) {
          reject(new Error("Analysis cancelled."));
          return;
        }
        const timeoutId = window.setTimeout(() => {
          this.send("stop");
          const cur = this.current;
          this.current = null;
          cur?.reject(new Error("Stockfish search timed out. Try again with a shorter game."));
          this.destroy();
        }, timeoutMs);
        const abort = () => {
          if (timeoutId !== null) window.clearTimeout(timeoutId);
          this.send("stop");
          if (this.current?.fen === fen) this.current = null;
          reject(new Error("Analysis cancelled."));
        };
        opts.signal?.addEventListener("abort", abort, { once: true });
        const side = (fen.split(" ")[1] as "w" | "b") ?? "w";
        this.current = {
          fen,
          sideToMove: side,
          lines: new Map(),
          depth: 0,
          multipv,
          resolve,
          reject,
          timeoutId,
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
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
    this.worker = null;
    this.workerUrl = null;
    this.uciok = false;
    this.ready = false;
    this.initPromise = null;
    this.initResolve = null;
    this.initReject = null;
    this.current = null;
    this.queue = [];
  }
}

let instance: AnalyzerEngine | null = null;
export function getAnalyzer(): AnalyzerEngine {
  if (!instance) instance = new AnalyzerEngine();
  return instance;
}
