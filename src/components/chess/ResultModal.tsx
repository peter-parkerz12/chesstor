import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Download, RotateCcw, Home, Trophy, BookOpen, Handshake } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createTimeline, easeEntry, prefersReducedMotion } from "@/lib/motion/anime";

export type ResultVariant = "win" | "loss" | "draw";

type Props = {
  open: boolean;
  variant?: ResultVariant;
  title: string;
  subtitle?: string;
  cplAvg?: number;
  insight?: string;
  onExportPGN?: () => void;
  onPlayAgain?: () => void;
  onAnalyze?: () => void;
  homeTo?: string;
};

const VARIANT_META: Record<ResultVariant, { tag: string; accent: string; icon: typeof Trophy; ring: string }> = {
  win: { tag: "Victory", accent: "text-gold", icon: Trophy, ring: "ring-gold/30" },
  loss: { tag: "Defeat",  accent: "text-foreground", icon: BookOpen, ring: "ring-white/10" },
  draw: { tag: "Draw",    accent: "text-foreground", icon: Handshake, ring: "ring-white/10" },
};

export function ResultModal({
  open, variant = "draw", title, subtitle, cplAvg, insight,
  onExportPGN, onPlayAgain, onAnalyze, homeTo = "/",
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const overlay = overlayRef.current;
    const card = cardRef.current;
    if (!overlay || !card) return;

    const items = card.querySelectorAll<HTMLElement>("[data-stagger]");
    const reduced = prefersReducedMotion();

    const tl = createTimeline({ defaults: { ease: easeEntry } });
    tl
      .add(overlay, { opacity: [0, 1], duration: reduced ? 1 : 220 }, 0)
      .add(card, {
        opacity: [0, 1],
        translateY: [10, 0],
        scale: [0.97, 1],
        duration: reduced ? 1 : 360,
      }, reduced ? 0 : 60)
      .add(items, {
        opacity: [0, 1],
        translateY: [6, 0],
        duration: reduced ? 1 : 280,
        delay: reduced ? 0 : (_el: Element, i: number) => i * 50,
      }, reduced ? 0 : 180);

    return () => { tl.pause(); };
  }, [open, variant, title]);

  if (!open) return null;

  const meta = VARIANT_META[variant];
  const Icon = meta.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-background/75 backdrop-blur-md"
        style={{ opacity: 0 }}
      />
      <div
        ref={cardRef}
        className={`relative w-full max-w-md rounded-3xl border border-white/8 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-7 text-center shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] backdrop-blur-xl ring-1 ${meta.ring}`}
        style={{ opacity: 0 }}
      >
        <div data-stagger className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/8">
          <Icon className={`h-5 w-5 ${meta.accent}`} aria-hidden="true" />
        </div>
        <p data-stagger className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] ${meta.accent}`}>
          {meta.tag}
        </p>
        <h2 data-stagger className="mt-1.5 text-3xl font-bold tracking-tight text-foreground text-balance">
          {title}
        </h2>
        {subtitle && (
          <p data-stagger className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        )}

        {(typeof cplAvg === "number" || insight) && (
          <div data-stagger className="mt-5 space-y-3">
            {typeof cplAvg === "number" && (
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs ring-1 ring-white/8">
                <span className="text-muted-foreground">Avg accuracy loss</span>
                <span className="font-mono font-semibold text-foreground">{cplAvg} cp</span>
              </div>
            )}
            {insight && (
              <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-muted-foreground ring-1 ring-white/5 text-pretty">
                {insight}
              </p>
            )}
          </div>
        )}

        <div data-stagger className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {onPlayAgain && (
            <Button
              onClick={onPlayAgain}
              className={variant === "win"
                ? "bg-gold text-primary-foreground hover:bg-gold/90"
                : "bg-foreground text-background hover:bg-foreground/90"}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {variant === "loss" ? "Rematch" : "Play again"}
            </Button>
          )}
          {onAnalyze && (
            <Button
              onClick={onAnalyze}
              className="bg-gold text-primary-foreground hover:bg-gold/90 shadow-[0_0_15px_rgba(226,185,111,0.2)]"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Review Game
            </Button>
          )}
          {onExportPGN && (
            <Button variant="ghost" onClick={onExportPGN}>
              <Download className="h-4 w-4" aria-hidden="true" /> PGN
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link to={homeTo}>
              <Home className="h-4 w-4" aria-hidden="true" /> Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
