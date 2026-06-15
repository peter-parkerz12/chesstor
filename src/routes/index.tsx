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

type Mode = { to: string; title: string; desc: string; icon: typeof Swords; accent?: boolean };
const MODES: Mode[] = [
  { to: "/play/ai", title: "Play vs AI", desc: "Stockfish opponent with 6 difficulty tiers and instant coaching.", icon: Swords, accent: true },
  { to: "/play/local", title: "Pass & Play", desc: "Two players, one device. Perfect for the dinner table.", icon: Users },
  { to: "/openings", title: "Opening Trainer", desc: "Drill 6 classical openings move by move with feedback.", icon: BookOpen },
  { to: "/stats", title: "Progress", desc: "Track your accuracy, mistakes, and openings mastered.", icon: BarChart3 },
];

function Home() {
  return (
    <div className="pb-nav mx-auto w-full max-w-6xl px-5 pt-10 sm:pt-14 lg:px-8 lg:pt-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-medium tracking-wide text-gold">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Offline · No account · No ads
        </span>
        <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Become a sharper{" "}
          <span className="text-gold">chess thinker.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
          A premium learning playground powered by Stockfish — explains every move you make in plain English.
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5">
        {MODES.map((m, i) => (
          <motion.div
            key={m.to}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link to={m.to as never} className="group block focus-visible:outline-none">
              <ClayCard className={`relative h-full overflow-hidden transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-[0_30px_60px_-25px_rgb(0_0_0/0.7)] ${m.accent ? "glow-gold" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${m.accent ? "bg-gold/15 text-gold" : "bg-white/5 text-foreground"}`}>
                    <m.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  {m.accent && (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">Featured</span>
                  )}
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
              </ClayCard>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
