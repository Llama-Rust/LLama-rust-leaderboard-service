// src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './utils/env.js';
import { pollOnce } from './poller.js';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client for read-backs (service key is fine here; if you prefer, swap to anon for reads)
const supabase = createClient(env.SUPABASE_URL || '', env.SUPABASE_SERVICE_KEY || '', {
  auth: { persistSession: false }
});

function buildServer() {
  const app = Fastify({ logger: true });

  // Plugins
  app.register(cors, { origin: true });

  // Friendly landing page (so hitting "/" in a browser isn't a 404)
  app.get('/', async () => ({
    ok: true,
    endpoints: ['GET /health', 'POST /poll', 'GET /latest'],
  }));

  // Health (simple, does not hit RCON or DB)
  app.get('/health', async () => ({ ok: true, mode: 'rcon' }));

  // Trigger one poll cycle (RCON -> parse -> write to Supabase)
  app.post('/poll', async (req, reply) => {
    try {
      const snap = await pollOnce();
      return {
        message: 'polled',
        summary: {
          hostname: snap.hostname,
          map: snap.map,
          playersOnline: snap.playersOnline,
          maxPlayers: snap.maxPlayers,
          queued: snap.queued,
          joining: snap.joining,
          entityCount: snap.entityCount,
          uptimeSeconds: snap.uptimeSeconds
        },
        players: snap.players
      };
    } catch (err: any) {
      req.log.error(err);
      return reply.code(500).send({ error: 'poll_failed', details: err?.message || String(err) });
    }
  });

  // Read back latest snapshot + current online players (useful for your Next.js UI)
  app.get('/latest', async (req, reply) => {
    try {
      // latest snapshot
      const { data: snap, error: snapErr } = await supabase
        .from('rust_server_snapshots')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapErr) throw snapErr;

      // current online players (up to 200)
      const { data: players, error: playersErr } = await supabase
        .from('rust_online_players')
        .select('*')
        .order('last_seen', { ascending: false })
        .limit(200);

      if (playersErr) throw playersErr;

      return { snap, players: players ?? [] };
    } catch (err: any) {
      req.log.error(err);
      return reply.code(500).send({ error: 'latest_failed', details: err?.message || String(err) });
    }
  });

  return app;
}

async function start() {
  const app = buildServer();
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`Service listening on :${env.PORT} (RCON)`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

start();
