const MAP_W = 150;
const MAP_H = 150;
const TERRITORY_SIZE = 8;
const TILE_WORLD = 8; // world units per tile
const CLAIM_COST = 50;
const ATTACK_SOLDIERS = 15;

const TILE = { GRASS: 0, WATER: 1, MOUNTAIN: 2, FOREST: 3, ROAD: 4, TOWN: 5, DIRT: 6 };

// Deterministic noise
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) / 2147483648;
}

function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (
    hash(ix, iy) * (1 - ux) * (1 - uy) +
    hash(ix + 1, iy) * ux * (1 - uy) +
    hash(ix, iy + 1) * (1 - ux) * uy +
    hash(ix + 1, iy + 1) * ux * uy
  );
}

class GameState {
  constructor() {
    this.players = {};
    this.clans = {};
    this.tileWorldSize = TILE_WORLD;
    this.mapData = this._generateMap();
    this.territories = this._generateTerritories();
    this.buildings = this._generateBuildings();
    this.bridges = this._generateBridges();
  }

  // Exact bridge positions where roads cross the (straight) rivers, so the client
  // can place decks that line up perfectly. Mirrors the river math in _tileAt.
  _generateBridges() {
    const TW = TILE_WORLD, cx0 = MAP_W / 2, cy0 = MAP_H / 2;
    // The two narrow paths (N-S at cx=0, E-W at cy=0) each cross one river.
    return [
      { x: cx0 * TW,         z: (cy0 + 38) * TW, alongZ: true },   // N-S path over the horizontal river
      { x: (cx0 - 42) * TW,  z: cy0 * TW,        alongZ: false },  // E-W path over the vertical river
    ];
  }

  _tileHeight(x, y) {
    const cx = x - MAP_W / 2, cy = y - MAP_H / 2;
    const dist = Math.sqrt(cx * cx + cy * cy);
    const d = dist / (MAP_W * 0.5);
    const n1 = noise(x * 0.08, y * 0.08);
    const n2 = noise(x * 0.2, y * 0.2) * 0.4;
    const n3 = noise(x * 0.5, y * 0.5) * 0.15;
    let h = (n1 + n2 + n3) * (1 - Math.max(0, d - 0.3) * 2);
    // Flatten the spawn plaza + stone-path zone so paths sit flush (no falling in).
    const FLAT = 0.13;
    if (dist < 22) {
      const blend = dist < 18 ? 1 : (22 - dist) / 4;   // flat inside r18, smooth out to r22
      h = h * (1 - blend) + FLAT * blend;
    }
    return h;
  }

  _tileAt(x, y) {
    const cx = x - MAP_W / 2, cy = y - MAP_H / 2;
    const dist = Math.sqrt(cx * cx + cy * cy);
    const R = MAP_W * 0.47; // water border radius scales with map size

    if (dist > R) return TILE.WATER;

    const h = this._tileHeight(x, y);

    // ── A thin stone path RING around the fountain & lights — inside stays grass ──
    if (Math.abs(dist - 4.4) < 0.7) return TILE.TOWN;

    // ── A couple of narrow paths branch out from the ring across the map ──
    if (dist > 5.0 && dist < R - 5) {
      if (Math.abs(cx) < 0.85 || Math.abs(cy) < 0.85) return TILE.ROAD;        // narrow N-S & E-W paths
    }

    // Rivers — two meandering water channels. Roads above already returned ROAD,
    // so where a road crosses a river the tile stays walkable (a bridge is placed).
    // Straight rivers → roads cross them perpendicularly so bridges line up cleanly.
    if (dist > 22) {
      if (Math.abs(cy - 38) < 1.5 && Math.abs(cx) < 56) return TILE.WATER;     // horizontal river (south)
      if (Math.abs(cx + 42) < 1.5 && Math.abs(cy) < 56) return TILE.WATER;     // vertical river (west)
    }

    if (dist > R - 4) return TILE.WATER; // beach edge

    if (h > 0.58) return TILE.MOUNTAIN;
    if (h > 0.34 && dist > 12) return TILE.FOREST;   // denser forests fill the map

    if (dist > 8 && dist < 30) {
      const dNoise = noise(x * 0.3 + 5, y * 0.3 + 5);
      if (dNoise > 0.56) return TILE.DIRT;
    }

    return TILE.GRASS;
  }

  _generateMap() {
    const tiles = [], heights = [];
    for (let y = 0; y < MAP_H; y++) {
      const row = [], hrow = [];
      for (let x = 0; x < MAP_W; x++) {
        row.push(this._tileAt(x, y));
        hrow.push(this._tileHeight(x, y));
      }
      tiles.push(row);
      heights.push(hrow);
    }
    return { width: MAP_W, height: MAP_H, tiles, heights, tileWorld: TILE_WORLD };
  }

  _generateBuildings() {
    const TW = TILE_WORLD;
    const cx = MAP_W / 2 * TW, cz = MAP_H / 2 * TW;
    const houses = ['house_gen1', 'house_gen2', 'house_gen3', 'house_gen4', 'house_gen5', 'house_gen6'];
    const stores = ['animal_store', 'clothing_store', 'furniture_store', 'seed_store', 'tool_store', 'farm_improvements_store', 'restaurant'];
    const list = [];
    let idc = 0;

    // A spot is buildable only if it (and a small footprint around it) is plain
    // ground — never water, mountain, a road, the stone ring, or a dirt patch.
    // This keeps houses & shops off the paths.
    const buildable = (x, z) => {
      for (const [dx, dz] of [[0, 0], [11, 0], [-11, 0], [0, 11], [0, -11]]) {
        const tx = Math.floor((x + dx) / TW), tz = Math.floor((z + dz) / TW);
        const t = this.mapData.tiles[tz]?.[tx];
        if (t === undefined || t === TILE.WATER || t === TILE.MOUNTAIN ||
            t === TILE.ROAD || t === TILE.TOWN || t === TILE.DIRT) return false;
      }
      return true;
    };
    const tooClose = (x, z, min) => list.some(b => Math.hypot(b.x - x, b.z - z) < min);
    const add = (model, x, z, rot, label, type) => {
      if (!buildable(x, z) || tooClose(x, z, 16)) return false;
      list.push({ id: 'b' + (idc++), model, x, z, rot, label, type, enterable: true });
      return true;
    };
    // Seeded RNG → the world is IDENTICAL every server start (deterministic map).
    // The terrain itself is already deterministic (noise-based); seeding the
    // building placement makes the whole layout fixed and repeatable.
    let seed = 0x1a2b3c4d;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const rnd = (a, b) => a + rand() * (b - a);
    const pick = arr => arr[Math.floor(rand() * arr.length)];

    // ── Capital town — buildings sit in the quadrants BETWEEN the two paths ──
    add('town_hall', cx + 40, cz + 32, -Math.PI * 0.75, 'Town Hall', 'townhall');
    add('restaurant', cx + 40, cz - 32, -Math.PI * 0.25, 'Tavern', 'inn');
    add('tool_store', cx - 40, cz + 32, Math.PI * 0.75, 'Blacksmith', 'blacksmith');
    add('church', cx - 40, cz - 32, Math.PI * 0.25, 'Church', 'temple');
    add('school', cx + 22, cz + 64, Math.PI, 'School', 'barracks');
    add('seed_store', cx - 22, cz - 64, 0, 'Seed Store', 'manor');
    // Dense concentric rings of houses filling ALL the grass around the capital.
    // buildable() already rejects paths/dirt/water/the stone ring, so houses
    // never land on sidewalks. Sweeping every angle at many radii fills the grass
    // pockets evenly in all directions (no more clustering to one side).
    const ringLabels = ['Cottage', 'Cabin', 'House', 'Farmstead', 'Hut'];
    // Rings reach from right beside the plaza all the way out to the village band,
    // so there is no empty "donut" of grass around the capital.
    for (const r of [88, 104, 120, 137, 155, 174, 194, 215, 238, 262, 288, 315, 344]) {
      const slots = Math.max(12, Math.round(r / 7));     // more slots as the ring grows
      for (let i = 0; i < slots; i++) {
        const a = (i / slots) * Math.PI * 2 + r * 0.017; // stagger each ring so they interleave
        add(pick(houses), cx + Math.cos(a) * r, cz + Math.sin(a) * r, a + Math.PI, pick(ringLabels), 'house');
      }
    }

    // ── Scattered villages further out ──
    const names = ['Oakhaven', 'Millbrook', 'Stonewell', 'Riverside', 'Greenhollow', 'Ashford', 'Thornwood', 'Eastmere'];
    for (let v = 0; v < 14; v++) {
      const ang = (v / 14) * Math.PI * 2 + rnd(-0.35, 0.35);
      const dist = rnd(240, 520);
      const vx = cx + Math.cos(ang) * dist, vz = cz + Math.sin(ang) * dist;
      if (!buildable(vx, vz)) continue;
      const nm = names[v % names.length];
      add(pick(stores), vx, vz, rnd(0, Math.PI * 2), nm + ' Store', 'inn');
      const n = 5 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rnd(-0.2, 0.2); const r = rnd(20, 46); add(pick(houses), vx + Math.cos(a) * r, vz + Math.sin(a) * r, a + Math.PI, 'House', 'house'); }
    }

    // ── Lone buildings dotted across the rest of the map ──
    const lone = houses.concat(['beach_hut', 'mine_entrance', 'house_gen2', 'house_gen4']);
    const labels = ['Cottage', 'Hut', 'Cabin', 'Farmstead', 'Outpost', 'Shack'];
    for (let i = 0; i < 70; i++) {
      const ang = rnd(0, Math.PI * 2), dist = rnd(150, 560);
      add(pick(lone), cx + Math.cos(ang) * dist, cz + Math.sin(ang) * dist, rnd(0, Math.PI * 2), pick(labels), 'house');
    }

    return list;
  }

  _generateTerritories() {
    const territories = {};
    const cols = Math.floor(MAP_W / TERRITORY_SIZE);
    const rows = Math.floor(MAP_H / TERRITORY_SIZE);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx2 = 0; cx2 < cols; cx2++) {
        const id = `${cx2}_${cy}`;
        const tileX = cx2 * TERRITORY_SIZE;
        const tileY = cy * TERRITORY_SIZE;
        let water = 0;
        for (let dy = 0; dy < TERRITORY_SIZE; dy++)
          for (let dx = 0; dx < TERRITORY_SIZE; dx++)
            if (this.mapData.tiles[tileY + dy]?.[tileX + dx] === TILE.WATER) water++;
        if (water > TERRITORY_SIZE * TERRITORY_SIZE * 0.6) continue;
        territories[id] = {
          id, tileX, tileY,
          ownerId: null, clanId: null, defense: 0,
          name: this._territoryName(cx2, cy),
        };
      }
    }
    return territories;
  }

  _territoryName(cx, cy) {
    const pre = ['Kita','Minami','Higashi','Nishi','Kami','Shimo','Naka','Uchi','Soto','Oku','Furu','Shin'];
    const suf = ['no Mori','yama','gawa','shiro','machi','sato','hara','oka','zawa','numa','hama','kawa'];
    return pre[(cx + cy * 3) % pre.length] + suf[(cx * 2 + cy) % suf.length];
  }

  getSpawnPoint() {
    const cx = MAP_W / 2 * TILE_WORLD;
    const cz = MAP_H / 2 * TILE_WORLD;
    const angle = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 15;
    return { x: cx + Math.cos(angle) * r, y: cz + Math.sin(angle) * r };
  }

  claimTerritory(playerId, tileX, tileY) {
    const p = this.players[playerId];
    if (!p) return { success: false, reason: 'Player not found' };
    if (p.gold < CLAIM_COST) return { success: false, reason: `Need ${CLAIM_COST} gold` };
    const cx = Math.floor(tileX / TERRITORY_SIZE);
    const cy = Math.floor(tileY / TERRITORY_SIZE);
    const t = this.territories[`${cx}_${cy}`];
    if (!t) return { success: false, reason: 'Invalid territory' };
    if (t.ownerId) return { success: false, reason: 'Already claimed — attack to take it' };
    p.gold -= CLAIM_COST;
    t.ownerId = playerId;
    t.clanId = p.clan;
    t.defense = p.soldiers;
    return { success: true, territoryId: t.id, name: t.name };
  }

  attackTerritory(playerId, tileX, tileY) {
    const attacker = this.players[playerId];
    if (!attacker) return { success: false, reason: 'Player not found' };
    if (attacker.soldiers < ATTACK_SOLDIERS) return { success: false, reason: `Need ${ATTACK_SOLDIERS} soldiers` };
    const cx = Math.floor(tileX / TERRITORY_SIZE);
    const cy = Math.floor(tileY / TERRITORY_SIZE);
    const t = this.territories[`${cx}_${cy}`];
    if (!t) return { success: false, reason: 'Invalid territory' };
    if (!t.ownerId) return { success: false, reason: 'Unclaimed — just claim it' };
    if (t.ownerId === playerId) return { success: false, reason: 'You own this' };

    const defender = this.players[t.ownerId];
    const atk = attacker.soldiers * (0.8 + Math.random() * 0.4);
    const def = t.defense * (0.8 + Math.random() * 0.4);
    attacker.soldiers -= ATTACK_SOLDIERS;

    if (atk > def) {
      const prev = t.ownerId;
      t.ownerId = playerId;
      t.clanId = attacker.clan;
      t.defense = Math.max(0, attacker.soldiers - 5);
      attacker.gold += 30;
      if (defender) defender.soldiers = Math.max(0, defender.soldiers - Math.floor(def / 2));
      return { success: true, won: true, territoryId: t.id, name: t.name, defenderId: prev, defenderSoldiers: defender?.soldiers, message: `${attacker.name} conquered ${t.name}!` };
    }
    t.defense = Math.max(0, t.defense - 5);
    return { success: true, won: false, territoryId: t.id, message: `${attacker.name} failed to take ${t.name}` };
  }

  createClan(playerId, name, color) {
    const p = this.players[playerId];
    if (!p) return { success: false, reason: 'Player not found' };
    if (p.clan) return { success: false, reason: 'Already in a clan' };
    if (p.gold < 200) return { success: false, reason: 'Need 200 gold to found a clan' };
    const id = `clan_${Date.now()}`;
    this.clans[id] = { id, name, color, leader: playerId, members: [playerId] };
    p.clan = id;
    p.gold -= 200;
    return { success: true, clanId: id, name };
  }

  joinClan(playerId, clanId) {
    const p = this.players[playerId];
    if (!p) return { success: false, reason: 'Player not found' };
    if (p.clan) return { success: false, reason: 'Already in a clan' };
    const clan = this.clans[clanId];
    if (!clan) return { success: false, reason: 'Clan not found' };
    clan.members.push(playerId);
    p.clan = clanId;
    return { success: true, clanId, name: clan.name };
  }
}

module.exports = GameState;
