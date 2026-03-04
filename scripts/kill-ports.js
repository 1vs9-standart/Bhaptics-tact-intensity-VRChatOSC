/**
 * Освобождает порты 9001 и 1969 (убивает процессы)
 * Запуск: node scripts/kill-ports.js
 */
import { execSync } from 'child_process';

const PORTS = [9001, 1969];

function getPidsListeningOnPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.toUpperCase().includes('LISTENING')) continue;
      const m = line.trim().match(/\s+(\d+)\s*$/);
      if (m && m[1] !== '0') pids.add(m[1]);
    }
    return [...pids];
  } catch {
    return [];
  }
}

for (const port of PORTS) {
  const pids = getPidsListeningOnPort(port);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
      console.log(`Killed PID ${pid} (port ${port})`);
    } catch (e) {
      // ignore
    }
  }
  if (pids.length === 0) {
    console.log(`Port ${port}: no process found`);
  }
}
