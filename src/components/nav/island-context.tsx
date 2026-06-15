import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type IslandState = {
  inGame: boolean;
  setInGame: (v: boolean) => void;
};

const Ctx = createContext<IslandState | null>(null);

export function IslandProvider({ children }: { children: ReactNode }) {
  const [inGame, setInGame] = useState(false);
  return <Ctx.Provider value={{ inGame, setInGame }}>{children}</Ctx.Provider>;
}

function useIslandCtx() {
  const v = useContext(Ctx);
  if (!v) {
    // Safe no-op during SSR / outside provider.
    return { inGame: false, setInGame: () => {} } as IslandState;
  }
  return v;
}

export function useIsland() {
  return useIslandCtx();
}

/** Marks the island as "in game" while `active` is true. Auto-resets on unmount. */
export function useGameMode(active: boolean) {
  const { setInGame } = useIslandCtx();
  useEffect(() => {
    setInGame(active);
    return () => setInGame(false);
  }, [active, setInGame]);
}
