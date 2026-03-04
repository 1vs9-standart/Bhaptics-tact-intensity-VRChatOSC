import http from 'http';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketServer } from 'ws';
import { dashboardState } from './dashboard-state.js';
import { config } from './config.js';
import { getMotorIndices } from './motor-utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getHapticConfig() {
  const base = config.haptic ?? {};
  const di = dashboardState.deviceInfo || {};
  const vestMotorCount = di.vestMotorCount ?? base.vestMotorCount ?? 16;
  return { ...base, vestMotorCount, deviceName: di.deviceName };
}

export function startDashboard(port = 1969) {
  const app = express();

  app.get('/api/state', (req, res) => {
    const state = { ...dashboardState };
    state.haptic = getHapticConfig();
    res.json(state);
  });

  app.get('/api/bhaptics-config', (req, res) => {
    const { appId, apiKey, remote } = config.bhaptics;
    res.json({ appId: appId || '', apiKey: apiKey || '', remote: remote || '' });
  });

  const ALLOW_ZONE_KEYS = new Set(['chest', 'stomach', 'upperBack', 'lowerBack']);
  const ALLOW_WHILE_KEYS = new Set(['grounded', 'seated', 'inStation', 'afk']);

  app.use(express.json({ limit: '50kb' }));
  app.get('/api/settings', (req, res) => {
    res.json({
      allowZones: dashboardState.allowZones,
      allowWhile: dashboardState.allowWhile,
    });
  });
  app.post('/api/settings', (req, res) => {
    const { allowZones, allowWhile } = req.body || {};
    if (allowZones && typeof allowZones === 'object' && !Array.isArray(allowZones)) {
      for (const k of Object.keys(allowZones)) {
        if (ALLOW_ZONE_KEYS.has(k) && typeof allowZones[k] === 'boolean') {
          dashboardState.allowZones[k] = allowZones[k];
        }
      }
    }
    if (allowWhile && typeof allowWhile === 'object' && !Array.isArray(allowWhile)) {
      for (const k of Object.keys(allowWhile)) {
        if (ALLOW_WHILE_KEYS.has(k) && typeof allowWhile[k] === 'boolean') {
          dashboardState.allowWhile[k] = allowWhile[k];
        }
      }
    }
    res.json({ ok: true, allowZones: dashboardState.allowZones, allowWhile: dashboardState.allowWhile });
  });

  let hapticsBridgeRef = null;
  app.post('/api/test-haptic', (req, res) => {
    const bridge = hapticsBridgeRef;
    if (!bridge?.hasClients?.()) {
      return res.status(400).json({ ok: false, error: 'No haptics client connected. Open this page in browser.' });
    }
    bridge.sendHaptic(0.5, config, 'Chest');
    res.json({ ok: true });
  });

  app.use('/tact', express.static(join(__dirname, '..', 'node_modules', 'tact-js', 'dist')));

  app.use(express.static(join(__dirname, '..', 'public')));

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/haptics' });
  const hapticsClients = new Set();

  wss.on('connection', (ws) => {
    hapticsClients.add(ws);
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ready') dashboardState.bhaptics.connected = true;
        if (msg.type === 'deviceInfo') dashboardState.deviceInfo = msg.data || {};
      } catch (_) {}
    });
    ws.on('close', () => {
      hapticsClients.delete(ws);
      if (hapticsClients.size === 0) dashboardState.bhaptics.connected = false;
    });
  });

  server.listen(port, () => {
    console.log(`[Dashboard] http://localhost:${port}`);
  });

  const hapticsBridge = {
    sendHaptic(intensity, cfg, zone, motorIndex = null, motorValues = null) {
      if (hapticsClients.size === 0) return;
      const haptic = getHapticConfig();
      const { useDotMode, vestMotorCount, eventKey, motorClusterSize } = haptic;
      const clusterSize = motorClusterSize ?? 1;
      let indices = [];
      if (Array.isArray(motorValues) && motorValues.length >= 32) {
        indices = motorValues.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
      } else {
        indices = getMotorIndices(zone, motorIndex, clusterSize);
      }
      dashboardState.lastMotorActivations = { indices, motorValues, timestamp: Date.now() };
      const ratio = Math.max(0, Math.min(2.0, intensity));
      const msg = JSON.stringify({
        type: 'play',
        intensity: ratio,
        zone: zone || 'Chest',
        motorIndex,
        motorIndices: indices,
        motorValues,
        useDotMode: useDotMode ?? true,
        vestMotorCount: vestMotorCount ?? 16,
        eventKey: eventKey ?? 'customTouch',
      });
      hapticsClients.forEach((c) => {
        if (c.readyState === 1) c.send(msg);
      });
    },
    hasClients: () => hapticsClients.size > 0,
  };
  hapticsBridgeRef = hapticsBridge;

  return {
    stop: (cb) => {
      wss.clients.forEach((ws) => {
        try { ws.terminate(); } catch (_) {}
      });
      wss.close();
      server.close(cb || (() => {}));
    },
    hapticsBridge,
  };
}
