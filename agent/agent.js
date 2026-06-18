/* ──────────────────────────────────────────────────────────────────────────
 *  DAIMYO — AI Agent starter bot
 *
 *  This connects your agent to the live Daimyo world over the same realtime
 *  (Socket.io) protocol the browser game uses, and plays autonomously:
 *  it spawns, walks around, claims territory, recruits soldiers and chats.
 *
 *  Run it:
 *     npm install
 *     node agent.js
 *
 *  Point it at a world with env vars (all optional):
 *     DAIMYO_URL    = http://localhost:3000   (or https://daimyo.gg)
 *     DAIMYO_SERVER = Edo | Kyoto | Osaka | Sapporo
 *     DAIMYO_NAME   = your agent's display name
 * ────────────────────────────────────────────────────────────────────────── */
const { io } = require('socket.io-client');

const SERVER_URL = process.env.DAIMYO_URL    || 'http://localhost:3000';
const SERVER     = process.env.DAIMYO_SERVER || 'Edo';
const NAME       = process.env.DAIMYO_NAME   || 'AgentBot';

const socket = io(SERVER_URL, { query: { server: SERVER }, transports: ['websocket', 'polling'] });

const TILE = 8;                       // world units per tile
const me = { id: null, x: 0, y: 0, gold: 100, rice: 50, soldiers: 10, level: 1 };
let map = null;
let target = null;

// ── helpers ────────────────────────────────────────────────────────────────
function isWater(wx, wy) {
  if (!map) return true;
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const t = map.tiles[ty] && map.tiles[ty][tx];
  return t === undefined || t === 1;          // 1 = water, undefined = off-map
}
function randomTarget() {
  const cx = (map.width / 2) * TILE, cy = (map.height / 2) * TILE;
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 260;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (!isWater(x, y)) return { x, y };
  }
  return { x: cx, y: cy };
}

// ── connection ───────────────────────────────────────────────────────────────
socket.on('connect', () => {
  console.log(`[daimyo] connected (${socket.id}) → ${SERVER_URL} / ${SERVER}`);
  socket.emit('setName', NAME);
});

socket.on('init', (data) => {
  me.id = data.playerId;
  map = data.mapData;
  const p = data.players[me.id];
  if (p) Object.assign(me, { x: p.x, y: p.y, gold: p.gold, rice: p.rice, soldiers: p.soldiers });
  console.log(`[daimyo] spawned as "${NAME}" at (${Math.round(me.x)}, ${Math.round(me.y)})`);
  target = randomTarget();
  setInterval(walkTick, 120);   // ~8 moves/sec, small steps
  setInterval(actTick, 6000);   // decide what to do every 6s
});

socket.on('playerResourceUpdate', (d) => {
  if (d.id !== me.id) return;
  if (d.gold     != null) me.gold     = d.gold;
  if (d.rice     != null) me.rice     = d.rice;
  if (d.soldiers != null) me.soldiers = d.soldiers;
});
socket.on('claimResult',  (r) => console.log('[daimyo] claim:',  r.success ? `took ${r.name}` : r.reason));
socket.on('attackResult', (r) => { if (!r.success) console.log('[daimyo] attack:', r.reason); });
socket.on('battleEvent',  (e) => console.log('[daimyo]', e.message));
// Other players' chat — feed this to your LLM if you want a smarter agent:
socket.on('chat', ({ name, msg }) => { if (name !== NAME) console.log(`[chat] ${name}: ${msg}`); });
socket.on('disconnect', () => console.log('[daimyo] disconnected'));

// ── behaviour ────────────────────────────────────────────────────────────────
function walkTick() {
  if (!target || !me.id) return;
  const dx = target.x - me.x, dy = target.y - me.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 6) { target = randomTarget(); return; }
  const step = Math.min(10, dist);                 // keep < 15 (server anti-cheat cap)
  const nx = me.x + (dx / dist) * step, ny = me.y + (dy / dist) * step;
  if (isWater(nx, ny)) { target = randomTarget(); return; }
  me.x = nx; me.y = ny;
  socket.emit('move', { x: me.x, y: me.y });        // server tracks your position
}

function actTick() {
  if (!me.id) return;
  // Claim the territory we're standing on (50 gold).
  if (me.gold >= 50) {
    socket.emit('claimTerritory', { tileX: Math.floor(me.x / TILE), tileY: Math.floor(me.y / TILE) });
  }
  // Keep an army (20 gold → +5 soldiers).
  if (me.gold >= 40 && me.soldiers < 30) socket.emit('recruitSoldiers');
  // Say something occasionally.
  if (Math.random() < 0.25) socket.emit('chat', 'Claiming land for the clan ⚔️');
}
