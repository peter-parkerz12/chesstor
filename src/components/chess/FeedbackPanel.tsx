import { AnimatePresence, motion } from "framer-motion";
import { SEVERITY_META, type Severity } from "@/lib/coach/rules";
import type { CoachReport } from "@/lib/coach/feedback";
import { ClayCard, GlassPanel } from "@/components/ui/surfaces";

type Props = {
  report: CoachReport | null;
  loading: boolean;
  thinking?: boolean;
  emptyHint?: string;
};

const TONE_CLASS: Record<Severity, string> = {
  good: "text-success",
  inaccuracy: "text-warning",
  mistake: "text-warning",
  blunder: "text-danger",
};

const TONE_RING: Record<Severity, string> = {
  good: "ring-success/30",
  inaccuracy: "ring-warning/30",
  mistake: "ring-warning/40",
  blunder: "ring-danger/40",
};

export function FeedbackPanel({ report, loading, thinking, emptyHint }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ClayCard className="!p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Coach</h3>
          {thinking && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
              thinking…
            </span>
          )}
        </div>
        <AnimatePresence mode="wait">
          {loading && !report ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-4 space-y-3"
            >
              <div className="h-4 w-24 animate-pulse rounded bg-white/5" />
              <div className="h-3 w-full animate-pulse rounded bg-white/5" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
            </motion.div>
          ) : report ? (
            <motion.div
              key={report.title + report.message}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className={`mt-4 rounded-2xl p-4 ring-1 ${TONE_RING[report.severity]} bg-white/3`}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base">{SEVERITY_META[report.severity].icon}</span>
                <span className={`font-semibold ${TONE_CLASS[report.severity]}`}>{report.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">CPL {report.cpl}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">{report.message}</p>
              {report.bestMoveSAN && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Best move: <span className="font-mono text-gold">{report.bestMoveSAN}</span>
                </p>
              )}
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-sm text-muted-foreground"
            >
              {emptyHint ?? "Make a move — I'll explain what worked and what didn't."}
            </motion.p>
          )}
        </AnimatePresence>
      </ClayCard>

      {report && (
        <GlassPanel>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phase</h4>
          <p className="mt-1 text-sm capitalize text-foreground/90">{report.phase}</p>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            {PHASE_HINT[report.phase]}
          </p>
        </GlassPanel>
      )}
    </div>
  );
}

const PHASE_HINT: Record<string, string> = {
  opening: "Develop knights and bishops, claim the center, castle early, and don't move the same piece twice without reason.",
  middlegame: "Look for tactics (forks, pins, skewers), keep pieces defended, and improve your worst piece.",
  endgame: "Activate your king, push passed pawns, and convert advantages into queens.",
};
