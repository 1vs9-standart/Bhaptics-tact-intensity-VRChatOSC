# tact-intensity-OSC(v1.0)

[Русский](README.md)

The app relays touch data from the avatar to TactSuit and adjusts intensity by touch type (impact vs smooth). It has the same functionality as the original VRChatOSC from Bhaptics.

**Made by:** [1vs9](https://1vs9.dev/) · [VRChat](https://vrchat.com/home/user/usr_fe820c0f-02c9-48b0-9459-853198136a24) · [GitHub](https://github.com/1vs9-standart)

---

## Requirements

- **Node.js 18+** — [download](https://nodejs.org/en)
- **bHaptics Player** — [download](https://www.bhaptics.com/software/player/)
- **TactSuit Air** or **TactSuit Pro**
- **VRChat** — avatar with touch support (bHapticsOSC, Contact, etc.)

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure

1. Copy `config.example.json` → `config.json`
2. Go to [developer.bhaptics.com](https://developer.bhaptics.com/applications), create an app
3. Put `appId` and `apiKey` in `config.json` (section `bhaptics`)

### 3. Run

**Windows:** double-click `start.bat`

**Or in terminal:**
```bash
npm start
```

### 4. Open dashboard

Open **http://localhost:1969** in your browser

> **Important:** keep the dashboard tab open. Haptics go through the browser → bHaptics Player. Closing the tab stops vibrations.

### 5. Start VRChat

Launch VRChat and join a world. When you get touched — the vest will vibrate.

---

## Dashboard

- **Zones** — which zones are enabled (chest, stomach, back)
- **When enabled** — conditions for haptics (grounded, seated, etc.)
- **Test haptic** — verify the vest responds
- **RU / UA / EN** — language switch

---

## config.json parameters

### ui — interface

| Parameter | Values | Description |
|-----------|--------|-------------|
| `port` | number (1969) | Dashboard port. Open http://localhost:PORT |

### osc — receiving data from VRChat

| Parameter | Values | Description |
|-----------|--------|-------------|
| `port` | number (9001) | OSC port. **Must match** VRChat settings (OSC → output port) |
| `host` | string ("0.0.0.0") | Listen address. 0.0.0.0 = all interfaces |
| `autoFreePorts` | true / false | Free ports on startup (kill processes on 9001, 1969) |

### bhaptics — connection to bHaptics Player

| Parameter | Values | Description |
|-----------|--------|-------------|
| `appId` | string | App ID from [developer.bhaptics.com](https://developer.bhaptics.com/applications) |
| `apiKey` | string | App API key |
| `remote` | string ("127.0.0.1:15881") | bHaptics Player address. Local = 127.0.0.1 |

### intensity — vibration strength and timing

| Parameter | Values | Description |
|-----------|--------|-------------|
| `impactThreshold` | 0.1–1.0 (0.4) | Threshold: higher = "impact", lower = "smooth touch". VRChat: 0.4 |
| `velocityMin` | 0.1–1.0 (0.2) | Min velocity for impact strength |
| `velocityMax` | 1.0–5.0 (3.0) | Max velocity. OSC can send 1000+, use 3 |
| `durationMin` | 0–2 (0.2) | Min strength for long touch (hugs) |
| `durationMax` | 0–2 (1.3) | Max strength for long touch. Not above maxIntensity |
| `longContactMs` | 500–5000 (1500) | How many ms until smooth touch reaches max |
| `emaAlpha` | 0.1–0.9 (0.4) | Smoothing. Higher = faster response |
| `cooldownMs` | 20–100 (40) | Pause (ms) between haptics on impacts |
| `sustainCooldownMs` | 100–500 (150) | Pause on smooth touch |
| `minIntensity` | 0–2 (0.15) | Min strength (bHaptics scale 0–2) |
| `maxIntensity` | 0–2 (2.0) | Max strength. VRChat: 1.8 to avoid overload |

### haptic — how the vest vibrates

| Parameter | Values | Description |
|-----------|--------|-------------|
| `useDotMode` | true / false | true = precise motor control (recommended) |
| `motorClusterSize` | 0, 1, 2 | 0 = single motor, 1 = center + 4 neighbors, 2 = 3×3 block |

### contactParams — which OSC parameters to listen to

| Parameter | Values | Description |
|-----------|--------|-------------|
| `value` | string ("ContactChest") | Main contact parameter |
| `speed` | string ("ContactSpeed") | Speed parameter |
| `zone` | string ("ContactZone") | Zone parameter |
| `acceptAll` | true / false | true = process all OSC (except face tracking) |
| `excludeFaceTracking` | true / false | Exclude face params (FT/, viseme, etc.) |
| `contactTimeoutMs` | 100–1000 (250) | If no OSC for N ms — reset contact. 250 = normal, 400–500 = if it "sticks", 150–200 = faster release |
| `extra` | string array [] | Extra parameter names to process |

By default: `contact`, `vest`, `proximity`, `touch`, `haptic`.

---

### contactTimeoutMs — tips

**contactTimeoutMs** — how many ms without new OSC messages before contact is considered ended:
- **150–200** — feel "released" sooner
- **250** — typical value
- **400–500** — if vibration "sticks" after hands are removed

---

## License

- **tact-intensity-OSC** — MIT (see [LICENSE](LICENSE))
- **tact-js** (bHaptics) — [bHaptics SDK Agreement](https://bhaptics.gitbook.io/license-sdk/)
