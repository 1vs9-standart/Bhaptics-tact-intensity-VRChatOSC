import { Server } from 'node-osc';

/**
 * OSC Listener — принимает параметры от VRChat
 * /avatar/change — смена аватара (id)
 * /avatar/parameters/* — параметры аватара
 */
export function createOSCListener(config, onMessage, onAvatarChange) {
  const { port, host } = config.osc;

  const server = new Server(port, host, () => {
    console.log(`[OSC] Listening on ${host}:${port}`);
  });

  server.on('message', (msg) => {
    const [address, ...args] = msg;
    if (!address) return;

    if (address === '/avatar/change') {
      const avatarId = args[0];
      if (avatarId != null) {
        onAvatarChange?.({ avatarId: String(avatarId), timestamp: Date.now() });
      }
      return;
    }

    if (address.startsWith('/avatar/parameters/')) {
      const paramName = address.replace('/avatar/parameters/', '');
      const value = args[0];
      const type = typeof value;

      if (type !== 'number' && type !== 'boolean') return;

      const numValue = type === 'boolean' ? (value ? 1 : 0) : value;
      onMessage({ paramName, value: numValue, timestamp: Date.now() });
    }
  });

  return {
    close(cb) {
      server.close(cb || (() => {}));
    },
  };
}
