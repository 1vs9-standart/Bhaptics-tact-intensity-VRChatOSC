/**
 * Shared state for dashboard — обновляется из main loop
 */
export const dashboardState = {
  osc: { listening: false, port: 9001 },
  bhaptics: { connected: false },
  vrchat: { connected: false },
  avatar: { id: '', oscType: '' },
  lastUpdate: 0,
  contact: { value: 0, velocity: 0, duration: 0, eventType: 'idle', lastParam: '' },
  intensity: 0,
  lastHaptic: 0,
  stats: { messagesReceived: 0, hapticsSent: 0 },
  lastOscParams: {},
  allowZones: { chest: true, stomach: true, upperBack: true, lowerBack: true },
  allowWhile: { grounded: true, seated: true, inStation: true, afk: false },
  deviceInfo: { battery: null, devices: [] },
  touchLog: [],
  lastMotorActivations: { indices: [], timestamp: 0 },
};
