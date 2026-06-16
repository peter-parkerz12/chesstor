import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Palette,
  Volume2,
  VolumeX,
  Lightbulb,
  LightbulbOff,
  Check,
} from "lucide-react";

import { ClayCard, GlassPanel } from "@/components/ui/surfaces";
import {
  BOARD_THEMES,
  PIECE_SETS,
  usePreferences,
} from "@/lib/settings/preferences";
import { playSfx } from "@/lib/audio/sfx";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ChessCoach" },
      { name: "description", content: "Customize board theme, piece set, sound, and gameplay hints." },
    ],
  }),
  ssr: false,
  component: SettingsRoute,
});

function SettingsRoute() {
  const [prefs, setPrefs] = usePreferences();

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-10 pb-nav lg:px-8 lg:pt-16">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <h1 className="text-3xl font-bold sm:text-4xl">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Customize the board, pieces, sound, and learning aids. All preferences stay on this device.
      </p>

      <section className="mt-10">
        <SectionHeading icon={Palette} title="Board theme" subtitle="Tap to preview instantly across every board." />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {BOARD_THEMES.map((t) => {
            const active = prefs.boardTheme === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => { setPrefs({ boardTheme: t.id }); playSfx("click"); }}
                whileTap={{ scale: 0.98 }}
                className={`group text-left ${active ? "ring-2 ring-gold/60 rounded-3xl" : ""}`}
              >
                <ClayCard className="!p-4">
                  <div className="grid grid-cols-4 grid-rows-4 overflow-hidden rounded-xl">
                    {Array.from({ length: 16 }).map((_, i) => {
                      const r = Math.floor(i / 4);
                      const c = i % 4;
                      const isDark = (r + c) % 2 === 1;
                      return (
                        <div
                          key={i}
                          className="aspect-square"
                          style={{ backgroundColor: isDark ? t.dark : t.light }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    {active && <Check className="h-4 w-4 text-gold" />}
                  </div>
                </ClayCard>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading
          icon={Palette}
          title="Piece set"
          subtitle="Adjust how the chess pieces are rendered."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PIECE_SETS.map((p) => {
            const active = prefs.pieceSet === p.id;
            return (
              <motion.button
                key={p.id}
                onClick={() => { setPrefs({ pieceSet: p.id }); playSfx("click"); }}
                whileTap={{ scale: 0.98 }}
                className={`text-left ${active ? "ring-2 ring-gold/60 rounded-3xl" : ""}`}
              >
                <ClayCard className="!p-4">
                  <div
                    className="flex items-center justify-center gap-1 rounded-xl bg-white/[0.04] py-4 text-3xl"
                    style={{ filter: p.filter }}
                    aria-hidden
                  >
                    <span>♔</span><span>♕</span><span>♖</span><span>♗</span><span>♘</span><span>♙</span>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-gold" />}
                  </div>
                </ClayCard>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassPanel>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${prefs.soundEnabled ? "bg-gold/15 text-gold" : "bg-white/5 text-muted-foreground"}`}>
                {prefs.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold">Sound effects</p>
                <p className="text-xs text-muted-foreground">Move, capture, check, win sounds.</p>
              </div>
            </div>
            <Toggle on={prefs.soundEnabled} onChange={(v) => { setPrefs({ soundEnabled: v }); if (v) playSfx("click"); }} />
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Volume</span>
              <span className="font-mono">{Math.round(prefs.soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(prefs.soundVolume * 100)}
              onChange={(e) => setPrefs({ soundVolume: Number(e.target.value) / 100 })}
              onMouseUp={() => playSfx("move")}
              onTouchEnd={() => playSfx("move")}
              disabled={!prefs.soundEnabled}
              className="mt-2 w-full accent-[var(--gold)] disabled:opacity-40"
              aria-label="Sound volume"
            />
          </div>
        </GlassPanel>

        <GlassPanel>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${prefs.aiHints ? "bg-gold/15 text-gold" : "bg-white/5 text-muted-foreground"}`}>
                {prefs.aiHints ? <Lightbulb className="h-4 w-4" /> : <LightbulbOff className="h-4 w-4" />}
              </div>
              <div>
                <p className="text-sm font-semibold">Real-time move hints</p>
                <p className="text-xs text-muted-foreground">Show best-move arrows after slips in Play vs AI.</p>
              </div>
            </div>
            <Toggle on={prefs.aiHints} onChange={(v) => { setPrefs({ aiHints: v }); playSfx("click"); }} />
          </div>
        </GlassPanel>
      </section>
    </div>
  );
}

function SectionHeading({
  icon: Icon, title, subtitle,
}: { icon: typeof Palette; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-gold">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-gold" : "bg-white/15"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${on ? "right-0.5" : "left-0.5"}`}
      />
    </button>
  );
}
