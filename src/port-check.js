import { execSync } from 'child_process';
import net from 'net';

export function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve({ port, free: false }));
    server.once('listening', () => {
      server.close(() => resolve({ port, free: true }));
    });
    server.listen(port, '127.0.0.1');
  });
}

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

export function freePorts(ports) {
  for (const port of ports) {
    const pids = getPidsListeningOnPort(port);
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
        console.log(`[tact-intensity-OSC] Freed port ${port} (killed PID ${pid})`);
      } catch (_) {}
    }
  }
}
