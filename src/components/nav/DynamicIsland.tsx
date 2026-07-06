import { useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { BarChart3, BookOpen, Home, LineChart, Settings, Swords, Target, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useIsland } from "./island-context";

type Mode = {
  to: "/" | "/play/ai" | "/play/local" | "/openings" | "/practice" | "/analyze" | "/stats" | "/settings";
  label: string;
  short: string;
  icon: typeof Home;
};

const MODES: Mode[] = [
  { to: "/", label: "Home", short: "Home", icon: Home },
  { to: "/play/ai", label: "Play vs AI", short: "Play AI", icon: Swords },
  { to: "/play/local", label: "Pass & Play", short: "Pass & Play", icon: Users },
  { to: "/openings", label: "Openings", short: "Openings", icon: BookOpen },
  { to: "/practice", label: "Practice", short: "Practice", icon: Target },
  { to: "/analyze", label: "Analyze", short: "Analyze", icon: LineChart },
  { to: "/stats", label: "Progress", short: "Stats", icon: BarChart3 },
  { to: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

const SPRING = { type: "spring" as const, stiffness: 380, damping: 32, mass: 0.7 };
const SWIPE_THRESHOLD = 48;
const LONG_PRESS_MS = 380;

function getActiveIndex(pathname: string) {
  // Prefer exact match, otherwise startsWith for nested.
  const exact = MODES.findIndex((m) => m.to === pathname);
  if (exact !== -1) return exact;
  const sub = MODES.findIndex((m) => m.to !== "/" && pathname.startsWith(m.to));
  return sub === -1 ? 0 : sub;
}

export function DynamicIsland() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { inGame } = useIsland();
  const [expanded, setExpanded] = useState(false);

  const activeIndex = getActiveIndex(pathname);
  const active = MODES[activeIndex];
  const ActiveIcon = active.icon;

  // Long-press to expand.
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const dragging = useRef(false);

  const clearPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const beginPress = useCallback(() => {
    longPressFired.current = false;
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setExpanded(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(8); } catch { /* noop */ }
      }
    }, LONG_PRESS_MS);
  }, [clearPress]);

  const handleTap = useCallback(() => {
    if (longPressFired.current || dragging.current) return;
    setExpanded((e) => !e);
  }, []);

  const handleDragStart = useCallback(() => {
    dragging.current = true;
    clearPress();
  }, [clearPress]);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      // Defer the dragging flag reset so the synthetic tap doesn't fire.
      setTimeout(() => { dragging.current = false; }, 50);
      if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return;
      const dir = info.offset.x > 0 ? -1 : 1;
      const next = (activeIndex + dir + MODES.length) % MODES.length;
      navigate({ to: MODES[next].to });
    },
    [activeIndex, navigate],
  );

  // Collapse on route change.
  useEffect(() => { setExpanded(false); }, [pathname]);

  // Click-outside / Escape to collapse.
  useEffect(() => {
    if (!expanded) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest("[data-island-root]")) setExpanded(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(false); };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const minimized = inGame && !expanded;

  return (
    <nav
      data-island-root
      aria-label="Primary"
      className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 sm:bottom-5"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <motion.div
        layout
        transition={SPRING}
        className="glass-panel overflow-hidden"
        style={{
          borderRadius: 999,
          boxShadow:
            "0 30px 60px -25px rgb(0 0 0 / 0.7), 0 10px 30px -15px rgb(0 0 0 / 0.45), inset 0 1px 0 0 rgb(255 255 255 / 0.08)",
        }}
      >
        <AnimatePresence initial={false} mode="wait">
          {expanded ? (
            <motion.div
              key="expanded"
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto p-1.5 no-scrollbar"
              role="menu"
            >
              {MODES.map((m, i) => {
                const isActive = i === activeIndex;
                const Icon = m.icon;
                return (
                  <button
                    key={m.to}
                    type="button"
                    role="menuitem"
                    onClick={() => { navigate({ to: m.to }); setExpanded(false); }}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={m.label}
                    className={`relative flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-medium transition-colors ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="island-active-pill"
                        className="absolute inset-0 rounded-full bg-white/[0.08] ring-1 ring-gold/30 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.08)]"
                        transition={{ type: "spring", stiffness: 460, damping: 36, mass: 0.6 }}
                      />
                    )}
                    <Icon
                      className={`relative h-4 w-4 transition-colors ${isActive ? "text-gold" : ""}`}
                      aria-hidden="true"
                    />
                    <span className="relative whitespace-nowrap">{m.short}</span>
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              layout
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.28}
              dragMomentum={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onTap={handleTap}
              onPointerDown={beginPress}
              onPointerUp={clearPress}
              onPointerLeave={clearPress}
              onPointerCancel={clearPress}
              onContextMenu={(e) => e.preventDefault()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              role="button"
              tabIndex={0}
              aria-label={`${active.label}. Tap or long-press to switch modes. Swipe to change mode.`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpanded(true);
                } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const dir = e.key === "ArrowRight" ? 1 : -1;
                  const next = (activeIndex + dir + MODES.length) % MODES.length;
                  navigate({ to: MODES[next].to });
                }
              }}
              className={`flex cursor-grab touch-pan-y select-none items-center gap-2.5 active:cursor-grabbing ${
                minimized ? "px-3 py-1.5" : "px-3.5 py-2"
              }`}
            >
              <motion.span
                layout
                transition={SPRING}
                className={`flex shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/25 ${
                  minimized ? "h-7 w-7" : "h-9 w-9"
                }`}
              >
                <ActiveIcon className={minimized ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
              </motion.span>

              <AnimatePresence initial={false}>
                {!minimized && (
                  <motion.div
                    key="label"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex min-w-0 flex-col overflow-hidden"
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 leading-none">
                      Mode
                    </span>
                    <span className="mt-0.5 whitespace-nowrap text-sm font-semibold leading-tight">
                      {active.short}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.span layout className="flex shrink-0 items-center gap-1 pl-1.5 pr-0.5" aria-hidden="true">
                {MODES.map((_, i) => (
                  <motion.span
                    key={i}
                    layout
                    transition={SPRING}
                    className={`block h-1 rounded-full ${
                      i === activeIndex ? "w-4 bg-gold" : "w-1 bg-white/25"
                    }`}
                  />
                ))}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </nav>
  );
}
