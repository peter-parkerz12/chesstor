// Lightweight Web Audio synthesizer for premium, subtle chess sounds.
// Zero assets. Uses oscillators + short envelopes.

import { getPreferences } from "@/lib/settings/preferences";

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

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = getPreferences().soundVolume;
    masterGain.connect(ctx.destination);
  }
  // Resume if user-gesture suspended it.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => null);
  }
  if (masterGain) masterGain.gain.value = getPreferences().soundVolume;
  return ctx;
}

type Tone = {
  freq: number;
  /** Seconds. */
  duration: number;
  type?: OscillatorType;
  /** 0..1 peak gain before master. */
  gain?: number;
  /** Delay in seconds before this tone starts. */
  delay?: number;
  /** Optional pitch slide end frequency. */
  glideTo?: number;
  /** Filter cutoff Hz (lowpass). Default 6000. */
  cutoff?: number;
};

type SoundPackConfig = {
  toneType: OscillatorType;
  gainScale: number;
  durationScale: number;
  cutoffScale: number;
  noiseGainScale: number;
  noiseFilter?: number;
};

const SOUND_PACK_CONFIG: Record<
  import("@/lib/settings/preferences").SoundPackId,
  SoundPackConfig
> = {
  default: {
    toneType: "triangle",
    gainScale: 1,
    durationScale: 1,
    cutoffScale: 1,
    noiseGainScale: 1,
    noiseFilter: 2200,
  },
  "classic-tournament": {
    toneType: "triangle",
    gainScale: 1.1,
    durationScale: 1.15,
    cutoffScale: 0.85,
    noiseGainScale: 1.2,
    noiseFilter: 1800,
  },
  "modern-digital": {
    toneType: "square",
    gainScale: 1.05,
    durationScale: 0.88,
    cutoffScale: 1.2,
    noiseGainScale: 0.65,
    noiseFilter: 2600,
  },
  "premium-luxury": {
    toneType: "sine",
    gainScale: 1.2,
    durationScale: 1.25,
    cutoffScale: 1.1,
    noiseGainScale: 0.5,
    noiseFilter: 2000,
  },
};

function playTone(c: AudioContext, dest: AudioNode, t: Tone) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = t.cutoff ?? 6000;

  osc.type = t.type ?? "triangle";
  osc.frequency.value = t.freq;

  const start = c.currentTime + (t.delay ?? 0);
  const peak = t.gain ?? 0.18;
  const dur = t.duration;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  if (t.glideTo) {
    osc.frequency.setValueAtTime(t.freq, start);
    osc.frequency.exponentialRampToValueAtTime(t.glideTo, start + dur * 0.9);
  }

  osc.connect(filter).connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function playNoiseBurst(c: AudioContext, dest: AudioNode, durationSec = 0.07, gain = 0.08, filterHz = 2200) {
  const bufferSize = Math.floor(c.sampleRate * durationSec);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const env = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  g.gain.value = gain;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterHz;
  filter.Q.value = 0.7;
  src.connect(filter).connect(g).connect(dest);
  src.start(c.currentTime);
}

function applyPackToTone(t: Tone, pack: SoundPackConfig): Tone {
  return {
    ...t,
    type: t.type ?? pack.toneType,
    gain: (t.gain ?? 0.18) * pack.gainScale,
    duration: t.duration * pack.durationScale,
    cutoff: t.cutoff ? t.cutoff * pack.cutoffScale : undefined,
  };
}

export function playSfx(kind: SfxKind) {
  const prefs = getPreferences();
  if (!prefs.soundEnabled) return;
  const c = ensureCtx();
  if (!c || !masterGain) return;
  const dest = masterGain;
  const packConfig = SOUND_PACK_CONFIG[prefs.soundPack] ?? SOUND_PACK_CONFIG.default;

  switch (kind) {
    case "move":
      // Subtle wooden click — short noise burst + dull tone.
      playNoiseBurst(c, dest, 0.05, 0.05 * packConfig.noiseGainScale, packConfig.noiseFilter);
      playTone(c, dest, applyPackToTone({ freq: 260, duration: 0.08, gain: 0.12, cutoff: 1800 }, packConfig));
      break;
    case "capture":
      // Heavier thud + brief noise.
      playNoiseBurst(c, dest, 0.09, 0.1 * packConfig.noiseGainScale, packConfig.noiseFilter);
      playTone(c, dest, applyPackToTone({ freq: 180, duration: 0.14, type: "sine", gain: 0.22, glideTo: 110, cutoff: 1400 }, packConfig));
      break;
    case "check":
      playTone(c, dest, applyPackToTone({ freq: 880, duration: 0.16, type: "sine", gain: 0.16, cutoff: 5000 }, packConfig));
      playTone(c, dest, applyPackToTone({ freq: 1320, duration: 0.18, type: "sine", gain: 0.12, delay: 0.06, cutoff: 5000 }, packConfig));
      break;
    case "checkmate":
    case "loss":
      playTone(c, dest, applyPackToTone({ freq: 440, duration: 0.22, type: "triangle", gain: 0.2, glideTo: 220, cutoff: 2500 }, packConfig));
      playTone(c, dest, applyPackToTone({ freq: 330, duration: 0.32, type: "sine", gain: 0.18, delay: 0.18, glideTo: 165, cutoff: 2000 }, packConfig));
      break;
    case "castle":
      playNoiseBurst(c, dest, 0.05, 0.05 * packConfig.noiseGainScale, packConfig.noiseFilter);
      playTone(c, dest, applyPackToTone({ freq: 220, duration: 0.07, type: "triangle", gain: 0.12 }, packConfig));
      playTone(c, dest, applyPackToTone({ freq: 260, duration: 0.08, type: "triangle", gain: 0.12, delay: 0.08 }, packConfig));
      break;
    case "promotion":
    case "puzzleSuccess":
    case "win":
      playTone(c, dest, applyPackToTone({ freq: 523, duration: 0.12, type: "sine", gain: 0.16, cutoff: 6000 }, packConfig));
      playTone(c, dest, applyPackToTone({ freq: 659, duration: 0.12, type: "sine", gain: 0.16, delay: 0.1, cutoff: 6000 }, packConfig));
      playTone(c, dest, applyPackToTone({ freq: 784, duration: 0.18, type: "sine", gain: 0.18, delay: 0.2, cutoff: 6000 }, packConfig));
      break;
    case "puzzleFail":
      playTone(c, dest, applyPackToTone({ freq: 220, duration: 0.16, type: "sawtooth", gain: 0.12, glideTo: 110, cutoff: 1500 }, packConfig));
      break;
    case "click":
      playNoiseBurst(c, dest, 0.025, 0.04 * packConfig.noiseGainScale, packConfig.noiseFilter);
      playTone(c, dest, applyPackToTone({ freq: 1800, duration: 0.04, type: "sine", gain: 0.05, cutoff: 8000 }, packConfig));
      break;
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
