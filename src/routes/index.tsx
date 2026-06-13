import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Swords, Users, BookOpen, BarChart3, Sparkles } from "lucide-react";
import { ClayCard } from "@/components/ui/surfaces";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChessCoach — Learn chess with instant feedback" },
      { name: "description", content: "Play vs Stockfish, get instant feedback after every move, and master chess openings — all offline." },
    ],
  }),
  component: Home,
});

const MODES = [
  { to: "/play/ai", title: "Play vs AI", desc: "Stockfish opponent with 6 difficulty tiers and instant coaching.", icon: Swords, accent: true },
  { to: "/play/local", title: "Pass & Play", desc: "Two players, one device. Perfect for the dinner table.", icon: Users },
  { to: "/openings", title: "Opening Trainer", desc: "Drill 6 classical openings move by move with feedback.", icon: BookOpen },
  { to: "/stats", title: "Progress", desc: "Track your accuracy, mistakes, and openings mastered.", icon: BarChart3 },
] as const;

function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pt-12 pb-32 lg:px-8 lg:pt-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Offline · No account · No ads
        </span>
        <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Become a sharper
          <br />
          <span className="text-gold">chess thinker.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          A premium learning playground powered by Stockfish — explains every move you make in plain English.
        </p>
      </motion.div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {MODES.map((m, i) => (
          <motion.div
            key={m.to}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 + i * 0.06 }}
          >
            <Link to={m.to} className="group block">
              <ClayCard className={`relative h-full overflow-hidden transition-transform group-hover:-translate-y-1 ${m.accent ? "glow-gold" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.accent ? "bg-gold/15 text-gold" : "bg-white/5 text-foreground"}`}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  {m.accent && (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">Featured</span>
                  )}
                </div>
                <h3 className="mt-5 text-xl font-bold">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
              </ClayCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
