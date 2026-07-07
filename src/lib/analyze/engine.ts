// Dedicated Stockfish analyzer with MultiPV support.
// Loads Stockfish in a same-origin blob worker that imports the CDN script.

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
  timeoutId: number;
  cleanup: () => void;
};

type Queued = { run: () => void; reject: (e: Error) => void };

class AnalyzerEngine {
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private uciok = false;
  private readyok = false;
  private configured = false;
  private initPromise: Promise<void> | null = null;
  private initResolve: (() => void) | null = null;
  private initReject: ((e: Error) => void) | null = null;
  private initTimeoutId: number | null = null;
  private current: Current | null = null;
  private queue: Queued[] = [];

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const code = `self.importScripts("${STOCKFISH_CDN}");`;
    const url = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
    const worker = new Worker(url);
    this.worker = worker;
    this.workerUrl = url;
    worker.onmessage = (event) => this.onMessage(typeof event.data === "string" ? event.data : String(event.data));
    worker.onerror = () => this.fail(new Error("Stockfish failed to load. Check your connection and try again."));
    worker.onmessageerror = () => this.fail(new Error("Stockfish returned an unreadable response."));
    worker.postMessage("uci");
    worker.postMessage("isready");
    return worker;
  }

  private send(cmd: string) {
    this.ensure().postMessage(cmd);
  }

  private finishInitIfReady() {
    if (!this.uciok || !this.readyok) return;
    if (!this.configured) {
      this.configured = true;
      // The stockfish.js build can freeze searches after setting Threads, even
      // though it advertises the option. Hash and MultiPV are safe.
      this.send("setoption name Hash value 16");
    }
    if (this.initTimeoutId !== null) window.clearTimeout(this.initTimeoutId);
    this.initTimeoutId = null;
    this.initResolve?.();
    this.initResolve = null;
    this.initReject = null;
  }

  private onMessage(line: string) {
    if (!line) return;
    if (line === "uciok") {
      this.uciok = true;
      this.finishInitIfReady();
      return;
    }
    if (line === "readyok") {
      this.readyok = true;
      this.finishInitIfReady();
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
      this.current.depth = parseInt(depthM[1], 10);
      return;
    }

    if (line.startsWith("bestmove")) {
      const current = this.current;
      this.current = null;
      window.clearTimeout(current.timeoutId);
      current.cleanup();
      const out: PVLine[] = [];
      for (let i = 1; i <= current.multipv; i++) {
        const pv = current.lines.get(i);
        if (!pv) continue;
        out.push({
          cp: current.sideToMove === "w" ? pv.cp : -pv.cp,
          mate: pv.mate,
          move: pv.move,
        });
      }
      if (out.length === 0) {
        const parts = line.split(/\s+/);
        const move = parts[1] && parts[1] !== "(none)" ? parts[1] : "";
        out.push({ cp: 0, mate: null, move });
      }
      current.resolve({ fen: current.fen, multipv: out, depth: current.depth });
      this.runNext();
    }
  }

  private runNext() {
    const next = this.queue.shift();
    next?.run();
  }

  private fail(error: Error) {
    if (this.initTimeoutId !== null) window.clearTimeout(this.initTimeoutId);
    this.initReject?.(error);
    if (this.current) {
      window.clearTimeout(this.current.timeoutId);
      this.current.cleanup();
      this.current.reject(error);
    }
    for (const queued of this.queue) queued.reject(error);
    this.destroy();
  }

  async init(): Promise<void> {
    if (this.uciok && this.readyok) return;
    if (this.initPromise) return this.initPromise;
    this.ensure();
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;
      this.initTimeoutId = window.setTimeout(() => {
        reject(new Error("Stockfish did not become ready in time. Please retry the analysis."));
        this.destroy();
      }, 12_000);
      this.finishInitIfReady();
    });
    return this.initPromise;
  }

  analyze(
    fen: string,
    opts: { depth?: number; multipv?: number; timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<AnalyzeOut> {
    const depth = opts.depth ?? 12;
    const multipv = opts.multipv ?? 1;
    const timeoutMs = opts.timeoutMs ?? Math.max(10_000, depth * 3_000);

    return new Promise<AnalyzeOut>((resolve, reject) => {
      const run = () => {
        if (opts.signal?.aborted) {
          reject(new Error("Analysis cancelled."));
          this.runNext();
          return;
        }

        const timeoutId = window.setTimeout(() => {
          const current = this.current;
          if (!current) return;
          try {
            this.worker?.postMessage("stop");
          } catch {
            /* worker already gone */
          }
          current.cleanup();
          current.reject(new Error("Stockfish search timed out. Try again with a shorter game."));
          this.destroy();
        }, timeoutMs);

        const cleanup = () => opts.signal?.removeEventListener("abort", abort);
        const abort = () => {
          window.clearTimeout(timeoutId);
          cleanup();
          if (this.current?.fen === fen) this.current = null;
          try {
            this.worker?.postMessage("stop");
          } catch {
            /* worker already gone */
          }
          reject(new Error("Analysis cancelled."));
          this.runNext();
        };
        opts.signal?.addEventListener("abort", abort, { once: true });

        this.current = {
          fen,
          sideToMove: (fen.split(" ")[1] as "w" | "b") ?? "w",
          lines: new Map(),
          depth: 0,
          multipv,
          resolve,
          reject,
          timeoutId,
          cleanup,
        };
        this.send(`setoption name MultiPV value ${multipv}`);
        this.send("ucinewgame");
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
      };

      if (this.current) this.queue.push({ run, reject });
      else run();
    });
  }

  destroy() {
    this.worker?.terminate();
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
    this.worker = null;
    this.workerUrl = null;
    this.uciok = false;
    this.readyok = false;
    this.configured = false;
    this.initPromise = null;
    this.initResolve = null;
    this.initReject = null;
    if (this.initTimeoutId !== null) window.clearTimeout(this.initTimeoutId);
    this.initTimeoutId = null;
    this.current = null;
    this.queue = [];
  }
}

let instance: AnalyzerEngine | null = null;
export function getAnalyzer(): AnalyzerEngine {
  if (!instance) instance = new AnalyzerEngine();
  return instance;
}
