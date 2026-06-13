export type Opening = {
  id: string;
  name: string;
  eco: string;
  description: string;
  /** Mainline moves in SAN, starting from the initial position. */
  moves: string[];
};

export const OPENINGS: Opening[] = [
  {
    id: "italian",
    name: "Italian Game",
    eco: "C50",
    description: "Classical opening focusing on rapid development and the f7 weak square.",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+"],
  },
  {
    id: "sicilian",
    name: "Sicilian Defense",
    eco: "B20",
    description: "Black's most popular reply to 1.e4 — sharp, asymmetric, full of counter-play.",
    moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be2", "e5"],
  },
  {
    id: "french",
    name: "French Defense",
    eco: "C00",
    description: "Solid pawn chain. Black accepts a cramped position to strike later with c5 and f6.",
    moves: ["e4", "e6", "d4", "d5", "Nc3", "Nf6", "Bg5", "Be7", "e5", "Nfd7", "Bxe7", "Qxe7"],
  },
  {
    id: "london",
    name: "London System",
    eco: "D02",
    description: "A reliable, easy-to-learn setup for White with the bishop on f4.",
    moves: ["d4", "d5", "Nf3", "Nf6", "Bf4", "c5", "e3", "Nc6", "c3", "e6", "Nbd2", "Bd6"],
  },
  {
    id: "queens-gambit",
    name: "Queen's Gambit",
    eco: "D06",
    description: "White offers a pawn for central control and rapid development.",
    moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "Nbd7"],
  },
  {
    id: "ruy-lopez",
    name: "Ruy Lopez",
    eco: "C60",
    description: "The Spanish Game — classical pressure on the knight defending e5.",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5"],
  },
];

export function findOpening(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id);
}
