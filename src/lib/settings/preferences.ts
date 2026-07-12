import { useCallback, useEffect, useState } from "react";

export type BoardThemeId = "walnut" | "slate" | "ivory" | "midnight" | "tournament" | "graphite";
export type PieceSetId = "staunton" | "modern" | "glass" | "neo" | "minimal" | "precision";
export type ThemeMode = "light" | "dark";
export type SoundPackId = "default" | "classic-tournament" | "modern-digital" | "premium-luxury";

export const BOARD_SIZE_MIN = 320;
export const BOARD_SIZE_MAX = 900;
export const BOARD_SIZE_DEFAULT = 640;

export function clampBoardSize(value: number): number {
  if (!Number.isFinite(value)) return BOARD_SIZE_DEFAULT;
  return Math.min(BOARD_SIZE_MAX, Math.max(BOARD_SIZE_MIN, Math.round(value)));
}

export type BoardTheme = {
  id: BoardThemeId;
  name: string;
  description: string;
  light: string;
  dark: string;
  /** Color used for square-coordinate text. */
  lightText: string;
  darkText: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "walnut",
    name: "Classic Walnut",
    description: "Tournament wood — warm, timeless contrast.",
    light: "#E8D2A6",
    dark: "#7A4E2D",
    lightText: "#5A3A1F",
    darkText: "#F4E4C1",
  },
  {
    id: "slate",
    name: "Midnight Slate",
    description: "Modern grayscale, maximum readability.",
    light: "#C9CFD7",
    dark: "#2E3340",
    lightText: "#2E3340",
    darkText: "#E6EAF0",
  },
  {
    id: "ivory",
    name: "Ivory & Ebony",
    description: "Editorial high-contrast tournament look.",
    light: "#EDE7DA",
    dark: "#141519",
    lightText: "#141519",
    darkText: "#EDE7DA",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep charcoal and muted slate for late-night focus.",
    light: "#3C4250",
    dark: "#0F1319",
    lightText: "#E6EAF0",
    darkText: "#8892A3",
  },
  {
    id: "tournament",
    name: "Tournament Green",
    description: "Classic tournament green with refined neutral squares.",
    light: "#EEEED2",
    dark: "#4B7A3F",
    lightText: "#4B7A3F",
    darkText: "#EEEED2",
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Minimal monochrome charcoal — pure focus.",
    light: "#B8BAC0",
    dark: "#3A3D44",
    lightText: "#2A2D33",
    darkText: "#E6E8EC",
  },
];

export type PieceSet = {
  id: PieceSetId;
  name: string;
  description: string;
};

export const PIECE_SETS: PieceSet[] = [
  {
    id: "staunton",
    name: "Premium Staunton",
    description: "Crisp classical pieces — the tournament standard.",
  },
  {
    id: "modern",
    name: "Modern Minimal",
    description: "Clean geometric silhouettes, no outline.",
  },
  {
    id: "glass",
    name: "Elite Glass",
    description: "Refined hairline outlines, premium clarity.",
  },
  {
    id: "neo",
    name: "Neo",
    description: "Bold modern silhouettes with strong contrast.",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Ultra-thin hairline pieces, maximum clarity.",
  },
  {
    id: "precision",
    name: "Precision",
    description: "Sharp engineered pieces with a mechanical edge.",
  },
];

export type Preferences = {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  theme: ThemeMode;
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  soundPack: SoundPackId;
  coachEnabled: boolean;
  moveHints: boolean;
  animations: boolean;
  offlineMode: boolean;
  boardSize: number; // px, desktop preferred board width
};

const DEFAULTS: Preferences = {
  boardTheme: "ivory",
  pieceSet: "staunton",
  theme: "dark",
  soundEnabled: true,
  soundVolume: 0.6,
  soundPack: "default",
  coachEnabled: true,
  moveHints: true,
  animations: true,
  offlineMode: true,
  boardSize: BOARD_SIZE_DEFAULT,
};

const KEY = "chesscoach:prefs:v1";
const THEME_COLOR: Record<ThemeMode, string> = {
  dark: "#090A0B",
  light: "#F8F6EF",
};

function inferSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return DEFAULTS.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isTheme(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark";
}

function clampVolume(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULTS.soundVolume;
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

function read(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, theme: inferSystemTheme() };
    const saved = JSON.parse(raw) as Partial<Preferences> & {
      aiHints?: boolean;
      pieceSet?: string;
    };
    const preferences: Preferences = {
      ...DEFAULTS,
      ...saved,
      theme: isTheme(saved.theme) ? saved.theme : inferSystemTheme(),
      soundPack: saved.soundPack ?? DEFAULTS.soundPack,
      soundVolume: clampVolume(saved.soundVolume),
      soundEnabled:
        typeof saved.soundEnabled === "boolean" ? saved.soundEnabled : DEFAULTS.soundEnabled,
      coachEnabled: saved.coachEnabled ?? saved.aiHints ?? DEFAULTS.coachEnabled,
      boardSize: clampBoardSize(saved.boardSize ?? DEFAULTS.boardSize),
    };
    if ((preferences.pieceSet as string) === "minimalist") preferences.pieceSet = "glass";
    return preferences;
  } catch {
    return { ...DEFAULTS, theme: inferSystemTheme() };
  }
}

function write(p: Preferences) {
  if (typeof window === "undefined") return;
  try {
    applyTheme(p.theme);
    window.localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new CustomEvent("chesscoach:prefs", { detail: p }));
  } catch {
    /* noop */
  }
}

export function getPreferences(): Preferences {
  return read();
}

export function resetPreferences(): Preferences {
  const next: Preferences = { ...DEFAULTS, theme: inferSystemTheme() };
  write(next);
  return next;
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
  const [prefs, setPrefs] = useState<Preferences>(() => read());

  useEffect(() => {
    const initial = read();
    applyTheme(initial.theme);
    setPrefs(initial);
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<Preferences>).detail;
      if (detail) {
        applyTheme(detail.theme);
        setPrefs(detail);
      } else {
        const next = read();
        applyTheme(next.theme);
        setPrefs(next);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        const next = read();
        applyTheme(next.theme);
        setPrefs(next);
      }
    };
    window.addEventListener("chesscoach:prefs", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("chesscoach:prefs", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<Preferences>) => {
    const next = { ...read(), ...patch };
    write(next);
    setPrefs(next);
  }, []);

  return [prefs, update];
}
