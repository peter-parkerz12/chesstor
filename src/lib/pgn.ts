import { Chess } from "chess.js";

export function buildPGN(opts: {
  white: string;
  black: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  moves: string[];
  event?: string;
}): string {
  const chess = new Chess();
  for (const san of opts.moves) {
    try {
      chess.move(san);
    } catch {
      // skip illegal — should not happen, but guard
    }
  }
  chess.header(
    "Event", opts.event ?? "ChessCoach Game",
    "Site", "ChessCoach PWA",
    "Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    "White", opts.white,
    "Black", opts.black,
    "Result", opts.result,
  );
  return chess.pgn();
}

export function downloadPGN(pgn: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
