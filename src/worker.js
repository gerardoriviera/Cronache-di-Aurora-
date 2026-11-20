/**
 * Cronache di Aurora — server delle stanze multigiocatore.
 *
 * - Serve il gioco (cartella public/) come file statici.
 * - /room/<nome> apre una connessione WebSocket verso la stanza <nome>.
 *   Ogni stanza è un Durable Object: tiene la "presence" di ogni giocatore
 *   (posizione, inviti, stato della lotta) e la inoltra a tutti gli altri.
 *
 * Protocollo (JSON):
 *   client -> server  {t:"presence", patch:{...}}   unisce i campi (null = rimuovi)
 *                     {t:"ping"}
 *   server -> client  {t:"init", you, peers:[{peer, presence}]}
 *                     {t:"p", peer, presence}       presence completa di un giocatore
 *                     {t:"left", peer}
 *                     {t:"resend"}                  chiede di rimandare la propria presence
 */
import { DurableObject } from "cloudflare:workers";

const ROOM_NAME = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const MAX_MESSAGE = 16 * 1024;   // byte per messaggio in arrivo
const MAX_PRESENCE = 8 * 1024;   // byte di presence per giocatore
const MAX_KEYS = 16;
const MAX_PLAYERS = 16;

/* Testi dei personaggi: il gioco li legge da /testi.csv, che arriva dal foglio Google
   indicato in wrangler.jsonc (vars.SHEET_ID). Il foglio deve essere visibile a
   "chiunque abbia il link". Se il foglio non risponde, il gioco usa i testi originali. */
async function testi(env, ctx) {
  if (!env.SHEET_ID) return new Response("", { status: 404 });
  const cache = caches.default;
  const key = new Request("https://cache.local/testi.csv");
  const hit = await cache.match(key);
  if (hit) return hit;
  let g, body = "";
  try {
    g = await fetch(`https://docs.google.com/spreadsheets/d/${env.SHEET_ID}/export?format=csv&gid=0`, { redirect: "follow" });
    if (g.ok) body = await g.text();
  } catch { return new Response("", { status: 502 }); }
  if (!g.ok || body.trimStart().startsWith("<")) return new Response("", { status: 502 });
  const res = new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=30" } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/testi.csv") return testi(env, ctx);
    const m = url.pathname.match(/^\/room\/([^/]+)$/);
    if (m) {
      const name = decodeURIComponent(m[1]);
      if (!ROOM_NAME.test(name)) return new Response("Nome stanza non valido", { status: 400 });
      if (request.headers.get("Upgrade") !== "websocket") return new Response("Serve una connessione WebSocket", { status: 426 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(name));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // presence in memoria: si perde se la stanza va in ibernazione,
    // in quel caso il server chiede ai giocatori di rimandarla ("resend").
    this.presence = new Map();
  }

  async fetch(request) {
    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= MAX_PLAYERS) return new Response("Stanza piena", { status: 503 });
    const { 0: client, 1: server } = new WebSocketPair();
    const peer = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer });
    this.presence.set(peer, {});
    const peers = [];
    let missing = false;
    for (const ws of sockets) {
      const a = ws.deserializeAttachment();
      if (!a) continue;
      if (!this.presence.has(a.peer)) missing = true;
      peers.push({ peer: a.peer, presence: this.presence.get(a.peer) || {} });
    }
    server.send(JSON.stringify({ t: "init", you: peer, peers }));
    if (missing) this.broadcast({ t: "resend" }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE) return;
    let d;
    try { d = JSON.parse(message); } catch { return; }
    const a = ws.deserializeAttachment();
    if (!a || !d || typeof d !== "object") return;
    if (d.t === "ping") { ws.send('{"t":"pong"}'); return; }
    if (d.t !== "presence" || !d.patch || typeof d.patch !== "object" || Array.isArray(d.patch)) return;

    if (this.presence.size <= 1 && this.ctx.getWebSockets().length > 1) this.broadcast({ t: "resend" }, ws);
    const cur = { ...(this.presence.get(a.peer) || {}) };
    for (const k of Object.keys(d.patch).slice(0, MAX_KEYS)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,31}$/.test(k)) continue;
      if (d.patch[k] === null) delete cur[k]; else cur[k] = d.patch[k];
    }
    if (JSON.stringify(cur).length > MAX_PRESENCE) return;
    this.presence.set(a.peer, cur);
    this.broadcast({ t: "p", peer: a.peer, presence: cur }, ws);
  }

  async webSocketClose(ws) { this.drop(ws); }
  async webSocketError(ws) { this.drop(ws); }

  drop(ws) {
    const a = ws.deserializeAttachment();
    if (a) { this.presence.delete(a.peer); this.broadcast({ t: "left", peer: a.peer }, ws); }
    try { ws.close(1000, "bye"); } catch {}
  }

  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(s); } catch {}
    }
  }
}
