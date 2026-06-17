import type { Chess } from "chess.js";

/** Locate king square for given color via chess.js board(). */
export function findKingSquare(chess: Chess, color: "w" | "b"): string | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) {
        const file = "abcdefgh"[c];
        const rank = 8 - r;
        return `${file}${rank}`;
      }
    }
  }
  return null;
}
