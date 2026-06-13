import { AnimatePresence, motion } from "framer-motion";
import { ClayCard } from "@/components/ui/surfaces";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, Home } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  cplAvg?: number;
  onExportPGN?: () => void;
  onPlayAgain?: () => void;
  homeTo?: string;
};

export function ResultModal({ open, title, subtitle, cplAvg, onExportPGN, onPlayAgain, homeTo = "/" }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-md"
          >
            <ClayCard className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Game over</p>
              <h2 className="mt-2 text-3xl font-bold text-foreground">{title}</h2>
              {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
              {typeof cplAvg === "number" && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs">
                  <span className="text-muted-foreground">Avg CPL</span>
                  <span className="font-mono font-semibold text-foreground">{cplAvg}</span>
                </div>
              )}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {onPlayAgain && (
                  <Button onClick={onPlayAgain} className="bg-gold text-primary-foreground hover:bg-gold/90">
                    <RotateCcw className="h-4 w-4" /> Play again
                  </Button>
                )}
                {onExportPGN && (
                  <Button variant="outline" onClick={onExportPGN}>
                    <Download className="h-4 w-4" /> Export PGN
                  </Button>
                )}
                <Button asChild variant="ghost">
                  <Link to={homeTo}>
                    <Home className="h-4 w-4" /> Home
                  </Link>
                </Button>
              </div>
            </ClayCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
