import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

// ─── Renderers ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// No tone mapping → flat, punchy, saturated colors (matches the reference art style)
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('renderer-mount').appendChild(renderer.domElement);
// Boost game vibrance and contrast for punchy feudal Japan look
renderer.domElement.style.filter = 'saturate(1.8) contrast(1.08) brightness(1.04)';

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById('label-layer').appendChild(labelRenderer.domElement);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ─── Fade overlay (transition animation) ──────────────────────────────────────
const fade = document.createElement('div');
fade.style.cssText = `position:fixed;inset:0;background:#000;opacity:0;z-index:500;
  pointer-events:none;transition:opacity 0.4s ease;`;
document.body.appendChild(fade);
function fadeOut() { return new Promise(r => { fade.style.opacity = '1'; setTimeout(r, 420); }); }
function fadeIn() { fade.style.opacity = '0'; }

// ─── Outdoor scene ────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ed0ee);
scene.fog = new THREE.Fog(0x9bd6f0, 140, 420);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);

// Outdoor lighting — warm key sun + cool sky fill
const sun = new THREE.DirectionalLight(0xfff6e2, 1.35);
sun.position.set(70, 130, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
sun.shadow.camera.left = -140; sun.shadow.camera.right = 140;
sun.shadow.camera.top = 140; sun.shadow.camera.bottom = -140;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);
const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;

scene.add(new THREE.HemisphereLight(0xddf2ff, 0x7aa850, 0.85));
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

// ─── Interior scene (separate world) ──────────────────────────────────────────
const interiorScene = new THREE.Scene();
interiorScene.background = new THREE.Color(0x14100c);
interiorScene.fog = new THREE.Fog(0x14100c, 25, 70);
interiorScene.add(new THREE.AmbientLight(0xffe0b0, 0.5));
interiorScene.add(new THREE.HemisphereLight(0x6a5a40, 0x201510, 0.6));

// ─── PBR materials ────────────────────────────────────────────────────────────
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts });
const MAT = {
  water:    new THREE.MeshStandardMaterial({ color: 0x3aa6e8, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.88 }),
  stone:    std(0x9a9a96, { roughness: 0.95 }),
  stoneL:   std(0xcfcdc4, { roughness: 0.9 }),
  wood:     std(0x8a5a2e, { roughness: 0.8 }),
  woodD:    std(0x5a3618, { roughness: 0.8 }),
  woodL:    std(0xb98a52, { roughness: 0.8 }),
  roof:     std(0x9c2626, { roughness: 0.7 }),
  roofD:    std(0x5e1616, { roughness: 0.7 }),
  roofGrn:  std(0x2f6e2f, { roughness: 0.7 }),
  cream:    std(0xefe6cf, { roughness: 0.9 }),
  white:    std(0xf8f4ea, { roughness: 0.9 }),
  gray:     std(0xb2aa9a, { roughness: 0.95 }),
  door:     std(0x6b3a1f, { roughness: 0.7 }),
  glass:    new THREE.MeshStandardMaterial({ color: 0x9dd8f5, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.6 }),
  gold:     new THREE.MeshStandardMaterial({ color: 0xffd24a, roughness: 0.3, metalness: 0.85 }),
  iron:     new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.4, metalness: 0.7 }),
  steel:    new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.85 }),
  trunk:    std(0x6b4226, { roughness: 0.9 }),
  leaf:     std(0x2f7c2f, { roughness: 1 }),
  leaf2:    std(0x3aa03a, { roughness: 1 }),
  fabric:   std(0x8c2c2c, { roughness: 1 }),
  fabricB:  std(0x2c4c8c, { roughness: 1 }),
  fountain: std(0xd2dde8, { roughness: 0.7 }),
  fwater:   new THREE.MeshStandardMaterial({ color: 0x5ab4f0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.9 }),
  ember:    new THREE.MeshStandardMaterial({ color: 0xff7a18, emissive: 0xff5500, emissiveIntensity: 2 }),
  candle:   new THREE.MeshStandardMaterial({ color: 0xffcf7a, emissive: 0xffaa33, emissiveIntensity: 2 }),
};

function box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function cyl(rt, rb, h, seg, mat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function cone(r, h, seg, mat) { const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }
function sph(r, mat) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), mat); m.castShadow = true; return m; }

// ─── GLTF model library (CC0 Kenney models) ──────────────────────────────────
const gltfLoader = new GLTFLoader();
const MODELS = {};
const MODEL_LIST = [
  'tree-big', 'tree-small', 'low-poly-tree',
  'formation-rock', 'formation-stone', 'formation-large-rock', 'plant',
  'house-3', 'house-4', 'house-5', 'house-6', 'house-7', 'house-18', 'barn', 'tower', 'library-large',
  'barrel', 'chest', 'bed', 'table', 'bench', 'pot', 'bottle', 'sword', 'pillow', 'present',
];
function loadModels(onProgress) {
  let done = 0;
  return Promise.all(MODEL_LIST.map(name => new Promise(res => {
    gltfLoader.load(`assets/models/${name}.gltf`,
      g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.metalness = 0; } }); MODELS[name] = g.scene; done++; onProgress && onProgress(done, MODEL_LIST.length); res(); },
      undefined,
      err => { console.warn('model load failed:', name, err); done++; onProgress && onProgress(done, MODEL_LIST.length); res(); });
  })));
}
function model(name) {
  const src = MODELS[name]; if (!src) return null;
  const c = src.clone(true);
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
}

// ─── Polytope Studio FBX nature pack ──────────────────────────────────────────
const fbxLoader = new FBXLoader();
fbxLoader.setResourcePath('assets/polytope/textures/');
const PT = {};
const PT_LIST = [
  'PT_Fruit_Tree_01_green', 'PT_Fruit_Tree_01_apples', 'PT_Fruit_Tree_01_pears', 'PT_Pine_Tree_03_green',
  'PT_Generic_Rock_01', 'PT_Menhir_Rock_02', 'PT_River_Rock_Pile_02', 'PT_Ore_Rock_01',
  'PT_Generic_Shrub_01_green', 'PT_Poppy_02', 'PT_Grass_02', 'PT_Caesars_Mushroom_01',
];
// Convert FBX (Phong) materials to consistent Standard materials that match our lighting.
function ptConvertMat(m) {
  const n = new THREE.MeshStandardMaterial({
    map: m.map || null,
    color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
    roughness: 0.92, metalness: 0.0,
  });
  if (n.map) { n.map.colorSpace = THREE.SRGBColorSpace; n.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); }
  n.alphaTest = 0.4;          // handles cutout leaf/grass cards; harmless on solid textures
  n.side = THREE.DoubleSide;
  return n;
}
function loadPolytope(onProgress) {
  let done = 0;
  return Promise.all(PT_LIST.map(name => new Promise(res => {
    fbxLoader.load(`assets/polytope/models/${name}.fbx`,
      obj => {
        obj.traverse(o => {
          if (o.isMesh) {
            o.castShadow = true; o.receiveShadow = true;
            o.material = Array.isArray(o.material) ? o.material.map(ptConvertMat) : ptConvertMat(o.material);
          }
        });
        PT[name] = obj; done++; onProgress && onProgress(done, PT_LIST.length); res();
      },
      undefined,
      err => { console.warn('FBX load failed:', name, err); done++; onProgress && onProgress(done, PT_LIST.length); res(); });
  })));
}
function ptModel(name) {
  const src = PT[name]; if (!src) return null;
  const c = src.clone(true);
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
}

// ─── Farming Game Pack buildings (FBX, textures assigned manually) ────────────
const FARM = {};
// model name → texture file (FBX don't embed texture refs; Unity used .mat)
const FARM_TEX = {
  animal_store: 'animal_store', beach_hut: 'beach_hut', church: 'church_building',
  clothing_store: 'clothing_store', farm_improvements_store: 'farm_improvements_store',
  furniture_store: 'furniture_store', harbor: 'harbor',
  house_gen1: 'house_gen_1', house_gen2: 'house_gen_2', house_gen3: 'house_gen_3',
  house_gen4: 'house_gen_4', house_gen5: 'house_gen_5', house_gen6: 'house_gen_6',
  lighthouse: 'lighthouse', mine_entrance: 'mine_entrance', restaurant: 'restaurant',
  school: 'school_texture', seed_store: 'seed_store', tool_store: 'tool_store', town_hall: 'town_hall',
};
const FARM_LIST = Object.keys(FARM_TEX);
const FARM_FOOT = { town_hall: 20, church: 17, restaurant: 15, school: 16, harbor: 22, lighthouse: 9, mine_entrance: 13 };
function loadFarm(onProgress) {
  let done = 0; const texCache = {};
  const getTex = n => {
    if (!texCache[n]) { const t = texLoader.load(`assets/farm/textures/${n}.png`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); texCache[n] = t; }
    return texCache[n];
  };
  return Promise.all(FARM_LIST.map(name => new Promise(res => {
    fbxLoader.load(`assets/farm/models/${name}.fbx`,
      obj => {
        const tex = getTex(FARM_TEX[name]);
        obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }); } });
        FARM[name] = obj; done++; onProgress && onProgress(done, FARM_LIST.length); res();
      },
      undefined,
      err => { console.warn('farm FBX failed:', name, err); done++; onProgress && onProgress(done, FARM_LIST.length); res(); });
  })));
}
function farmModel(name) {
  const src = FARM[name]; if (!src) return null;
  const c = src.clone(true);
  c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return c;
}
// Scale model so its footprint width == targetW, seated with base at y=0. Returns world size.
function fitGround(obj, targetW) {
  let size = new THREE.Vector3(); new THREE.Box3().setFromObject(obj).getSize(size);
  const s = targetW / (Math.max(size.x, size.z) || 1); obj.scale.setScalar(s);
  const b2 = new THREE.Box3().setFromObject(obj); obj.position.y -= b2.min.y;
  const out = new THREE.Vector3(); new THREE.Box3().setFromObject(obj).getSize(out); return out;
}
function fitHeight(obj, targetH) {
  let size = new THREE.Vector3(); new THREE.Box3().setFromObject(obj).getSize(size);
  obj.scale.setScalar(targetH / (size.y || 1));
  const b2 = new THREE.Box3().setFromObject(obj); obj.position.y -= b2.min.y;
}
// Place a fitted prop into a group at local (x,z).
function addProp(g, name, x, z, targetH, rotY = 0) {
  const m = model(name); if (!m) return;
  const w = new THREE.Group(); w.add(m); fitHeight(m, targetH);
  w.position.set(x, 0, z); w.rotation.y = rotY; g.add(w);
}

// ─── Blink animated human characters (skinned FBX + animation clips) ──────────
// Deterministic 0..1 from a string seed → consistent look per player/NPC.
function seedRand(str, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < String(str).length; i++) { h ^= String(str).charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

// Loaded character mesh (skinned, with skeleton) + animation clips keyed by name.
const CHAR = { mesh: null, anims: {}, height: 1 };
const ANIM_FILES = {
  idle: 'Idle', run: 'RunForward',
  emote_cheer: 'Buff', emote_jump: 'Jumps', emote_cast: 'SpellCast', emote_slash: 'MeleeAttack_OneHanded',
};
const EMOTE_KEYS = ['emote_cheer', 'emote_jump', 'emote_cast', 'emote_slash'];

// Armor/clothing FBX (skinned to the same rig) layered onto the body.
const ARMOR_FILES = ['StarterArmor_HumanMale.fbx', 'PlateSet1_HumanMale.fbx'];

function loadCharacter(onProgress) {
  const loader = new FBXLoader();
  const bodyTex = texLoader.load('assets/blink/LowPolyCharacterTexture.png'); bodyTex.colorSpace = THREE.SRGBColorSpace;
  const armorTex = texLoader.load('assets/blink/LowPolyArmorTexture.png'); armorTex.colorSpace = THREE.SRGBColorSpace;
  const total = 1 + ARMOR_FILES.length + Object.keys(ANIM_FILES).length;
  let done = 0; const tick = () => { done++; onProgress && onProgress(done, total); };
  const loadFBX = url => new Promise(res => loader.load(url, o => res(o), undefined, e => { console.warn('load fail', url, e); res(null); }));

  return (async () => {
    // Body (carries the skeleton everything else binds to)
    const body = await loadFBX('assets/blink/HumanMale_Character.fbx'); tick();
    if (!body) return;
    let bodySkinned = null;
    body.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      o.material = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.85, metalness: 0 });
      if (o.isSkinnedMesh && !bodySkinned) bodySkinned = o; } });
    const boneByName = {}; body.traverse(o => { if (o.isBone) boneByName[o.name] = o; });

    // Layer the clothes + armor onto the body's skeleton so they animate with it.
    for (const af of ARMOR_FILES) {
      const armor = await loadFBX('assets/blink/' + af); tick();
      if (!armor || !bodySkinned) continue;
      const pieces = []; armor.traverse(o => { if (o.isSkinnedMesh) pieces.push(o); });
      pieces.forEach(sm => {
        try {
          const bones = sm.skeleton.bones.map(b => boneByName[b.name] || b);
          sm.material = new THREE.MeshStandardMaterial({ map: armorTex, roughness: 0.8, metalness: 0 });
          sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
          sm.bind(new THREE.Skeleton(bones, sm.skeleton.boneInverses), bodySkinned.bindMatrix);
          bodySkinned.parent.add(sm);
        } catch (e) { console.warn('armor bind failed', af, e); }
      });
    }
    const sz = new THREE.Vector3(); new THREE.Box3().setFromObject(body).getSize(sz);
    CHAR.mesh = body; CHAR.height = sz.y || 1;

    // Animation clips
    for (const [key, file] of Object.entries(ANIM_FILES)) {
      const obj = await loadFBX(`assets/blink/anims/${file}.fbx`); tick();
      const clip = obj && obj.animations && obj.animations[0];
      if (clip) { clip.name = key; CHAR.anims[key] = clip; }
    }
    // Clean each clip: keep only tracks for bones we actually have, and strip the
    // root/hips translation so the run plays IN PLACE (game logic drives movement).
    const names = new Set(); CHAR.mesh.traverse(o => { if (o.name) names.add(o.name); });
    for (const k in CHAR.anims) {
      const clip = CHAR.anims[k];
      clip.tracks = clip.tracks.filter(t => {
        const dot = t.name.lastIndexOf('.');
        const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
        if (!names.has(node)) return false;
        if (prop === 'position' && /root|hips|pelvis|cog|reference|spine_?01|spine1/i.test(node)) return false;
        return true;
      });
    }
  })();
}

// Clone the skinned character (preserving its skeleton) and wire up an
// AnimationMixer with idle/run/emote actions. Returns a wrapper Group.
function createAnimatedCharacter(color, isMe, seed) {
  if (!CHAR.mesh) return null;
  const s = seed || color || 'x';
  const model = cloneSkeleton(CHAR.mesh);
  const tint = new THREE.Color(color || '#ffffff').lerp(new THREE.Color(0xffffff), 0.25);
  model.traverse(o => { if (o.isMesh) {
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    o.material = o.material.clone(); o.material.color = tint.clone();
  } });

  const wrap = new THREE.Group();
  // Contact shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; wrap.add(sh);

  // Scale the whole model to a fixed height via a neutral scaler group, then seat.
  const scaler = new THREE.Group(); scaler.add(model); wrap.add(scaler);
  const size = new THREE.Vector3(); new THREE.Box3().setFromObject(scaler).getSize(size);
  const targetH = 3.5 + seedRand(s, 3) * 0.5;
  scaler.scale.setScalar(targetH / (size.y || 1));
  const b2 = new THREE.Box3().setFromObject(scaler); scaler.position.y -= b2.min.y;

  // Mixer + actions
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const k in CHAR.anims) actions[k] = mixer.clipAction(CHAR.anims[k]);
  if (actions.idle) actions.idle.play();
  wrap.userData.rig = { mixer, actions, current: actions.idle ? 'idle' : null, emoting: false, wrap };

  // Bright "you" marker (MeshBasic = always lit, never renders black like metal did)
  if (isMe) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0x35e0ff }));
    m.rotation.x = Math.PI; m.position.y = targetH + 1.0; wrap.add(m);
    wrap.userData.meMarker = m;
  }
  return wrap;
}

function rigCrossFade(r, to, dur = 0.22) {
  const dest = r.actions[to]; if (!dest) return;
  const from = r.actions[r.current];
  dest.reset(); dest.setLoop(THREE.LoopRepeat); dest.enabled = true; dest.setEffectiveWeight(1); dest.play();
  if (from && from !== dest) from.crossFadeTo(dest, dur, false);
  r.current = to;
}
function rigSetLocomotion(mesh, moving) {
  const r = mesh?.userData?.rig; if (!r || r.emoting) return;
  const want = moving ? 'run' : 'idle';
  if (r.current !== want) rigCrossFade(r, want);
}
function rigPlayEmote(mesh, key) {
  const r = mesh?.userData?.rig; if (!r || !r.actions[key] || r.emoting) return;
  r.emoting = true;
  const act = r.actions[key], from = r.actions[r.current];
  act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.enabled = true; act.setEffectiveWeight(1); act.play();
  if (from && from !== act) from.crossFadeTo(act, 0.15, false);
  const onDone = e => {
    if (e.action !== act) return;
    r.mixer.removeEventListener('finished', onDone);
    r.emoting = false; r.current = null; rigCrossFade(r, 'idle', 0.2);
  };
  r.mixer.addEventListener('finished', onDone);
}
function updateRigs(delta) {
  Object.values(playerMeshes).forEach(m => { const r = m.userData.rig; if (r) r.mixer.update(delta); });
  if (typeof npcs !== 'undefined') npcs.forEach(n => { const r = n.mesh.userData.rig; if (r) r.mixer.update(delta); });
  if (interiorPlayerMesh) { const r = interiorPlayerMesh.userData.rig; if (r) r.mixer.update(delta); }
}

// ─── Wooden bridges (procedural — always aligned with the road over the river) ─
function loadBridge() { return Promise.resolve(); } // (procedural now; nothing to load)

// Build a plank bridge centred on (wx,wz), spanning the river along the road.
// alongZ = true → the road runs N-S, so the deck is long in Z.
function placeBridge(wx, wz, alongZ) {
  const g = new THREE.Group();
  const baseY = getGroundY(wx, wz);          // road height at the crossing
  const len = TILE_W * 6;                     // span across the river (+ banks)
  const wid = TILE_W * 1.7;                   // deck width
  const L = alongZ ? wid : len, Wd = alongZ ? len : wid; // x , z extents

  // Deck — its top sits flush with the road surface
  const deck = box(L, 0.35, Wd, MAT.woodL); deck.position.y = -0.05; deck.receiveShadow = true; g.add(deck);
  // Plank seams
  const planks = alongZ ? Math.round(Wd / 1.4) : Math.round(L / 1.4);
  for (let i = 0; i < planks; i++) {
    const t = (i / (planks - 1) - 0.5);
    const p = box(alongZ ? L : 0.12, 0.4, alongZ ? 0.12 : Wd, MAT.woodD);
    p.position.set(alongZ ? 0 : t * L, 0.0, alongZ ? t * Wd : 0); g.add(p);
  }
  // Railings + posts down both long sides
  for (const side of [-1, 1]) {
    const off = (wid / 2 - 0.2) * side;
    const rail = box(alongZ ? 0.18 : len, 0.18, alongZ ? len : 0.18, MAT.wood);
    rail.position.set(alongZ ? off : 0, 1.05, alongZ ? 0 : off); g.add(rail);
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = (i / n - 0.5);
      const post = box(0.28, 1.3, 0.28, MAT.woodD);
      post.position.set(alongZ ? off : t * len, 0.55, alongZ ? t * len : off);
      post.castShadow = true; g.add(post);
    }
  }
  // Support pillars reaching down into the water
  for (const a of [-0.28, 0.28]) for (const b of [-0.32, 0, 0.32]) {
    const pil = box(0.5, 3.4, 0.5, MAT.woodD);
    pil.position.set(alongZ ? a * wid : b * len, -1.8, alongZ ? b * len : a * wid);
    g.add(pil);
  }
  g.position.set(wx, baseY, wz);
  scene.add(g);
}

// Place the bridges the server computed (exact road↔river crossings).
const bridgeSpots = [];
function placeBridges(list) {
  bridgeSpots.length = 0;
  (list || []).forEach(b => { placeBridge(b.x, b.z, b.alongZ); bridgeSpots.push(b); });
}

// ─── State ────────────────────────────────────────────────────────────────────
let socket, myId, myPlayer;
let players = {}, territories = {}, clans = {}, mapData = null, serverBuildings = [], serverBridges = [];
let playerMeshes = {}, playerLabels = {}, chatLabels = {}, chatTimers = {};
let buildingMeshes = [], terrMeshes = {};
let myCustom = null; // player's chosen outfit { outfit, pants, shoe, hat, hair, skin }
const obstacles = []; // { x, z, r } solid circular colliders (trees, rocks, props)
function addObstacle(x, z, r) { obstacles.push({ x, z, r }); }
// True if tile (tx,ty) or any neighbour is a path (road/town/dirt) — used to keep
// trees/rocks/foliage off the paths and their edges.
function nearPath(md, tx, ty) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = md.tiles[ty + dy]?.[tx + dx];
    if (t === 4 || t === 5 || t === 6) return true;
  }
  return false;
}
// True if (x,z) is too close to a building or an already-placed prop/tree/rock.
// Used so vegetation never spawns inside houses or on top of other objects.
function overlapsStructure(x, z, pad = 2) {
  for (const b of buildingMeshes) {
    const e = b.userData.ext || { x: 6, z: 6 };
    if (Math.hypot(x - b.position.x, z - b.position.z) < Math.max(e.x, e.z) + pad) return true;
  }
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (Math.hypot(x - o.x, z - o.z) < o.r + pad) return true;
  }
  return false;
}
let TILE_W = 8;
let selectedTerritoryId = null;
let nearBuilding = null, insideBuilding = null;
let notifTimeout = null, chatFocused = false, transitioning = false;
const keys = {};

let groundMesh = null, terrainGroup = null, spawnWheel = null, spawnFireLights = [];

// Interior runtime
let interiorGroup = null, interiorMeta = null, interiorPlayerMesh = null;
const interiorPos = new THREE.Vector3();
let interiorYaw = 0;

// Camera — CLOSER default third-person
const CAM_OUT = { dist: 22, height: 16 };   // outdoor default (close)
const CAM_IN  = { dist: 14, height: 10 };   // interior — matches outdoor angle so FOV feels consistent
let camDist = CAM_OUT.dist, camHeight = CAM_OUT.height, camYaw = 0;
const camTarget = new THREE.Vector3();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// ─── Terrain (bulletproof floor) ──────────────────────────────────────────────
// One continuous, smooth elevation field for ALL land tiles. Using the same
// gentle multiplier everywhere means neighbouring tiles never jump → no spikes.
// Mountains are simply where the smooth height noise is naturally higher.
function heightFor(tile, h) {
  if (tile === 1) return -1.2;     // water bed
  return h * 7;                    // rolling hills, ~0–11 units, fully smooth
}

// Tiling detail texture: near-white so it multiplies the per-tile vertex color,
// with noise + a darker border per tile → the grid look from the reference.
function makeDetailTexture() {
  const s = 64;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    c.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${Math.random() * 0.16})` : `rgba(255,255,255,${Math.random() * 0.12})`;
    c.fillRect(x, y, 1.4, 1.4);
  }
  // subtle blades / clumps
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * s, y = Math.random() * s;
    c.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.07})`;
    c.fillRect(x, y, 1, 2 + Math.random() * 2);
  }
  // tile border (grid)
  c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 2;
  c.strokeRect(1, 1, s - 2, s - 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const detailTex = makeDetailTexture();

const texLoader = new THREE.TextureLoader();
function loadTiledTex(url, repX, repY) {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

let waterNM = null;
function buildTerrain(md) {
  if (terrainGroup) scene.remove(terrainGroup);
  terrainGroup = new THREE.Group();
  TILE_W = md.tileWorld || 8;
  // Apply the Polytope water normal map so rivers/lakes get real rippling water.
  if (!waterNM) {
    waterNM = loadTiledTex('assets/polytope/textures/PT_Water_NM_01.png', 14, 14);
    MAT.water.normalMap = waterNM; MAT.water.normalScale = new THREE.Vector2(0.5, 0.5); MAT.water.needsUpdate = true;
    MAT.fwater.normalMap = waterNM; MAT.fwater.needsUpdate = true;
  }
  const W = md.width, H = md.height;
  const cx = W * TILE_W / 2, cz = H * TILE_W / 2;

  // 1) Solid base floor, grass-textured (safety net + horizon)
  const baseGeo = new THREE.PlaneGeometry(W * TILE_W + 400, H * TILE_W + 400);
  baseGeo.rotateX(-Math.PI / 2);
  const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({
    map: loadTiledTex('assets/polytope/textures/PT_Ground_Grass_Green_01.png', (W + 50) / 2, (H + 50) / 2), roughness: 1,
  }));
  base.position.set(cx, -1.4, cz); base.receiveShadow = true;
  terrainGroup.add(base);

  // 2) Water surface
  const waterGeo = new THREE.PlaneGeometry(W * TILE_W + 120, H * TILE_W + 120, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, MAT.water);
  water.position.set(cx, -0.35, cz); water.receiveShadow = true;
  terrainGroup.add(water);

  // 3) Height-mapped GRASS terrain (real grass texture from the pack)
  const geo = new THREE.PlaneGeometry(W * TILE_W, H * TILE_W, W - 1, H - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = i % W, vy = Math.floor(i / W);
    pos.setY(i, heightFor(md.tiles[vy]?.[vx] ?? 0, md.heights[vy]?.[vx] ?? 0));
  }
  geo.computeVertexNormals();
  groundMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: loadTiledTex('assets/polytope/textures/PT_Ground_Grass_Green_01.png', W / 2, H / 2), roughness: 0.95,
  }));
  groundMesh.position.set(cx, 0, cz); groundMesh.receiveShadow = true; groundMesh.name = 'ground';
  terrainGroup.add(groundMesh);

  // 4) Dirt-path and stone-plaza overlays sit on top of the grass
  buildGroundOverlays(md);

  scene.add(terrainGroup);
}

// Corner height that matches the terrain mesh exactly (uniform elevation field).
function cornerY(md, gx, gy) {
  const h = md.heights[Math.min(gy, md.height - 1)]?.[Math.min(gx, md.width - 1)] ?? 0;
  return heightFor(0, h); // tile type irrelevant for land elevation
}

// Build one merged, terrain-CONFORMING mesh for a set of tiles. Each tile is two
// triangles whose corners sit on the real terrain surface → zero clipping.
function buildConformingTiles(md, tiles, material, yLift) {
  if (!tiles.length) return null;
  const positions = [], uvs = [], indices = [];
  let v = 0;
  for (const [x, y] of tiles) {
    const x0 = x * TILE_W, x1 = (x + 1) * TILE_W;
    const z0 = y * TILE_W, z1 = (y + 1) * TILE_W;
    const y00 = cornerY(md, x, y) + yLift, y10 = cornerY(md, x + 1, y) + yLift;
    const y01 = cornerY(md, x, y + 1) + yLift, y11 = cornerY(md, x + 1, y + 1) + yLift;
    positions.push(x0, y00, z0,  x1, y10, z0,  x1, y11, z1,  x0, y01, z1);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(v, v + 2, v + 1, v, v + 3, v + 2); // wind so faces point UP (visible from above)
    v += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function buildGroundOverlays(md) {
  const W = md.width, H = md.height;
  const dirt = [], town = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = md.tiles[y][x];
    if (t === 4 || t === 6) dirt.push([x, y]);
    else if (t === 5) town.push([x, y]);
  }
  // Warm sandy path — clearly contrasts with grass so routes read at a glance.
  // Strong polygonOffset (factor + units) so the path always wins the depth test
  // over the grass beneath it → no flickering/z-fighting at any angle or distance.
  const dirtMat = new THREE.MeshStandardMaterial({ map: loadTiledTex('assets/polytope/textures/PT_Ground_Generic_03.png', 1, 1), color: 0xd9b377, roughness: 1, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
  const townMat = new THREE.MeshStandardMaterial({ color: 0xb3b0a8, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
  const dm = buildConformingTiles(md, dirt, dirtMat, PATH_LIFT); if (dm) terrainGroup.add(dm);
  const tm = buildConformingTiles(md, town, townMat, PATH_LIFT); if (tm) terrainGroup.add(tm);
}

const PATH_LIFT = 0.06; // tiny lift; the strong polygonOffset below keeps paths flicker-free
function getGroundY(wx, wz) {
  if (!mapData) return 0;
  const tx = Math.floor(wx / TILE_W), tz = Math.floor(wz / TILE_W);
  const t = mapData.tiles[tz]?.[tx] ?? 0;
  let y = heightFor(t, mapData.heights[tz]?.[tx] ?? 0);
  if (t === 4 || t === 5 || t === 6) y += PATH_LIFT; // stand on the path surface
  return y;
}

// ─── Trees ────────────────────────────────────────────────────────────────────
// Pick a fitted clone from the Polytope pack, falling back to Kenney models.
function natureClone(ptNames, kenneyNames) {
  const pt = ptNames.filter(n => PT[n]);
  if (pt.length) return { obj: ptModel(pt[Math.floor(Math.random() * pt.length)]), pt: true };
  const kn = (kenneyNames || []).filter(n => MODELS[n]);
  if (kn.length) return { obj: model(kn[Math.floor(Math.random() * kn.length)]), pt: false };
  return null;
}

// Trees cover the WHOLE land — dense forest clumps plus woodland scattered across
// all grass (incl. the outer ring). Stride-sampling keeps coverage even, not
// bunched at the top of the map.
function spawnTrees(md) {
  const W = md.width, H = md.height;
  const g = new THREE.Group();
  const cands = [];
  const cxT = W / 2, cyT = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - cxT, y - cyT) < 8) continue; // keep the spawn plaza clear
    if (nearPath(md, x, y)) continue;               // never on or beside a path
    const t = md.tiles[y][x];
    const r = Math.sin(x * 91.3 + y * 73.7) * 0.5 + 0.5;
    if (t === 3) { if (r < 0.22) continue; cands.push({ x, y, r }); }            // forests: dense
    else if (t === 0) {
      // Grass: woodland everywhere, and MUCH denser toward the outskirts so the
      // outer ring is no longer blank.
      const d = Math.hypot(x - cxT, y - cyT) / (W * 0.5);   // 0 center → 1 edge
      const thresh = 0.74 - d * 0.45;
      if (r > thresh) cands.push({ x, y, r });
    }
  }
  const MAX = 2100;
  const step = Math.max(1, cands.length / MAX);
  const ptTrees = ['PT_Fruit_Tree_01_green', 'PT_Fruit_Tree_01_apples', 'PT_Fruit_Tree_01_pears', 'PT_Pine_Tree_03_green'];
  for (let f = 0; f < cands.length; f += step) {
    const { x, y, r } = cands[Math.floor(f)];
    const wx = x * TILE_W + TILE_W / 2 + (r - 0.5) * 5;
    const wz = y * TILE_W + TILE_W / 2 + Math.cos(x + y) * 2.5;
    if (overlapsStructure(wx, wz, 3)) continue;
    const pick = natureClone(ptTrees, ['tree-big', 'tree-small', 'low-poly-tree']); if (!pick) continue;
    const wrap = new THREE.Group(); wrap.add(pick.obj);
    fitHeight(pick.obj, 8 + r * 6);
    wrap.position.set(wx, getGroundY(wx, wz), wz);
    wrap.rotation.y = r * Math.PI * 2;
    g.add(wrap);
    addObstacle(wx, wz, 1.5);
  }
  scene.add(g);
}

function scatterRocks(md) {
  const W = md.width, H = md.height;
  const g = new THREE.Group();
  const cands = [];
  const cxT = W / 2, cyT = H / 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.hypot(x - cxT, y - cyT) < 14) continue; // keep the whole spawn area clear of rocks
    const tile = md.tiles[y][x];
    if (tile !== 0 && tile !== 2) continue;
    if (nearPath(md, x, y)) continue;   // never on or beside a path
    const r = Math.sin(x * 53.7 + y * 31.1) * 0.5 + 0.5;
    const d = Math.hypot(x - cxT, y - cyT) / (W * 0.5);
    if (r < 0.9 - d * 0.25) continue;   // more rocks toward the edges
    cands.push({ x, y, r });
  }
  const MAX = 600;
  const step = Math.max(1, cands.length / MAX);
  const ptRocks = ['PT_Generic_Rock_01', 'PT_Menhir_Rock_02', 'PT_River_Rock_Pile_02', 'PT_Ore_Rock_01'];
  for (let f = 0; f < cands.length; f += step) {
    const { x, y, r } = cands[Math.floor(f)];
    const wx = x * TILE_W + TILE_W / 2, wz = y * TILE_W + TILE_W / 2;
    if (overlapsStructure(wx, wz, 2.5)) continue;
    const pick = natureClone(ptRocks, ['formation-rock', 'formation-stone', 'formation-large-rock']); if (!pick) continue;
    const wrap = new THREE.Group(); wrap.add(pick.obj);
    const rh = 1.6 + r * 3;
    fitHeight(pick.obj, rh);
    wrap.position.set(wx, getGroundY(wx, wz), wz);
    wrap.rotation.y = r * Math.PI * 2;
    g.add(wrap);
    addObstacle(wx, wz, 1.3 + rh * 0.35);
  }
  scene.add(g);
}

// Shrubs, flowers, grass tufts and mushrooms sprinkled over ALL grass (even, not top-biased).
function scatterFoliage(md) {
  const W = md.width, H = md.height;
  const g = new THREE.Group();
  const kinds = [
    { names: ['PT_Grass_02'], h: [0.6, 1.1], thresh: 0.6 },
    { names: ['PT_Generic_Shrub_01_green'], h: [1.6, 2.6], thresh: 0.93 },
    { names: ['PT_Poppy_02'], h: [0.5, 0.9], thresh: 0.95 },
    { names: ['PT_Caesars_Mushroom_01'], h: [0.4, 0.8], thresh: 0.972 },
  ];
  const cands = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (md.tiles[y][x] !== 0) continue; // grass only
    if (nearPath(md, x, y)) continue;   // keep paths clean
    for (let k = 0; k < kinds.length; k++) {
      const r = Math.sin(x * (17.3 + k * 4) + y * (29.7 + k * 6)) * 0.5 + 0.5;
      if (r < kinds[k].thresh) continue;
      cands.push({ x, y, r, k }); break;
    }
  }
  const MAX = 1800;
  const step = Math.max(1, cands.length / MAX);
  for (let f = 0; f < cands.length; f += step) {
    const { x, y, r, k } = cands[Math.floor(f)];
    const kind = kinds[k];
    const m = ptModel(kind.names[0]); if (!m) continue;
    const wx = x * TILE_W + TILE_W / 2 + (r - 0.5) * 6;
    const wz = y * TILE_W + TILE_W / 2 + Math.cos(x * 3 + y) * 3;
    if (overlapsStructure(wx, wz, 1.5)) continue;
    const wrap = new THREE.Group(); wrap.add(m);
    fitHeight(m, kind.h[0] + r * (kind.h[1] - kind.h[0]));
    wrap.position.set(wx, getGroundY(wx, wz), wz);
    wrap.rotation.y = r * Math.PI * 2;
    g.add(wrap);
  }
  scene.add(g);
}

// ─── Exterior buildings ───────────────────────────────────────────────────────
function pagodaRoof(rb, h, mat) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, rb, h, 4), mat); m.castShadow = true; m.rotation.y = Math.PI / 4; return m; }

function buildTownHall() {
  const g = new THREE.Group();
  const hall = box(20, 11, 16, MAT.cream); hall.position.y = 5.5; g.add(hall);
  const r1 = pagodaRoof(13, 5, MAT.roof); r1.position.y = 13.5; g.add(r1);
  const r2 = pagodaRoof(10, 4, MAT.roofD); r2.position.y = 17; g.add(r2);
  [-4, 0, 4].forEach(x => { const col = cyl(0.5, 0.5, 11, 10, MAT.white); col.position.set(x, 5.5, 8); g.add(col); });
  for (let i = 0; i < 3; i++) { const s = box(14 - i * 2, 0.6, 2.4, MAT.stoneL); s.position.set(0, 0.5 + i * 0.6, 9 + i * 0.6); g.add(s); }
  const door = box(3, 5, 0.4, MAT.door); door.position.set(0, 3, 8.05); g.add(door);
  [-8, 8].forEach(x => { const p = cyl(0.12, 0.12, 14, 6, MAT.woodD); p.position.set(x, 7, 8); g.add(p);
    const f = box(3, 1.8, 0.1, MAT.fabric); f.position.set(x + 1.5, 13, 8); g.add(f); });
  return g;
}
function buildInn() {
  const g = new THREE.Group();
  const lo = box(14, 6, 12, MAT.cream); lo.position.y = 3; g.add(lo);
  const up = box(12, 4.5, 10, MAT.wood); up.position.y = 8.2; g.add(up);
  const r = pagodaRoof(9, 4, MAT.roofD); r.position.y = 12.5; g.add(r);
  const balc = box(10, 0.4, 2.2, MAT.woodD); balc.position.set(0, 6.2, 7); g.add(balc);
  [-4, -1.3, 1.3, 4].forEach(x => { const p = cyl(0.15, 0.15, 4.5, 6, MAT.wood); p.position.set(x, 8.2, 7.9); g.add(p); });
  const door = box(2.4, 3.6, 0.3, MAT.door); door.position.set(0, 1.8, 6.05); g.add(door);
  [-4, 4].forEach(x => { const w = box(1.4, 1.4, 0.2, MAT.glass); w.position.set(x, 3.4, 6.05); g.add(w); });
  const lantern = sph(0.5, MAT.candle); lantern.position.set(3, 4.5, 6.4); g.add(lantern);
  const ll = new THREE.PointLight(0xffaa44, 6, 14); ll.position.set(3, 4.5, 6.6); g.add(ll);
  return g;
}
function buildBlacksmith() {
  const g = new THREE.Group();
  const m = box(12, 6, 10, MAT.gray); m.position.y = 3; g.add(m);
  const r = pagodaRoof(8, 3.5, MAT.roofD); r.position.y = 7.5; g.add(r);
  const ch = box(1.8, 7, 1.8, MAT.stone); ch.position.set(4, 7, -3); g.add(ch);
  const aw = box(12, 0.4, 4.5, MAT.woodD); aw.position.set(0, 5.6, 7); g.add(aw);
  const door = box(3, 4.5, 0.3, MAT.door); door.position.set(0, 2.2, 5.05); g.add(door);
  const forge = box(2.5, 1.6, 2.5, MAT.stone); forge.position.set(-3.5, 0.8, 6.5); g.add(forge);
  const coals = box(1.6, 0.4, 1.6, MAT.ember); coals.position.set(-3.5, 1.7, 6.5); g.add(coals);
  const fl = new THREE.PointLight(0xff5500, 8, 16); fl.position.set(-3.5, 2.5, 6.5); g.add(fl);
  return g;
}
function buildTemple() {
  const g = new THREE.Group();
  const base = box(16, 1.2, 16, MAT.stoneL); base.position.y = 0.6; g.add(base);
  const hall = box(11, 8, 11, MAT.white); hall.position.y = 5.2; g.add(hall);
  [[13, 9], [11, 12], [9, 15]].forEach(([w, y]) => { const r = pagodaRoof(w / 2, 2.8, MAT.roofGrn); r.position.y = y; g.add(r); });
  const spire = cyl(0.18, 0.18, 4, 8, MAT.gold); spire.position.y = 18; g.add(spire);
  const ball = sph(0.6, MAT.gold); ball.position.y = 20.3; g.add(ball);
  [-4.5, 4.5].forEach(x => [-4.5, 4.5].forEach(z => { const c = cyl(0.5, 0.5, 8, 10, MAT.white); c.position.set(x, 4.2, z); g.add(c); }));
  for (let i = 0; i < 3; i++) { const s = box(9 + i * 2, 0.5, 3, MAT.stoneL); s.position.set(0, 1.2 + i * 0.5, 8 + i * 1); g.add(s); }
  const door = box(3, 5, 0.4, MAT.door); door.position.set(0, 3.7, 5.55); g.add(door);
  return g;
}
function buildBarracks() {
  const g = new THREE.Group();
  const m = box(18, 7, 11, MAT.gray); m.position.y = 3.5; g.add(m);
  const r = box(19, 0.9, 12, MAT.stone); r.position.y = 7.4; g.add(r);
  for (let i = -8; i <= 8; i += 2) { [6, -6].forEach(z => { const me = box(0.9, 1.3, 0.9, MAT.stone); me.position.set(i, 8.4, z); g.add(me); }); }
  const pole = cyl(0.13, 0.13, 7, 6, MAT.woodD); pole.position.y = 11; g.add(pole);
  const flag = box(3.4, 2, 0.1, MAT.fabric); flag.position.set(1.7, 13.5, 0); g.add(flag);
  const door = box(3, 4.5, 0.3, MAT.woodD); door.position.set(0, 2.2, 5.55); g.add(door);
  [-6, -2, 2, 6].forEach(x => { const s = box(0.5, 1.6, 0.2, MAT.iron); s.position.set(x, 4.5, 5.55); g.add(s); });
  return g;
}
function buildManor() {
  const g = new THREE.Group();
  const main = box(13, 8, 10, MAT.cream); main.position.y = 4; g.add(main);
  const r = pagodaRoof(8.5, 4.5, MAT.roofD); r.position.y = 10.2; g.add(r);
  const tower = box(5, 12, 5, MAT.gray); tower.position.set(-7, 6, 0); g.add(tower);
  const tr = cone(3.4, 4.5, 8, MAT.roofD); tr.position.set(-7, 14.2, 0); g.add(tr);
  const door = box(2.2, 3.6, 0.3, MAT.door); door.position.set(0, 1.8, 5.05); g.add(door);
  [-4, 4].forEach(x => { const w = box(1.4, 1.6, 0.2, MAT.glass); w.position.set(x, 4.5, 5.05); g.add(w); });
  return g;
}
const BUILDERS = { townhall: buildTownHall, inn: buildInn, blacksmith: buildBlacksmith, temple: buildTemple, barracks: buildBarracks, manor: buildManor };
// Map each building to a CC0 Kenney model + target footprint (world units).
const B_MODEL = { townhall: 'library-large', inn: 'house-5', blacksmith: 'house-3', temple: 'tower', barracks: 'barn', manor: 'house-7' };
const B_FOOT = { townhall: 26, inn: 18, blacksmith: 15, temple: 15, barracks: 22, manor: 18 };

function placeBuildings(list) {
  buildingMeshes = [];
  list.forEach(b => {
    const gy = getGroundY(b.x, b.z);
    const wrap = new THREE.Group();
    let labelY = 12, ext = { x: 7, z: 7 };
    // Prefer the Farming-pack FBX building named by b.model; fall back to Kenney.
    const m = (b.model && farmModel(b.model)) || (B_MODEL[b.type] && model(B_MODEL[b.type]));
    if (m) {
      wrap.add(m);
      const foot = (b.model && FARM_FOOT[b.model]) || (b.model ? 13 : (B_FOOT[b.type] || 16));
      const size = fitGround(m, foot);
      labelY = size.y + 2;
      const rad = Math.max(size.x, size.z) / 2;
      ext = { x: rad * 0.8, z: rad * 0.8 };
    } else if (BUILDERS[b.type]) {
      wrap.add(BUILDERS[b.type]());
    }
    wrap.position.set(b.x, gy, b.z);
    wrap.rotation.y = b.rot || 0;
    wrap.userData = { ...b, groundY: gy, ext };
    scene.add(wrap);
    buildingMeshes.push(wrap);
    const el = document.createElement('div');
    el.className = 'building-label'; el.textContent = b.label || '';
    const lbl = new CSS2DObject(el); lbl.position.set(0, labelY, 0); wrap.add(lbl);
  });
}

function makeWheelTexture() {
  const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e91e63'];
  const n = colors.length, m = s / 2;
  for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(m, m); c.arc(m, m, m, (i / n) * 6.2832, ((i + 1) / n) * 6.2832); c.closePath(); c.fillStyle = colors[i]; c.fill(); }
  c.beginPath(); c.arc(m, m, m * 0.13, 0, 6.2832); c.fillStyle = '#fff'; c.fill();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function lamppost(x, z) {
  const g = new THREE.Group();
  const pole = cyl(0.18, 0.24, 5.5, 8, MAT.iron); pole.position.y = 2.75; g.add(pole);
  const arm = cyl(0.12, 0.12, 1, 6, MAT.iron); arm.rotation.z = Math.PI / 2; arm.position.set(0, 5.4, 0); g.add(arm);
  const bulb = sph(0.45, MAT.candle); bulb.position.y = 5.4; g.add(bulb);
  const l = new THREE.PointLight(0xffd27a, 7, 34); l.position.y = 5.4; g.add(l);
  g.position.set(x, getGroundY(x, z), z); return g;
}
function banner(x, z, color, rot) {
  const g = new THREE.Group();
  const pole = cyl(0.1, 0.1, 7, 6, MAT.woodD); pole.position.y = 3.5; g.add(pole);
  const cloth = box(2, 3.2, 0.12, new THREE.MeshStandardMaterial({ color, roughness: 1 })); cloth.position.set(0, 5, 0.3); g.add(cloth);
  const fin = cone(0.18, 0.5, 6, MAT.gold); fin.position.y = 7.2; g.add(fin);
  g.position.set(x, getGroundY(x, z), z); g.rotation.y = rot || 0; return g;
}
function bench(x, z, rot) {
  const g = new THREE.Group();
  const seat = box(3, 0.25, 1, MAT.wood); seat.position.y = 0.8; g.add(seat);
  const backr = box(3, 1, 0.2, MAT.wood); backr.position.set(0, 1.3, -0.4); g.add(backr);
  [-1.3, 1.3].forEach(lx => { const leg = box(0.25, 0.8, 0.9, MAT.woodD); leg.position.set(lx, 0.4, 0); g.add(leg); });
  g.position.set(x, getGroundY(x, z), z); g.rotation.y = rot || 0; return g;
}

function buildSpawnArea(cx, cz) {
  const gy = getGroundY(cx, cz);

  // (The stone plaza, ring path and branches are terrain-conforming TOWN tiles
  //  generated server-side, so they sit flush with the ground — no falling in.)

  // ── Grand tiered fountain (center landmark) ─────────────────────────────────
  const g = new THREE.Group();
  const f = new THREE.Group();
  f.add(cyl(8, 9, 1.5, 32, MAT.fountain));
  const pool1 = cyl(7.2, 7.2, 0.7, 32, MAT.fwater); pool1.position.y = 0.9; f.add(pool1);
  const fcol = cyl(0.9, 1.2, 2.8, 16, MAT.fountain); fcol.position.y = 2.2; f.add(fcol);
  const fbowl = cyl(4, 0.7, 1, 24, MAT.fountain); fbowl.position.y = 3.6; f.add(fbowl);
  const pool2 = cyl(3.5, 3.5, 0.5, 24, MAT.fwater); pool2.position.y = 4.0; f.add(pool2);
  const fcol2 = cyl(0.5, 0.7, 2, 12, MAT.fountain); fcol2.position.y = 4.8; f.add(fcol2);
  const ftop = cyl(1.6, 0.5, 0.6, 20, MAT.fountain); ftop.position.y = 6.2; f.add(ftop);
  const fjet = sph(0.6, MAT.fwater); fjet.position.y = 7.0; f.add(fjet);
  const fbl = new THREE.PointLight(0x44bbff, 6, 24); fbl.position.set(0, 4, 0); f.add(fbl);
  f.position.y = 0.5; g.add(f);
  g.position.set(cx, gy, cz);
  scene.add(g);
  addObstacle(cx, cz, 9.5); // fountain base

  // ── Torii Gate — dramatic entrance to the north ──────────────────────────────
  {
    const t = new THREE.Group();
    const W = 14, H = 12;
    [-W/2, W/2].forEach(px => {
      const post = cyl(0.65, 0.75, H, 10, MAT.roof); post.position.set(px, H/2, 0); t.add(post);
    });
    const kasagi = box(W + 5, 1.1, 1.8, MAT.roofD); kasagi.position.set(0, H + 0.4, 0); t.add(kasagi);
    const nuki = box(W + 1.5, 0.75, 1.1, MAT.roof); nuki.position.set(0, H - 2, 0); t.add(nuki);
    [-1, 1].forEach(s => {
      const tip = cone(0.55, 1.8, 6, MAT.roofD); tip.position.set(s * (W/2 + 2.4), H + 1.1, 0); t.add(tip);
    });
    [-W/4, W/4].forEach(lx => {
      const lg = new THREE.Group(); lg.add(sph(0.45, MAT.candle));
      const ll = new THREE.PointLight(0xffaa44, 5, 18); lg.add(ll); lg.position.set(lx, H - 0.5, 0); t.add(lg);
    });
    t.position.set(cx, getGroundY(cx, cz - 36), cz - 36);
    scene.add(t);
    addObstacle(cx - W/2, cz - 36, 1.2); addObstacle(cx + W/2, cz - 36, 1.2); // torii posts
  }

  // ── Komainu guardian lions at the gate ──────────────────────────────────────
  [[cx - 10, cz - 36, -0.3], [cx + 10, cz - 36, 0.3]].forEach(([kx, kz, ry]) => {
    const k = new THREE.Group();
    const plinth = box(2.5, 1.1, 2.5, MAT.stoneL); plinth.position.y = 0.55; k.add(plinth);
    const body = box(1.7, 1.9, 2.4, MAT.stone); body.position.y = 2; k.add(body);
    const head = sph(0.95, MAT.stone); head.position.set(0, 3.15, 0.9); k.add(head);
    const mane = cyl(1.1, 0.85, 1.3, 10, MAT.stoneL); mane.position.set(0, 3.1, 0.2); k.add(mane);
    [-0.5, 0.5].forEach(ex => { const ear = cone(0.28, 0.55, 6, MAT.stoneL); ear.position.set(ex, 3.9, 0.6); k.add(ear); });
    k.position.set(kx, getGroundY(kx, kz), kz); k.rotation.y = ry;
    scene.add(k);
    addObstacle(kx, kz, 1.8);
  });

  // ── Eight fire braziers around the perimeter ────────────────────────────────
  spawnFireLights = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 35, bz = cz + Math.sin(a) * 35;   // on the ring path
    const bg = new THREE.Group();
    const stand = cyl(0.2, 0.32, 4, 6, MAT.iron); stand.position.y = 2; bg.add(stand);
    for (let j = 0; j < 3; j++) {
      const a2 = (j / 3) * Math.PI * 2;
      const leg = box(0.12, 1.5, 0.12, MAT.iron); leg.position.set(Math.cos(a2)*0.42, 0.75, Math.sin(a2)*0.42); leg.rotation.z = 0.18; bg.add(leg);
    }
    const fbowl2 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.32, 1.1, 10), MAT.iron); fbowl2.position.y = 4.3; bg.add(fbowl2);
    const fire = sph(0.58, MAT.ember); fire.position.y = 5.1; bg.add(fire);
    const fl = new THREE.PointLight(0xff5500, 12, 30); fl.position.set(0, 5.4, 0); bg.add(fl);
    bg.position.set(bx, getGroundY(bx, bz), bz);
    scene.add(bg);
    spawnFireLights.push({ fire, light: fl, base: 12 });
    addObstacle(bx, bz, 1.3);
  }

  // ── Dragon banners on tall poles (4 cardinal) ────────────────────────────────
  const dragonColors = [0xcc2200, 0x1144bb, 0x117733, 0x880099];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 44, bz = cz + Math.sin(a) * 44;
    const bg = new THREE.Group();
    const pole = cyl(0.2, 0.25, 11, 6, MAT.woodD); pole.position.y = 5.5; bg.add(pole);
    const cloth = box(4, 6, 0.17, new THREE.MeshStandardMaterial({ color: dragonColors[i], roughness: 0.9, emissive: dragonColors[i], emissiveIntensity: 0.15 }));
    cloth.position.set(2, 9.2, 0.2); bg.add(cloth);
    const fin2 = cone(0.25, 0.9, 6, MAT.gold); fin2.position.y = 11.4; bg.add(fin2);
    bg.position.set(bx, getGroundY(bx, bz), bz); bg.rotation.y = -a;
    scene.add(bg);
    addObstacle(bx, bz, 1.0);
  }

  // ── Prize wheel ─────────────────────────────────────────────────────────────
  const wheelPost = new THREE.Group();
  const post = cyl(0.18, 0.22, 4, 8, MAT.woodD); post.position.y = 2; wheelPost.add(post);
  const tilt = new THREE.Group(); tilt.position.y = 4; tilt.rotation.x = Math.PI / 2;
  const wheelMat = new THREE.MeshStandardMaterial({ map: makeWheelTexture(), roughness: 0.6, side: THREE.DoubleSide });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.25, 28), wheelMat);
  tilt.add(wheel); wheelPost.add(tilt);
  wheelPost.position.set(cx + 20, getGroundY(cx + 20, cz - 8), cz - 8);
  scene.add(wheelPost);
  spawnWheel = wheel;
  addObstacle(cx + 20, cz - 8, 1.0);

  // ── Lampposts line the ring path (alternating with braziers); benches inside ──
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const lx = cx + Math.cos(a) * 35, lz = cz + Math.sin(a) * 35;
    scene.add(lamppost(lx, lz)); addObstacle(lx, lz, 0.8);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = cx + Math.cos(a) * 20, bz = cz + Math.sin(a) * 20;
    scene.add(bench(bx, bz, -a + Math.PI / 2)); addObstacle(bx, bz, 1.6);
  }
}

// ─── Farm ─────────────────────────────────────────────────────────────────────
let farmCenter = null;
function buildFarm(cx, cz) {
  farmCenter = { x: cx, z: cz };
  const baseY = getGroundY(cx, cz);
  const cropMats = [std(0x6fbf3a, { roughness: 1 }), std(0xd9b53a, { roughness: 1 }), std(0x4ea82e, { roughness: 1 })];
  const FW = 56, FD = 44; // farm footprint

  // ── Tilled soil pad ─────────────────────────────────────────────────────────
  const soil = box(FW, 0.3, FD, std(0x6b4a2a, { roughness: 1 }));
  soil.position.set(cx, baseY + 0.16, cz); soil.receiveShadow = true; scene.add(soil);

  // ── Crop rows (raised furrows with little crop tufts) ────────────────────────
  const rows = new THREE.Group();
  for (let r = 0; r < 7; r++) {
    const rz = cz - FD / 2 + 6 + r * 5;
    const furrow = box(FW - 10, 0.35, 1.4, std(0x7a5530, { roughness: 1 }));
    furrow.position.set(cx, baseY + 0.35, rz); rows.add(furrow);
    const mat = cropMats[r % cropMats.length];
    for (let c = 0; c < 16; c++) {
      const crop = cone(0.45, 1.5, 5, mat);
      crop.position.set(cx - FW / 2 + 8 + c * 2.5, baseY + 1.1, rz);
      rows.add(crop);
    }
  }
  scene.add(rows);

  // ── Wooden perimeter fence ──────────────────────────────────────────────────
  const fenceMat = MAT.woodD;
  function fenceLine(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 3);
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = x0 + (x1 - x0) * t, pz = z0 + (z1 - z0) * t;
      const post = box(0.3, 1.6, 0.3, fenceMat); post.position.set(px, getGroundY(px, pz) + 0.8, pz); scene.add(post);
      addObstacle(px, pz, 0.7);
    }
    // two rails
    const mid = box(len, 0.18, 0.18, fenceMat);
    mid.position.set((x0 + x1) / 2, baseY + 1.2, (z0 + z1) / 2);
    mid.rotation.y = Math.atan2(z1 - z0, x1 - x0); scene.add(mid);
    const low = mid.clone(); low.position.y = baseY + 0.6; scene.add(low);
  }
  const hx = FW / 2, hz = FD / 2;
  fenceLine(cx - hx, cz - hz, cx + hx, cz - hz);
  fenceLine(cx - hx, cz + hz, cx - 6, cz + hz);            // gap for gate near +z
  fenceLine(cx + 6, cz + hz, cx + hx, cz + hz);
  fenceLine(cx - hx, cz - hz, cx - hx, cz + hz);
  fenceLine(cx + hx, cz - hz, cx + hx, cz + hz);

  // ── Barn (Kenney model if available, else procedural) ───────────────────────
  const barnX = cx - hx + 8, barnZ = cz - hz - 9;
  const barn = model('barn');
  if (barn) {
    const wrap = new THREE.Group(); wrap.add(barn);
    fitGround(barn, 18); wrap.position.set(barnX, getGroundY(barnX, barnZ), barnZ);
    wrap.rotation.y = Math.PI; scene.add(wrap);
  } else {
    const b = box(14, 8, 10, MAT.roof); b.position.set(barnX, baseY + 4, barnZ); scene.add(b);
    const roofB = pagodaRoof(9, 4, MAT.roofD); roofB.position.set(barnX, baseY + 10, barnZ); scene.add(roofB);
  }
  addObstacle(barnX, barnZ, 10);

  // ── Hay bales ───────────────────────────────────────────────────────────────
  [[cx + hx - 6, cz - hz - 6], [cx + hx - 10, cz - hz - 6], [cx + hx - 8, cz - hz - 9]].forEach(([hxx, hzz]) => {
    const bale = cyl(1.3, 1.3, 2.2, 12, std(0xd9b85a, { roughness: 1 }));
    bale.rotation.z = Math.PI / 2; bale.position.set(hxx, getGroundY(hxx, hzz) + 1.3, hzz); scene.add(bale);
    addObstacle(hxx, hzz, 1.6);
  });

  // ── Scarecrow ───────────────────────────────────────────────────────────────
  const sc = new THREE.Group();
  const sp = box(0.18, 4, 0.18, MAT.woodD); sp.position.y = 2; sc.add(sp);
  const arm = box(3, 0.18, 0.18, MAT.woodD); arm.position.y = 3; sc.add(arm);
  const sh = sph(0.5, std(0xd9c074, { roughness: 1 })); sh.position.y = 4.1; sc.add(sh);
  const hat = cone(0.7, 0.8, 8, MAT.roof); hat.position.y = 4.6; sc.add(hat);
  sc.position.set(cx, getGroundY(cx, cz) + 0.15, cz); scene.add(sc);
  addObstacle(cx, cz, 0.6);

  // ── Label ───────────────────────────────────────────────────────────────────
  const el = document.createElement('div'); el.className = 'building-label'; el.textContent = '🌾 Rice Farm';
  const lbl = new CSS2DObject(el); lbl.position.set(cx, baseY + 11, cz - hz - 9); scene.add(lbl);
}

// ─── NPCs ─────────────────────────────────────────────────────────────────────
let npcs = [], nearNPC = null, activeNPC = null, npcLineIdx = 0;
function npcDefs(cx, cz) {
  return [
    { id: 'npc_hiro', name: 'Old Hiro', tag: 'Elder', color: '#8fd0ff', x: cx + 30, z: cz + 24,
      lines: ['Welcome to the realm, young warrior.', 'These lands have weathered a thousand battles.', 'Claim territory and your clan shall flourish.'] },
    { id: 'npc_aiko', name: 'Merchant Aiko', tag: 'Merchant', color: '#ffd24a', x: cx - 32, z: cz + 22,
      lines: ['Fresh apples, picked this very morning!', 'A hungry samurai is a slow samurai.'],
      shop: { item: '🍎 Apple', cost: { gold: 3 }, give: { rice: 5 }, pitch: 'Buy a crisp apple for 3 gold? (+5 rice)' } },
    { id: 'npc_goro', name: 'Coin Trader Goro', tag: 'Trader', color: '#e8a33a', x: cx + 34, z: cz - 26,
      lines: ['Turn your harvest into shining gold!', 'Rice feeds men — gold builds empires.'],
      shop: { item: '🪙 Gold Coins', cost: { rice: 8 }, give: { gold: 12 }, pitch: 'Trade 8 rice for 12 gold coins?' } },
    { id: 'npc_yuki', name: 'Samurai Yuki', tag: 'Warrior', color: '#ff8585', x: cx - 28, z: cz - 30,
      lines: ['Train hard. The weak do not survive here.', 'The barracks will sharpen your soldiers.', 'Honor before all. Strike true.'] },
    { id: 'npc_mei', name: 'Farmer Mei', tag: 'Farmer', color: '#9be86a', x: cx - 150, z: cz + 132,
      lines: ['The rice grows golden this season.', 'Hard work feeds the whole realm.'],
      shop: { item: '🍎 Apple Basket', cost: { gold: 5 }, give: { rice: 10 }, pitch: 'A whole basket of apples for 5 gold? (+10 rice)' } },
  ];
}
function buildNPCs(cx, cz) {
  npcs = [];
  npcDefs(cx, cz).forEach(def => {
    const mesh = createCharacter(def.color, false, def.id);
    mesh.position.set(def.x, getGroundY(def.x, def.z), def.z);
    mesh.rotation.y = Math.atan2(cx - def.x, cz - def.z); // face the plaza
    scene.add(mesh);
    // Nametag
    const el = document.createElement('div');
    el.className = 'npc-label';
    el.innerHTML = `<span class="npc-badge">${def.shop ? '🛒 ' : ''}NPC</span><span class="npc-name">${esc(def.name)}</span>`;
    const lbl = new CSS2DObject(el); lbl.position.set(0, 4.4, 0); mesh.add(lbl);
    // Floating attention marker
    const mk = sph(0.22, def.shop ? MAT.gold : MAT.candle); mk.position.set(0, 5.1, 0); mesh.add(mk);
    addObstacle(def.x, def.z, 1.3);
    npcs.push({ def, mesh, marker: mk });
  });
}

// ─── Territory overlays ───────────────────────────────────────────────────────
function getTerrColor(t) {
  if (t.clanId && clans[t.clanId]) return new THREE.Color(clans[t.clanId].color);
  const o = players[t.ownerId];
  return o ? new THREE.Color(o.color) : new THREE.Color(0x888888);
}
function buildTerritoryOverlays() {
  Object.values(terrMeshes).forEach(m => scene.remove(m));
  terrMeshes = {};
  Object.values(territories).forEach(t => {
    if (!t.ownerId) return;
    const size = 8 * TILE_W;
    const geo = new THREE.PlaneGeometry(size - 0.5, size - 0.5); geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: getTerrColor(t), transparent: true, opacity: 0.2, depthWrite: false }));
    const cx = (t.tileX + 4) * TILE_W, cz = (t.tileY + 4) * TILE_W;
    mesh.position.set(cx, getGroundY(cx, cz) + 0.12, cz);
    scene.add(mesh); terrMeshes[t.id] = mesh;
  });
}

// ─── Characters ───────────────────────────────────────────────────────────────
// Fully articulated villager: limbs pivot from hip/shoulder, with hands, feet/
// shoes and a face. Walk cycle swings the limbs + bobs the body. Skin/hair/hat
// vary by seed so everyone looks like a different person.
const SKIN_TONES = [0xf5cba7, 0xe8b08a, 0xd9a066, 0xc68642, 0x8d5524, 0xffe0bd];
const HAIR_COLORS = [0x1a0a00, 0x3b2412, 0x6b4423, 0x111111, 0x4a4a4a, 0x7a2b1a];
const PANTS_COLORS = [0x2c3e50, 0x3a2f22, 0x1f3a2f, 0x402030, 0x23303f, 0x4a3a1a];
// Wardrobe options the player can choose on the Character page.
const CUSTOM = {
  outfit: [0xc0392b, 0x2e86c1, 0x27ae60, 0x8e44ad, 0xe67e22, 0x34495e, 0xe84393, 0x16a085, 0x2c3e50, 0xecf0f1, 0xf1c40f, 0x111111],
  pants:  [0x2c3e50, 0x3a2f22, 0x1f3a2f, 0x402030, 0x23303f, 0x4a3a1a, 0x111111, 0x6b4423],
  shoe:   [0x3a2415, 0x111111, 0x6b4423, 0x8b1a1a, 0x2c3e50, 0xe8e8e8],
  hat:    ['None', 'Straw Hat', 'Samurai Helmet', 'Topknot'],
  hair:   HAIR_COLORS.slice(),
  skin:   SKIN_TONES.slice(),
};
window.DAIMYO_CUSTOM = CUSTOM;

function limbPivot(x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); return p; }

// `custom` (optional) = { outfit, pants, shoe, hat, hair, skin } indices into CUSTOM.
function createCharacter(color, isMe, seed, custom) {
  // Articulated procedural villager (the original character model).
  const s = seed || color || Math.random();
  custom = custom || {};
  const pick = (key, dfltHex) => custom[key] != null && CUSTOM[key][custom[key]] != null ? CUSTOM[key][custom[key]] : dfltHex;
  const outfitHex = custom.outfit != null && CUSTOM.outfit[custom.outfit] != null ? CUSTOM.outfit[custom.outfit] : (color || '#e74c3c');
  const col = new THREE.Color(outfitHex);
  const body  = std(col, { roughness: 0.7 });
  const sleeve = std(col.clone().multiplyScalar(0.7), { roughness: 0.7 });
  const skin  = std(pick('skin', SKIN_TONES[Math.floor(seedRand(s, 2) * SKIN_TONES.length)]), { roughness: 0.85 });
  const pants = std(pick('pants', PANTS_COLORS[Math.floor(seedRand(s, 4) * PANTS_COLORS.length)]), { roughness: 0.85 });
  const hairC = pick('hair', HAIR_COLORS[Math.floor(seedRand(s, 6) * HAIR_COLORS.length)]);
  const hair  = std(hairC, { roughness: 0.95 });
  const shoe  = std(pick('shoe', 0x3a2415), { roughness: 0.9 });
  // Hat: explicit choice, else a seeded default (0 None,1 Straw,2 Samurai,3 Topknot).
  const hatIdx = custom.hat != null ? custom.hat : [1, 2, 3, 0][Math.floor(seedRand(s, 8) * 4)];

  const g = new THREE.Group();
  // Soft contact shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; g.add(sh);

  // Everything that bobs while walking lives under `frame`
  const frame = new THREE.Group(); g.add(frame);

  // ── Legs (pivot at hip ~y1.55, hang down to feet) ──
  const lHip = limbPivot(-0.26, 1.55, 0), rHip = limbPivot(0.26, 1.55, 0);
  [lHip, rHip].forEach(hip => {
    const thigh = box(0.42, 1.5, 0.46, pants); thigh.position.y = -0.72; hip.add(thigh);
    const foot = box(0.5, 0.32, 0.78, shoe); foot.position.set(0, -1.55, 0.16); hip.add(foot);
    frame.add(hip);
  });

  // ── Torso ──
  const torso = box(1.04, 1.45, 0.6, body); torso.position.y = 2.35; frame.add(torso);
  const belt = box(1.08, 0.22, 0.64, std(0x2a1c10, { roughness: 0.9 })); belt.position.y = 1.6; frame.add(belt);
  const collar = box(1.06, 0.25, 0.62, sleeve); collar.position.y = 3.0; frame.add(collar);

  // ── Arms (pivot at shoulder ~y2.95, hang down; hand at the end) ──
  const lSho = limbPivot(-0.64, 2.9, 0), rSho = limbPivot(0.64, 2.9, 0);
  [[lSho, false], [rSho, true]].forEach(([sho, right]) => {
    const upper = box(0.34, 1.15, 0.36, sleeve); upper.position.y = -0.5; sho.add(upper);
    const hand = box(0.32, 0.32, 0.36, skin); hand.position.y = -1.18; sho.add(hand);
    frame.add(sho);
  });

  // ── Head + face ──
  const head = box(0.92, 0.9, 0.9, skin); head.position.y = 3.62; frame.add(head);
  const eyeMat = std(0x201712, { roughness: 0.5 });
  const fz = 0.46;
  [-0.2, 0.2].forEach(ex => { const eye = box(0.12, 0.17, 0.06, eyeMat); eye.position.set(ex, 3.66, fz); frame.add(eye); });
  const mouth = box(0.24, 0.07, 0.05, eyeMat); mouth.position.set(0, 3.36, fz); frame.add(mouth);
  const cheekMat = std(0xff9aa0, { roughness: 0.85 });
  [-0.34, 0.34].forEach(cxp => { const ch = box(0.14, 0.11, 0.05, cheekMat); ch.position.set(cxp, 3.42, fz - 0.02); frame.add(ch); });
  // Hair cap
  const hairCap = box(0.98, 0.34, 0.98, hair); hairCap.position.y = 4.12; frame.add(hairCap);
  [-0.46, 0.46].forEach(hx => { const side = box(0.08, 0.5, 0.9, hair); side.position.set(hx, 3.72, 0); frame.add(side); });

  // ── Headgear (0 None, 1 Straw Hat, 2 Samurai Helmet, 3 Topknot) ──
  if (hatIdx === 1) { // straw farmer hat
    const brim = cyl(1.5, 1.5, 0.08, 12, std(0xcBae5e, { roughness: 1 })); brim.position.y = 4.3; frame.add(brim);
    const cap = cone(0.7, 0.7, 12, std(0xc7a84e, { roughness: 1 })); cap.position.y = 4.7; frame.add(cap);
  } else if (hatIdx === 2) { // samurai helmet
    const helm = box(1.04, 0.42, 1.04, std(0x2a2a30, { roughness: 0.5, metalness: 0.4 })); helm.position.y = 4.2; frame.add(helm);
    const crest = box(0.12, 0.5, 0.5, MAT.gold); crest.position.set(0, 4.6, -0.1); frame.add(crest);
  } else if (hatIdx === 3) { // topknot
    const knot = sph(0.2, hair); knot.position.y = 4.4; frame.add(knot);
  }
  // Some carry a sword on the back
  if (seedRand(s, 9) > 0.5) {
    const sheath = box(0.12, 1.6, 0.16, std(0x111111, { roughness: 0.6 })); sheath.position.set(-0.3, 2.4, -0.42); sheath.rotation.z = 0.35; frame.add(sheath);
    const hilt = box(0.1, 0.4, 0.12, MAT.gold); hilt.position.set(-0.62, 3.2, -0.42); hilt.rotation.z = 0.35; frame.add(hilt);
  }

  g.userData.parts = { lHip, rHip, lSho, rSho, frame, head, baseY: 0 };
  return g;
}
function spawnOrUpdatePlayer(p) {
  const customKey = JSON.stringify(p.custom || null);
  // Rebuild the mesh if the player changed their outfit.
  if (playerMeshes[p.id] && playerMeshes[p.id].userData.customKey !== customKey) {
    scene.remove(playerMeshes[p.id]);
    delete playerMeshes[p.id]; delete playerLabels[p.id]; delete chatLabels[p.id];
  }
  if (!playerMeshes[p.id]) {
    const mesh = createCharacter(p.color, p.id === myId, p.id, p.custom);
    mesh.userData.customKey = customKey;
    scene.add(mesh); playerMeshes[p.id] = mesh;
    const el = document.createElement('div'); el.className = 'player-label' + (p.id === myId ? ' mine' : '');
    el.innerHTML = `<span class="pl-lvl"></span><span class="pl-name"></span>`;
    const lbl = new CSS2DObject(el); lbl.position.set(0, 4.6, 0); mesh.add(lbl); playerLabels[p.id] = el;
    const cel = document.createElement('div'); cel.className = 'chat-bubble'; cel.style.display = 'none';
    const clbl = new CSS2DObject(cel); clbl.position.set(0, 5.6, 0); mesh.add(clbl); chatLabels[p.id] = cel;
  }
  const lblEl = playerLabels[p.id];
  lblEl.querySelector('.pl-lvl').textContent = `Lv ${p.level ?? 1}`;
  lblEl.querySelector('.pl-name').textContent = p.name || 'Warrior';
  playerMeshes[p.id].position.set(p.x, getGroundY(p.x, p.y), p.y);
}
function animateChar(mesh, moving) {
  const pa = mesh?.userData?.parts; if (!pa || !pa.lHip) return;
  if (applyEmote(mesh)) return; // procedural emote overrides normal pose briefly
  if (moving) {
    const t = performance.now() * 0.012;
    const sw = Math.sin(t);
    pa.lHip.rotation.x = sw * 0.7;  pa.rHip.rotation.x = -sw * 0.7;   // legs swing from hip
    pa.lSho.rotation.x = -sw * 0.6; pa.rSho.rotation.x = sw * 0.6;    // arms counter-swing
    pa.frame.position.y = Math.abs(Math.sin(t)) * 0.16;              // step bob
    pa.frame.rotation.z = sw * 0.03;                                  // slight sway
  } else {
    // Ease limbs back to rest + a gentle breathing idle
    ['lHip', 'rHip', 'lSho', 'rSho'].forEach(k => pa[k].rotation.x *= 0.82);
    pa.frame.position.y *= 0.82;
    pa.frame.rotation.z *= 0.82;
    const b = Math.sin(performance.now() * 0.002) * 0.02;
    pa.frame.position.y += b * 0.4;
  }
}

// ─── INTERIORS (ultra-detailed) ───────────────────────────────────────────────
function lantern(x, y, z, color = 0xffaa44, intensity = 5) {
  const g = new THREE.Group();
  g.add(sph(0.3, MAT.candle));
  const l = new THREE.PointLight(color, intensity, 22); g.add(l);
  g.position.set(x, y, z); return g;
}
function roomShell(w, d, h, floorMat, wallMat) {
  const g = new THREE.Group();
  const floor = box(w, 0.4, d, floorMat); floor.position.y = -0.2; g.add(floor);
  // No ceiling — the camera looks into the room from above-inside.
  const back = box(w, h, 0.4, wallMat); back.position.set(0, h / 2, -d / 2); g.add(back);
  const left = box(0.4, h, d, wallMat); left.position.set(-w / 2, h / 2, 0); g.add(left);
  const right = box(0.4, h, d, wallMat); right.position.set(w / 2, h / 2, 0); g.add(right);
  // Front wall with door gap (two segments)
  const fSeg = (w - 4) / 2;
  const fl = box(fSeg, h, 0.4, wallMat); fl.position.set(-(2 + fSeg / 2), h / 2, d / 2); g.add(fl);
  const fr = box(fSeg, h, 0.4, wallMat); fr.position.set(2 + fSeg / 2, h / 2, d / 2); g.add(fr);
  const lintel = box(4.4, h - 4, 0.4, wallMat); lintel.position.set(0, h - (h - 4) / 2, d / 2); g.add(lintel);
  return g;
}
function table(x, z, w = 3, d = 1.6) {
  const g = new THREE.Group();
  const top = box(w, 0.2, d, MAT.woodL); top.position.y = 1.1; g.add(top);
  [[-w / 2 + 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3], [-w / 2 + 0.3, d / 2 - 0.3], [w / 2 - 0.3, d / 2 - 0.3]]
    .forEach(([lx, lz]) => { const leg = box(0.2, 1.1, 0.2, MAT.woodD); leg.position.set(lx, 0.55, lz); g.add(leg); });
  g.position.set(x, 0, z); return g;
}
function stool(x, z) {
  const g = new THREE.Group();
  const s = cyl(0.4, 0.4, 0.2, 10, MAT.wood); s.position.y = 0.8; g.add(s);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const leg = box(0.12, 0.8, 0.12, MAT.woodD); leg.position.set(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3); g.add(leg); }
  g.position.set(x, 0, z); return g;
}
function rug(x, z, w, d, mat) { const m = box(w, 0.06, d, mat); m.position.set(x, 0.05, z); return m; }

// Sprinkle CC0 props into interiors for that "ultra-detailed" look.
function decorateInterior(g, type, w, d) {
  const L = -w / 2, R = w / 2, B = -d / 2;
  switch (type) {
    case 'inn':
      addProp(g, 'barrel', L + 2, B + 2, 1.7); addProp(g, 'barrel', L + 3.6, B + 2, 1.7);
      addProp(g, 'bottle', -1, B + 2.6, 0.9); addProp(g, 'bottle', 1, B + 2.6, 0.9);
      addProp(g, 'chest', R - 2, B + 2.5, 1.3, Math.PI); addProp(g, 'plant', L + 2, d / 2 - 3, 1.8);
      addProp(g, 'pot', R - 2.5, 4, 1.1);
      break;
    case 'blacksmith':
      addProp(g, 'barrel', 3, 1, 1.7); addProp(g, 'chest', R - 2, B + 2.5, 1.3, Math.PI);
      addProp(g, 'sword', -1, 1.6, 1.6, Math.PI / 2); addProp(g, 'pot', R - 3, 3, 1.1);
      break;
    case 'temple':
      addProp(g, 'pot', -3, 2, 1.3); addProp(g, 'pot', 3, 2, 1.3);
      addProp(g, 'present', 0, B + 4, 1); addProp(g, 'plant', L + 2.5, d / 2 - 3, 2);
      addProp(g, 'plant', R - 2.5, d / 2 - 3, 2);
      break;
    case 'barracks':
      addProp(g, 'chest', -8, 4, 1.3); addProp(g, 'chest', 8, 4, 1.3, Math.PI);
      addProp(g, 'barrel', 0, B + 2, 1.7); addProp(g, 'sword', -2, 4, 1.5, Math.PI / 2);
      break;
    case 'townhall':
      addProp(g, 'plant', L + 2.5, d / 2 - 3, 2.2); addProp(g, 'plant', R - 2.5, d / 2 - 3, 2.2);
      addProp(g, 'chest', R - 3, B + 3, 1.4, Math.PI); addProp(g, 'present', -2, B + 4, 1);
      break;
    default: // manor / house
      addProp(g, 'chest', L + 2, B + 2.5, 1.3); addProp(g, 'pot', L + 2, 4, 1.1);
      addProp(g, 'plant', R - 2.5, d / 2 - 3, 1.8); addProp(g, 'barrel', L + 3.6, B + 2.5, 1.6);
      break;
  }
}

function buildInterior(type) {
  const g = new THREE.Group();
  let w = 22, d = 18, h = 9, spawnZ;
  switch (type) {
    case 'inn': {
      g.add(roomShell(w, d, h, MAT.woodL, MAT.cream));
      g.add(rug(0, 0, 8, 6, MAT.fabric));
      // Bar counter
      const bar = box(10, 1.3, 1.6, MAT.woodD); bar.position.set(0, 0.65, -d / 2 + 2.5); g.add(bar);
      const shelf = box(10, 3, 0.4, MAT.wood); shelf.position.set(0, 4, -d / 2 + 0.6); g.add(shelf);
      for (let i = -4; i <= 4; i += 1.2) { const bot = cyl(0.18, 0.18, 0.7, 6, MAT.glass); bot.position.set(i, 4.6, -d / 2 + 0.8); g.add(bot); }
      [-3, 0, 3].forEach(x => g.add(stool(x, -d / 2 + 4)));
      // Tables
      [[-6, 3], [6, 3], [-6, -3], [6, -3]].forEach(([x, z]) => { g.add(table(x, z)); g.add(stool(x - 1.6, z)); g.add(stool(x + 1.6, z)); });
      // Fireplace
      const fp = box(4, 4, 1, MAT.stone); fp.position.set(w / 2 - 1, 2, -4); g.add(fp);
      const fire = box(2, 1, 0.6, MAT.ember); fire.position.set(w / 2 - 1, 1, -3.6); g.add(fire);
      const fl = new THREE.PointLight(0xff6a22, 9, 20); fl.position.set(w / 2 - 2, 2, -3); g.add(fl);
      g.add(lantern(-6, 6.5, 3), lantern(6, 6.5, -3), lantern(0, 6.5, 0, 0xffcc66, 4));
      spawnZ = 2; break;
    }
    case 'blacksmith': {
      g.add(roomShell(w, d, h, MAT.stone, MAT.gray));
      // Forge
      const forge = box(4, 2.5, 3, MAT.stone); forge.position.set(-6, 1.25, -d / 2 + 3); g.add(forge);
      const coals = box(2.5, 0.6, 2, MAT.ember); coals.position.set(-6, 2.6, -d / 2 + 3); g.add(coals);
      const fl = new THREE.PointLight(0xff5200, 11, 24); fl.position.set(-6, 3.5, -d / 2 + 4); g.add(fl);
      const hood = cone(2.5, 3, 4, MAT.iron); hood.position.set(-6, 5.5, -d / 2 + 3); g.add(hood);
      // Anvil
      const an = box(1.6, 0.8, 0.9, MAT.iron); an.position.set(-1, 1, 0); g.add(an);
      const anBase = box(0.9, 1, 0.9, MAT.woodD); anBase.position.set(-1, 0.5, 0); g.add(anBase);
      // Water trough
      const tr = box(3, 0.9, 1.4, MAT.wood); tr.position.set(3, 0.45, 1); g.add(tr);
      const wt = box(2.7, 0.2, 1.2, MAT.fwater); wt.position.set(3, 0.85, 1); g.add(wt);
      // Weapon rack on wall
      const rack = box(8, 0.3, 0.3, MAT.woodD); rack.position.set(4, 5, -d / 2 + 0.5); g.add(rack);
      for (let i = 0; i < 6; i++) { const bl = box(0.08, 2.4, 0.08, MAT.steel); bl.position.set(1 + i * 1, 3.8, -d / 2 + 0.6); g.add(bl); const gu = box(0.4, 0.1, 0.12, MAT.gold); gu.position.set(1 + i * 1, 4.9, -d / 2 + 0.6); g.add(gu); }
      // Workbench
      g.add(table(6, 4, 4, 1.4));
      g.add(lantern(5, 6.5, 4), lantern(-2, 6.5, -2, 0xffcc66, 4));
      spawnZ = 2; break;
    }
    case 'temple': {
      w = 20; d = 22; h = 12;
      g.add(roomShell(w, d, h, MAT.stoneL, MAT.white));
      g.add(rug(0, 0, 6, 14, MAT.fabric));
      // Pillars
      [-6, 6].forEach(x => [-7, 0, 7].forEach(z => { const c = cyl(0.6, 0.7, h, 12, MAT.white); c.position.set(x, h / 2, z); g.add(c); }));
      // Altar
      const altar = box(6, 1.6, 2.5, MAT.gold); altar.position.set(0, 0.8, -d / 2 + 3); g.add(altar);
      // Golden statue (seated)
      const sBase = cyl(2, 2.4, 1, 12, MAT.stoneL); sBase.position.set(0, 0.5, -d / 2 + 6); g.add(sBase);
      const sBody = box(2.4, 3, 1.6, MAT.gold); sBody.position.set(0, 2.5, -d / 2 + 6); g.add(sBody);
      const sHead = sph(1, MAT.gold); sHead.position.set(0, 4.6, -d / 2 + 6); g.add(sHead);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 24), MAT.gold); halo.position.set(0, 4.6, -d / 2 + 5.4); g.add(halo);
      const gl = new THREE.PointLight(0xffd24a, 7, 26); gl.position.set(0, 4, -d / 2 + 8); g.add(gl);
      // Candles down the aisle
      for (let z = -6; z <= 6; z += 3) { [-3, 3].forEach(x => {
        const cdl = cyl(0.12, 0.14, 0.8, 6, MAT.white); cdl.position.set(x, 0.4, z); g.add(cdl);
        const fl = sph(0.12, MAT.candle); fl.position.set(x, 0.9, z); g.add(fl);
        const pl = new THREE.PointLight(0xffbb55, 2.2, 9); pl.position.set(x, 1.1, z); g.add(pl);
      }); }
      // Cushions
      [-2, 2].forEach(x => [2, 5].forEach(z => { const cu = box(1.2, 0.3, 1.2, MAT.fabricB); cu.position.set(x, 0.2, z); g.add(cu); }));
      spawnZ = 2; break;
    }
    case 'barracks': {
      w = 24; d = 16; h = 9;
      g.add(roomShell(w, d, h, MAT.wood, MAT.gray));
      // Bunks along walls
      [-1, 1].forEach(side => { for (let i = 0; i < 4; i++) {
        const z = -d / 2 + 3 + i * 3;
        const x = side * (w / 2 - 2);
        const frame = box(3, 0.4, 2, MAT.woodD); frame.position.set(x, 0.8, z); g.add(frame);
        const mat = box(2.8, 0.3, 1.8, MAT.fabricB); mat.position.set(x, 1.05, z); g.add(mat);
        const pil = box(0.8, 0.3, 1.6, MAT.white); pil.position.set(x - side * 1, 1.2, z); g.add(pil);
      } });
      // Central weapon rack & armor stands
      for (let i = 0; i < 5; i++) { const sp = box(0.1, 3.5, 0.1, MAT.woodD); sp.position.set(-4 + i * 2, 1.75, 0); g.add(sp);
        const bl = box(0.08, 2, 0.08, MAT.steel); bl.position.set(-4 + i * 2, 2.5, 0.2); g.add(bl); }
      // Map table
      g.add(table(0, 4, 4, 2.4));
      const mapp = box(3.6, 0.05, 2, MAT.cream); mapp.position.set(0, 1.22, 4); g.add(mapp);
      // Banners
      [-w / 2 + 0.5, w / 2 - 0.5].forEach(x => { const ban = box(0.1, 4, 1.6, MAT.fabric); ban.position.set(x, 6, -d / 2 + 4); g.add(ban); });
      g.add(lantern(-5, 6.5, 0), lantern(5, 6.5, 0));
      spawnZ = 2; break;
    }
    case 'townhall': {
      w = 24; d = 20; h = 12;
      g.add(roomShell(w, d, h, MAT.stoneL, MAT.cream));
      g.add(rug(0, 0, 5, 16, MAT.fabric));
      // Dais + throne
      const dais = box(8, 1.2, 5, MAT.woodD); dais.position.set(0, 0.6, -d / 2 + 3); g.add(dais);
      const throne = box(3, 4, 2, MAT.gold); throne.position.set(0, 3.2, -d / 2 + 2.5); g.add(throne);
      const seat = box(2.6, 0.4, 1.6, MAT.fabric); seat.position.set(0, 1.6, -d / 2 + 3); g.add(seat);
      // Columns
      [-7, 7].forEach(x => [-6, 0, 6].forEach(z => { const c = cyl(0.55, 0.6, h, 12, MAT.white); c.position.set(x, h / 2, z); g.add(c); }));
      // Long council table
      g.add(table(0, 3, 8, 2.4));
      for (let x = -3; x <= 3; x += 2) { g.add(stool(x, 1.6)); g.add(stool(x, 4.4)); }
      // Hanging banners
      [-7, 0, 7].forEach(x => { const ban = box(0.1, 5, 2, MAT.fabric); ban.position.set(x, 7, -d / 2 + 0.6); g.add(ban); });
      // Chandelier
      const ch = new THREE.Group();
      ch.add(new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 20), MAT.gold));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const fl = sph(0.18, MAT.candle); fl.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6); ch.add(fl); }
      ch.position.set(0, h - 2, 1); ch.rotation.x = Math.PI / 2; g.add(ch);
      const cl = new THREE.PointLight(0xffcc66, 8, 30); cl.position.set(0, h - 2.5, 1); g.add(cl);
      spawnZ = 2; break;
    }
    default: { // manor / house
      g.add(roomShell(w, d, h, MAT.woodL, MAT.cream));
      g.add(rug(-4, 2, 6, 5, MAT.fabricB));
      // Bed
      const bed = box(4, 0.8, 6, MAT.woodD); bed.position.set(w / 2 - 3, 0.6, -3); g.add(bed);
      const mat = box(3.6, 0.4, 5.6, MAT.white); mat.position.set(w / 2 - 3, 1.1, -3); g.add(mat);
      const blank = box(3.6, 0.3, 3, MAT.fabric); blank.position.set(w / 2 - 3, 1.3, -1); g.add(blank);
      const pil = box(3.2, 0.4, 1.2, MAT.white); pil.position.set(w / 2 - 3, 1.3, -5); g.add(pil);
      // Hearth
      const fp = box(3.5, 3.5, 1, MAT.stone); fp.position.set(-w / 2 + 1, 1.75, -3); g.add(fp);
      const fire = box(1.8, 0.9, 0.6, MAT.ember); fire.position.set(-w / 2 + 1, 0.9, -2.6); g.add(fire);
      const fl = new THREE.PointLight(0xff6a22, 8, 18); fl.position.set(-w / 2 + 2, 2, -2); g.add(fl);
      // Dining set
      g.add(table(-3, 3, 3, 1.6)); g.add(stool(-4.6, 3)); g.add(stool(-1.4, 3));
      // Shelf
      const shelf = box(0.4, 4, 5, MAT.wood); shelf.position.set(-w / 2 + 0.5, 2.5, 4); g.add(shelf);
      g.add(lantern(0, 6.5, 0, 0xffcc66, 5));
      spawnZ = 2; break;
    }
  }
  decorateInterior(g, type, w, d);

  // Exit door + glow
  const door = box(3.6, 4, 0.3, MAT.door); door.position.set(0, 2, d / 2 - 0.1); g.add(door);
  const exitGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.0 }));
  exitGlow.position.set(0, 2, d / 2 - 0.25); g.add(exitGlow);
  return { group: g, spawn: { x: 0, z: spawnZ }, exit: { z: d / 2 }, bounds: { w: w / 2 - 1.5, d: d / 2 - 1.5 } };
}

// ─── Building tasks ───────────────────────────────────────────────────────────
const BUILDING_TASKS = {
  inn:        [{ label: 'Serve Drinks',    desc: 'Bring sake to the patrons',       dur: 3000, reward: { gold: 15 } },
               { label: 'Brew Sake',       desc: 'Prepare the finest rice wine',    dur: 5000, reward: { gold: 28 } },
               { label: 'Clean Tables',    desc: 'Clear up after the last battle',  dur: 2000, reward: { gold: 8  } }],
  blacksmith: [{ label: 'Forge a Blade',   desc: 'Work iron at the forge',          dur: 5000, reward: { gold: 32 } },
               { label: 'Sharpen Swords',  desc: 'Hone a warrior\'s edge',          dur: 3000, reward: { gold: 16 } },
               { label: 'Craft Armor',     desc: 'Hammer steel into plate',         dur: 6000, reward: { gold: 45 } }],
  temple:     [{ label: 'Meditate',        desc: 'Seek inner clarity and strength', dur: 4000, reward: { gold: 5,  soldiers: 5  } },
               { label: 'Offer Incense',   desc: 'Honor the ancestors',             dur: 2000, reward: { gold: 10 } },
               { label: 'Bless Warriors',  desc: 'Invoke divine favor',             dur: 5500, reward: { soldiers: 12 } }],
  barracks:   [{ label: 'Train Recruits',  desc: 'Drill new warriors to readiness', dur: 5000, reward: { soldiers: 8  } },
               { label: 'Battle Drills',   desc: 'Run tactical combat exercises',   dur: 6000, reward: { soldiers: 15 } },
               { label: 'Weapons Check',   desc: 'Inspect and maintain armory',     dur: 3000, reward: { gold: 10, soldiers: 3 } }],
  townhall:   [{ label: 'Collect Taxes',   desc: 'Gather the realm\'s tribute',     dur: 4000, reward: { gold: 50 } },
               { label: 'Sign Decree',     desc: 'Formalize land rights',           dur: 2500, reward: { gold: 22 } },
               { label: 'Recruit Spies',   desc: 'Build an intelligence network',   dur: 6000, reward: { gold: 38, soldiers: 5 } }],
  manor:      [{ label: 'Rest & Recover',  desc: 'Regain strength for battle',      dur: 3000, reward: { gold: 5,  soldiers: 3 } },
               { label: 'Study Maps',      desc: 'Plan the next conquest',          dur: 4000, reward: { gold: 22 } }],
};
BUILDING_TASKS.house = BUILDING_TASKS.manor;

let activeTask = null, taskTimerStart = 0;

function rewardFmt(r) {
  const parts = [];
  if (r.gold) parts.push(`+${r.gold} Gold`);
  if (r.soldiers) parts.push(`+${r.soldiers} Soldiers`);
  if (r.rice) parts.push(`+${r.rice} Rice`);
  return parts.join('  ');
}

function buildTaskPanel(type) {
  const tasks = BUILDING_TASKS[type] || BUILDING_TASKS.manor;
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  tasks.forEach((task, i) => {
    const el = document.createElement('div');
    el.className = 'task-item'; el.dataset.idx = i;
    el.innerHTML = `<div class="task-item-title">${task.label}</div>
      <div class="task-item-desc">${task.desc}</div>
      <div class="task-reward">${rewardFmt(task.reward)}</div>
      <div class="task-progress-bar"><div class="task-progress-fill" id="task-fill-${i}"></div></div>`;
    el.addEventListener('click', () => startTask(task, i, tasks));
    list.appendChild(el);
  });
}

function startTask(task, idx, tasks) {
  if (activeTask) return;
  activeTask = { task, idx };
  taskTimerStart = performance.now();
  const el = document.querySelector(`.task-item[data-idx="${idx}"]`);
  if (el) el.classList.add('task-active');
  // Animate progress bar
  const fill = document.getElementById(`task-fill-${idx}`);
  if (fill) {
    fill.style.transition = `width ${task.dur}ms linear`;
    requestAnimationFrame(() => { fill.style.width = '100%'; });
  }
  setTimeout(() => completeTask(task, idx), task.dur);
}

function completeTask(task, idx) {
  if (!activeTask || activeTask.idx !== idx) return;
  activeTask = null;
  const r = task.reward;
  if (myPlayer) {
    if (r.gold)     myPlayer.gold     = (myPlayer.gold     || 0) + r.gold;
    if (r.soldiers) myPlayer.soldiers = (myPlayer.soldiers || 0) + r.soldiers;
    if (r.rice)     myPlayer.rice     = (myPlayer.rice     || 0) + r.rice;
    updateHUD();
  }
  if (socket) socket.emit('taskReward', { gold: r.gold || 0, soldiers: r.soldiers || 0, rice: r.rice || 0 });
  notify(`${task.label} complete! ${rewardFmt(r)}`, '#ffd700');
  const el = document.querySelector(`.task-item[data-idx="${idx}"]`);
  if (el) { el.classList.remove('task-active'); el.classList.add('task-done'); }
}

window.closeTaskPanel = () => { document.getElementById('task-panel').style.display = 'none'; };

// ─── Enter / Exit buildings (with transition) ─────────────────────────────────
async function enterBuilding(b) {
  if (transitioning) return;
  transitioning = true;
  await fadeOut();

  const built = buildInterior(b.userData.type);
  if (interiorGroup) interiorScene.remove(interiorGroup);
  interiorGroup = built.group;
  interiorMeta = built;
  interiorScene.add(interiorGroup);

  if (!interiorPlayerMesh) { interiorPlayerMesh = createCharacter(myPlayer.color, true, myId); interiorScene.add(interiorPlayerMesh); }
  else { interiorPlayerMesh.visible = true; }
  interiorPos.set(built.spawn.x, 0, built.spawn.z);
  interiorYaw = 0; // face toward the camera / front door
  interiorPlayerMesh.position.copy(interiorPos);
  interiorPlayerMesh.rotation.y = interiorYaw;

  insideBuilding = b;
  camDist = CAM_IN.dist; camHeight = CAM_IN.height; camYaw = 0;
  camera.position.set(interiorPos.x, CAM_IN.height, Math.min(interiorPos.z + CAM_IN.dist, built.bounds.d - 0.5));

  document.getElementById('interior-hud').style.display = 'block';
  document.getElementById('interior-name').textContent = b.userData.label || 'Building';
  document.getElementById('interact-prompt').style.display = 'none';
  // Show task panel
  activeTask = null;
  const tp = document.getElementById('task-panel');
  document.getElementById('task-building-name').textContent = b.userData.label || 'Building';
  buildTaskPanel(b.userData.type || 'manor');
  tp.style.display = 'block';

  fadeIn();
  setTimeout(() => { transitioning = false; }, 200);
}

async function exitBuilding() {
  if (transitioning || !insideBuilding) return;
  transitioning = true;
  await fadeOut();
  if (interiorPlayerMesh) interiorPlayerMesh.visible = false;
  insideBuilding = null; activeTask = null;
  camDist = CAM_OUT.dist; camHeight = CAM_OUT.height;
  document.getElementById('interior-hud').style.display = 'none';
  document.getElementById('task-panel').style.display = 'none';
  fadeIn();
  setTimeout(() => { transitioning = false; }, 200);
}

function handleInteract() {
  if (transitioning) return;
  if (insideBuilding) {
    // Only exit when near the interior door
    if (interiorMeta && interiorPos.z > interiorMeta.exit.z - 3.2) exitBuilding();
    else exitBuilding(); // allow exit anywhere via E for convenience
    return;
  }
  if (nearBuilding) enterBuilding(nearBuilding);
}

// Cycle through the Blink emote animations on the local character.
let emoteIdx = 0;
const EMOTE_TYPES = [
  { type: 'wave', label: '👋 Wave!' },
  { type: 'cheer', label: '🙌 Cheer!' },
  { type: 'jump', label: '⤴ Jump!' },
];
function doEmote() {
  const mesh = insideBuilding ? interiorPlayerMesh : playerMeshes[myId];
  const pa = mesh?.userData?.parts; if (!pa) return;
  const e = EMOTE_TYPES[emoteIdx % EMOTE_TYPES.length]; emoteIdx++;
  mesh.userData.emote = { type: e.type, start: performance.now(), dur: 1200 };
  notify(e.label, '#46e0ff');
}
// Drive a short procedural emote on the local character's limbs. Returns true if active.
function applyEmote(mesh) {
  const em = mesh?.userData?.emote, pa = mesh?.userData?.parts;
  if (!em || !pa) return false;
  const now = performance.now(), t = (now - em.start) / em.dur;
  if (t >= 1) { mesh.userData.emote = null; pa.rSho.rotation.z = 0; pa.lSho.rotation.z = 0; return false; }
  const wob = Math.sin(now * 0.02);
  if (em.type === 'wave') {
    pa.rSho.rotation.x = -2.5; pa.rSho.rotation.z = wob * 0.5; // raised arm waving
    pa.frame.position.y = 0;
  } else if (em.type === 'cheer') {
    pa.lSho.rotation.x = -2.6; pa.rSho.rotation.x = -2.6;       // both arms up
    pa.frame.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.15;
  } else { // jump
    pa.frame.position.y = Math.abs(Math.sin(t * Math.PI)) * 1.2;
    pa.lSho.rotation.x = -1.0; pa.rSho.rotation.x = -1.0;
  }
  return true;
}

// ─── NPC dialogue ─────────────────────────────────────────────────────────────
function talkToNPC() {
  if (transitioning || insideBuilding) return;
  if (activeNPC) { closeNPC(); return; }
  if (!nearNPC) return;
  activeNPC = nearNPC; npcLineIdx = 0;
  renderNPCDialogue();
  document.getElementById('npc-dialogue').style.display = 'block';
}
function renderNPCDialogue() {
  if (!activeNPC) return;
  const def = activeNPC.def;
  document.getElementById('npc-d-name').textContent = def.name;
  document.getElementById('npc-d-tag').textContent = def.tag;
  document.getElementById('npc-d-text').textContent = def.lines[npcLineIdx % def.lines.length];
  const actions = document.getElementById('npc-d-actions');
  actions.innerHTML = '';
  const moreLines = npcLineIdx < def.lines.length - 1;
  if (moreLines) {
    const next = document.createElement('button'); next.className = 'npc-btn';
    next.textContent = 'Continue ▸';
    next.onclick = () => { npcLineIdx++; renderNPCDialogue(); };
    actions.appendChild(next);
  }
  if (def.shop) {
    const buy = document.createElement('button'); buy.className = 'npc-btn buy';
    buy.textContent = def.shop.pitch;
    buy.onclick = () => buyFromNPC(def);
    actions.appendChild(buy);
  }
  const leave = document.createElement('button'); leave.className = 'npc-btn leave';
  leave.textContent = 'Farewell';
  leave.onclick = closeNPC;
  actions.appendChild(leave);
}
function buyFromNPC(def) {
  const s = def.shop; if (!s) return;
  const haveGold = myPlayer.gold || 0, haveRice = myPlayer.rice || 0;
  if ((s.cost.gold || 0) > haveGold || (s.cost.rice || 0) > haveRice) {
    notify('Not enough to trade!', '#ff6060'); return;
  }
  // Optimistic local update; server validates & confirms.
  if (s.cost.gold) myPlayer.gold -= s.cost.gold;
  if (s.cost.rice) myPlayer.rice -= s.cost.rice;
  if (s.give.gold) myPlayer.gold = (myPlayer.gold || 0) + s.give.gold;
  if (s.give.rice) myPlayer.rice = (myPlayer.rice || 0) + s.give.rice;
  if (s.give.soldiers) myPlayer.soldiers = (myPlayer.soldiers || 0) + s.give.soldiers;
  updateHUD();
  if (socket) socket.emit('npcTrade', { cost: s.cost, give: s.give });
  notify(`Bought ${s.item}!`, '#5dde7a');
}
function closeNPC() { activeNPC = null; document.getElementById('npc-dialogue').style.display = 'none'; }
window.closeNPC = closeNPC;

// ─── Movement ─────────────────────────────────────────────────────────────────
const SPEED_OUT = 17, SPEED_IN = 9;

function moveInput() {
  let dx = 0, dz = 0;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) { dx -= Math.sin(camYaw); dz -= Math.cos(camYaw); }
  if (keys['ArrowDown'] || keys['s'] || keys['S']) { dx += Math.sin(camYaw); dz += Math.cos(camYaw); }
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) { dx -= Math.cos(camYaw); dz += Math.sin(camYaw); }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) { dx += Math.cos(camYaw); dz -= Math.sin(camYaw); }
  return { dx, dz };
}

function processOutdoor(delta) {
  if (!myPlayer || !socket || chatFocused) return false;
  if (document.getElementById('character-screen').style.display === 'flex') return false;
  let { dx, dz } = moveInput();
  if (!dx && !dz) return false;
  const len = Math.hypot(dx, dz); dx = dx / len * SPEED_OUT * delta; dz = dz / len * SPEED_OUT * delta;
  const nx = myPlayer.x + dx, nz = myPlayer.y + dz;
  const canGo = (wx, wz) => !isWater(wx, wz) && !isBlocked(wx, wz);
  if (canGo(nx, nz)) { myPlayer.x = nx; myPlayer.y = nz; }
  else if (canGo(nx, myPlayer.y)) myPlayer.x = nx;
  else if (canGo(myPlayer.x, nz)) myPlayer.y = nz;
  if (playerMeshes[myId]) playerMeshes[myId].rotation.y = Math.atan2(dx, dz);
  socket.emit('move', { x: myPlayer.x, y: myPlayer.y });
  return true;
}
function processInterior(delta) {
  if (chatFocused || !interiorMeta) return false;
  let { dx, dz } = moveInput();
  if (!dx && !dz) return false;
  const len = Math.hypot(dx, dz); dx = dx / len * SPEED_IN * delta; dz = dz / len * SPEED_IN * delta;
  const b = interiorMeta.bounds;
  interiorPos.x = Math.max(-b.w, Math.min(b.w, interiorPos.x + dx));
  interiorPos.z = Math.max(-b.d, Math.min(b.d, interiorPos.z + dz));
  interiorPlayerMesh.position.copy(interiorPos);
  interiorPlayerMesh.rotation.y = Math.atan2(dx, dz);
  return true;
}
// World border: water tiles and off-map are impassable; everything else walkable.
function isWater(wx, wz) {
  if (!mapData) return false;
  const tx = Math.floor(wx / TILE_W), tz = Math.floor(wz / TILE_W);
  const tile = mapData.tiles[tz]?.[tx];
  return tile === undefined || tile === 1;
}
// Solid-body collision: buildings (rotated AABB) + circular obstacles (props/trees/rocks).
function isBlocked(wx, wz) {
  const PAD = 2.0;
  for (const b of buildingMeshes) {
    const e = b.userData.ext || { x: 5, z: 5 };
    const dx = wx - b.position.x, dz = wz - b.position.z;
    const ry = -(b.rotation.y || 0);
    const lx = dx * Math.cos(ry) - dz * Math.sin(ry);
    const lz = dx * Math.sin(ry) + dz * Math.cos(ry);
    if (Math.abs(lx) < e.x + PAD && Math.abs(lz) < e.z + PAD) return true;
  }
  for (const o of obstacles) {
    const dx = wx - o.x, dz = wz - o.z;
    if (dx * dx + dz * dz < o.r * o.r) return true;
  }
  return false;
}
function checkNear() {
  if (!myPlayer || insideBuilding) { document.getElementById('interact-prompt').style.display = 'none'; return; }
  nearBuilding = null;
  for (const b of buildingMeshes) {
    if (!b.userData.enterable) continue;
    const e = b.userData.ext || { x: 6, z: 6 };
    if (Math.hypot(myPlayer.x - b.position.x, myPlayer.y - b.position.z) < Math.max(e.x, e.z) + 3.5) { nearBuilding = b; break; }
  }
  // Nearest NPC within range
  nearNPC = null; let best = 7;
  for (const n of npcs) {
    const d = Math.hypot(myPlayer.x - n.def.x, myPlayer.y - n.def.z);
    if (d < best) { best = d; nearNPC = n; }
  }
  const p = document.getElementById('interact-prompt');
  const parts = [];
  if (nearNPC) parts.push(`Press F to talk to ${nearNPC.def.name}`);
  if (nearBuilding) parts.push(`Press E to enter ${nearBuilding.userData.label}`);
  if (parts.length) { p.innerHTML = parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;'); p.style.display = 'block'; }
  else p.style.display = 'none';
}

// ─── Camera ───────────────────────────────────────────────────────────────────
function updateCamera() {
  // Interior: keep the camera clamped INSIDE the room so walls never occlude.
  if (insideBuilding && interiorPlayerMesh && interiorMeta) {
    const b = interiorMeta.bounds;
    const target = interiorPlayerMesh.position.clone().add(new THREE.Vector3(0, 2, 0));
    const desired = target.clone().add(new THREE.Vector3(Math.sin(camYaw) * camDist, camHeight, Math.cos(camYaw) * camDist));
    desired.x = Math.max(-b.w + 0.6, Math.min(b.w - 0.6, desired.x));
    desired.z = Math.max(-b.d + 0.6, Math.min(b.d - 0.6, desired.z));
    camera.position.lerp(desired, transitioning ? 1 : 0.18);
    camTarget.lerp(target, transitioning ? 1 : 0.18);
    camera.lookAt(camTarget);
    return;
  }
  if (!playerMeshes[myId]) return;
  const focus = playerMeshes[myId].position;
  const offset = new THREE.Vector3(Math.sin(camYaw) * camDist, camHeight, Math.cos(camYaw) * camDist);
  const target = focus.clone().add(new THREE.Vector3(0, 2, 0));
  camera.position.lerp(target.clone().add(offset), transitioning ? 1 : 0.12);
  camTarget.lerp(target, transitioning ? 1 : 0.12);
  camera.lookAt(camTarget);
  sunTarget.position.copy(focus); sun.position.set(focus.x + 70, 130, focus.z + 50);
}

// ─── Input ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (chatFocused) return;
  if (document.getElementById('character-screen').style.display === 'flex') { if (e.key === 'Escape') window.closeCharacter(); return; }
  if (e.key === 'e' || e.key === 'E') {
    // Context: enter/exit a building when next to one, otherwise play an emote.
    if (insideBuilding || nearBuilding) handleInteract();
    else doEmote();
  }
  if (e.key === 'f' || e.key === 'F') talkToNPC();
  if ((e.key === 'm' || e.key === 'M')) toggleFullmap();
  if (e.key === 'Enter' && !chatFocused) { document.getElementById('chat-input').focus(); e.preventDefault(); }
  if (e.key === 'Escape') { closeNPC(); toggleFullmap(false); document.getElementById('territory-panel').style.display = 'none'; document.getElementById('clan-panel').style.display = 'none'; }
  if (e.key === 'q' || e.key === 'Q') camYaw += 0.1;
  if (e.key === 'z' || e.key === 'Z') camYaw -= 0.1;
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

let dragCam = false, lastMX = 0;
renderer.domElement.addEventListener('mousedown', e => { if (e.button === 2) { dragCam = true; lastMX = e.clientX; } });
document.addEventListener('mouseup', () => dragCam = false);
document.addEventListener('mousemove', e => { if (dragCam) { camYaw -= (e.clientX - lastMX) * 0.005; lastMX = e.clientX; } });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('wheel', e => {
  const min = insideBuilding ? 5 : 14, max = insideBuilding ? 14 : 90;
  camDist = Math.max(min, Math.min(max, camDist + e.deltaY * 0.04));
  camHeight = camDist * (insideBuilding ? 1.3 : 0.72);
}, { passive: true });

renderer.domElement.addEventListener('click', e => {
  if (!mapData || insideBuilding || e.button !== 0) return;
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if (!groundMesh) return;
  const hits = raycaster.intersectObject(groundMesh);
  if (!hits.length) return;
  const pt = hits[0].point;
  const cx = Math.floor(Math.floor(pt.x / TILE_W) / 8), cz = Math.floor(Math.floor(pt.z / TILE_W) / 8);
  const tid = `${cx}_${cz}`;
  if (territories[tid]) { selectedTerritoryId = tid; updateTerrPanel(tid); document.getElementById('territory-panel').style.display = 'block'; showSelHighlight(territories[tid]); }
});

// Glowing square marking the territory you've selected to claim / attack.
let selHighlight = null;
function showSelHighlight(t) {
  if (!selHighlight) {
    const geo = new THREE.PlaneGeometry(8 * TILE_W - 1, 8 * TILE_W - 1); geo.rotateX(-Math.PI / 2);
    selHighlight = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe24a, transparent: true, opacity: 0.28, depthWrite: false }));
    scene.add(selHighlight);
  }
  const wx = (t.tileX + 4) * TILE_W, wz = (t.tileY + 4) * TILE_W;
  selHighlight.position.set(wx, getGroundY(wx, wz) + 0.4, wz);
  selHighlight.visible = true;
}

// ─── Socket ───────────────────────────────────────────────────────────────────
function connectSocket(name) {
  socket = io({ query: { server: window.daimyoServer || 'Edo' } });
  socket.on('connect', () => {
    socket.emit('setName', name);
    sysMsg('Welcome to Daimyo! WASD to move · E to emote/enter · F to talk to NPCs.');
    sysMsg('Press Enter to chat. Click any land to claim it, then Attack to conquer.');
    sysMsg('Use the buttons below: Home · Recruit soldiers · Clan · Map (M) · Music.');
  });
  socket.on('init', data => {
    myId = data.playerId; mapData = data.mapData; territories = data.territories;
    players = data.players; clans = data.clans; serverBuildings = data.buildings || []; serverBridges = data.bridges || [];
    myPlayer = players[myId];
    // Load saved outfit for this wallet and apply it.
    myCustom = loadMyCustom();
    if (myCustom) { myPlayer.custom = myCustom; socket.emit('customize', myCustom); }
    // Structures FIRST so vegetation can avoid overlapping them.
    buildTerrain(mapData);
    placeBuildings(serverBuildings);
    buildSpawnArea(mapData.width / 2 * TILE_W, mapData.height / 2 * TILE_W);
    buildFarm(mapData.width / 2 * TILE_W - 160, mapData.height / 2 * TILE_W + 120);
    buildNPCs(mapData.width / 2 * TILE_W, mapData.height / 2 * TILE_W);
    placeBridges(serverBridges);
    // Vegetation last — skips anything overlapping a structure or other prop.
    spawnTrees(mapData); scatterRocks(mapData); scatterFoliage(mapData);
    buildTerritoryOverlays();
    buildMinimapBase();
    Object.values(players).forEach(spawnOrUpdatePlayer);
    if (myPlayer) { camera.position.set(myPlayer.x, CAM_OUT.height, myPlayer.y + CAM_OUT.dist); }
    updateHUD();
  });
  socket.on('tick', data => {
    data.players.forEach(p => {
      if (p.id === myId) return;
      if (!players[p.id]) players[p.id] = p; else Object.assign(players[p.id], p);
      spawnOrUpdatePlayer(players[p.id]);
      const cel = chatLabels[p.id];
      if (cel) { if (p.chatMsg) { cel.textContent = p.chatMsg; cel.style.display = 'block'; } else cel.style.display = 'none'; }
    });
  });
  socket.on('playerJoined', p => spawnOrUpdatePlayer(p));
  socket.on('playerLeft', id => { if (playerMeshes[id]) { scene.remove(playerMeshes[id]); delete playerMeshes[id]; } delete players[id]; delete chatLabels[id]; });
  socket.on('playerUpdate', d => { if (players[d.id]) Object.assign(players[d.id], d); if (d.id === myId) { Object.assign(myPlayer, d); updateHUD(); } if (playerLabels[d.id] && d.name) { const n = playerLabels[d.id].querySelector('.pl-name'); if (n) n.textContent = d.name; } });
  socket.on('playerResourceUpdate', d => { if (players[d.id]) Object.assign(players[d.id], d); if (d.id === myId) { Object.assign(myPlayer, d); updateHUD(); } });
  socket.on('territoryUpdate', t => { territories = t; buildTerritoryOverlays(); if (selectedTerritoryId) updateTerrPanel(selectedTerritoryId); updateHUD(); });
  socket.on('clanUpdate', c => { clans = c; updateHUD(); buildTerritoryOverlays(); });
  socket.on('chat', ({ id, name, msg, clan }) => {
    const tag = clan && clans[clan] ? `[${clans[clan].name}] ` : '';
    addChat(`<span class="clan-tag">${esc(tag)}</span><span class="pname">${esc(name)}</span>: ${esc(msg)}`);
    if (chatLabels[id]) { chatLabels[id].textContent = msg; chatLabels[id].style.display = 'block'; clearTimeout(chatTimers[id]); chatTimers[id] = setTimeout(() => { if (chatLabels[id]) chatLabels[id].style.display = 'none'; }, 6000); }
  });
  socket.on('tradeResult', r => { if (!r.success) notify(r.reason || 'Trade failed', '#ff6060'); });
  socket.on('battleEvent', ev => notify(ev.message, ev.won ? '#ffd700' : '#ff6060'));
  socket.on('claimResult', r => notify(r.success ? `Claimed ${r.name}!` : r.reason, r.success ? '#5dde7a' : '#ff6060'));
  socket.on('attackResult', r => { if (!r.success) notify(r.reason, '#ff6060'); });
  socket.on('createClanResult', r => { if (r.success) { notify(`Clan "${r.name}" founded!`, '#5dde7a'); closeClanPanel(); } else notify(r.reason, '#ff6060'); });
  socket.on('joinClanResult', r => { if (r.success) { notify(`Joined "${r.name}"!`, '#5dde7a'); closeClanPanel(); } else notify(r.reason, '#ff6060'); });
}

// ─── Main loop ────────────────────────────────────────────────────────────────
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const delta = Math.min((t - lastT) / 1000, 0.05); lastT = t;
  if (!mapData || !myPlayer) { renderer.render(scene, camera); return; }

  let moving;
  if (insideBuilding) {
    moving = processInterior(delta);
    animateChar(interiorPlayerMesh, moving);
  } else {
    moving = processOutdoor(delta);
    spawnOrUpdatePlayer(myPlayer);
    animateChar(playerMeshes[myId], moving);
    Object.keys(playerMeshes).forEach(id => { if (id !== myId) animateChar(playerMeshes[id], false); });
    checkNear();
  }
  updateRigs(delta); // advance all character animation mixers
  if (waterNM) { waterNM.offset.x += delta * 0.015; waterNM.offset.y += delta * 0.01; } // flowing water
  if (spawnWheel) spawnWheel.rotation.y += delta * 0.8;
  // Bob NPC attention markers
  if (npcs.length) {
    const bt = performance.now() * 0.003;
    npcs.forEach((n, i) => { n.marker.position.y = 5.1 + Math.sin(bt + i) * 0.18; n.marker.rotation.y += delta; });
  }
  // Flicker fire braziers
  if (spawnFireLights.length) {
    const ft = performance.now() * 0.003;
    spawnFireLights.forEach((f, i) => {
      const flicker = 0.72 + Math.sin(ft * 7.1 + i * 1.7) * 0.18 + Math.sin(ft * 13.3 + i * 2.9) * 0.1;
      f.light.intensity = f.base * flicker;
      f.fire.scale.setScalar(0.88 + flicker * 0.22);
    });
  }
  updateCamera();
  renderer.render(insideBuilding ? interiorScene : scene, camera);
  labelRenderer.render(insideBuilding ? interiorScene : scene, camera);
}
requestAnimationFrame(loop);

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateHUD() {
  if (!myPlayer) return;
  document.getElementById('hud-name').textContent = myPlayer.name || 'Warrior';
  document.getElementById('hud-gold').textContent = myPlayer.gold ?? 0;
  document.getElementById('hud-rice').textContent = myPlayer.rice ?? 0;
  document.getElementById('hud-soldiers').textContent = myPlayer.soldiers ?? 0;
  document.getElementById('hud-lands').textContent = Object.values(territories).filter(t => t.ownerId === myId).length;
  const clan = myPlayer.clan && clans[myPlayer.clan];
  const badge = document.getElementById('clan-badge');
  if (clan) { badge.style.display = 'block'; badge.style.borderColor = clan.color; badge.textContent = clan.name; badge.style.color = clan.color; }
  else badge.style.display = 'none';
}
function updateTerrPanel(tid) {
  const t = territories[tid]; if (!t) return;
  document.getElementById('tp-name').textContent = t.name;
  document.getElementById('tp-owner').textContent = t.ownerId ? (players[t.ownerId]?.name ?? '???') : 'Unclaimed';
  document.getElementById('tp-defense').textContent = t.defense ?? 0;
  document.getElementById('tp-claim').style.display = !t.ownerId ? 'block' : 'none';
  document.getElementById('tp-attack').style.display = (t.ownerId && t.ownerId !== myId) ? 'block' : 'none';
}
window.claimSelected = () => { const t = territories[selectedTerritoryId]; if (t) socket.emit('claimTerritory', { tileX: t.tileX, tileY: t.tileY }); };
window.attackSelected = () => { const t = territories[selectedTerritoryId]; if (t) socket.emit('attack', { tileX: t.tileX, tileY: t.tileY }); };
window.closeTerrPanel = () => { document.getElementById('territory-panel').style.display = 'none'; selectedTerritoryId = null; if (selHighlight) selHighlight.visible = false; };
window.recruitSoldiers = () => {
  if (!myPlayer || !socket) return;
  if ((myPlayer.gold || 0) < 20) { notify('Not enough gold (need 20)', '#ff6060'); return; }
  socket.emit('recruitSoldiers'); notify('⚔️ +5 Soldiers!', '#5dde7a');
};
window.goHome = () => {
  if (!myPlayer || !mapData) return;
  if (insideBuilding) exitBuilding();
  const cx = mapData.width / 2 * TILE_W, cz = mapData.height / 2 * TILE_W;
  const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 8;
  myPlayer.x = cx + Math.cos(a) * r; myPlayer.y = cz + Math.sin(a) * r;
  if (playerMeshes[myId]) playerMeshes[myId].position.set(myPlayer.x, getGroundY(myPlayer.x, myPlayer.y), myPlayer.y);
  if (socket) socket.emit('move', { x: myPlayer.x, y: myPlayer.y });
  notify('Returned to the Capital', '#ffd700');
};

// ─── Character page (customize + loot) ────────────────────────────────────────
const customKey = () => 'daimyo_custom_' + (window.daimyoWallet || window.daimyoUsername || 'guest');
function loadMyCustom() { try { return JSON.parse(localStorage.getItem(customKey())) || null; } catch { return null; } }
function saveMyCustom(c) { try { localStorage.setItem(customKey(), JSON.stringify(c)); } catch {} }

let pvRenderer, pvScene, pvCamera, pvChar, pvRAF, pvSpin = 0;
function ensurePreview() {
  if (pvRenderer) return;
  const cv = document.getElementById('char-canvas');
  pvRenderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  pvRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  pvScene = new THREE.Scene();
  pvCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  pvCamera.position.set(0, 3.4, 9.5); pvCamera.lookAt(0, 2.6, 0);
  pvScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.1));
  const dl = new THREE.DirectionalLight(0xffffff, 1.2); dl.position.set(4, 8, 6); pvScene.add(dl);
}
function resizePreview() {
  if (!pvRenderer) return;
  const cv = document.getElementById('char-canvas');
  const w = cv.clientWidth || 300, h = cv.clientHeight || 360;
  pvRenderer.setSize(w, h, false); pvCamera.aspect = w / h; pvCamera.updateProjectionMatrix();
}
function rebuildPreviewChar() {
  ensurePreview();
  if (pvChar) pvScene.remove(pvChar);
  pvChar = createCharacter(myPlayer?.color || '#e74c3c', false, myId || 'me', myCustom || {});
  // hide the contact-shadow disc in the preview (first child)
  if (pvChar.children[0]) pvChar.children[0].visible = false;
  pvScene.add(pvChar);
}
function previewLoop() {
  pvRAF = requestAnimationFrame(previewLoop);
  if (!pvRenderer || !pvChar) return;
  pvSpin += 0.012; pvChar.rotation.y = pvSpin;
  pvRenderer.render(pvScene, pvCamera);
}

const CUSTOM_GROUPS = [
  { key: 'hat',    label: 'Hat',     swatch: false },
  { key: 'outfit', label: 'Clothes', swatch: true },
  { key: 'shoe',   label: 'Shoes',   swatch: true },
  { key: 'hair',   label: 'Hair',    swatch: true },
  { key: 'skin',   label: 'Skin',    swatch: true },
];
function buildCustomUI() {
  const wrap = document.getElementById('custom-options'); wrap.innerHTML = '';
  myCustom = myCustom || {};
  CUSTOM_GROUPS.forEach(g => {
    const row = document.createElement('div'); row.className = 'cz-row';
    const opts = CUSTOM[g.key];
    let chips = '';
    opts.forEach((opt, i) => {
      const sel = (myCustom[g.key] ?? -99) === i ? ' sel' : '';
      if (g.swatch) chips += `<span class="cz-chip${sel}" data-k="${g.key}" data-i="${i}" style="background:#${(opt).toString(16).padStart(6,'0')}"></span>`;
      else chips += `<span class="cz-chip txt${sel}" data-k="${g.key}" data-i="${i}">${opt}</span>`;
    });
    row.innerHTML = `<div class="cz-label">${g.label}</div><div class="cz-chips">${chips}</div>`;
    wrap.appendChild(row);
  });
  wrap.querySelectorAll('.cz-chip').forEach(ch => ch.onclick = () => {
    const k = ch.dataset.k, i = parseInt(ch.dataset.i, 10);
    myCustom[k] = i;
    buildCustomUI(); rebuildPreviewChar();
  });
}
function updateLootPanel() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('loot-gold', myPlayer?.gold ?? 0);
  set('loot-rice', myPlayer?.rice ?? 0);
  set('loot-soldiers', myPlayer?.soldiers ?? 0);
  set('loot-lands', Object.values(territories).filter(t => t.ownerId === myId).length);
  set('loot-level', myPlayer?.level ?? 1);
  const clan = myPlayer?.clan && clans[myPlayer.clan];
  set('loot-clan', clan ? clan.name : '—');
  document.getElementById('char-name').textContent = myPlayer?.name || 'Warrior';
}
window.openCharacter = () => {
  if (!myPlayer) return;
  if (insideBuilding) return notify('Exit the building first (press E)', '#ff6060');
  myCustom = myCustom || loadMyCustom() || {};
  document.getElementById('character-screen').style.display = 'flex';
  buildCustomUI(); updateLootPanel();
  ensurePreview(); resizePreview(); rebuildPreviewChar();
  if (!pvRAF) previewLoop();
};
window.closeCharacter = () => {
  const scr = document.getElementById('character-screen');
  if (scr.style.display !== 'flex') return;
  scr.style.display = 'none';
  if (pvRAF) { cancelAnimationFrame(pvRAF); pvRAF = null; } // stop preview render
  // Save + broadcast the chosen outfit so it shows in-world.
  saveMyCustom(myCustom);
  if (myPlayer) myPlayer.custom = myCustom;
  if (socket) socket.emit('customize', myCustom);
};

window.openClanPanel = () => {
  const panel = document.getElementById('clan-panel'), content = document.getElementById('clan-content');
  panel.style.display = 'block';
  if (myPlayer?.clan) { const clan = clans[myPlayer.clan];
    content.innerHTML = `<div style="color:#c8b89a;margin-bottom:10px">Member of: <span style="color:${clan?.color}">${esc(clan?.name ?? '???')}</span></div><div style="color:#777;font-size:12px">Members: ${(clan?.members ?? []).map(id => players[id]?.name ?? '???').join(', ')}</div>`;
  } else {
    const list = Object.values(clans).map(c => `<button class="game-btn gold" onclick="window.joinClan('${esc(c.id)}')" style="text-align:left"><span style="color:${c.color}">■</span> ${esc(c.name)} (${c.members.length})</button>`).join('');
    content.innerHTML = `<input id="clan-name-in" placeholder="Clan name..."><button class="game-btn gold" onclick="window.createClan()">Found Clan (200 gold)</button><div style="margin:12px 0 6px;color:#777;font-size:12px">— or join —</div>${list || '<div style="color:#555;font-size:12px">No clans yet</div>'}`;
  }
};
window.closeClanPanel = () => document.getElementById('clan-panel').style.display = 'none';
function closeClanPanel() { window.closeClanPanel(); }
window.createClan = () => { const name = document.getElementById('clan-name-in')?.value?.trim(); if (!name) return notify('Enter a clan name', '#ff6060'); socket.emit('createClan', { name, color: `hsl(${Math.random() * 360 | 0},70%,55%)` }); };
window.joinClan = id => socket.emit('joinClan', { clanId: id });

function addChat(html) { const log = document.getElementById('chat-log'); const d = document.createElement('div'); d.className = 'msg'; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; if (log.children.length > 60) log.removeChild(log.children[0]); }
function sysMsg(t) { addChat(`<span class="sys">${esc(t)}</span>`); }
function notify(msg, color) { const el = document.getElementById('notification'); el.textContent = msg; el.style.borderColor = color || '#ffd700'; el.style.color = color || '#ffd700'; el.style.opacity = '1'; clearTimeout(notifTimeout); notifTimeout = setTimeout(() => el.style.opacity = '0', 3500); }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ─── Minimap ──────────────────────────────────────────────────────────────────
const MM = document.getElementById('minimap');
const mmctx = MM.getContext('2d');
let mmBase = null;
const MM_S = 190; // canvas size (matches CSS)
MM.width = MM_S; MM.height = MM_S;

function buildMinimapBase() {
  if (!mapData) return;
  const W = mapData.width, H = mapData.height;
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const o = off.getContext('2d');
  const col = { 0: '#4dba2e', 1: '#2a8fd4', 2: '#8a8880', 3: '#2e8a1c', 4: '#c9a84c', 5: '#d4c88e', 6: '#bf9a50' };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { o.fillStyle = col[mapData.tiles[y][x]] || '#4dba2e'; o.fillRect(x, y, 1, 1); }
  // Overlay tile grid lightly
  o.strokeStyle = 'rgba(0,0,0,0.08)'; o.lineWidth = 0.3;
  for (let y = 0; y < H; y += 8) { o.beginPath(); o.moveTo(0, y); o.lineTo(W, y); o.stroke(); }
  for (let x = 0; x < W; x += 8) { o.beginPath(); o.moveTo(x, 0); o.lineTo(x, H); o.stroke(); }
  mmBase = off;
}

function drawMinimap() {
  if (!mapData || !mmBase) return;
  const W = mapData.width, H = mapData.height, S = MM_S;
  const sx = S / W, sz = S / H; // tile-coord → pixel
  mmctx.clearRect(0, 0, S, S);
  mmctx.imageSmoothingEnabled = false;
  mmctx.drawImage(mmBase, 0, 0, W, H, 0, 0, S, S);

  // Territory tints + borders
  Object.values(territories).forEach(t => {
    if (!t.ownerId) return;
    const hex = '#' + getTerrColor(t).getHexString();
    mmctx.fillStyle = hex; mmctx.globalAlpha = 0.42;
    mmctx.fillRect(t.tileX * sx, t.tileY * sz, 8 * sx, 8 * sz);
    mmctx.globalAlpha = 0.8;
    mmctx.strokeStyle = hex; mmctx.lineWidth = 0.8;
    mmctx.strokeRect(t.tileX * sx + 0.5, t.tileY * sz + 0.5, 8 * sx - 1, 8 * sz - 1);
    mmctx.globalAlpha = 1;
  });

  // Only major landmarks (not every house) → keeps the minimap clean.
  buildingMeshes.forEach(b => {
    if (b.userData.type === 'house') return;
    const bx = b.position.x / TILE_W * sx, bz = b.position.z / TILE_W * sz;
    mmctx.fillStyle = '#ffc830'; mmctx.strokeStyle = '#5a3800'; mmctx.lineWidth = 0.8;
    mmctx.fillRect(bx - 2.5, bz - 2.5, 5, 5); mmctx.strokeRect(bx - 2.5, bz - 2.5, 5, 5);
  });

  // Other players
  Object.values(players).forEach(p => {
    if (p.id === myId) return;
    const px = p.x / TILE_W * sx, pz = p.y / TILE_W * sz;
    mmctx.fillStyle = p.color || '#ff4444'; mmctx.strokeStyle = '#000'; mmctx.lineWidth = 0.7;
    mmctx.beginPath(); mmctx.arc(px, pz, 3, 0, Math.PI * 2); mmctx.fill(); mmctx.stroke();
  });

  // Local player — white dot + direction arrow
  if (myPlayer) {
    const px = myPlayer.x / TILE_W * sx, pz = myPlayer.y / TILE_W * sz;
    const dir = playerMeshes[myId]?.rotation.y || 0;
    // White circle
    mmctx.fillStyle = '#ffffff'; mmctx.strokeStyle = '#000'; mmctx.lineWidth = 1;
    mmctx.beginPath(); mmctx.arc(px, pz, 4.5, 0, Math.PI * 2); mmctx.fill(); mmctx.stroke();
    // Gold direction triangle
    mmctx.save(); mmctx.translate(px, pz); mmctx.rotate(-dir);
    mmctx.fillStyle = '#ffd700';
    mmctx.beginPath(); mmctx.moveTo(0, -8); mmctx.lineTo(-3.5, 0); mmctx.lineTo(3.5, 0); mmctx.closePath(); mmctx.fill();
    mmctx.restore();
  }

  // Compass rose (bottom-right corner)
  const cr = S - 18, cc = S - 18;
  mmctx.fillStyle = 'rgba(0,0,0,0.55)';
  mmctx.beginPath(); mmctx.arc(cr, cc, 11, 0, Math.PI * 2); mmctx.fill();
  mmctx.font = 'bold 8px serif'; mmctx.textAlign = 'center'; mmctx.textBaseline = 'middle';
  mmctx.fillStyle = '#ff4444'; mmctx.fillText('N', cr, cc - 5);
  mmctx.fillStyle = '#aaa';    mmctx.fillText('S', cr, cc + 5.5);
  mmctx.fillStyle = '#aaa';    mmctx.fillText('W', cr - 5.5, cc + 0.5);
  mmctx.fillStyle = '#aaa';    mmctx.fillText('E', cr + 5.5, cc + 0.5);
}
setInterval(drawMinimap, 250);

// ─── Full map (press M) ───────────────────────────────────────────────────────
let fullmapOpen = false;
const fullmapCanvas = document.getElementById('fullmap-canvas');
const fmctx = fullmapCanvas.getContext('2d');
function toggleFullmap(force) {
  fullmapOpen = force !== undefined ? force : !fullmapOpen;
  document.getElementById('fullmap-overlay').style.display = fullmapOpen ? 'flex' : 'none';
  if (fullmapOpen) drawFullMap();
}
window.toggleFullmap = toggleFullmap; // so the Map button's inline onclick can reach it
function drawFullMap() {
  if (!mapData || !mmBase) return;
  const W = mapData.width, H = mapData.height;
  const size = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.74);
  fullmapCanvas.width = size; fullmapCanvas.height = size;
  const sx = size / W, sz = size / H;
  fmctx.clearRect(0, 0, size, size);
  fmctx.imageSmoothingEnabled = false;
  fmctx.drawImage(mmBase, 0, 0, W, H, 0, 0, size, size);

  // Territory ownership tints
  Object.values(territories).forEach(t => {
    if (!t.ownerId) return;
    fmctx.fillStyle = '#' + getTerrColor(t).getHexString();
    fmctx.globalAlpha = 0.4; fmctx.fillRect(t.tileX * sx, t.tileY * sz, 8 * sx, 8 * sz); fmctx.globalAlpha = 1;
  });

  // Landmark markers + names
  const tileToPx = (wx, wz) => ({ px: wx / TILE_W * sx, pz: wz / TILE_W * sz });
  const drawLabel = (wx, wz, text, color, big) => {
    const { px, pz } = tileToPx(wx, wz);
    fmctx.beginPath(); fmctx.arc(px, pz, big ? 5 : 3.5, 0, Math.PI * 2);
    fmctx.fillStyle = color; fmctx.fill();
    fmctx.strokeStyle = '#000'; fmctx.lineWidth = 1; fmctx.stroke();
    fmctx.font = `${big ? 700 : 600} ${big ? 14 : 11}px Cinzel, serif`;
    fmctx.textAlign = 'center'; fmctx.textBaseline = 'bottom';
    fmctx.lineWidth = 3; fmctx.strokeStyle = 'rgba(0,0,0,0.85)';
    fmctx.strokeText(text, px, pz - 6); fmctx.fillStyle = color;
    fmctx.fillText(text, px, pz - 6);
  };

  // Just 5 landmarks total: Imperial Capital, Rice Farm, and 3 outlying villages.
  const cwx = W / 2 * TILE_W, cwz = H / 2 * TILE_W;
  drawLabel(cwx, cwz, '⛩ Imperial Capital', '#ffe08a', true);
  if (farmCenter) drawLabel(farmCenter.x, farmCenter.z, '🌾 Rice Farm', '#9be86a');

  // 3 villages, chosen as the ones farthest from the capital and spread apart.
  const villages = buildingMeshes
    .filter(b => /Store/.test(b.userData.label || ''))
    .map(b => ({ b, d: Math.hypot(b.position.x - cwx, b.position.z - cwz) }))
    .sort((a, z) => z.d - a.d);
  const picked = [];
  for (const v of villages) {
    if (picked.length >= 3) break;
    if (picked.some(p => Math.hypot(p.position.x - v.b.position.x, p.position.z - v.b.position.z) < 200)) continue;
    picked.push(v.b);
    drawLabel(v.b.position.x, v.b.position.z, (v.b.userData.label || '').replace(' Store', ''), '#9fe0ff');
  }

  // Player position — gold triangle
  if (myPlayer) {
    const { px, pz } = tileToPx(myPlayer.x, myPlayer.y);
    const dir = playerMeshes[myId]?.rotation.y || 0;
    fmctx.save(); fmctx.translate(px, pz); fmctx.rotate(-dir);
    fmctx.fillStyle = '#ffffff'; fmctx.strokeStyle = '#000'; fmctx.lineWidth = 1.5;
    fmctx.beginPath(); fmctx.moveTo(0, -10); fmctx.lineTo(-6, 6); fmctx.lineTo(6, 6); fmctx.closePath();
    fmctx.fill(); fmctx.stroke(); fmctx.restore();
    drawLabel(myPlayer.x, myPlayer.y, 'You', '#ffffff');
  }
}
document.getElementById('fullmap-overlay').addEventListener('click', () => toggleFullmap(false));
document.getElementById('fullmap-frame').addEventListener('click', e => e.stopPropagation());

const chatInput = document.getElementById('chat-input');
chatInput.addEventListener('focus', () => chatFocused = true);
chatInput.addEventListener('blur', () => chatFocused = false);
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { const m = chatInput.value.trim(); if (m && socket) socket.emit('chat', m); chatInput.value = ''; chatInput.blur(); e.preventDefault(); }
  if (e.key === 'Escape') chatInput.blur();
});

// ─── Music (generative ambient via Web Audio — no file needed) ────────────────
let audioCtx, musicGain, musicTimer, musicOn = true, musicNext = 0;
const PENTA = [0, 3, 5, 7, 10]; // minor pentatonic
function noteHz(semi) { return 220 * Math.pow(2, semi / 12); }
function playTone(freq, t, dur, type, gain) {
  const o = audioCtx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.05);
}
function startMusic() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain(); musicGain.gain.value = musicOn ? 0.14 : 0;
  musicGain.connect(audioCtx.destination);
  musicNext = audioCtx.currentTime + 0.2;
  musicTimer = setInterval(() => {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    while (musicNext < now + 2) {
      const oct = Math.random() < 0.4 ? 12 : 0;
      const semi = PENTA[Math.floor(Math.random() * PENTA.length)] + oct;
      playTone(noteHz(semi), musicNext, 1.6, 'triangle', 0.22);
      if (Math.random() < 0.55) playTone(noteHz(PENTA[0] - 12), musicNext, 2.2, 'sine', 0.28);
      if (Math.random() < 0.3) playTone(noteHz(semi + 7), musicNext + 0.3, 1.3, 'sine', 0.12);
      musicNext += 0.7 + Math.random() * 0.5;
    }
  }, 300);
}
window.toggleMusic = () => {
  musicOn = !musicOn;
  if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(musicOn ? 0.14 : 0, audioCtx.currentTime, 0.1);
  const b = document.getElementById('music-btn');
  if (b) { b.style.opacity = musicOn ? '1' : '0.5'; b.querySelector('.ab-ico').textContent = musicOn ? '♪' : '🔇'; }
};

let entering = false;
window.enterGame = async (username) => {
  if (entering) return; entering = true;
  startMusic(); // user gesture — safe to start audio
  const name = (username || 'Warrior').toString().trim().slice(0, 20) || 'Warrior';
  const loading = document.getElementById('game-loading');
  const fill = document.getElementById('gl-fill'), pct = document.getElementById('load-pct');
  if (loading) loading.style.display = 'flex';
  // Load Kenney (buildings/props) + Polytope (nature) packs together.
  let kDone = 0, kTot = 1, pDone = 0, pTot = 1, fDone = 0, fTot = 1;
  const upd = () => {
    const p = Math.round((kDone + pDone + fDone) / (kTot + pTot + fTot) * 100);
    if (fill) fill.style.width = p + '%';
    if (pct) pct.textContent = `Loading ${p}%`;
  };
  await Promise.all([
    loadModels((d, t) => { kDone = d; kTot = t; upd(); }),
    loadPolytope((d, t) => { pDone = d; pTot = t; upd(); }),
    loadFarm((d, t) => { fDone = d; fTot = t; upd(); }),
    loadBridge(),
  ]);
  if (loading) loading.style.display = 'none';
  connectSocket(name);
};
