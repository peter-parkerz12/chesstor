import { motion } from "framer-motion";

type Props = {
  /** Centipawns from White's perspective. ±10000 = mate. */
  cp: number;
  orientation?: "white" | "black";
};

export function EvalBar({ cp, orientation = "white" }: Props) {
  // Convert cp to a 0..100 percentage for White's advantage.
  const clamped = Math.max(-1000, Math.min(1000, cp));
  const whitePct = 50 + (clamped / 1000) * 50;
  const isMate = Math.abs(cp) > 9000;
  const mateIn = isMate ? 10000 - Math.abs(cp) : null;

  const flipped = orientation === "black";
  const whiteHeight = flipped ? 100 - whitePct : whitePct;
  const label = isMate
    ? `M${mateIn}`
    : `${cp >= 0 ? "+" : ""}${(cp / 100).toFixed(1)}`;

  return (
    <div className="relative h-full w-3 sm:w-4 overflow-hidden clay-inset" style={{ minHeight: 280 }}>
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-foreground"
        animate={{ height: `${whiteHeight}%` }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-gold/50" />
      <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full pl-2 text-[10px] font-semibold tabular-nums text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
