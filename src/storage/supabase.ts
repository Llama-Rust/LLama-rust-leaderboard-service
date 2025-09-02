import { createClient } from '@supabase/supabase-js';
import type { ServerSnapshot } from '../rcon/index.js';
import { env } from '../utils/env.js';

export const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false }
});

export class SupabaseStorage {
  async writeSnapshot(s: ServerSnapshot) {
    const { error: snapErr } = await supabase.from('rust_server_snapshots').insert({
      hostname: s.hostname,
      map: s.map,
      players_online: s.playersOnline,
      max_players: s.maxPlayers,
      queued: s.queued,
      joining: s.joining,
      entity_count: s.entityCount,
      uptime_seconds: s.uptimeSeconds
    });
    if (snapErr) throw snapErr;

    if (s.players?.length) {
      const rows = s.players.map(p => ({
        steam_id: p.steamId,
        name: p.name,
        connected_seconds: p.connectedSeconds,
        ping: p.ping,
        last_seen: new Date().toISOString()
      }));
      const { error: upErr } = await supabase.from('rust_online_players').upsert(rows, { onConflict: 'steam_id' });
      if (upErr) throw upErr;
    }
  }
}

