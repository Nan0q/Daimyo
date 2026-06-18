const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const GameState = require('./gameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
// Cache policy: the entry files (HTML/JS/CSS) must always revalidate so a fresh
// deploy is picked up immediately instead of a browser serving a stale, mismatched
// mix of old + new files (which can break loading). Big static art can cache.
app.use(express.static(path.join(__dirname, '../client'), {
  etag: true,
  setHeaders(res, filePath) {
    if (/\.(html|js|mjs|css)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');           // revalidate via ETag every load
    } else {
      res.setHeader('Cache-Control', 'public, max-age=604800'); // models/textures: cache 7 days
    }
  },
}));

const game = new GameState();

// ── Wallet → username persistence (so returning players keep their name) ──
const USERS_FILE = path.join(__dirname, 'users.json');
let users = {};
try { users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { users = {}; }

// ── Real player tracking: wallet → last-played timestamp (for monthly count) ──
const SEEN_FILE = path.join(__dirname, 'seen.json');
let seen = {};
try { seen = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')); } catch { seen = {}; }
let seenDirty = false;
// A Solana address (base58, 32-44 chars) — case-sensitive, so we don't lowercase.
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function recordSeen(wallet) {
  const w = String(wallet || '');
  if (!WALLET_RE.test(w)) return;
  seen[w] = Date.now(); seenDirty = true;
}
// Flush the seen map to disk at most once a second.
setInterval(() => { if (seenDirty) { seenDirty = false; fs.writeFile(SEEN_FILE, JSON.stringify(seen), () => {}); } }, 1000);

app.get('/api/user', (req, res) => {
  const w = String(req.query.wallet || '');
  res.json({ username: users[w] || null });
});
app.post('/api/user', (req, res) => {
  const w = String((req.body && req.body.wallet) || '');
  const name = String((req.body && req.body.username) || '').trim().slice(0, 20);
  if (!WALLET_RE.test(w) || !name) return res.status(400).json({ error: 'bad request' });
  users[w] = name;
  fs.writeFile(USERS_FILE, JSON.stringify(users), () => {});
  res.json({ ok: true, username: name });
});
// Called when a verified wallet actually enters the game.
app.post('/api/seen', (req, res) => {
  recordSeen(req.body && req.body.wallet);
  res.json({ ok: true });
});
const SERVERS = ['Edo', 'Kyoto', 'Osaka', 'Sapporo'];

app.get('/api/stats', (req, res) => {
  const online = Object.keys(game.players).length;                 // real: currently connected players
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;            // last 30 days
  const monthly = Object.values(seen).filter(t => t >= cutoff).length; // real: unique wallets that played
  const servers = {};                                              // real: players currently on each server
  SERVERS.forEach(s => { servers[s] = 0; });
  Object.values(game.players).forEach(p => { if (servers[p.server] !== undefined) servers[p.server]++; });
  res.json({ online, monthly, servers });
});

const TICK_RATE = 20; // 20 ticks/sec
const PLAYER_SPEED = 3;

io.on('connection', (socket) => {
  const playerId = uuidv4();
  const spawn = game.getSpawnPoint();
  const server = SERVERS.includes(socket.handshake.query.server) ? socket.handshake.query.server : SERVERS[0];

  const player = {
    id: playerId,
    name: 'Ronin',
    server,
    x: spawn.x,
    y: spawn.y,
    clan: null,
    gold: 100,
    rice: 50,
    soldiers: 10,
    level: 1,
    color: randomColor(),
    chatMsg: '',
    chatTimer: 0,
  };

  game.players[playerId] = player;
  socket.playerId = playerId;

  // Send full state to new player
  socket.emit('init', {
    playerId,
    mapData: game.mapData,
    territories: game.territories,
    players: game.players,
    clans: game.clans,
    buildings: game.buildings,
    bridges: game.bridges,
  });

  // Broadcast new player
  socket.broadcast.emit('playerJoined', player);

  socket.on('setName', (name) => {
    if (typeof name !== 'string') return;
    game.players[playerId].name = name.slice(0, 20);
    io.emit('playerUpdate', { id: playerId, name: game.players[playerId].name });
  });

  // Character customization (clothes / hat / shoes / hair / skin).
  socket.on('customize', (custom) => {
    const p = game.players[playerId];
    if (!p || typeof custom !== 'object' || custom === null) return;
    const keys = ['outfit', 'pants', 'shoe', 'hat', 'hair', 'skin'];
    const clean = {};
    for (const k of keys) { const v = custom[k]; if (Number.isInteger(v) && v >= 0 && v < 64) clean[k] = v; }
    p.custom = clean;
    io.emit('playerUpdate', { id: playerId, custom: clean });
  });

  socket.on('move', ({ x, y }) => {
    const p = game.players[playerId];
    if (!p) return;
    // Validate movement distance (anti-cheat)
    const dx = x - p.x;
    const dy = y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > PLAYER_SPEED * 5) return;
    p.x = x;
    p.y = y;
  });

  socket.on('chat', (msg) => {
    if (typeof msg !== 'string') return;
    const p = game.players[playerId];
    if (!p) return;
    p.chatMsg = msg.slice(0, 60);
    p.chatTimer = 5000;
    io.emit('chat', { id: playerId, name: p.name, msg: p.chatMsg, clan: p.clan });
  });

  socket.on('claimTerritory', ({ tileX, tileY }) => {
    const result = game.claimTerritory(playerId, tileX, tileY);
    if (result.success) {
      io.emit('territoryUpdate', game.territories);
      io.emit('playerResourceUpdate', { id: playerId, gold: game.players[playerId].gold });
    }
    socket.emit('claimResult', result);
  });

  socket.on('createClan', ({ name, color }) => {
    if (typeof name !== 'string' || typeof color !== 'string') return;
    const result = game.createClan(playerId, name.slice(0, 20), color);
    if (result.success) {
      io.emit('clanUpdate', game.clans);
      io.emit('playerUpdate', { id: playerId, clan: game.players[playerId].clan });
    }
    socket.emit('createClanResult', result);
  });

  socket.on('joinClan', ({ clanId }) => {
    const result = game.joinClan(playerId, clanId);
    if (result.success) {
      io.emit('playerUpdate', { id: playerId, clan: game.players[playerId].clan });
      io.emit('clanUpdate', game.clans);
    }
    socket.emit('joinClanResult', result);
  });

  socket.on('attack', ({ tileX, tileY }) => {
    const result = game.attackTerritory(playerId, tileX, tileY);
    if (result.success) {
      io.emit('territoryUpdate', game.territories);
      io.emit('playerResourceUpdate', { id: playerId, soldiers: game.players[playerId].soldiers });
      if (result.defenderId) {
        io.emit('playerResourceUpdate', { id: result.defenderId, soldiers: result.defenderSoldiers });
      }
      io.emit('battleEvent', result);
    }
    socket.emit('attackResult', result);
  });

  socket.on('recruitSoldiers', () => {
    const p = game.players[playerId];
    if (!p) return;
    const cost = 20;
    if (p.gold < cost) {
      socket.emit('error', 'Not enough gold');
      return;
    }
    p.gold -= cost;
    p.soldiers += 5;
    socket.emit('playerResourceUpdate', { id: playerId, gold: p.gold, soldiers: p.soldiers });
  });

  socket.on('taskReward', ({ gold = 0, soldiers = 0, rice = 0 }) => {
    const p = game.players[playerId];
    if (!p) return;
    p.gold     = (p.gold     || 0) + Math.min(gold,     100);
    p.soldiers = (p.soldiers || 0) + Math.min(soldiers, 20);
    p.rice     = (p.rice     || 0) + Math.min(rice,     50);
    socket.emit('playerResourceUpdate', { id: playerId, gold: p.gold, soldiers: p.soldiers, rice: p.rice });
  });

  socket.on('npcTrade', ({ cost = {}, give = {} }) => {
    const p = game.players[playerId];
    if (!p) return;
    const cg = Math.min(Math.max(cost.gold || 0, 0), 1000);
    const cr = Math.min(Math.max(cost.rice || 0, 0), 1000);
    if ((p.gold || 0) < cg || (p.rice || 0) < cr) {
      socket.emit('tradeResult', { success: false, reason: 'Not enough to trade' });
      return;
    }
    p.gold     = (p.gold     || 0) - cg + Math.min(give.gold     || 0, 200);
    p.rice     = (p.rice     || 0) - cr + Math.min(give.rice     || 0, 200);
    p.soldiers = (p.soldiers || 0)      + Math.min(give.soldiers || 0, 50);
    socket.emit('playerResourceUpdate', { id: playerId, gold: p.gold, rice: p.rice, soldiers: p.soldiers });
    socket.emit('tradeResult', { success: true });
  });

  socket.on('disconnect', () => {
    delete game.players[playerId];
    io.emit('playerLeft', playerId);
  });
});

// Game tick — broadcast positions
setInterval(() => {
  const playerList = Object.values(game.players);

  // Tick chat timers & generate resources from territories
  playerList.forEach(p => {
    if (p.chatTimer > 0) p.chatTimer -= 1000 / TICK_RATE;

    // Passive income from owned territories
    const ownedCount = Object.values(game.territories).filter(t => t.ownerId === p.id).length;
    if (ownedCount > 0 && Math.random() < 0.01) {
      p.gold += ownedCount;
      p.rice += Math.floor(ownedCount / 2);
    }
    p.level = 1 + Math.floor((p.soldiers || 0) / 10) + ownedCount * 2 + Math.floor((p.gold || 0) / 200);
  });

  io.emit('tick', {
    players: playerList.map(p => ({
      id: p.id, x: p.x, y: p.y, name: p.name, color: p.color, level: p.level,
      clan: p.clan, chatMsg: p.chatTimer > 0 ? p.chatMsg : '', custom: p.custom || null,
    }))
  });
}, 1000 / TICK_RATE);

function randomColor() {
  const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#e91e63'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Daimyo server running on http://localhost:${PORT}`));
