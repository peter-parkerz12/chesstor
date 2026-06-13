# ChessCoach — Plan

A fully offline PWA chess learning platform with Stockfish-powered instant feedback. No backend, all data in IndexedDB.

## Stack adjustments (important)

Your spec listed Next.js + next-pwa, but this project is **React + TanStack Start + Vite**. I'll adapt:
- `next-pwa` → **vite-plugin-pwa** (same outcome: installable PWA, SW caching, manifest)
- Everything else (chess.js, react-chessboard, Stockfish WASM via Web Worker, idb) stays exactly as specified

All other constraints (no backend, IndexedDB only, offline-first, Stockfish from CDN cached by SW) are honored.

## Routes

```
/                → Home (hero + mode picker)
/play/ai         → Play vs AI (difficulty + side picker → game)
/play/local      → Pass & Play
/openings        → Opening Trainer (pick line → drill)
/stats           → Progress Dashboard
```

Bottom floating nav: Home · Play · Openings · Stats

## Architecture

```
src/
  routes/                       # TanStack file routes above
  components/
    chess/
      Board.tsx                 # react-chessboard wrapper, themed
      EvalBar.tsx               # centipawn bar
      GameLayout.tsx            # 70/30 desktop, stacked mobile
      FeedbackPanel.tsx         # right panel (best move, quality, tips)
      MoveQualityCard.tsx       # CPL → ✅/⚠️/❌/💀
      ResultModal.tsx           # game end + PGN export
    nav/FloatingNav.tsx         # bottom nav
    pwa/InstallButton.tsx       # beforeinstallprompt handler
    ui/ClayCard.tsx, GlassPanel.tsx
  lib/
    engine/stockfish.ts         # Worker wrapper, UCI protocol, skill levels
    engine/analyze.ts           # bestmove + eval + CPL helpers
    coach/phases.ts             # opening/middlegame/endgame detection
    coach/rules.ts              # heuristics (same piece twice, hanging pieces, king safety, passive king…)
    coach/feedback.ts           # combines CPL + phase + rules → human message
    openings/database.ts        # Italian, Sicilian, French, London, QG, Ruy Lopez
    db/idb.ts                   # idb schema: games, openingProgress, stats
    pgn.ts                      # export helpers
  styles.css                    # design tokens (see below)
public/
  manifest.webmanifest
  icons/icon-192.png, icon-512.png
vite.config.ts                  # add VitePWA
```

## Stockfish integration

- Single shared Worker created on first use, reused across games
- Loaded from `https://cdn.jsdelivr.net/npm/stockfish@16/src/stockfish-nnue-16.js` (cached by SW after first hit)
- API: `setSkill(level)`, `bestMove(fen, depth)`, `evaluate(fen)` → returns Promises by tagging UCI requests
- Difficulty map exactly as spec'd (Beginner skill 2 … Master skill 20)
- Coach instance always runs at skill 20 / depth 15 for feedback regardless of game difficulty
- UI never blocks: all engine calls are async; feedback panel shows skeleton while thinking

## Instant Learning Feedback flow

After every human move:
1. Take FEN before move + FEN after move
2. Coach: bestMove(beforeFen) + eval(beforeFen) + eval(afterFen)
3. CPL = |eval_after − eval_best| (sign-adjusted for side to move)
4. Detect phase: moves ≤ 15 = opening, ≥ 41 or < 7 pieces = endgame, else middlegame
5. Run phase rules:
   - Opening: same piece moved twice, not castled by move 10, no center pawn, undeveloped minors
   - Middlegame: hanging pieces (attacked + undefended), missed tactic (best move wins ≥ 200cp material), king exposed
   - Endgame: passive king (distance to center/passed pawn worse than alternative), missed promotion race
6. Compose feedback card: severity color + plain-English message + best-move arrow on board

## Opening Trainer

JSON DB with the 6 named openings as `{name, eco, moves: [...], description}`. Drill flow:
- User plays moves; each is compared to mainline
- ✓ Book / ✗ Deviation (with "Mainline was: Nf3")
- Track per-opening accuracy in IDB (`openingProgress` store)

## IndexedDB schema (idb)

```
games:           {id, mode, side, difficulty, result, pgn, moves[], cplAvg, mistakes[], date}
openingProgress: {id (opening name), attempts, correct, accuracy, lastPlayed}
stats:           {id: 'global', puzzlesSolved, puzzleAccuracy, ...derived}
```

Dashboard reads + aggregates: games/W-L-D, avg CPL, opening/middle/endgame scores (avg CPL bucketed by phase), most common mistake type.

## PWA

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, `injectRegister: null`, custom guarded wrapper that **never registers in Lovable preview/iframe/dev** (per skill rules)
- `workbox.runtimeCaching`: NetworkFirst for navigations, CacheFirst for hashed assets, CacheFirst for `cdn.jsdelivr.net/npm/stockfish*`
- `manifest.webmanifest` with the exact name/colors/icons you specified
- `InstallButton` listens for `beforeinstallprompt`, shows in floating nav when available

## Design system (src/styles.css)

Tokens (oklch):
- `--bg: #0F0F1A`, `--surface: #1A1A2E`, `--surface-2` (slightly lighter), `--gold: #E2B96F`, `--success #4ADE80`, `--warning #FB923C`, `--danger #F87171`, `--text #F0ECE3`, `--muted` foreground
- Radii: 24/28/32px
- Shadows: clay (dual inset highlight + soft drop), glass (blur 24px, 1px border with low-alpha gold tint)
- Utilities: `.clay-card`, `.glass-panel`, `.clay-inset`

Board theme: pure B/W squares (`#F0ECE3` / `#1A1A2E`), elegant default piece set, rounded 24px container with clay shadow, gold highlight for last move / legal moves.

Motion: Framer Motion fade/slide 250–350ms only.

## Layout responsiveness (critical: board never overflows)

- Container: `grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]`
- Board wrapper: `aspect-square w-full max-w-[min(70vh,100%)]` and parent has `min-w-0` + `min-h-0` so it scales to the smaller of viewport height & available width — guarantees full visibility on every device
- Mobile: feedback panel stacks below; bottom nav is `fixed` with safe-area padding; board sized as `min(100vw - padding, 100dvh - chrome)`

## Build order (single pass)

1. Install deps: `chess.js`, `react-chessboard`, `idb`, `framer-motion`, `vite-plugin-pwa`
2. Design tokens + clay/glass utilities in `styles.css`
3. PWA: vite.config + manifest + icons (generated) + guarded registration
4. Engine + coach libs
5. IDB layer + openings DB
6. UI: FloatingNav, ClayCard, GlassPanel, Board, EvalBar, FeedbackPanel, ResultModal
7. Routes: home, play/ai, play/local, openings, stats
8. Verify build

## Out of scope (call out)

- "Puzzles solved" stat is shown but I won't ship a full puzzle module in this pass (no source database specified) — the dashboard field will read 0 until a puzzle pack is added. Say the word and I'll add a small bundled puzzle set in a follow-up.

Approve and I'll build it end-to-end.
