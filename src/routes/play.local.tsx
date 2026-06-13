import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState, useRef } from "react";
import { Chess } from "chess.js";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Board } from "@/components/chess/Board";
import { FeedbackPanel } from "@/components/chess/FeedbackPanel";
import { GameLayout } from "@/components/chess/GameLayout";
import { ResultModal } from "@/components/chess/ResultModal";
import { Button } from "@/components/ui/button";
import { analyzeMove, type CoachReport } from "@/lib/coach/feedback";
import { buildPGN, downloadPGN } from "@/lib/pgn";
import { saveGame } from "@/lib/db/idb";

export const Route = createFileRoute("/play/local")({
  head: () => ({
    meta: [
      { title: "Pass & Play — ChessCoach" },
      { name: "description", content: "Two players, one device. Local chess with instant move coaching." },
    ],
  }),
  ssr: false,
  component: PassAndPlay,
});

function PassAndPlay() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [report, setReport] = useState<CoachReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [arrows, setArrows] = useState<{ startSquare: string; endSquare: string; color: string }[]>([]);
  const [resultOpen, setResultOpen] = useState(false);
  const cplHistory = useRef<number[]>([]);

  const reset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setReport(null);
    setLastMove(null);
    setArrows([]);
    setResultOpen(false);
    cplHistory.current = [];
  }, [chess]);

  const onMove = useCallback((from: string, to: string) => {
    const fenBefore = chess.fen();
    const turn = chess.turn();
    let mv;
    try {
      mv = chess.move({ from, to, promotion: "q" });
    } catch { return false; }
    if (!mv) return false;
    setFen(chess.fen());
    setLastMove({ from: mv.from, to: mv.to });
    setArrows([]);
    setLoading(true);
    setReport(null);
    const history = chess.history({ verbose: true }).map((h) => ({ from: h.from, to: h.to, san: h.san, piece: h.piece }));
    analyzeMove({ fenBefore, fenAfter: chess.fen(), playedSAN: mv.san, history, side: turn })
      .then((r) => {
        setReport(r);
        cplHistory.current.push(r.cpl);
        if (r.bestMove && r.cpl > 30) {
          setArrows([{ startSquare: r.bestMove.slice(0, 2), endSquare: r.bestMove.slice(2, 4), color: "#E2B96F" }]);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
    if (chess.isGameOver()) {
      const result = chess.isCheckmate()
        ? (chess.turn() === "w" ? "0-1" : "1-0")
        : chess.isDraw() ? "1/2-1/2" : "*";
      const cplAvg = cplHistory.current.length
        ? Math.round(cplHistory.current.reduce((a, b) => a + b, 0) / cplHistory.current.length)
        : 0;
      saveGame({
        id: crypto.randomUUID(),
        mode: "local",
        side: "white",
        result: result === "1-0" || result === "0-1" ? "win" : result === "1/2-1/2" ? "draw" : "unfinished",
        pgn: buildPGN({ white: "Player 1", black: "Player 2", result: result as "1-0" | "0-1" | "1/2-1/2" | "*", moves: chess.history() }),
        moves: chess.history(),
        cplAvg,
        cplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
        mistakeBuckets: { development: 0, tactics: 0, kingSafety: 0, endgame: 0 },
        date: Date.now(),
      });
      setResultOpen(true);
    }
    return true;
  }, [chess]);

  const orientation = chess.turn() === "w" ? "white" : "black";
  const turnLabel = chess.turn() === "w" ? "White to move" : "Black to move";
  const resultText = chess.isCheckmate()
    ? `${chess.turn() === "w" ? "Black" : "White"} wins`
    : chess.isDraw() ? "Draw" : "";

  return (
    <>
      <GameLayout
        topBar={
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted-foreground">{turnLabel}</span>
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
        }
        board={
          <Board fen={fen} orientation={orientation} onMove={onMove} lastMove={lastMove} arrows={arrows} />
        }
        side={<FeedbackPanel report={report} loading={loading} thinking={loading} emptyHint="Pass the device after each move. I'll review every play." />}
      />
      <ResultModal
        open={resultOpen}
        title={resultText || "Game over"}
        subtitle="Pass & Play"
        cplAvg={cplHistory.current.length ? Math.round(cplHistory.current.reduce((a, b) => a + b, 0) / cplHistory.current.length) : undefined}
        onPlayAgain={reset}
        onExportPGN={() => {
          const pgn = buildPGN({
            white: "Player 1", black: "Player 2",
            result: chess.isCheckmate() ? (chess.turn() === "w" ? "0-1" : "1-0") : chess.isDraw() ? "1/2-1/2" : "*",
            moves: chess.history(),
          });
          downloadPGN(pgn, `chesscoach-local-${Date.now()}.pgn`);
        }}
      />
    </>
  );
}
