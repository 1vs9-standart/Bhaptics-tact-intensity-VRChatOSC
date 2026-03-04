/**
 * Motor layout: 4x4 grid per zone.
 * Front: 0-15, Back: 16-31.
 * Row 0: 0,1,2,3 | Row 1: 4,5,6,7 | Row 2: 8,9,10,11 | Row 3: 12,13,14,15
 */
const COLS = 4;
const ROWS = 4;
const ZONE_SIZE = 16;

const ZONE_FRONT_INDICES = Object.freeze([...Array(ZONE_SIZE).keys()]);
const ZONE_BACK_INDICES = Object.freeze([...Array(ZONE_SIZE).keys()].map((i) => i + ZONE_SIZE));

function getNeighbors(index) {
  if (index < 0 || index > 15) return [];
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const out = [];
  if (row > 0) out.push(index - COLS);
  if (row < ROWS - 1) out.push(index + COLS);
  if (col > 0) out.push(index - 1);
  if (col < COLS - 1) out.push(index + 1);
  return out;
}

/**
 * @param {number} centerIndex 0-15
 * @param {number} clusterSize 0=single, 1=+4 neighbors, 2=+8 (3x3)
 * @returns {number[]} indices 0-15
 */
export function getMotorCluster(centerIndex, clusterSize = 1) {
  const c = Math.max(0, Math.min(15, centerIndex));
  if (clusterSize <= 0) return [c];
  const n1 = getNeighbors(c);
  if (clusterSize === 1) return [c, ...n1];
  const n2 = new Set([c, ...n1]);
  for (const n of n1) {
    for (const nn of getNeighbors(n)) n2.add(nn);
  }
  return [...n2];
}

/**
 * @param {string} zone 'Chest'|'Stomach'|'Back'
 * @param {number|null} motorIndex 0-15 or null
 * @param {number} clusterSize
 * @returns {number[]} global indices 0-31
 */
export function getMotorIndices(zone, motorIndex, clusterSize = 1) {
  const z = (zone || '').toLowerCase();
  const isBack = /back|vest_back/i.test(z);
  const isFront = /chest|front|stomach|belly|vest_front/i.test(z);
  const offset = isBack ? ZONE_SIZE : 0;

  if (typeof motorIndex === 'number' && motorIndex >= 0 && motorIndex <= 19) {
    const localIdx = Math.min(15, motorIndex);
    const local = getMotorCluster(localIdx, clusterSize);
    return local.map((i) => i + offset);
  }
  if (isBack) return ZONE_BACK_INDICES;
  if (isFront) return ZONE_FRONT_INDICES;
  return [];
}

/**
 * Multi-touch: combine multiple touches into motorValues[32].
 * @param {{ param: string, value: number }[]} activeParams
 * @param {function(string): { zone: string, motorIndex: number|null }} parseZoneAndMotor
 * @param {number} globalIntensity 0-2 (bHaptics standard)
 * @param {number} clusterSize
 * @returns {number[]} motorValues 0-100 per motor
 */
export function combineMotorValues(activeParams, parseZoneAndMotor, globalIntensity, clusterSize = 1) {
  const motorValues = Array(32).fill(0);
  for (const { param, value } of activeParams) {
    const { zone, motorIndex } = parseZoneAndMotor(param);
    const z = zone === 'Front' ? 'Chest' : zone;
    const indices = getMotorIndices(z, motorIndex, clusterSize);
    const scaled = Math.round(Math.min(100, 100 * value * globalIntensity));
    for (const i of indices) {
      if (i >= 0 && i < 32) motorValues[i] = Math.max(motorValues[i], scaled);
    }
  }
  return motorValues;
}
