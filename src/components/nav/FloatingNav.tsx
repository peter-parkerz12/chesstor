import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Swords, BookOpen, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };
const ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/play/ai", label: "Play", icon: Swords },
  { to: "/openings", label: "Learn", icon: BookOpen },
  { to: "/stats", label: "Stats", icon: BarChart3 },
];

export function FloatingNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-40 w-[min(420px,calc(100%-2rem))] -translate-x-1/2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="glass-panel flex items-center justify-around gap-1 !p-2">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to.replace(/\/ai$/, ""));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-white/8 ring-1 ring-gold/30"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className={`relative h-5 w-5 ${active ? "text-gold" : ""}`} />
              <span className={`relative ${active ? "text-foreground" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
