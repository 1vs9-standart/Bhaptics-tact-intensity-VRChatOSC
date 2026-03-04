/**
 * Face tracking / expression params — не касания.
 */
export function isFaceTrackingParam(name) {
  if (!name || typeof name !== 'string') return false;
  const n = name.toLowerCase();
  if (n.startsWith('ft/') || n.startsWith('ft\\')) return true;
  if (/^touch\/ear/i.test(n)) return true;
  return /eyesquint|cheeksquint|eyeopen|eyewide|brow|viseme|jaw|gaze|mouth|lip/i.test(n);
}

/**
 * State Analyzer — хранит состояние контакта, вычисляет скорость и длительность
 */
export function createStateAnalyzer(contactParams) {
  const state = {
    values: {},
    lastUpdate: 0,
    contactStart: 0,
    contactActive: false,
    velocity: 0,
    peakVelocity: 0,
    maxValue: 0,
  };

  const paramValue = contactParams?.value ?? 'ContactChest';
  const paramSpeed = contactParams?.speed ?? 'ContactSpeed';
  const extraParams = contactParams?.extra ?? [];
  const acceptAll = contactParams?.acceptAll ?? false;
  const excludeFaceTracking = contactParams?.excludeFaceTracking !== false;
  const contactTimeoutMs = contactParams?.contactTimeoutMs ?? 250;

  const contactParamNames = new Set([paramValue, paramSpeed, ...extraParams].filter(Boolean));

  function isContactParam(name) {
    if (isFaceTrackingParam(name)) return false;
    if (contactParamNames.has(name)) return true;
    return (
      /contact/i.test(name) ||
      /vest/i.test(name) ||
      /proximity/i.test(name) ||
      /touch/i.test(name) ||
      /haptic/i.test(name) ||
      /chest/i.test(name)
    );
  }

  function clearStaleContact(now) {
    if (!state.contactActive || !state.lastUpdate) return;
    if (now - state.lastUpdate <= contactTimeoutMs) return;
    for (const k of Object.keys(state.values)) {
      if (isContactParam(k)) state.values[k] = 0;
    }
    state.maxValue = 0;
    state.contactActive = false;
    state.peakVelocity = 0;
  }

  function update(msg) {
    const { paramName, value, timestamp } = msg;
    const dt = state.lastUpdate ? (timestamp - state.lastUpdate) / 1000 : 0.02;

    clearStaleContact(timestamp);

    if (excludeFaceTracking && isFaceTrackingParam(paramName)) return getSnapshot();

    const isRelevant = acceptAll || isContactParam(paramName);

    if (!isRelevant) return getSnapshot();

    const prevMax = state.maxValue;
    state.values[paramName] = value;
    state.lastUpdate = timestamp;
    state.maxValue = Math.max(0, ...Object.values(state.values));
    state.velocity = dt > 0 ? Math.abs(state.maxValue - prevMax) / dt : 0;

    if (state.maxValue > 0.01) {
      if (!state.contactActive) {
        state.contactStart = timestamp;
        state.contactActive = true;
      }
      state.peakVelocity = Math.max(state.peakVelocity, state.velocity);
    } else {
      state.contactActive = false;
      state.peakVelocity = 0;
    }

    return getSnapshot();
  }

  function getSnapshot() {
    const now = state.lastUpdate;
    const duration = state.contactActive ? (now - state.contactStart) / 1000 : 0;
    const eventType = state.velocity > 0.5 ? 'impact' : state.contactActive ? 'smooth' : 'idle';
    const active = Object.entries(state.values).filter(([, v]) => v > 0.01);
    const lastParam = active.length ? active.reduce((a, b) => (a[1] >= b[1] ? a : b))[0] : '';
    const activeParams = active.map(([param, value]) => ({ param, value })).sort((a, b) => b.value - a.value);

    return {
      value: state.maxValue,
      velocity: state.velocity,
      peakVelocity: state.peakVelocity,
      speed: state.values[paramSpeed] ?? 0,
      duration,
      contactActive: state.contactActive,
      eventType,
      timestamp: state.lastUpdate,
      lastParam,
      activeParams,
    };
  }

  return { update, getSnapshot };
}
