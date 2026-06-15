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
      aria-label="Primary"
      className="fixed bottom-3 left-1/2 z-40 w-[min(440px,calc(100%-1.5rem))] -translate-x-1/2 sm:bottom-5"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="glass-panel flex items-center justify-around gap-1 !p-1.5">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.to
            : pathname === item.to || pathname.startsWith(item.to.replace(/\/ai$/, ""));
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as never}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-2xl bg-white/[0.08] ring-1 ring-gold/30 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.6 }}
                />
              )}
              <Icon className={`relative h-5 w-5 transition-colors ${active ? "text-gold" : ""}`} aria-hidden="true" />
              <span className={`relative transition-colors ${active ? "text-foreground" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
