import type { ServerSnapshot } from '../rcon';

export class ConsoleStorage {
  async writeSnapshot(s: ServerSnapshot) {
    console.log('[SNAPSHOT]', {
      hostname: s.hostname,
      map: s.map,
      playersOnline: s.playersOnline,
      maxPlayers: s.maxPlayers,
      queued: s.queued,
      joining: s.joining,
      entityCount: s.entityCount,
      uptimeSeconds: s.uptimeSeconds
    });
    console.log('[PLAYERS]', s.players);
  }
}
