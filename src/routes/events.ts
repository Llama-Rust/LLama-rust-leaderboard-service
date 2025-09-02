// src/routes/events.ts
import { FastifyInstance } from "fastify";
import { supabase } from "../storage/supabase.js";



export default async function (app: FastifyInstance) {
  app.post("/events/:source", async (req, reply) => {
    const { source } = req.params as { source: string };
    const body = (req.body ?? {}) as any;

    // Optional shared secret check
    const cfg = process.env.WEBHOOK_SECRET;
    const provided = (req.headers["x-kr-secret"] as string)
                  || (req.query as any)?.key
                  || (body.secret as string);
    const secret_ok = cfg ? provided === cfg : null;

    // Insert raw
    const { error } = await supabase.from("events_raw").insert([{
      source,
      secret_ok,
      headers: req.headers,
      payload: body,
      // server_id: you can set this later once you know it, or infer from payload
    }]);
    if (error) app.log.error(error);

    return { ok: true }; // keep webhook fast
  });
}
