// One-off build tool: convert the farm FBX buildings to glTF and strip their
// embedded textures (the game assigns textures itself from assets/farm/textures),
// turning ~2MB-each models into a few KB of geometry.
const { execFileSync } = require('child_process');
const { NodeIO } = require('@gltf-transform/core');
const { prune, dedup } = require('@gltf-transform/functions');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe');
const SRC_DIR = path.join(ROOT, 'client/assets/farm/models');
const OUT_DIR = path.join(ROOT, 'client/assets/farm/glb');
const TMP_DIR = path.join(__dirname, 'glb');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

(async () => {
  const io = new NodeIO();
  const files = fs.readdirSync(SRC_DIR).filter(f => f.toLowerCase().endsWith('.fbx'));
  let totalIn = 0, totalOut = 0;
  for (const f of files) {
    const name = f.replace(/\.fbx$/i, '');
    const src = path.join(SRC_DIR, f);
    const tmp = path.join(TMP_DIR, name + '.glb');
    const out = path.join(OUT_DIR, name + '.glb');
    try {
      execFileSync(BIN, ['--binary', '-i', src, '-o', tmp], { stdio: 'ignore' });
      const doc = await io.read(tmp);
      for (const mat of doc.getRoot().listMaterials()) {
        mat.setBaseColorTexture(null).setMetallicRoughnessTexture(null)
           .setNormalTexture(null).setEmissiveTexture(null).setOcclusionTexture(null);
      }
      await doc.transform(prune(), dedup());
      await io.write(out, doc);
      const inSz = fs.statSync(src).size, outSz = fs.statSync(out).size;
      totalIn += inSz; totalOut += outSz;
      console.log(`${name.padEnd(28)} ${(inSz/1024).toFixed(0).padStart(6)}KB -> ${(outSz/1024).toFixed(1).padStart(6)}KB`);
    } catch (e) {
      console.error('FAILED', name, e.message);
    }
  }
  console.log(`\nTOTAL: ${(totalIn/1048576).toFixed(1)}MB -> ${(totalOut/1048576).toFixed(2)}MB`);
})();
