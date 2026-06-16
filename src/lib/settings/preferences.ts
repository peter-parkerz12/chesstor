import { useEffect, useState } from "react";

export type BoardThemeId = "walnut" | "slate" | "ivory";
export type PieceSetId = "staunton" | "modern" | "minimalist";

export type BoardTheme = {
  id: BoardThemeId;
  name: string;
  description: string;
  light: string;
  dark: string;
  /** Color used for square-coordinate text on light squares. */
  lightText: string;
  darkText: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "walnut",
    name: "Classic Walnut",
    description: "Tournament wood — warm and timeless.",
    light: "#E8D2A6",
    dark: "#7A4E2D",
    lightText: "#5A3A1F",
    darkText: "#F4E4C1",
  },
  {
    id: "slate",
    name: "Midnight Slate",
    description: "High-visibility modern grays.",
    light: "#D6DCE3",
    dark: "#3B4252",
    lightText: "#2E3440",
    darkText: "#ECEFF4",
  },
  {
    id: "ivory",
    name: "Ivory & Ebony",
    description: "Clean editorial contrast.",
    light: "#F0ECE3",
    dark: "#1A1A2E",
    lightText: "#1A1A2E",
    darkText: "#F0ECE3",
  },
];

export type PieceSet = {
  id: PieceSetId;
  name: string;
  description: string;
  /** CSS filter applied to default piece rendering. */
  filter: string;
};

export const PIECE_SETS: PieceSet[] = [
  {
    id: "staunton",
    name: "Premium Staunton",
    description: "Crisp classical pieces — the tournament standard.",
    filter: "none",
  },
  {
    id: "modern",
    name: "Modern Tournament",
    description: "Slightly bolder, higher contrast for sharper reading.",
    filter: "contrast(1.12) saturate(1.05)",
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Soft, low-contrast pieces for a calm board.",
    filter: "contrast(0.92) brightness(1.04) saturate(0.85)",
  },
];

export type Preferences = {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  aiHints: boolean;
};

const DEFAULTS: Preferences = {
  boardTheme: "ivory",
  pieceSet: "staunton",
  soundEnabled: true,
  soundVolume: 0.6,
  aiHints: false,
};

const KEY = "chesscoach:prefs:v1";

function read(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULTS;
  }
}

function write(p: Preferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("chesscoach:prefs", { detail: p }));
  } catch {
    /* noop */
  }
}

export function getPreferences(): Preferences {
  return read();
}

export function getBoardTheme(id?: BoardThemeId): BoardTheme {
  const target = id ?? read().boardTheme;
  return BOARD_THEMES.find((t) => t.id === target) ?? BOARD_THEMES[0];
}

export function getPieceSet(id?: PieceSetId): PieceSet {
  const target = id ?? read().pieceSet;
  return PIECE_SETS.find((p) => p.id === target) ?? PIECE_SETS[0];
}

/** Subscribe to preference changes (same-tab + storage events). */
export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    setPrefs(read());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<Preferences>).detail;
      if (detail) setPrefs(detail);
      else setPrefs(read());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setPrefs(read());
    };
    window.addEventListener("chesscoach:prefs", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("chesscoach:prefs", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = (patch: Partial<Preferences>) => {
    const next = { ...read(), ...patch };
    write(next);
    setPrefs(next);
  };

  return [prefs, update];
}
