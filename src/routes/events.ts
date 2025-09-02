// src/routes/events.ts
import { FastifyInstance } from "fastify";
import { supabase } from "../storage/supabase.js";

export default async function (app: FastifyInstance) {
  // ⬅️ FIX: path is now just "/:source" because server.ts registers with { prefix: "/events" }
  app.post("/:source", async (req, reply) => {
    const { source } = req.params as { source: string };
    const body = (req.body ?? {}) as any;

    const cfg = process.env.WEBHOOK_SECRET;
    const provided =
      (req.headers["x-kr-secret"] as string) ||
      (req.query as any)?.key ||
      (body.secret as string);

    const secret_ok = cfg ? provided === cfg : null;
    if (cfg && !secret_ok) {
      return reply.code(401).send({ ok: false, error: "bad secret" });
    }

    const { error } = await supabase.from("events_raw").insert([
      {
        source,
        secret_ok,
        headers: req.headers,
        payload: body,
        // server_id: set later if/when you tag events to a server
      },
    ]);
    if (error) {
      req.log.error({ err: error }, "events_raw insert failed");
      return reply.code(500).send({ ok: false, error: error.message });
    }

    return { ok: true };
  });
}
