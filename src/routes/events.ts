// src/routes/events.ts
import type { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../utils/env.js';

const supabase = createClient(env.SUPABASE_URL || '', env.SUPABASE_SERVICE_KEY || '', {
  auth: { persistSession: false },
});

// constant-time compare
function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const plugin: FastifyPluginAsync = async (app) => {
  // POST /events/killrecords
  app.post('/killrecords', async (req, reply) => {
    // --- auth check ---
    const expected =
      process.env.WEBHOOK_SECRET ??
      process.env.INGEST_SECRET ??
      '';

    const providedRaw =
      (req.headers['x-webhook-secret'] as string | undefined) ??
      ((req.query as any)?.secretKey as string | undefined) ??
      '';

    const provided = providedRaw ? decodeURIComponent(providedRaw) : '';

    if (!expected || !provided || !safeEqual(provided, expected)) {
      req.log.warn(
        {
          hasExpected: !!expected,
          providedSample: provided ? `${provided.slice(0, 4)}…` : '(none)',
        },
        'events.killrecords unauthorized',
      );
      return reply.code(401).send({ error: 'unauthorized' });
    }
    // --- end auth check ---

    // Accept either querystring or JSON body payloads
    const qs = (req.query as any) ?? {};
    const body = (req.body as any) ?? {};

    // Merge payload sources (query wins if both present)
    const payload = { ...body, ...qs };

    // Minimal normalization
    const steamid = String(payload.steamid ?? '');
    const displayname = String(payload.displayname ?? '');
    const deaths = Number(payload.deaths ?? 0);

    // Store raw for debugging / audit
    try {
      const { error } = await supabase
        .from('events_raw')
        .insert([
          {
            source: 'killrecords',
            received_at: new Date().toISOString(),
            steamid,
            displayname,
            data: payload, // JSON column recommended in schema
          },
        ]);

      if (error) {
        req.log.error({ err: error }, 'events.killrecords insert failed');
        return reply.code(500).send({ error: 'insert_failed', details: error.message });
      }
    } catch (err: any) {
      req.log.error({ err }, 'events.killrecords insert threw');
      return reply.code(500).send({ error: 'insert_failed', details: err?.message || String(err) });
    }

    // (Optional) If you’ve got a processed table (e.g., rust_kill_events), you can upsert there too.

    return reply.send({
      ok: true,
      received: {
        steamid,
        displayname,
        deaths,
      },
    });
  });
};

export default plugin;
