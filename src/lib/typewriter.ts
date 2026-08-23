export const TYPEWRITER_SPEED_KEY = "visionfleet-typewriter-speed";

export type TypewriterSpeed = "instant" | "slow" | "normal" | "fast";

export const TYPEWRITER_PRESETS: Record<Exclude<TypewriterSpeed, "instant">, { charsPerTick: number; intervalMs: number }> = {
  slow: { charsPerTick: 1, intervalMs: 35 },
  normal: { charsPerTick: 2, intervalMs: 18 },
  fast: { charsPerTick: 5, intervalMs: 12 },
};

export const getStoredTypewriterSpeed = (): TypewriterSpeed => {
  const stored = localStorage.getItem(TYPEWRITER_SPEED_KEY) as TypewriterSpeed | null;
  if (stored === "instant" || stored === "slow" || stored === "normal" || stored === "fast") {
    return stored;
  }
  return "normal";
};

// Returns the reveal-rate config for the currently stored preference, or
// null if the user has it set to "instant" (i.e. no buffering at all).
export const getActiveTypewriterConfig = () => {
  const speed = getStoredTypewriterSpeed();
  return speed === "instant" ? null : TYPEWRITER_PRESETS[speed];
};
