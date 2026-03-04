/**
 * tact-js работает только в браузере.
 * Подключается к bHaptics Player, слушает WebSocket, выполняет haptic-команды.
 * Автоопределение устройства и количества моторов.
 */
(async () => {
  const wsUrl = `ws://${location.host}/haptics`;
  const ws = new WebSocket(wsUrl);

  let Tact = null;
  let PositionType = null;
  let detectedMotorCount = 16;

  function inferVestMotorCount(dev) {
    if (!dev || typeof dev !== 'object') return 16;
    const name = String(dev.name || dev.deviceName || dev.DeviceName || dev.Device || dev.type || '').toLowerCase();
    const pos = dev.position ?? dev.Position;
    if (pos && typeof pos === 'object' && Array.isArray(pos.motors)) return pos.motors.length;
    if (/pro|x40|32/.test(name)) return 32;
    if (/x40/.test(name)) return 40;
    if (/air|x16|16/.test(name)) return 16;
    return 16;
  }

  try {
    const mod = await import('/tact/bundle.js');
    Tact = mod.default;
    PositionType = mod.PositionType;

    const cfgRes = await fetch('/api/bhaptics-config');
    const cfg = await cfgRes.json();
    if (cfg.appId && cfg.apiKey) {
      const initParams = { appId: cfg.appId, apiKey: cfg.apiKey };
      if (cfg.remote) initParams.remote = cfg.remote;
      await Tact.init(initParams);
      console.log('[Haptics] Connected to bHaptics Player');
      ws.send(JSON.stringify({ type: 'ready' }));

      const pollDeviceInfo = async () => {
        if (!Tact) return;
        try {
          const devices = await Tact.getConnectedDevices();
          const arr = Array.isArray(devices) ? devices : [];
          const dev = arr.find((d) => /vest|tactsuit|tact suit/i.test(String(d.name || d.deviceName || d.type || d.position || ''))) || arr[0] || {};
          const findVal = (obj, ...keys) => {
            for (const k of keys) {
              const v = obj?.[k];
              if (v != null) return v;
            }
            return null;
          };
          detectedMotorCount = inferVestMotorCount(dev);
          const data = {
            devices: arr,
            battery: findVal(dev, 'battery', 'batteryLevel', 'Battery', 'battery_percent', 'BatteryLevel'),
            deviceName: findVal(dev, 'name', 'deviceName', 'DeviceName', 'Device') || (arr.length ? 'TactSuit' : null),
            vestMotorCount: detectedMotorCount,
          };
          ws.send(JSON.stringify({ type: 'deviceInfo', data }));
        } catch (_) {}
      };
      pollDeviceInfo();
      setInterval(pollDeviceInfo, 5000);
    }
  } catch (e) {
    console.warn('[Haptics] Init failed:', e.message);
  }

  ws.onmessage = async (ev) => {
    if (!Tact) return;
    try {
      const { type, intensity, zone, motorIndex, motorIndices, motorValues: rawMotorValues, useDotMode, vestMotorCount, eventKey } = JSON.parse(ev.data);
      if (type !== 'play' || intensity < 0.01) return;
      const ratio = Math.max(0, Math.min(2.0, intensity));
      const motorCount = detectedMotorCount || vestMotorCount || 16;

      if (useDotMode) {
        const VEST_MOTORS = 32;
        let motorValues = Array(VEST_MOTORS).fill(0);
        if (Array.isArray(rawMotorValues) && rawMotorValues.length >= VEST_MOTORS) {
          motorValues = rawMotorValues.slice(0, VEST_MOTORS).map((v) => Math.round(Math.min(100, Math.max(0, v))));
        } else {
          let indices = [];
          if (Array.isArray(motorIndices) && motorIndices.length > 0) {
            indices = motorIndices.filter((i) => i >= 0 && i < VEST_MOTORS);
          } else {
            const z = (zone || '').toLowerCase();
            const isBack = /back|vest_back/i.test(z);
            const isFront = /chest|front|stomach|belly|vest_front/i.test(z);
          if (typeof motorIndex === 'number' && motorIndex >= 0 && motorIndex <= 19) {
            const m = Math.min(15, motorIndex);
            indices = [isBack ? m + 16 : m];
            } else if (isBack) {
              indices = [...Array(16).keys()].map((i) => i + 16);
            } else if (isFront) {
              indices = [...Array(16).keys()];
            } else return;
          }
          const val = Math.round(Math.min(100, 100 * ratio));
          for (const i of indices) {
            if (i >= 0 && i < VEST_MOTORS) motorValues[i] = val;
          }
        }
        await Tact.playDot({ position: PositionType.Vest, motorValues, duration: 150 });
      } else {
        await Tact.play({ eventKey: eventKey || 'customTouch', intensityRatio: ratio, durationRatio: 1 });
      }
    } catch (e) {
      console.warn('[Haptics] play error:', e.message);
    }
  };
})();
