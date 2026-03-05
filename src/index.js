/**
 * VRChatOSC-bhaptics-js — VRChat OSC → bHaptics middleware
 */
import { config } from './config.js';
import { checkPort, freePorts } from './port-check.js';
import { createOSCListener } from './osc-listener.js';
import { createStateAnalyzer, isFaceTrackingParam } from './state-analyzer.js';
import { createIntensityEngine } from './intensity-engine.js';
import { dashboardState } from './dashboard-state.js';
import { startDashboard } from './dashboard.js';
import { combineMotorValues } from './motor-utils.js';

async function main() {
  console.log('[VRChatOSC-bhaptics-js] Запуск...');

  const oscPort = config.osc.port;
  const uiPort = config.ui?.port ?? 1969;

  if (config.osc?.autoFreePorts !== false) {
    freePorts([oscPort, uiPort]);
    await new Promise((r) => setTimeout(r, 500));
  }

  const [port9000, port9001, portUi] = await Promise.all([
    checkPort(9000),
    checkPort(oscPort),
    checkPort(uiPort),
  ]);

  if (!port9001.free) {
    console.error(`[VRChatOSC-bhaptics-js] Порт 9001 (OSC) занят`);
    process.exit(1);
  }
  if (!portUi.free) {
    console.error(`[VRChatOSC-bhaptics-js] Порт ${uiPort} (Dashboard) занят`);
    process.exit(1);
  }

  if (!port9000.free) {
    console.log('[VRChatOSC-bhaptics-js] VRChat подключён (порт 9000 занят)');
  }
  console.log(`[VRChatOSC-bhaptics-js] OSC :9001 | Dashboard :${uiPort}`);

  const stateAnalyzer = createStateAnalyzer(config.contactParams);
  const intensityEngine = createIntensityEngine(config);


  const vestFrontMax = 19;
  const vestBackMax = 19;
  const clusterSize = config.haptic?.motorClusterSize ?? 1;
  let lastLogSummary = '';
  let lastLogTime = 0;

  function parseZoneAndMotor(lastParam) {
    const p = (lastParam || '').toLowerCase();
    const backMatch = p.match(/vest_back[_-]?(\d+)|back[_-]?(\d+)/i);
    const frontMatch = p.match(/vest_front[_-]?(\d+)|vestfront[_-]?(\d+)/i);
    if (backMatch) {
      const raw = parseInt(backMatch[1] || backMatch[2] || '0', 10);
      return { zone: 'Back', motorIndex: Math.min(vestBackMax, Math.max(0, raw)), rawMotorIndex: raw };
    }
    if (frontMatch) {
      const raw = parseInt(frontMatch[1] || frontMatch[2] || '0', 10);
      return { zone: 'Front', motorIndex: Math.min(vestFrontMax, Math.max(0, raw)), rawMotorIndex: raw };
    }
    if (/chest|front|vest_front/.test(p)) return { zone: 'Chest', motorIndex: null, rawMotorIndex: null };
    if (/stomach|belly/.test(p)) return { zone: 'Stomach', motorIndex: null, rawMotorIndex: null };
    if (/back|upperback|upper|lowerback|lower|vest_back/.test(p)) return { zone: 'Back', motorIndex: null, rawMotorIndex: null };
    return { zone: 'Chest', motorIndex: null, rawMotorIndex: null };
  }

  function zoneFromParam(p) {
    const lp = (p || '').toLowerCase();
    const frontMatch = lp.match(/vest_front[_-]?(\d+)|vestfront[_-]?(\d+)/i);
    const backMatch = lp.match(/vest_back[_-]?(\d+)|back[_-]?(\d+)/i);
    if (frontMatch) {
      const raw = parseInt(frontMatch[1] || frontMatch[2] || '0', 10);
      const idx0 = Math.max(0, raw - 1); // 1-20 -> 0-19
      const row = Math.floor(Math.min(15, idx0) / 4); // 4x4 сетка
      return row <= 1 ? 'chest' : 'stomach';
    }
    if (backMatch) {
      const raw = parseInt(backMatch[1] || backMatch[2] || '0', 10);
      const idx0 = Math.max(0, raw - 1);
      const row = Math.floor(Math.min(15, idx0) / 4);
      return row <= 1 ? 'upperBack' : 'lowerBack';
    }
    if (/stomach|belly/.test(lp)) return 'stomach';
    if (/upperback/.test(lp)) return 'upperBack';
    if (/lowerback/.test(lp)) return 'lowerBack';
    if (/back|vest_back/.test(lp)) return 'upperBack';
    if (/chest|front|vest_front/.test(lp)) return 'chest';
    return 'chest';
  }

  function canSendHaptic(activeParams) {
    const { allowZones, allowWhile, lastOscParams, stats } = dashboardState;
    const params = lastOscParams || {};

    // 1) Ограничения по состоянию (Grounded / Seated / InStation / AFK)
    const hasStateParams =
      'IsGrounded' in params || 'InStation' in params || 'AFK' in params || 'Seated' in params;
    if (hasStateParams && stats.messagesReceived >= 5) {
      const isGrounded = !!params.IsGrounded;
      const inStation = !!params.InStation;
      const afk = !!params.AFK;
      const seated = !!params.Seated;
      const stateOk =
        (allowWhile.grounded && isGrounded) ||
        (allowWhile.seated && seated) ||
        (allowWhile.inStation && inStation) ||
        (allowWhile.afk && afk);
      if (!stateOk) return false;
    }

    // 2) Ограничения по зонам (Chest / Stomach / UpperBack / LowerBack)
    const toCheck = activeParams?.length
      ? activeParams.map((a) => a.param)
      : [dashboardState.contact?.lastParam].filter(Boolean);
    if (toCheck.length === 0) return false;

    // Если зона явно выключена (false) — блочим, иначе считаем включённой по умолчанию.
    return toCheck.some((param) => {
      const zoneKey = zoneFromParam(param);
      const v = allowZones[zoneKey];
      return v !== false;
    });
  }

  const { stop, hapticsBridge } = startDashboard(config.ui?.port ?? 1969);

  const oscListener = createOSCListener(
    config,
    (msg) => {
      dashboardState.vrchat.connected = true;
      const v = dashboardState.avatar.oscType;
      if (!v || /^avtr_/i.test(v)) dashboardState.avatar.oscType = 'Avatar Parameters';
      dashboardState.stats.messagesReceived++;
      dashboardState.lastUpdate = Date.now();
      const p = dashboardState.lastOscParams;
      if (!isFaceTrackingParam(msg.paramName)) {
        p[msg.paramName] = msg.value;
      }
      const pKeys = Object.keys(p);
      if (pKeys.length > 50) {
        for (let i = 0; i < pKeys.length - 30; i++) delete p[pKeys[i]];
      }

      const snapshot = stateAnalyzer.update(msg);
      const { intensity, emit, touchType } = intensityEngine.process(snapshot);

      dashboardState.contact = { ...snapshot };
      dashboardState.intensity = intensity;

      const activeParams = snapshot.activeParams || [];
      const hasTouch = snapshot.lastParam || activeParams.length > 0;
      if (emit && intensity > 0.01 && hasTouch && canSendHaptic(activeParams)) {
        const now = Date.now();
        const vel = Math.max(snapshot.velocity ?? 0, snapshot.peakVelocity ?? 0);

        if (activeParams.length > 0) {
          const motorValues = combineMotorValues(activeParams, parseZoneAndMotor, intensity, clusterSize);
          const hasAny = motorValues.some((v) => v > 0);
          if (hasAny) {
            const logEntries = [];
            const byZone = {};
            for (const { param, value } of activeParams) {
              const { zone: parsedZone, motorIndex, rawMotorIndex } = parseZoneAndMotor(param);
              const zone = parsedZone === 'Front' ? 'Chest' : parsedZone;
              logEntries.push({ zone, param, motorIndex: rawMotorIndex ?? motorIndex, timestamp: now, intensity: value * intensity, velocity: vel });
              if (!byZone[zone]) byZone[zone] = new Set();
              if (rawMotorIndex != null) byZone[zone].add(rawMotorIndex);
            }
            dashboardState.touchLog.unshift(...logEntries);
            if (dashboardState.touchLog.length > 50) dashboardState.touchLog.splice(50);
            const summary = Object.entries(byZone)
              .map(([z, motors]) => {
                const arr = [...motors].sort((a, b) => a - b);
                return arr.length ? `${z}#${arr.join(',')}` : z;
              })
              .join(' | ');
            if (config.debug && (summary !== lastLogSummary || now - lastLogTime > 300)) {
              lastLogSummary = summary;
              lastLogTime = now;
              const params = activeParams.map((a) => a.param).join(', ');
              console.log(
                `[Touch] ${summary} type=${touchType || 'unknown'} intensity=${intensity.toFixed(
                  2
                )} vel=${vel.toFixed(2)} | params: ${params}`
              );
            }
            hapticsBridge.sendHaptic(intensity, config, null, null, motorValues);
            dashboardState.stats.hapticsSent++;
            dashboardState.lastHaptic = now;
          }
        } else {
          const lastParam = snapshot.lastParam || '';
          const { zone: parsedZone, motorIndex, rawMotorIndex } = parseZoneAndMotor(lastParam);
          const zone = parsedZone === 'Front' ? 'Chest' : parsedZone;
          const entry = { zone, param: lastParam, motorIndex: rawMotorIndex ?? motorIndex, timestamp: now, intensity, velocity: vel };
          dashboardState.touchLog.unshift(entry);
          if (dashboardState.touchLog.length > 50) dashboardState.touchLog.splice(50);
          if (config.debug) {
            const loc = motorIndex != null ? ` motor #${motorIndex}` : '';
            console.log(
              `[Touch] ${zone}${loc} — ${lastParam || '—'} | type=${touchType || 'unknown'} intensity=${intensity.toFixed(
                2
              )} vel=${vel.toFixed(2)}`
            );
          }
          hapticsBridge.sendHaptic(intensity, config, zone, motorIndex);
          dashboardState.stats.hapticsSent++;
          dashboardState.lastHaptic = now;
        }
      }
    },
    (avatar) => {
      dashboardState.avatar.id = avatar.avatarId;
      dashboardState.avatar.oscType = 'Avatar Parameters';
      dashboardState.vrchat.connected = true;
    }
  );

  dashboardState.osc.listening = true;
  dashboardState.osc.port = config.osc.port;

  const shutdown = () => {
    console.log('\n[VRChatOSC-bhaptics-js] Остановка...');
    let done = false;
    const forceExit = () => {
      if (!done) {
        done = true;
        console.log('[VRChatOSC-bhaptics-js] Принудительный выход');
        process.exit(0);
      }
    };
    setTimeout(forceExit, 3000);
    oscListener.close(() => {
      stop(() => {
        done = true;
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
