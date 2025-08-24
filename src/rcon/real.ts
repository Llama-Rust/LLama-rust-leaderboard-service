import type { ServerSnapshot } from './index.js';
import { env } from '../utils/env.js';
import WebSocket from 'ws';

type WebRconMsg = { Identifier: number; Message: string; Name: string; Type: string; };

function sendWs(ws: WebSocket, payload: WebRconMsg): Promise<WebRconMsg> {
  return new Promise((resolve, reject) => {
    const onMessage = (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString()) as WebRconMsg;
        if (msg.Identifier === payload.Identifier) {
          ws.off('message', onMessage);
          resolve(msg);
        }
      } catch { /* ignore non-JSON */ }
    };
    const onError = (err: any) => { ws.off('message', onMessage); reject(err); };
    ws.on('message', onMessage);
    ws.once('error', onError);
    ws.send(JSON.stringify(payload));
  });
}

async function webRcon(ws: WebSocket, cmd: string, id: number) {
  const reply = await sendWs(ws, { Identifier: id, Message: cmd, Name: 'WebRcon', Type: 'Generic' });
  return reply.Message || '';
}

function parseServerinfoJSON(text: string) {
  try {
    const obj = JSON.parse(text);
    return {
      hostname: obj.Hostname ?? null,
      map: obj.Map ?? null,
      playersOnline: typeof obj.Players === 'number' ? obj.Players : null,
      maxPlayers: typeof obj.MaxPlayers === 'number' ? obj.MaxPlayers : null,
      queued: typeof obj.Queued === 'number' ? obj.Queued : null,
      joining: typeof obj.Joining === 'number' ? obj.Joining : null,
      entityCount: typeof obj.EntityCount === 'number' ? obj.EntityCount : null,
      uptimeSeconds: typeof obj.Uptime === 'number' ? obj.Uptime : null,
    };
  } catch { return null; }
}

function parseStatusMeta(text: string) {
  const hostname = /hostname:\s*(.+)\s*$/im.exec(text)?.[1]?.trim() ?? null;
  const map      = /map\s*:\s*(.+)\s*$/im.exec(text)?.[1]?.trim() ?? null;
  const pm = /players\s*:\s*(\d+)\s*\((\d+)\s*max\)\s*\((\d+)\s*queued\)\s*\((\d+)\s*joining\)/i.exec(text);
  return {
    hostname,
    map,
    playersOnline: pm ? Number(pm[1]) : null,
    maxPlayers:    pm ? Number(pm[2]) : null,
    queued:        pm ? Number(pm[3]) : null,
    joining:       pm ? Number(pm[4]) : null
  };
}

function parseStatusPlayers(text: string) {
  const players: { steamId: string; name: string; connectedSeconds: number; ping: number }[] = [];
  // Example row:
  // 7656119... "Name" 64 1207.423s 129.222.76.28:33912 0.0 0 116786
  const rowRe = /^\s*(\d{17})\s+"([^"]+)"\s+(\d+)\s+([\d.]+)s\s+[^\s]+\s+[^\s]+\s+\d+\s+\d+\s*$/;
  for (const line of text.split('\n')) {
    const m = rowRe.exec(line);
    if (!m) continue;
    const steamId = m[1];
    const name = m[2].trim();
    const ping = Number(m[3]);
    const connectedSeconds = Math.round(Number(m[4]));
    players.push({ steamId, name, ping, connectedSeconds });
  }
  return players;
}

export async function getRconSnapshot(): Promise<ServerSnapshot> {
  // Change to wss:// if your host enforces TLS for WebRCON
  const url = `ws://${env.RCON_HOST}:${env.RCON_PORT}/${encodeURIComponent(env.RCON_PASSWORD)}`;
  const ws = new WebSocket(url, { handshakeTimeout: 15000 });

  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });

  try {
    const serverinfoRaw = await webRcon(ws, 'serverinfo', 1);
    const statusRaw     = await webRcon(ws, 'status', 2);

    const jsonPart       = serverinfoRaw.trim().startsWith('{') ? parseServerinfoJSON(serverinfoRaw) : null;
    const metaFromStatus = parseStatusMeta(statusRaw);

    const hostname      = jsonPart?.hostname ?? metaFromStatus.hostname ?? 'Rust Server';
    const map           = jsonPart?.map ?? metaFromStatus.map ?? null;
    const playersOnline = jsonPart?.playersOnline ?? metaFromStatus.playersOnline ?? null;
    const maxPlayers    = jsonPart?.maxPlayers ?? metaFromStatus.maxPlayers ?? null;
    const queued        = jsonPart?.queued ?? metaFromStatus.queued ?? null;
    const joining       = jsonPart?.joining ?? metaFromStatus.joining ?? null;
    const entityCount   = jsonPart?.entityCount ?? null;
    const uptimeSeconds = jsonPart?.uptimeSeconds ?? null;

    const players = parseStatusPlayers(statusRaw);

    return {
      hostname,
      map,
      playersOnline,
      maxPlayers,
      queued,
      joining,
      entityCount,
      uptimeSeconds,
      rawStatus: statusRaw,
      players
    };
  } finally {
    ws.close();
  }
}

