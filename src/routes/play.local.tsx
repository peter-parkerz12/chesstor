import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

import { Board } from "@/components/chess/Board";
import { GameLayout } from "@/components/chess/GameLayout";
import { MoveList } from "@/components/chess/MoveList";
import { ResultModal } from "@/components/chess/ResultModal";
import { ResignButton } from "@/components/chess/ResignButton";
import { ClayCard } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { useGameMode } from "@/components/nav/island-context";
import { buildPGN, downloadPGN } from "@/lib/pgn";
import { saveGame } from "@/lib/db/idb";
import { playMoveSfx, playSfx } from "@/lib/audio/sfx";
import { findKingSquare } from "@/lib/chess/squares";

export const Route = createFileRoute("/play/local")({
  head: () => ({
    meta: [
      { title: "Pass & Play — ChessCoach" },
      { name: "description", content: "Two players, one device. Pure over-the-board chess — no engine, no hints." },
    ],
  }),
  ssr: false,
  component: PassAndPlay,
});

type Ending = { winner: "white" | "black" | null; reason: "checkmate" | "draw" | "resign" } | null;

function PassAndPlay() {
  useGameMode(true);

  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [ending, setEnding] = useState<Ending>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [, force] = useState(0);
  const moveCount = useRef(0);

  const reset = useCallback(() => {
    chess.reset();
    setFen(chess.fen());
    setLastMove(null);
    setResultOpen(false);
    setEnding(null);
    setHistory([]);
    setReviewPly(null);
    moveCount.current = 0;
    force((n) => n + 1);
  }, [chess]);

  const persistAndOpen = useCallback(
    (e: NonNullable<Ending>) => {
      const result =
        e.reason === "draw"
          ? "1/2-1/2"
          : e.winner === "white"
            ? "1-0"
            : "0-1";
      if (result === "1-0" || result === "0-1") playSfx("win");
      saveGame({
        id: crypto.randomUUID(),
        mode: "local",
        side: "white",
        result: result === "1-0" || result === "0-1" ? "win" : "draw",
        pgn: buildPGN({
          white: "Player 1",
          black: "Player 2",
          result: result as "1-0" | "0-1" | "1/2-1/2",
          moves: chess.history(),
        }),
        moves: chess.history(),
        cplAvg: 0,
        cplByPhase: { opening: 0, middlegame: 0, endgame: 0 },
        mistakeBuckets: { development: 0, tactics: 0, kingSafety: 0, endgame: 0 },
        date: Date.now(),
      });
      setEnding(e);
      setResultOpen(true);
    },
    [chess],
  );

  const onMove = useCallback(
    (from: string, to: string) => {
      if (resultOpen) return false;
      if (reviewPly !== null) return false;
      let mv;
      try {
        mv = chess.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!mv) return false;
      setFen(chess.fen());
      setLastMove({ from: mv.from, to: mv.to });
      setHistory(chess.history());
      playMoveSfx(mv);
      moveCount.current += 1;
      force((n) => n + 1);

      if (chess.isGameOver()) {
        if (chess.isCheckmate()) {
          persistAndOpen({ winner: chess.turn() === "w" ? "black" : "white", reason: "checkmate" });
        } else if (chess.isDraw()) {
          persistAndOpen({ winner: null, reason: "draw" });
        }
      }
      return true;
    },
    [chess, resultOpen, reviewPly, persistAndOpen],
  );

  const undoMove = useCallback(() => {
    if (resultOpen) return;
    setReviewPly(null);
    if (chess.history().length === 0) return;
    chess.undo();
    setFen(chess.fen());
    const verbose = chess.history({ verbose: true });
    const last = verbose[verbose.length - 1];
    setLastMove(last ? { from: last.from, to: last.to } : null);
    setHistory(chess.history());
    moveCount.current = Math.max(0, moveCount.current - 1);
    force((n) => n + 1);
    playSfx("click");
  }, [chess, resultOpen]);

  const jumpTo = useCallback(
    (ply: number) => {
      const live = chess.history().length - 1;
      setReviewPly(ply >= live ? null : ply);
    },
    [chess],
  );

  const resign = useCallback(() => {
    if (resultOpen) return;
    const loser = chess.turn() === "w" ? "white" : "black";
    const winner = loser === "white" ? "black" : "white";
    persistAndOpen({ winner, reason: "resign" });
  }, [chess, resultOpen, persistAndOpen]);

  const orientation = chess.turn() === "w" ? "white" : "black";
  const isWhite = chess.turn() === "w";
  const turnLabel = isWhite ? "White to move" : "Black to move";
  const inCheck = chess.inCheck();
  const checkSq = inCheck ? findKingSquare(chess, chess.turn()) : null;
  const checkHighlight = checkSq ? { [checkSq]: "check" as const } : {};

  const resultVariant: "win" | "loss" | "draw" =
    ending?.reason === "draw" ? "draw" : ending ? "win" : "draw";
  const resultText = ending
    ? ending.reason === "draw"
      ? "Draw"
      : ending.reason === "resign"
        ? `${ending.winner === "white" ? "White" : "Black"} wins by resignation`
        : `${ending.winner === "white" ? "White" : "Black"} wins`
    : "";

  const moves = useMemo(() => {
    const h = chess.history();
    const pairs: Array<{ n: number; white?: string; black?: string }> = [];
    for (let i = 0; i < h.length; i += 2) {
      pairs.push({ n: i / 2 + 1, white: h[i], black: h[i + 1] });
    }
    return pairs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, chess]);

  return (
    <>
      <GameLayout
        topBar={
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <div className="flex items-center gap-1.5">
              <ResignButton
                onResign={resign}
                description={`Are you sure ${isWhite ? "White" : "Black"} wants to resign this game?`}
              />
              <Button size="sm" variant="ghost" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </div>
          </div>
        }
        board={
          <Board fen={fen} orientation={orientation} onMove={onMove} lastMove={lastMove} highlights={checkHighlight} />
        }
        side={
          <div className="flex flex-col gap-4">
            <ClayCard className="p-5!">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Turn</h3>
              <div className="mt-3 flex items-center gap-3">
                <motion.span
                  key={isWhite ? "w" : "b"}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className={`h-7 w-7 rounded-full ring-2 ring-gold/40 ${
                    isWhite ? "bg-foreground" : "bg-surface"
                  }`}
                  aria-hidden
                />
                <p className="text-lg font-semibold">{turnLabel}</p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Pure over-the-board play. No engine, no hints — just you and your opponent.
              </p>
            </ClayCard>

            <GlassPanel>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Moves</h4>
              {moves.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No moves yet.</p>
              ) : (
                <ol className="mt-3 max-h-64 space-y-1 overflow-y-auto pr-1 text-sm no-scrollbar">
                  {moves.map((p) => (
                    <li key={p.n} className="grid grid-cols-[2rem_1fr_1fr] gap-2 font-mono">
                      <span className="text-muted-foreground">{p.n}.</span>
                      <span>{p.white ?? ""}</span>
                      <span className="text-muted-foreground">{p.black ?? ""}</span>
                    </li>
                  ))}
                </ol>
              )}
            </GlassPanel>
          </div>
        }
      />
      <ResultModal
        open={resultOpen}
        variant={resultVariant}
        title={resultText || "Game over"}
        subtitle="Pass & Play"
        insight={
          ending?.reason === "resign"
            ? `${ending.winner === "white" ? "Black" : "White"} resigned — clean victory for ${ending.winner}.`
            : undefined
        }
        onPlayAgain={reset}
        onExportPGN={() => {
          const result =
            ending?.reason === "draw"
              ? "1/2-1/2"
              : ending?.winner === "white"
                ? "1-0"
                : ending?.winner === "black"
                  ? "0-1"
                  : "*";
          const pgn = buildPGN({
            white: "Player 1",
            black: "Player 2",
            result: result as "1-0" | "0-1" | "1/2-1/2" | "*",
            moves: chess.history(),
          });
          downloadPGN(pgn, `chesscoach-local-${Date.now()}.pgn`);
        }}
      />
    </>
  );
}
