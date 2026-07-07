import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight, FileUp, RotateCcw, Sparkles, Upload, X } from "lucide-react";

import { Board } from "@/components/chess/Board";
import { EvalBar } from "@/components/chess/EvalBar";
import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { parsePGN, type ParsedGame, formatDate } from "@/lib/analyze/pgn";
import { analyzeGame, type GameReport, type AnalyzedMove, type AnalysisProgress } from "@/lib/analyze/analyzer";
import { CLASS_META, explainMove, type Classification } from "@/lib/analyze/classify";
import { buildReport, type Report } from "@/lib/analyze/report";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Game Analysis — ChessCoach" },
      {
        name: "description",
        content:
          "Upload a PGN and get a full Stockfish-powered analysis with move classifications, evaluation graph, and educational feedback.",
      },
    ],
  }),
  ssr: false,
  component: AnalyzePage,
});

type Stage =
  | { name: "import"; error?: string }
  | { name: "analyzing"; progress: AnalysisProgress }
  | { name: "ready"; report: GameReport; insights: Report };

function AnalyzePage() {
  const [stage, setStage] = useState<Stage>({ name: "import" });
  const abortRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(async (pgnText: string) => {
    abortRef.current?.abort();
    setStage({ name: "analyzing", progress: { label: "Parsing PGN…", done: 0, total: 100 } });
    let parsed: ParsedGame;
    try {
      parsed = parsePGN(pgnText);
    } catch (e) {
      setStage({ name: "import", error: e instanceof Error ? e.message : "Could not parse PGN." });
      return;
    }
    setStage({ name: "analyzing", progress: { label: "Generating positions…", done: 2, total: 100 } });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const report = await analyzeGame(parsed, {
        depth: 12,
        signal: controller.signal,
        onProgress: (progress) =>
          setStage({ name: "analyzing", progress }),
      });
      const insights = buildReport(report);
      setStage({ name: "analyzing", progress: { label: "Complete", done: 100, total: 100 } });
      setStage({ name: "ready", report, insights });
    } catch (e) {
      setStage({
        name: "import",
        error: e instanceof Error ? e.message : "Analysis failed. Try again.",
      });
    } finally {
      abortRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStage({ name: "import" });
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return (
    <div className="pb-nav mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 sm:px-5 lg:px-8 lg:pt-10">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-eyebrow">Game Analysis</p>
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {stage.name === "ready"
                ? `${stage.report.parsed.headers.White ?? "White"} vs ${stage.report.parsed.headers.Black ?? "Black"}`
                : "Review any PGN with Stockfish"}
            </h1>
          </div>
        </div>
        {stage.name === "ready" && (
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> New game
          </Button>
        )}
        {stage.name === "analyzing" && (
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        )}
      </header>

      <AnimatePresence mode="wait">
        {stage.name === "import" && (
          <motion.div
            key="import"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <ImportView error={stage.error} onSubmit={startAnalysis} />
          </motion.div>
        )}

        {stage.name === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AnalyzingView progress={stage.progress} />
          </motion.div>
        )}

        {stage.name === "ready" && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <AnalysisView report={stage.report} insights={stage.insights} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────  IMPORT  ──────────────────────────── */

function ImportView({ error, onSubmit }: { error?: string; onSubmit: (pgn: string) => void }) {
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const readFile = useCallback((file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pgn") && !file.type.includes("text") && file.type !== "") {
      onSubmit(""); // triggers the parse error path with clear message
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      onSubmit(content);
    };
    reader.onerror = () => onSubmit("");
    reader.readAsText(file);
  }, [onSubmit]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  return (
    <ClayCard className="!p-0 overflow-hidden">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-eyebrow">Import</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Bring any game. We'll do the rest.
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
              Drop a PGN, paste the text, or pick a file. Works with exports from Chess.com, Lichess,
              chessbase, or over-the-board scoresheets.
            </p>
          </div>

          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cn(
              "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors",
              drag
                ? "border-gold/60 bg-gold/[0.06]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pgn,text/plain,text/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readFile(f);
              }}
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-gold ring-1 ring-white/10">
              <FileUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Drag &amp; drop a .pgn</p>
            <p className="text-xs text-muted-foreground">or click to pick a file</p>
          </label>

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-eyebrow">Or paste PGN</p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`[Event "Casual game"]\n[White "You"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 ...`}
            className="h-56 resize-none font-mono text-[12.5px]"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Analyzed offline in your browser.</p>
            <Button
              onClick={() => onSubmit(text)}
              disabled={!text.trim()}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" /> Analyze game
            </Button>
          </div>
        </div>
      </div>
    </ClayCard>
  );
}

/* ────────────────────────────  ANALYZING  ──────────────────────────── */

function AnalyzingView({ progress }: { progress: AnalysisProgress }) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <ClayCard className="flex flex-col items-center gap-5 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/25">
        <Sparkles className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Analyzing your game</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {progress.label}
        </p>
      </div>
      <div className="w-full max-w-md">
        <Progress value={pct} className="h-2" />
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {pct}% complete
        </p>
      </div>
    </ClayCard>
  );
}

/* ────────────────────────────  RESULT  ──────────────────────────── */

function AnalysisView({ report, insights }: { report: GameReport; insights: Report }) {
  const moves = report.moves;
  const [ply, setPly] = useState(-1); // -1 = initial position

  const currentFen = useMemo(() => {
    if (ply < 0) return moves[0]?.fenBefore ?? "";
    return moves[ply]?.fenAfter ?? "";
  }, [moves, ply]);

  const currentEvalCp = report.evalTimeline[ply + 1] ?? report.evalTimeline[0] ?? 0;
  const currentMove: AnalyzedMove | undefined = ply >= 0 ? moves[ply] : undefined;

  const lastMove = currentMove ? { from: currentMove.from, to: currentMove.to } : null;

  const onJump = useCallback((p: number) => setPly(p), []);
  const goPrev = useCallback(() => setPly((p) => Math.max(-1, p - 1)), []);
  const goNext = useCallback(() => setPly((p) => Math.min(moves.length - 1, p + 1)), [moves.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const headers = report.parsed.headers;

  return (
    <div className="flex flex-col gap-5">
      <SummaryCard report={report} insights={insights} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Board column */}
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="hidden sm:block">
              <EvalBar cp={currentEvalCp} orientation="white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mx-auto" style={{ maxWidth: "min(70vh, 100%)" }}>
                <Board
                  fen={currentFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
                  orientation="white"
                  lastMove={lastMove}
                  draggable={false}
                  highlights={
                    currentMove
                      ? {
                          [currentMove.from]: "selected",
                          [currentMove.to]:
                            classToHighlight(currentMove.classification),
                        }
                      : {}
                  }
                />
              </div>

              {/* Nav controls */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setPly(-1)} className="h-9 px-2 text-xs">
                    Start
                  </Button>
                  <Button size="icon" variant="outline" onClick={goPrev} aria-label="Previous move" className="h-9 w-9">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" onClick={goNext} aria-label="Next move" className="h-9 w-9">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPly(moves.length - 1)} className="h-9 px-2 text-xs">
                    End
                  </Button>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {ply < 0 ? "Start" : `${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "." : "…"} ${moves[ply].san}`}
                </p>
              </div>

              <EvalGraph
                timeline={report.evalTimeline}
                currentPly={ply}
                onJump={(p) => setPly(p)}
                moves={moves}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex min-w-0 flex-col gap-4">
          <MoveExplanation move={currentMove} />
          <MoveListPanel moves={moves} currentPly={ply} onJump={onJump} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <InsightPanel title="Strengths" tone="success" items={insights.strengths} empty="Play a sharper game to surface new strengths." />
        <InsightPanel title="Weaknesses" tone="danger" items={insights.weaknesses} empty="No major weaknesses in this game." />
        <RecommendationPanel recs={insights.recommendations} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <KeyMomentsPanel moments={insights.keyMoments} onJump={onJump} />
        <OpeningPanel opening={insights.opening} headers={headers} />
      </div>
    </div>
  );
}

function classToHighlight(k: Classification): "best" | "mistake" | "blunder" | "good" {
  switch (k) {
    case "brilliant":
    case "great":
    case "best":
    case "excellent":
    case "good":
      return "good";
    case "inaccuracy":
      return "mistake";
    case "mistake":
    case "missed_tactic":
      return "mistake";
    case "blunder":
    case "missed_win":
      return "blunder";
  }
}

/* ────────────────────────────  SUMMARY  ──────────────────────────── */

function SummaryCard({ report, insights }: { report: GameReport; insights: Report }) {
  const h = report.parsed.headers;
  const rows = [
    { k: "Event", v: h.Event || "—" },
    { k: "Date", v: formatDate(h) },
    { k: "Result", v: report.parsed.result },
    { k: "Moves", v: String(Math.ceil(report.moves.length / 2)) },
  ];
  return (
    <ClayCard className="!p-5 sm:!p-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-eyebrow">Overview</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">White</span>
              <span className="text-lg font-semibold">{h.White || "White"}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-muted-foreground">Black</span>
              <span className="text-lg font-semibold">{h.Black || "Black"}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {rows.map((r) => (
              <div key={r.k} className="rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {r.k}
                </p>
                <p className="mt-1 truncate text-sm font-medium">{r.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {insights.opening.eco && (
              <Badge variant="outline" className="border-white/10 bg-white/[0.03]">
                {insights.opening.eco}
              </Badge>
            )}
            <Badge variant="outline" className="border-white/10 bg-white/[0.03]">
              {insights.opening.name}
            </Badge>
            <Badge variant="outline" className="border-gold/25 bg-gold/10 text-gold">
              {insights.quality}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="White acc." value={`${report.accuracy.white.toFixed(1)}%`} />
          <StatTile label="Black acc." value={`${report.accuracy.black.toFixed(1)}%`} />
          <StatTile label="Overall" value={`${report.accuracy.overall.toFixed(1)}%`} accent />
          <StatTile label="Avg CPL W" value={report.avgCpl.white.toFixed(0)} />
          <StatTile label="Avg CPL B" value={report.avgCpl.black.toFixed(0)} />
          <StatTile
            label="Blunders"
            value={String(report.counts.blunder + report.counts.missed_win)}
          />
        </div>
      </div>
    </ClayCard>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl px-3 py-2.5 ring-1",
        accent ? "bg-gold/10 ring-gold/25" : "bg-white/[0.03] ring-white/5",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", accent && "text-gold")}>
        {value}
      </p>
    </div>
  );
}

/* ────────────────────────────  MOVE EXPLANATION  ──────────────────────────── */

function MoveExplanation({ move }: { move?: AnalyzedMove }) {
  if (!move) {
    return (
      <GlassPanel>
        <p className="text-eyebrow">Move detail</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the board or move list to step through the game. Every move is annotated with Stockfish's verdict.
        </p>
      </GlassPanel>
    );
  }
  const meta = CLASS_META[move.classification];
  const num = Math.floor(move.ply / 2) + 1;
  const label = `${num}${move.side === "w" ? "." : "…"} ${move.san}`;
  return (
    <GlassPanel>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-sm text-muted-foreground">{label}</span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          <span>{meta.icon}</span>
          {meta.label}
        </span>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-foreground/90">
        {explainMove(move)}
      </p>
      {move.bestSan && move.bestSan !== move.san && (
        <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-muted-foreground ring-1 ring-white/5">
          Engine's top choice: <span className="font-mono text-foreground">{move.bestSan}</span> ·{" "}
          <span className="tabular-nums">
            {formatEval(move.eval.cpBefore, move.side)}
          </span>
        </div>
      )}
    </GlassPanel>
  );
}

function formatEval(cpWhite: number, side: "w" | "b"): string {
  const cp = side === "w" ? cpWhite : -cpWhite;
  if (Math.abs(cp) > 9000) {
    const mate = 10000 - Math.abs(cp);
    return `${cp > 0 ? "+" : "-"}M${mate}`;
  }
  return `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(2)}`;
}

/* ────────────────────────────  MOVE LIST  ──────────────────────────── */

function MoveListPanel({
  moves,
  currentPly,
  onJump,
}: {
  moves: AnalyzedMove[];
  currentPly: number;
  onJump: (ply: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPly]);

  const pairs = useMemo(() => {
    const out: { n: number; w?: AnalyzedMove; b?: AnalyzedMove }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      out.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
    }
    return out;
  }, [moves]);

  return (
    <GlassPanel className="!p-0">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-baseline gap-2">
          <p className="text-eyebrow">Moves</p>
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {moves.length}
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="no-scrollbar max-h-[min(52vh,22rem)] overflow-y-auto px-3 pb-4 pt-1"
      >
        <ol className="space-y-0.5 font-mono text-[13px]">
          {pairs.map((p) => (
            <li key={p.n} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-1">
              <span className="text-xs text-muted-foreground tabular-nums">{p.n}.</span>
              <MoveCell m={p.w} active={currentPly === p.w?.ply} onJump={onJump} />
              <MoveCell m={p.b} active={currentPly === p.b?.ply} onJump={onJump} />
            </li>
          ))}
        </ol>
      </div>
    </GlassPanel>
  );
}

function MoveCell({
  m,
  active,
  onJump,
}: {
  m?: AnalyzedMove;
  active: boolean;
  onJump: (ply: number) => void;
}) {
  if (!m) return <span className="text-muted-foreground/40">—</span>;
  const meta = CLASS_META[m.classification];
  return (
    <button
      type="button"
      data-active={active || undefined}
      onClick={() => onJump(m.ply)}
      className={cn(
        "flex items-center justify-between gap-1 truncate rounded-md px-1.5 py-1 text-left transition-colors",
        active
          ? "bg-gold/15 text-gold ring-1 ring-gold/30"
          : "hover:bg-white/5",
      )}
      title={`${meta.label} · ${m.cpl ? `−${(m.cpl / 100).toFixed(1)}` : "0.0"}cp`}
    >
      <span className="truncate">{m.san}</span>
      <span
        className="text-[11px] leading-none"
        style={{ color: meta.color }}
        aria-hidden="true"
      >
        {meta.icon}
      </span>
    </button>
  );
}

/* ────────────────────────────  EVAL GRAPH  ──────────────────────────── */

function EvalGraph({
  timeline,
  currentPly,
  onJump,
  moves,
}: {
  timeline: number[];
  currentPly: number;
  onJump: (ply: number) => void;
  moves: AnalyzedMove[];
}) {
  const W = 600;
  const H = 96;
  const n = timeline.length;
  if (n < 2) return null;

  const clamp = (v: number) => Math.max(-1000, Math.min(1000, v));
  const yFor = (v: number) => H / 2 - (clamp(v) / 1000) * (H / 2 - 4);
  const xFor = (i: number) => (i / (n - 1)) * W;

  // Build filled area path.
  let path = `M 0 ${H / 2}`;
  for (let i = 0; i < n; i++) path += ` L ${xFor(i).toFixed(2)} ${yFor(timeline[i]).toFixed(2)}`;
  const fill = `${path} L ${W} ${H / 2} L 0 ${H / 2} Z`;
  const stroke = path;

  const activeIndex = currentPly + 1; // timeline[0] is initial position

  const svgRef = useRef<SVGSVGElement | null>(null);
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(n - 1, Math.round(x * (n - 1))));
    onJump(idx - 1);
  };

  return (
    <div className="mt-4 rounded-xl bg-white/[0.02] p-3 ring-1 ring-white/5">
      <div className="flex items-center justify-between pb-2">
        <p className="text-eyebrow">Evaluation</p>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {formatEval(timeline[activeIndex] ?? 0, "w")}
        </p>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-24 w-full cursor-crosshair"
        onClick={handleClick}
      >
        <rect x="0" y="0" width={W} height={H} fill="oklch(0.185 0 0)" />
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="oklch(0.82 0.1 80 / 0.35)" strokeDasharray="3 4" />
        <path d={fill} fill="oklch(0.96 0.005 80 / 0.14)" />
        <path d={stroke} fill="none" stroke="oklch(0.96 0.005 80 / 0.85)" strokeWidth="1.4" />
        {/* Key moment markers */}
        {moves.map((m) => {
          if (!["blunder", "missed_win", "mistake", "brilliant", "great"].includes(m.classification)) return null;
          const cx = xFor(m.ply + 1);
          const cy = yFor(timeline[m.ply + 1] ?? 0);
          return (
            <circle
              key={m.ply}
              cx={cx}
              cy={cy}
              r={3}
              fill={CLASS_META[m.classification].color}
              stroke="oklch(0.145 0 0)"
              strokeWidth="1"
            />
          );
        })}
        {/* Active indicator */}
        {activeIndex >= 0 && activeIndex < n && (
          <line
            x1={xFor(activeIndex)}
            y1={0}
            x2={xFor(activeIndex)}
            y2={H}
            stroke="oklch(0.82 0.1 80)"
            strokeWidth="1.2"
          />
        )}
      </svg>
    </div>
  );
}

/* ────────────────────────────  INSIGHT PANELS  ──────────────────────────── */

function InsightPanel({
  title,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: "success" | "danger";
  items: string[];
  empty: string;
}) {
  const color = tone === "success" ? "oklch(0.78 0.13 145)" : "oklch(0.7 0.17 25)";
  return (
    <GlassPanel>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        <p className="text-eyebrow">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-foreground/90">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: color }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

function RecommendationPanel({ recs }: { recs: Report["recommendations"] }) {
  return (
    <GlassPanel>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        <p className="text-eyebrow">Recommendations</p>
      </div>
      <ul className="mt-3 space-y-3">
        {recs.map((r, i) => (
          <li key={i} className="rounded-lg bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/5">
            <p className="text-sm font-semibold text-foreground">{r.title}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{r.reason}</p>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}

function KeyMomentsPanel({
  moments,
  onJump,
}: {
  moments: Report["keyMoments"];
  onJump: (ply: number) => void;
}) {
  return (
    <GlassPanel>
      <p className="text-eyebrow">Game highlights</p>
      {moments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          A calm, accurate game — no major turning points detected.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {moments.map((m) => {
            const num = Math.floor(m.ply / 2) + 1;
            return (
              <li key={m.ply}>
                <button
                  type="button"
                  onClick={() => onJump(m.ply)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5 text-left ring-1 ring-white/5 transition hover:bg-white/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.note}</p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {num}
                    {m.side === "w" ? "." : "…"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}

function OpeningPanel({
  opening,
  headers,
}: {
  opening: Report["opening"];
  headers: Record<string, string>;
}) {
  return (
    <GlassPanel>
      <p className="text-eyebrow">Opening review</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg font-semibold tracking-tight">{opening.name}</span>
        {opening.eco && (
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {opening.eco}
          </span>
        )}
      </div>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{opening.note}</p>
      {headers.Event && (
        <p className="mt-3 text-xs text-muted-foreground">
          Event: <span className="text-foreground/90">{headers.Event}</span>
        </p>
      )}
    </GlassPanel>
  );
}
