export type PracticeCategory =
  | "tactics-fork"
  | "tactics-pin"
  | "tactics-skewer"
  | "tactics-discovered"
  | "tactics-deflection"
  | "strategy-outpost"
  | "strategy-king-safety"
  | "endgame-opposition"
  | "endgame-rook"
  | "endgame-passed-pawn"
  | "endgame-mate";

export type PracticeSection = "midgame" | "endgame";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export type PracticePosition = {
  id: string;
  section: PracticeSection;
  category: PracticeCategory;
  categoryLabel: string;
  difficulty: Difficulty;
  fen: string;
  sideToMove: "w" | "b";
  objective: string;
  /** Accepted first moves in UCI (lowercase, e.g. "e2e4", "g1f3", "e7e8q"). */
  solutions: string[];
  hints: [string, string, string];
  /** Educational explanation when solved. */
  explanation: string;
  /** Tactical/strategic idea (one-liner). */
  idea: string;
};

export const PRACTICE_CATEGORIES: Array<{
  id: PracticeCategory;
  section: PracticeSection;
  label: string;
  blurb: string;
}> = [
  { id: "tactics-fork",       section: "midgame", label: "Forks",              blurb: "Attack two pieces at once." },
  { id: "tactics-pin",        section: "midgame", label: "Pins",               blurb: "Freeze a piece against a more valuable one." },
  { id: "tactics-skewer",     section: "midgame", label: "Skewers",            blurb: "Force a valuable piece to move and win the one behind." },
  { id: "tactics-discovered", section: "midgame", label: "Discovered attacks", blurb: "Unmask a hidden attacker." },
  { id: "tactics-deflection", section: "midgame", label: "Deflection",         blurb: "Lure a defender away from a key square." },
  { id: "strategy-outpost",   section: "midgame", label: "Outposts",           blurb: "Plant a knight where pawns can't kick it." },
  { id: "strategy-king-safety", section: "midgame", label: "King safety",      blurb: "Spot and exploit a weak king." },
  { id: "endgame-opposition", section: "endgame", label: "King opposition",    blurb: "The dance of kings in pawn endings." },
  { id: "endgame-rook",       section: "endgame", label: "Rook endgames",      blurb: "Lucena, Philidor and active rooks." },
  { id: "endgame-passed-pawn",section: "endgame", label: "Passed pawns",       blurb: "Promote material into queens." },
  { id: "endgame-mate",       section: "endgame", label: "Basic checkmates",   blurb: "Convert overwhelming material." },
];

export const PRACTICE_POSITIONS: PracticePosition[] = [
  {
    id: "fork-knight-001",
    section: "midgame",
    category: "tactics-fork",
    categoryLabel: "Knight fork",
    difficulty: "beginner",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    sideToMove: "w",
    objective: "Find a strong developing move that pressures Black's center and king.",
    solutions: ["e1g1", "b1c3", "d2d3"],
    hints: [
      "Complete development — your king needs a safe home and your pieces need coordination.",
      "Think about castling or bringing the queenside knight into the game.",
      "Castling kingside (O-O) is the most natural choice here.",
    ],
    explanation:
      "Castling tucks the king away and connects the rooks — a textbook Italian Game decision before launching action in the center.",
    idea: "Development & king safety in the opening to middlegame transition.",
  },
  {
    id: "fork-queen-002",
    section: "midgame",
    category: "tactics-fork",
    categoryLabel: "Royal fork",
    difficulty: "beginner",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",
    sideToMove: "w",
    objective: "Develop the kingside knight to its best square.",
    solutions: ["g1f3"],
    hints: [
      "Develop a minor piece that attacks Black's central pawn.",
      "Think about a knight move toward the center.",
      "Ng1-f3 attacks e5 and prepares castling.",
    ],
    explanation: "Nf3 attacks e5, develops with tempo, and prepares short castling — a model opening move.",
    idea: "Knight development with a concrete threat.",
  },
  {
    id: "pin-bishop-001",
    section: "midgame",
    category: "tactics-pin",
    categoryLabel: "Absolute pin",
    difficulty: "beginner",
    fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 2",
    sideToMove: "w",
    objective: "Establish a flexible central setup.",
    solutions: ["d2d4", "b1c3"],
    hints: [
      "Challenge Black in the center.",
      "A pawn break gains space and opens lines.",
      "d4 confronts c5 and stakes a claim in the center.",
    ],
    explanation: "d4 is the principled Open Sicilian move — striking the center while Black is still developing.",
    idea: "Central pawn break that opens lines for your pieces.",
  },
  {
    id: "back-rank-001",
    section: "midgame",
    category: "tactics-deflection",
    categoryLabel: "Back-rank weakness",
    difficulty: "intermediate",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    sideToMove: "w",
    objective: "White to play and win material with a back-rank theme.",
    solutions: ["a1a8"],
    hints: [
      "Black's king has no luft — the back rank is fragile.",
      "Look for an invasion along the open file.",
      "Ra8+ delivers a back-rank check that wins on the spot.",
    ],
    explanation:
      "Ra8# (or Ra8+ winning massive material) exploits the absence of a flight square — always check your back-rank safety before pushing pawns.",
    idea: "Back-rank mate — the king's prison.",
  },
  {
    id: "outpost-001",
    section: "midgame",
    category: "strategy-outpost",
    categoryLabel: "Knight outpost",
    difficulty: "intermediate",
    fen: "r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    sideToMove: "w",
    objective: "Improve your worst piece with a long-term strategic move.",
    solutions: ["c1e3", "f1e2", "f1c4", "f1d3"],
    hints: [
      "Complete development before tactics — find a bishop that hasn't moved yet.",
      "Where do your remaining minor pieces want to live?",
      "Be3 or Bc4/Bd3/Be2 — any natural bishop development is principled here.",
    ],
    explanation:
      "Finishing development of your bishops keeps options open. Quiet improvements like Be3 win games at every level.",
    idea: "Slow improvement and piece coordination beat random aggression.",
  },
  {
    id: "opposition-001",
    section: "endgame",
    category: "endgame-opposition",
    categoryLabel: "King opposition",
    difficulty: "beginner",
    fen: "8/8/8/4k3/8/4K3/4P3/8 w - - 0 1",
    sideToMove: "w",
    objective: "Promote the pawn. Use the opposition to make progress.",
    solutions: ["e3d3", "e3f3"],
    hints: [
      "The kings face off — whoever has to move first usually loses the duel.",
      "Step sideways: don't push the pawn yet.",
      "Kd3 or Kf3 keeps the opposition and forces Black's king back.",
    ],
    explanation:
      "Taking the opposition (kings on the same file/rank with one square between them, opponent to move) is the foundation of K+P endings.",
    idea: "Opposition — the silent king-and-pawn weapon.",
  },
  {
    id: "passed-pawn-001",
    section: "endgame",
    category: "endgame-passed-pawn",
    categoryLabel: "Promotion",
    difficulty: "beginner",
    fen: "8/4P3/8/8/8/8/8/k6K w - - 0 1",
    sideToMove: "w",
    objective: "Promote and win.",
    solutions: ["e7e8q"],
    hints: [
      "Your pawn is one square from glory.",
      "Promote to the strongest piece available.",
      "e8=Q creates a winning queen.",
    ],
    explanation: "Promotion to a queen converts a passed pawn into decisive material. Always check for stalemate traps — here there are none.",
    idea: "Promote passed pawns at the first safe opportunity.",
  },
  {
    id: "rook-philidor-001",
    section: "endgame",
    category: "endgame-rook",
    categoryLabel: "Philidor defense (rook ending)",
    difficulty: "advanced",
    fen: "5k2/8/4K3/4P3/8/r7/8/4R3 b - - 0 1",
    sideToMove: "b",
    objective: "Hold the draw with the Philidor third-rank defense.",
    solutions: ["a3a6", "a3b3", "a3c3", "a3d3", "a3e3", "a3f3", "a3g3", "a3h3"],
    hints: [
      "The defending rook belongs on the third rank — for now.",
      "Block the white king from advancing past the fifth rank.",
      "…Ra6 (third rank from Black's side) sets up the Philidor formation.",
    ],
    explanation:
      "Keeping the rook on the 3rd rank (Black's perspective: 6th) prevents White's king from entering. When the pawn finally pushes to e6, the rook swings behind to harass it — the classic Philidor draw.",
    idea: "Active defense: passive rooks lose endgames.",
  },
  {
    id: "mate-q-001",
    section: "endgame",
    category: "endgame-mate",
    categoryLabel: "Queen + king vs king",
    difficulty: "beginner",
    fen: "8/8/8/8/3k4/8/3Q4/3K4 w - - 0 1",
    sideToMove: "w",
    objective: "Drive the enemy king toward the edge.",
    solutions: ["d2e3", "d2c3", "d2e2", "d2c2", "d2d3"],
    hints: [
      "Don't stalemate — give the king somewhere to go.",
      "Keep your queen a knight's-move away from the enemy king.",
      "Qe3 (or similar) restricts the king while your king approaches.",
    ],
    explanation:
      "The 'knight's-move method' systematically corners the king. Avoid stalemate by always leaving an escape square until your king arrives to deliver mate.",
    idea: "Restrict, approach, mate — never stalemate.",
  },
  {
    id: "discovered-001",
    section: "midgame",
    category: "tactics-discovered",
    categoryLabel: "Discovered attack",
    difficulty: "intermediate",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    sideToMove: "w",
    objective: "Find a developing move that prepares castling and keeps the bishop's pressure.",
    solutions: ["e1g1", "b1c3", "d2d3"],
    hints: [
      "King safety first — your king is still in the center.",
      "Castle to bring the rook into play and tuck the king away.",
      "O-O is calm, strong, and the main-line Ruy Lopez move.",
    ],
    explanation:
      "Castling completes development and centralizes the rook. The latent pressure of Bb5 stays on c6 — a positional decision before tactics arrive.",
    idea: "King safety before tactics — every grandmaster game proves it.",
  },
];

export function getPositionsByCategory(category: PracticeCategory) {
  return PRACTICE_POSITIONS.filter((p) => p.category === category);
}

export function getPosition(id: string) {
  return PRACTICE_POSITIONS.find((p) => p.id === id);
}
