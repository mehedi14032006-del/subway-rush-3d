import fs from 'node:fs/promises';
import path from 'node:path';

const KENNEY = 'https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b';
const THREE_GLTF = 'https://raw.githubusercontent.com/mrdoob/three.js/1d3772857eb8970ce24b3757980c5e9d46c0d6ff/examples/models/gltf';
const AUDIO = 'https://raw.githubusercontent.com/Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds';

const ASSETS = [
  // Rigged Characters & Hoverboard
  ['models/char-boy.glb', `${KENNEY}/3d/mini-skate/character-skate-boy.glb`],
  ['models/char-girl.glb', `${KENNEY}/3d/mini-skate/character-skate-girl.glb`],
  ['models/char-bot.glb', `${THREE_GLTF}/RobotExpressive/RobotExpressive.glb`],
  ['models/char-guard.glb', `${KENNEY}/3d/mini-characters/character-male-c.glb`],
  ['models/skateboard.glb', `${KENNEY}/3d/mini-skate/skateboard.glb`],

  // Real Subway, Bullet & Freight Trains
  ['models/train-subway-a.glb', `${KENNEY}/3d/train/train-electric-subway-a.glb`],
  ['models/train-subway-b.glb', `${KENNEY}/3d/train/train-electric-subway-b.glb`],
  ['models/train-subway-c.glb', `${KENNEY}/3d/train/train-electric-subway-c.glb`],
  ['models/train-bullet-a.glb', `${KENNEY}/3d/train/train-electric-bullet-a.glb`],
  ['models/train-bullet-b.glb', `${KENNEY}/3d/train/train-electric-bullet-b.glb`],
  ['models/train-city-a.glb', `${KENNEY}/3d/train/train-electric-city-a.glb`],
  ['models/train-city-b.glb', `${KENNEY}/3d/train/train-electric-city-b.glb`],
  ['models/train-freight-blue.glb', `${KENNEY}/3d/train/train-carriage-container-blue.glb`],
  ['models/train-freight-red.glb', `${KENNEY}/3d/train/train-carriage-container-red.glb`],
  ['models/train-freight-green.glb', `${KENNEY}/3d/train/train-carriage-container-green.glb`],
  ['models/track-detailed.glb', `${KENNEY}/3d/train/track-detailed.glb`],

  // Obstacles & Collectibles
  ['models/barrier.glb', `${KENNEY}/3d/city-roads/construction-barrier.glb`],
  ['models/cone.glb', `${KENNEY}/3d/city-roads/construction-cone.glb`],
  ['models/gantry.glb', `${KENNEY}/3d/city-roads/sign-highway-wide.glb`],
  ['models/streetlight.glb', `${KENNEY}/3d/city-roads/light-curved.glb`],
  ['models/coin.glb', `${KENNEY}/3d/platformer/coin-gold.glb`],
  ['models/key.glb', `${KENNEY}/3d/platformer/key.glb`],
  ['models/star.glb', `${KENNEY}/3d/platformer/star.glb`],

  // City Skyline & Trackside Props
  ['models/building-a.glb', `${KENNEY}/3d/city-commercial/building-a.glb`],
  ['models/building-b.glb', `${KENNEY}/3d/city-commercial/building-b.glb`],
  ['models/building-e.glb', `${KENNEY}/3d/city-commercial/building-e.glb`],
  ['models/building-g.glb', `${KENNEY}/3d/city-commercial/building-g.glb`],
  ['models/building-sky-a.glb', `${KENNEY}/3d/city-commercial/building-skyscraper-a.glb`],
  ['models/building-sky-b.glb', `${KENNEY}/3d/city-commercial/building-skyscraper-b.glb`],
  ['models/building-ind-a.glb', `${KENNEY}/3d/city-industrial/building-a.glb`],
  ['models/building-ind-c.glb', `${KENNEY}/3d/city-industrial/building-c.glb`],
  ['models/tree.glb', `${KENNEY}/3d/retro-urban/tree-park-large.glb`],
  ['models/dumpster.glb', `${KENNEY}/3d/retro-urban/detail-dumpster-closed.glb`],

  // Studio CC0 WAV Sound Effects
  ['audio/coin.wav', `${AUDIO}/pluck_001.wav`],
  ['audio/swipe.wav', `${AUDIO}/switch_004.wav`],
  ['audio/jump.wav', `${AUDIO}/maximize_006.wav`],
  ['audio/roll.wav', `${AUDIO}/minimize_006.wav`],
  ['audio/crash.wav', `${AUDIO}/error_003.wav`],
  ['audio/powerup.wav', `${AUDIO}/confirmation_002.wav`],
  ['audio/click.wav', `${AUDIO}/click_003.wav`],
  ['audio/hoverboard.wav', `${AUDIO}/open_003.wav`]
];

const outRoot = path.resolve('public/assets');

async function downloadOne([relPath, url]) {
  const dest = path.join(outRoot, relPath);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    const stat = await fs.stat(dest);
    if (stat.size > 500) {
      console.log(`✓ Cached ${relPath}`);
      return;
    }
  } catch {}

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(dest, buf);
      console.log(`↓ Downloaded ${relPath} (${(buf.length / 1024).toFixed(1)} KB)`);
      return;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`⚠ Failed ${relPath}: ${err.message} (will fallback to CDN at runtime)`);
      } else {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }
}

async function main() {
  console.log(`Fetching ${ASSETS.length} real 3D GLB & WAV assets for offline APK bundle...`);
  const concurrency = 6;
  const queue = [...ASSETS];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item) await downloadOne(item);
    }
  });
  await Promise.all(workers);
  console.log('Done fetching assets.');
}

main();
