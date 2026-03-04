import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const defaultConfig = {
  ui: {
    port: 1969,
  },
  osc: {
    port: 9001,
    host: '127.0.0.1',
    autoFreePorts: true,
  },
  bhaptics: {
    appId: '',
    apiKey: '',
    remote: '127.0.0.1:15881',
  },
  intensity: {
    impactThreshold: 0.5,
    velocityMin: 0.3,
    velocityMax: 2.0,
    durationMin: 0.1,
    durationMax: 2.0,
    longContactMs: 2000,
    emaAlpha: 0.3,
    cooldownMs: 50,
    minIntensity: 0.0,
    maxIntensity: 2.0,
  },
  contactParams: {
    value: 'ContactChest',
    speed: 'ContactSpeed',
    zone: 'ContactZone',
    acceptAll: false,
    excludeFaceTracking: true,
    contactTimeoutMs: 250,
    extra: [],
    ignore: [],
  },
  haptic: {
    eventKey: 'customTouch',
    useDotMode: true,
    vestMotorCount: 16,
    motorClusterSize: 1,
  },
};

function loadConfig() {
  const configPath = join(__dirname, '..', 'config.json');
  if (existsSync(configPath)) {
    try {
      const loaded = JSON.parse(readFileSync(configPath, 'utf-8'));
      delete loaded._comment;
      return deepMerge(JSON.parse(JSON.stringify(defaultConfig)), loaded);
    } catch (e) {
      console.warn('Failed to load config.json, using defaults:', e.message);
    }
  }
  return { ...JSON.parse(JSON.stringify(defaultConfig)) };
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

export const config = loadConfig();
