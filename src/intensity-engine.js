/**
 * Intensity Engine — вычисляет динамическую интенсивность по velocity и duration
 */
export function createIntensityEngine(config) {
  const cfg = config.intensity ?? {};
  const impactThreshold = cfg.impactThreshold ?? 0.5;
  const velocityMin = cfg.velocityMin ?? 0.3;
  const velocityMax = cfg.velocityMax ?? 2.0;
  const durationMin = cfg.durationMin ?? 0.1;
  const durationMax = cfg.durationMax ?? 1.0;
  const longContactMs = cfg.longContactMs ?? 2000;
  const emaAlpha = cfg.emaAlpha ?? 0.3;
  const cooldownMs = cfg.cooldownMs ?? 50;
  const sustainCooldownMs = cfg.sustainCooldownMs ?? 200;
  const minIntensity = cfg.minIntensity ?? 0.0;
  const maxIntensity = cfg.maxIntensity ?? 2.0;

  let lastEmit = 0;
  let ema = 0;

  function process(snapshot) {
    const { velocity, duration, contactActive } = snapshot;
    const now = Date.now();

    let intensity = 0;
    const isImpact = velocity > impactThreshold;

    if (isImpact) {
      intensity = minIntensity + (maxIntensity - minIntensity) *
        Math.min(1, (velocity - velocityMin) / (velocityMax - velocityMin));
    } else if (contactActive && duration > 0) {
      const t = Math.min(1, (duration * 1000) / longContactMs);
      intensity = durationMin + (durationMax - durationMin) * t;
    }

    intensity = Math.max(minIntensity, Math.min(maxIntensity, intensity));

    if (intensity > 0) {
      ema = emaAlpha * intensity + (1 - emaAlpha) * ema;
      intensity = ema;
    }

    const sinceLast = now - lastEmit;
    const cooldown = isImpact ? cooldownMs : sustainCooldownMs;
    const emit = intensity > (minIntensity || 0.01) && sinceLast >= cooldown;

    if (emit) lastEmit = now;

    return { intensity, emit };
  }

  return { process };
}
