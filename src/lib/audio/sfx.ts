// Web Audio synthesizer for chess sounds. Every sound pack uses a
// genuinely distinct synthesis architecture — different waveforms,
// spectral shaping, envelopes, and noise character — so packs are
// audibly and functionally different, not just level-scaled.

import { getPreferences, type SoundPackId } from "@/lib/settings/preferences";

export type SfxKind =
  | "move"
  | "capture"
  | "check"
  | "checkmate"
  | "castle"
  | "promotion"
  | "puzzleSuccess"
  | "puzzleFail"
  | "win"
  | "loss"
  | "click";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let lastPlayedAt = 0;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;
    masterGain.gain.value = getPreferences().soundVolume;
    masterGain.connect(compressor).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => null);
  if (masterGain) {
    const volume = getPreferences().soundVolume;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }
  return ctx;
}

/* ─────────────── low-level building blocks ─────────────── */

function tone(
  c: AudioContext,
  dest: AudioNode,
  {
    freq,
    dur,
    type = "sine",
    gain = 0.18,
    delay = 0,
    glideTo,
    cutoff = 6000,
    filterType = "lowpass",
    q = 0.7,
  }: {
    freq: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    glideTo?: number;
    cutoff?: number;
    filterType?: BiquadFilterType;
    q?: number;
  },
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = cutoff;
  f.Q.value = q;
  osc.type = type;
  osc.frequency.value = freq;
  const start = c.currentTime + delay;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur * 0.9);
  osc.connect(f).connect(g).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.03);
}

function noise(
  c: AudioContext,
  dest: AudioNode,
  {
    dur,
    gain = 0.08,
    freq = 2200,
    q = 0.7,
    type = "bandpass",
    color = "white",
    delay = 0,
  }: {
    dur: number;
    gain?: number;
    freq?: number;
    q?: number;
    type?: BiquadFilterType;
    color?: "white" | "pink";
    delay?: number;
  },
) {
  const size = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, size, c.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < size; i++) {
    const env = Math.pow(1 - i / size, 1.6);
    const w = Math.random() * 2 - 1;
    if (color === "pink") {
      last = 0.98 * last + 0.02 * w;
      data[i] = last * 4 * env;
    } else {
      data[i] = w * env;
    }
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const start = c.currentTime + delay;
  src.connect(f).connect(g).connect(dest);
  src.start(start);
  src.stop(start + dur + 0.03);
}

/* ─────────────── per-pack sound designers ─────────────── */
/**
 * Each pack is a distinct sound designer. Same event → very different
 * sonic result: different waveforms, spectra, and layering.
 */
type Designer = (c: AudioContext, dest: AudioNode, kind: SfxKind) => void;

const defaultPack: Designer = (c, d, kind) => {
  switch (kind) {
    case "move":
      noise(c, d, { dur: 0.05, gain: 0.05, freq: 2400 });
      tone(c, d, { freq: 300, dur: 0.08, type: "triangle", gain: 0.12, cutoff: 1800 });
      return;
    case "capture":
      noise(c, d, { dur: 0.09, gain: 0.1, freq: 1600 });
      tone(c, d, { freq: 200, dur: 0.14, type: "sine", gain: 0.22, glideTo: 110, cutoff: 1400 });
      return;
    case "check":
      tone(c, d, { freq: 880, dur: 0.16, type: "sine", gain: 0.16 });
      tone(c, d, { freq: 1320, dur: 0.18, type: "sine", gain: 0.12, delay: 0.06 });
      return;
    case "castle":
      noise(c, d, { dur: 0.05, gain: 0.05, freq: 2000 });
      tone(c, d, { freq: 240, dur: 0.07, type: "triangle", gain: 0.12 });
      tone(c, d, { freq: 280, dur: 0.08, type: "triangle", gain: 0.12, delay: 0.08 });
      return;
    case "promotion":
    case "puzzleSuccess":
    case "win":
      tone(c, d, { freq: 523, dur: 0.12, type: "sine", gain: 0.16 });
      tone(c, d, { freq: 659, dur: 0.12, type: "sine", gain: 0.16, delay: 0.1 });
      tone(c, d, { freq: 784, dur: 0.18, type: "sine", gain: 0.18, delay: 0.2 });
      return;
    case "checkmate":
    case "loss":
    case "puzzleFail":
      tone(c, d, { freq: 440, dur: 0.22, type: "triangle", gain: 0.2, glideTo: 200 });
      tone(c, d, { freq: 330, dur: 0.32, type: "sine", gain: 0.18, delay: 0.18, glideTo: 155 });
      return;
    case "click":
      noise(c, d, { dur: 0.025, gain: 0.04, freq: 2400 });
      tone(c, d, { freq: 1800, dur: 0.04, type: "sine", gain: 0.05 });
      return;
  }
};

/** Tournament — natural wooden thunk: pink noise transient + low body. */
const tournamentPack: Designer = (c, d, kind) => {
  switch (kind) {
    case "move":
      noise(c, d, { dur: 0.09, gain: 0.16, freq: 900, q: 1.2, color: "pink" });
      tone(c, d, { freq: 150, dur: 0.13, type: "sine", gain: 0.18, glideTo: 95, cutoff: 900 });
      return;
    case "capture":
      noise(c, d, { dur: 0.14, gain: 0.22, freq: 700, q: 1.4, color: "pink" });
      tone(c, d, { freq: 110, dur: 0.22, type: "sine", gain: 0.28, glideTo: 60, cutoff: 700 });
      tone(c, d, { freq: 320, dur: 0.06, type: "triangle", gain: 0.08, delay: 0.02, cutoff: 1400 });
      return;
    case "check":
      noise(c, d, { dur: 0.06, gain: 0.08, freq: 3000, color: "pink" });
      tone(c, d, { freq: 660, dur: 0.28, type: "triangle", gain: 0.18, cutoff: 3200 });
      tone(c, d, { freq: 990, dur: 0.32, type: "triangle", gain: 0.12, delay: 0.05, cutoff: 3200 });
      return;
    case "castle":
      noise(c, d, { dur: 0.08, gain: 0.14, freq: 850, color: "pink" });
      tone(c, d, { freq: 140, dur: 0.09, type: "sine", gain: 0.16, cutoff: 900 });
      noise(c, d, { dur: 0.08, gain: 0.14, freq: 850, color: "pink", delay: 0.11 });
      tone(c, d, { freq: 140, dur: 0.09, type: "sine", gain: 0.16, delay: 0.11, cutoff: 900 });
      return;
    case "promotion":
    case "puzzleSuccess":
    case "win":
      tone(c, d, { freq: 392, dur: 0.18, type: "triangle", gain: 0.2, cutoff: 3000 });
      tone(c, d, { freq: 494, dur: 0.18, type: "triangle", gain: 0.2, delay: 0.14, cutoff: 3000 });
      tone(c, d, { freq: 587, dur: 0.28, type: "triangle", gain: 0.22, delay: 0.28, cutoff: 3000 });
      return;
    case "checkmate":
    case "loss":
    case "puzzleFail":
      noise(c, d, { dur: 0.18, gain: 0.22, freq: 500, color: "pink" });
      tone(c, d, { freq: 220, dur: 0.55, type: "sine", gain: 0.24, glideTo: 90, cutoff: 900 });
      return;
    case "click":
      noise(c, d, { dur: 0.04, gain: 0.08, freq: 1200, color: "pink" });
      return;
  }
};

/** Digital — crisp square/blip tones, no noise. */
const digitalPack: Designer = (c, d, kind) => {
  switch (kind) {
    case "move":
      tone(c, d, { freq: 900, dur: 0.05, type: "square", gain: 0.12, cutoff: 5000 });
      tone(c, d, { freq: 1400, dur: 0.04, type: "square", gain: 0.08, delay: 0.04, cutoff: 6000 });
      return;
    case "capture":
      tone(c, d, { freq: 700, dur: 0.06, type: "square", gain: 0.16, cutoff: 5000 });
      tone(c, d, { freq: 260, dur: 0.14, type: "sawtooth", gain: 0.18, glideTo: 120, cutoff: 3000 });
      return;
    case "check":
      tone(c, d, { freq: 1200, dur: 0.06, type: "square", gain: 0.16 });
      tone(c, d, { freq: 1600, dur: 0.06, type: "square", gain: 0.14, delay: 0.07 });
      tone(c, d, { freq: 2000, dur: 0.08, type: "square", gain: 0.12, delay: 0.14 });
      return;
    case "castle":
      tone(c, d, { freq: 600, dur: 0.05, type: "square", gain: 0.14 });
      tone(c, d, { freq: 900, dur: 0.05, type: "square", gain: 0.14, delay: 0.07 });
      return;
    case "promotion":
    case "puzzleSuccess":
    case "win":
      tone(c, d, { freq: 800, dur: 0.08, type: "square", gain: 0.18 });
      tone(c, d, { freq: 1200, dur: 0.08, type: "square", gain: 0.18, delay: 0.08 });
      tone(c, d, { freq: 1600, dur: 0.12, type: "square", gain: 0.2, delay: 0.16 });
      return;
    case "checkmate":
    case "loss":
    case "puzzleFail":
      tone(c, d, { freq: 400, dur: 0.1, type: "sawtooth", gain: 0.18, glideTo: 180 });
      tone(c, d, { freq: 260, dur: 0.18, type: "sawtooth", gain: 0.2, delay: 0.1, glideTo: 100 });
      return;
    case "click":
      tone(c, d, { freq: 2200, dur: 0.03, type: "square", gain: 0.08 });
      return;
  }
};

/** Precision — deep, restrained mechanical: filtered noise + sub sine. */
const precisionPack: Designer = (c, d, kind) => {
  switch (kind) {
    case "move":
      noise(c, d, { dur: 0.03, gain: 0.06, freq: 3800, q: 2, color: "white" });
      tone(c, d, { freq: 90, dur: 0.14, type: "sine", gain: 0.24, glideTo: 60, cutoff: 700 });
      return;
    case "capture":
      noise(c, d, { dur: 0.05, gain: 0.14, freq: 2400, q: 1.5, color: "white" });
      tone(c, d, { freq: 70, dur: 0.28, type: "sine", gain: 0.3, glideTo: 45, cutoff: 500 });
      tone(c, d, { freq: 180, dur: 0.05, type: "triangle", gain: 0.08, delay: 0.02, cutoff: 1400 });
      return;
    case "check":
      tone(c, d, { freq: 520, dur: 0.35, type: "sine", gain: 0.18, cutoff: 4000 });
      tone(c, d, { freq: 780, dur: 0.4, type: "sine", gain: 0.14, delay: 0.08, cutoff: 4000 });
      return;
    case "castle":
      noise(c, d, { dur: 0.04, gain: 0.08, freq: 3000, q: 2 });
      tone(c, d, { freq: 80, dur: 0.12, type: "sine", gain: 0.2, cutoff: 700 });
      noise(c, d, { dur: 0.04, gain: 0.08, freq: 3000, q: 2, delay: 0.14 });
      tone(c, d, { freq: 80, dur: 0.12, type: "sine", gain: 0.2, delay: 0.14, cutoff: 700 });
      return;
    case "promotion":
    case "puzzleSuccess":
    case "win":
      tone(c, d, { freq: 261, dur: 0.28, type: "sine", gain: 0.2, cutoff: 4000 });
      tone(c, d, { freq: 329, dur: 0.32, type: "sine", gain: 0.2, delay: 0.16, cutoff: 4000 });
      tone(c, d, { freq: 392, dur: 0.42, type: "sine", gain: 0.22, delay: 0.34, cutoff: 4000 });
      return;
    case "checkmate":
    case "loss":
    case "puzzleFail":
      noise(c, d, { dur: 0.35, gain: 0.16, freq: 400, q: 0.8 });
      tone(c, d, { freq: 130, dur: 0.7, type: "sine", gain: 0.28, glideTo: 55, cutoff: 500 });
      return;
    case "click":
      tone(c, d, { freq: 60, dur: 0.05, type: "sine", gain: 0.12, cutoff: 500 });
      return;
  }
};

const PACKS: Record<SoundPackId, Designer> = {
  default: defaultPack,
  "classic-tournament": tournamentPack,
  "modern-digital": digitalPack,
  "premium-luxury": precisionPack,
};

export function playSfx(kind: SfxKind, packOverride?: SoundPackId) {
  const prefs = getPreferences();
  if (!prefs.soundEnabled) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  // Debounce rapid-fire clicks only; game events must never be dropped.
  if (kind === "click" && now - lastPlayedAt < 0.02) return;
  lastPlayedAt = now;
  const pack = PACKS[packOverride ?? prefs.soundPack] ?? defaultPack;
  try {
    pack(c, masterGain, kind);
  } catch {
    /* noop */
  }
}

/** Helper that picks the right sound from a chess.js move object. */
export function playMoveSfx(move: { san: string; captured?: string; flags?: string }) {
  const san = move.san ?? "";
  if (san.includes("#")) return playSfx("checkmate");
  if (san === "O-O" || san === "O-O-O") return playSfx("castle");
  if (san.includes("=")) return playSfx("promotion");
  if (san.includes("+")) return playSfx("check");
  if (move.captured || san.includes("x")) return playSfx("capture");
  return playSfx("move");
}
