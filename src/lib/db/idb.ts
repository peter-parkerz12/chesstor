import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "chesscoach";
const DB_VERSION = 1;

export type GameRecord = {
  id: string;
  mode: "ai" | "local" | "opening";
  side: "white" | "black";
  difficulty?: string;
  result: "win" | "loss" | "draw" | "unfinished";
  pgn: string;
  moves: string[];
  cplAvg: number;
  cplByPhase: { opening: number; middlegame: number; endgame: number };
  mistakeBuckets: { development: number; tactics: number; kingSafety: number; endgame: number };
  date: number;
};

export type OpeningProgress = {
  id: string;
  name: string;
  attempts: number;
  correct: number;
  accuracy: number;
  lastPlayed: number;
};

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB not available");
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("games")) {
          db.createObjectStore("games", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("openingProgress")) {
          db.createObjectStore("openingProgress", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("stats")) {
          db.createObjectStore("stats", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveGame(game: GameRecord): Promise<void> {
  const db = await getDB();
  await db.put("games", game);
}

export async function listGames(): Promise<GameRecord[]> {
  const db = await getDB();
  const games = (await db.getAll("games")) as GameRecord[];
  return games.sort((a, b) => b.date - a.date);
}

export async function saveOpeningProgress(p: OpeningProgress): Promise<void> {
  const db = await getDB();
  await db.put("openingProgress", p);
}

export async function getOpeningProgress(id: string): Promise<OpeningProgress | undefined> {
  const db = await getDB();
  return (await db.get("openingProgress", id)) as OpeningProgress | undefined;
}

export async function listOpeningProgress(): Promise<OpeningProgress[]> {
  const db = await getDB();
  return (await db.getAll("openingProgress")) as OpeningProgress[];
}

export async function recordOpeningAttempt(id: string, name: string, correct: boolean) {
  const existing = (await getOpeningProgress(id)) ?? {
    id,
    name,
    attempts: 0,
    correct: 0,
    accuracy: 0,
    lastPlayed: 0,
  };
  existing.attempts += 1;
  if (correct) existing.correct += 1;
  existing.accuracy = existing.attempts > 0 ? existing.correct / existing.attempts : 0;
  existing.lastPlayed = Date.now();
  await saveOpeningProgress(existing);
}
