import { useState } from "react";
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
  Moon,
  Sun,
  Music2,
  Sparkles,
  Wand2,
  Wifi,
  RotateCcw,
  AppWindow,
  type LucideIcon,
} from "lucide-react";

import { ClayCard } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { InstallButton } from "@/components/pwa/InstallButton";
import {
  BOARD_SIZE_MAX,
  BOARD_SIZE_MIN,
  BOARD_THEMES,
  PIECE_SETS,
  resetPreferences,
  type SoundPackId,
  usePreferences,
} from "@/lib/settings/preferences";
import { playSfx } from "@/lib/audio/sfx";
import { PieceSetPreview } from "@/lib/chess/pieceSets";
import { Play, Ruler } from "lucide-react";

const SOUND_PACKS: Array<{ id: SoundPackId; name: string; description: string }> = [
  { id: "default", name: "Default", description: "Balanced acoustic tones." },
  { id: "classic-tournament", name: "Classic Tournament", description: "Warm wooden-board sounds." },
  { id: "modern-digital", name: "Modern Digital", description: "Crisp app-style tones." },
  { id: "premium-luxury", name: "Premium Luxury", description: "Deep cinematic character." },
];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ChessCoach" },
      {
        name: "description",
        content: "Customize appearance, gameplay, audio, and application preferences.",
      },
    ],
  }),
  ssr: false,
  component: SettingsRoute,
});

function SettingsRoute() {
  const [prefs, setPrefs] = usePreferences();
  const [resetOpen, setResetOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-8 pb-nav sm:px-6 lg:px-8 lg:pt-16">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Personalize the board, gameplay, audio, and application. All preferences stay on this
          device.
        </p>
      </header>

      <div className="space-y-12">
        {/* ──────────────── APPEARANCE ──────────────── */}
        <Section
          icon={Palette}
          title="Appearance"
          subtitle="Theme, board, and pieces. Changes apply instantly across every screen."
        >
          {/* Theme */}
          <Row
            icon={prefs.theme === "dark" ? Moon : Sun}
            title="Theme"
            description="Switch between dark and light interface."
            control={
              <Switch
                on={prefs.theme === "dark"}
                onChange={() => {
                  setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" });
                  playSfx("click");
                }}
                label="Toggle theme"
              />
            }
          />

          {/* Board theme */}
          <Group title="Board theme">
            <CardGrid>
              {BOARD_THEMES.map((t) => {
                const active = prefs.boardTheme === t.id;
                return (
                  <ThemeTile
                    key={t.id}
                    active={active}
                    onClick={() => {
                      setPrefs({ boardTheme: t.id });
                      playSfx("click");
                    }}
                    name={t.name}
                    description={t.description}
                    preview={
                      <div className="grid grid-cols-4 grid-rows-4 overflow-hidden rounded-xl ring-1 ring-white/5">
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
                    }
                  />
                );
              })}
            </CardGrid>
          </Group>

          {/* Piece theme */}
          <Group title="Piece theme">
            <CardGrid>
              {PIECE_SETS.map((p) => {
                const active = prefs.pieceSet === p.id;
                return (
                  <ThemeTile
                    key={p.id}
                    active={active}
                    onClick={() => {
                      setPrefs({ pieceSet: p.id });
                      playSfx("click");
                    }}
                    name={p.name}
                    description={p.description}
                    preview={
                      <div
                        className="flex h-[88px] items-center justify-center rounded-xl bg-white/2.5 ring-1 ring-white/5"
                        aria-hidden
                      >
                        <PieceSetPreview id={p.id} />
                      </div>
                    }
                  />
                );
              })}
            </CardGrid>
          </Group>

          <Row
            icon={Ruler}
            title="Board size"
            description="Preferred board width on desktop. Automatically clamps to the available space."
            control={
              <div className="flex w-full max-w-[220px] items-center gap-3">
                <input
                  type="range"
                  min={BOARD_SIZE_MIN}
                  max={BOARD_SIZE_MAX}
                  step={10}
                  value={prefs.boardSize}
                  onChange={(e) => setPrefs({ boardSize: Number(e.target.value) })}
                  className="h-1.5 flex-1 cursor-pointer accent-gold"
                  aria-label="Board size"
                />
                <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {prefs.boardSize}px
                </span>
              </div>
            }
          />
        </Section>

        {/* ──────────────── GAMEPLAY ──────────────── */}
        <Section
          icon={Wand2}
          title="Gameplay"
          subtitle="Coaching, hints, and animation behavior during games."
        >
          <Row
            icon={prefs.coachEnabled ? Lightbulb : LightbulbOff}
            title="Coach feedback"
            description="Real-time analysis and instructional notes after every move."
            control={
              <Switch
                on={prefs.coachEnabled}
                onChange={(v) => {
                  setPrefs({ coachEnabled: v });
                  playSfx("click");
                }}
                label="Toggle coach"
              />
            }
          />
          <Row
            icon={Sparkles}
            title="Move hints"
            description="Show the best-move arrow when a slip is detected."
            control={
              <Switch
                on={prefs.moveHints}
                onChange={(v) => {
                  setPrefs({ moveHints: v });
                  playSfx("click");
                }}
                label="Toggle move hints"
              />
            }
          />
          <Row
            icon={Wand2}
            title="Animations"
            description="Smooth piece movement and UI transitions."
            control={
              <Switch
                on={prefs.animations}
                onChange={(v) => {
                  setPrefs({ animations: v });
                  playSfx("click");
                }}
                label="Toggle animations"
              />
            }
          />
        </Section>

        {/* ──────────────── AUDIO ──────────────── */}
        <Section
          icon={Volume2}
          title="Audio"
          subtitle="Sound effects, pack, and volume."
        >
          <Row
            icon={prefs.soundEnabled ? Volume2 : VolumeX}
            title="Sound effects"
            description="Move, capture, check, and result sounds."
            control={
              <Switch
                on={prefs.soundEnabled}
                onChange={(v) => {
                  setPrefs({ soundEnabled: v });
                  if (v) playSfx("click");
                }}
                label="Toggle sound"
              />
            }
          />
          <Row
            icon={Volume2}
            title="Volume"
            description="Master output level for all sound effects."
            control={
              <div className="flex w-full max-w-[200px] items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(prefs.soundVolume * 100)}
                  onChange={(e) => setPrefs({ soundVolume: Number(e.target.value) / 100 })}
                  onMouseUp={() => playSfx("move")}
                  onTouchEnd={() => playSfx("move")}
                  disabled={!prefs.soundEnabled}
                  className="h-1.5 flex-1 cursor-pointer accent-gold disabled:opacity-40"
                  aria-label="Sound volume"
                />
                <span className="w-10 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {Math.round(prefs.soundVolume * 100)}%
                </span>
              </div>
            }
          />
          <Group title="Sound pack" icon={Music2}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SOUND_PACKS.map((pack) => {
                const active = prefs.soundPack === pack.id;
                return (
                  <div
                    key={pack.id}
                    className={`group min-h-[72px] rounded-2xl border px-4 py-3.5 transition-colors ${
                      active
                        ? "border-gold/40 bg-gold/10"
                        : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPrefs({ soundPack: pack.id });
                          playSfx("move", pack.id);
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-semibold">{pack.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{pack.description}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Preview ${pack.name} sound`}
                          onClick={(e) => {
                            e.stopPropagation();
                            playSfx("move", pack.id);
                            setTimeout(() => playSfx("capture", pack.id), 220);
                            setTimeout(() => playSfx("check", pack.id), 480);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        {active && <Check className="mt-0.5 h-4 w-4 text-gold" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Group>
        </Section>

        {/* ──────────────── APPLICATION ──────────────── */}
        <Section
          icon={AppWindow}
          title="Application"
          subtitle="Installation, offline access, and preference reset."
        >
          <Row
            icon={AppWindow}
            title="Install ChessCoach"
            description="Add the app to your home screen for fast, full-screen access."
            control={
              <div className="flex items-center">
                <InstallFallback />
              </div>
            }
          />
          <Row
            icon={Wifi}
            title="Offline mode"
            description="Cache the app so you can play and learn without an internet connection."
            control={
              <Switch
                on={prefs.offlineMode}
                onChange={(v) => {
                  setPrefs({ offlineMode: v });
                  playSfx("click");
                }}
                label="Toggle offline mode"
              />
            }
          />
          <Row
            icon={RotateCcw}
            title="Reset preferences"
            description="Restore every setting on this page to its default value."
            control={
              !resetOpen ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setResetOpen(true)}
                >
                  Reset
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    onClick={() => setResetOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl bg-danger text-white hover:bg-danger/90"
                    onClick={() => {
                      resetPreferences();
                      setResetOpen(false);
                      playSfx("click");
                    }}
                  >
                    Confirm reset
                  </Button>
                </div>
              )
            }
          />
        </Section>
      </div>
    </div>
  );
}

/* ─────────────────────── Building blocks ─────────────────────── */

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gold ring-1 ring-white/8">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      <ClayCard className="divide-y divide-white/5 p-0!">{children}</ClayCard>
    </section>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:px-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted-foreground ring-1 ring-white/5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center justify-end">{control}</div>
    </div>
  );
}

function Group({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function ThemeTile({
  active,
  onClick,
  name,
  description,
  preview,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  description: string;
  preview: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      aria-pressed={active}
      className={`group flex h-full flex-col rounded-2xl border p-3 text-left transition-colors ${
        active
          ? "border-gold/50 bg-gold/8 shadow-[0_0_0_3px_oklch(0.82_0.1_80/0.12)]"
          : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
      }`}
    >
      {preview}
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        </div>
        {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" />}
      </div>
    </motion.button>
  );
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-gold" : "bg-white/15"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${
          on ? "right-0.5" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** When no install prompt is available, render a graceful disabled hint. */
function InstallFallback() {
  // InstallButton renders nothing when not installable; show a hint in that case.
  return (
    <div className="flex items-center gap-2">
      <InstallButton />
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Use your browser&apos;s &quot;Add to Home Screen&quot; if no button appears.
      </span>
    </div>
  );
}
