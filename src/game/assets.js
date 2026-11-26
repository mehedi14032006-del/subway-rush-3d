import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const KENNEY = 'https://raw.githubusercontent.com/shorepine/kenney/3694c6879e487c108f55677be7dd2ca75b07cc3b';
const THREE_GLTF = 'https://raw.githubusercontent.com/mrdoob/three.js/1d3772857eb8970ce24b3757980c5e9d46c0d6ff/examples/models/gltf';

export const MODEL_MANIFEST = {
  // Rigged Characters & Hoverboard
  charBoy: { local: './assets/models/char-boy.glb', cdn: `${KENNEY}/3d/mini-skate/character-skate-boy.glb` },
  charGirl: { local: './assets/models/char-girl.glb', cdn: `${KENNEY}/3d/mini-skate/character-skate-girl.glb` },
  charBot: { local: './assets/models/char-bot.glb', cdn: `${THREE_GLTF}/RobotExpressive/RobotExpressive.glb` },
  charGuard: { local: './assets/models/char-guard.glb', cdn: `${KENNEY}/3d/mini-characters/character-male-c.glb` },
  skateboard: { local: './assets/models/skateboard.glb', cdn: `${KENNEY}/3d/mini-skate/skateboard.glb` },

  // Real Subway, Bullet, City & Freight Trains
  trainSubwayA: { local: './assets/models/train-subway-a.glb', cdn: `${KENNEY}/3d/train/train-electric-subway-a.glb` },
  trainSubwayB: { local: './assets/models/train-subway-b.glb', cdn: `${KENNEY}/3d/train/train-electric-subway-b.glb` },
  trainSubwayC: { local: './assets/models/train-subway-c.glb', cdn: `${KENNEY}/3d/train/train-electric-subway-c.glb` },
  trainBulletA: { local: './assets/models/train-bullet-a.glb', cdn: `${KENNEY}/3d/train/train-electric-bullet-a.glb` },
  trainBulletB: { local: './assets/models/train-bullet-b.glb', cdn: `${KENNEY}/3d/train/train-electric-bullet-b.glb` },
  trainCityA: { local: './assets/models/train-city-a.glb', cdn: `${KENNEY}/3d/train/train-electric-city-a.glb` },
  trainCityB: { local: './assets/models/train-city-b.glb', cdn: `${KENNEY}/3d/train/train-electric-city-b.glb` },
  trainFreightBlue: { local: './assets/models/train-freight-blue.glb', cdn: `${KENNEY}/3d/train/train-carriage-container-blue.glb` },
  trainFreightRed: { local: './assets/models/train-freight-red.glb', cdn: `${KENNEY}/3d/train/train-carriage-container-red.glb` },
  trainFreightGreen: { local: './assets/models/train-freight-green.glb', cdn: `${KENNEY}/3d/train/train-carriage-container-green.glb` },
  trackDetailed: { local: './assets/models/track-detailed.glb', cdn: `${KENNEY}/3d/train/track-detailed.glb` },

  // Obstacles & Collectibles
  barrier: { local: './assets/models/barrier.glb', cdn: `${KENNEY}/3d/city-roads/construction-barrier.glb` },
  cone: { local: './assets/models/cone.glb', cdn: `${KENNEY}/3d/city-roads/construction-cone.glb` },
  gantry: { local: './assets/models/gantry.glb', cdn: `${KENNEY}/3d/city-roads/sign-highway-wide.glb` },
  streetlight: { local: './assets/models/streetlight.glb', cdn: `${KENNEY}/3d/city-roads/light-curved.glb` },
  coin: { local: './assets/models/coin.glb', cdn: `${KENNEY}/3d/platformer/coin-gold.glb` },
  key: { local: './assets/models/key.glb', cdn: `${KENNEY}/3d/platformer/key.glb` },
  star: { local: './assets/models/star.glb', cdn: `${KENNEY}/3d/platformer/star.glb` },

  // City Skyline & Trackside Props
  buildingA: { local: './assets/models/building-a.glb', cdn: `${KENNEY}/3d/city-commercial/building-a.glb` },
  buildingB: { local: './assets/models/building-b.glb', cdn: `${KENNEY}/3d/city-commercial/building-b.glb` },
  buildingE: { local: './assets/models/building-e.glb', cdn: `${KENNEY}/3d/city-commercial/building-e.glb` },
  buildingG: { local: './assets/models/building-g.glb', cdn: `${KENNEY}/3d/city-commercial/building-g.glb` },
  buildingSkyA: { local: './assets/models/building-sky-a.glb', cdn: `${KENNEY}/3d/city-commercial/building-skyscraper-a.glb` },
  buildingSkyB: { local: './assets/models/building-sky-b.glb', cdn: `${KENNEY}/3d/city-commercial/building-skyscraper-b.glb` },
  buildingIndA: { local: './assets/models/building-ind-a.glb', cdn: `${KENNEY}/3d/city-industrial/building-a.glb` },
  buildingIndC: { local: './assets/models/building-ind-c.glb', cdn: `${KENNEY}/3d/city-industrial/building-c.glb` },
  tree: { local: './assets/models/tree.glb', cdn: `${KENNEY}/3d/retro-urban/tree-park-large.glb` },
  dumpster: { local: './assets/models/dumpster.glb', cdn: `${KENNEY}/3d/retro-urban/detail-dumpster-closed.glb` }
};

// Shared uniforms for the Subway Surfers curved-world vertex shader
export const WORLD_CURVE = {
  uCurveX: { value: 0.0 },
  uCurveY: { value: 0.00145 }
};

export function applyCurvedShader(material) {
  if (!material || material.userData?.curvedPatched) return material;
  material.userData = { ...(material.userData || {}), curvedPatched: true };
  material.customProgramCacheKey = () => 'subway_rush_curved_v2';
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurveX = WORLD_CURVE.uCurveX;
    shader.uniforms.uCurveY = WORLD_CURVE.uCurveY;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uCurveX;
uniform float uCurveY;`
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
float srDist = max(0.0, -mvPosition.z - 5.0);
float srD2 = srDist * srDist;
mvPosition.y -= srD2 * uCurveY;
mvPosition.x += srD2 * uCurveX;
gl_Position = projectionMatrix * mvPosition;`
      );
  };
  material.needsUpdate = true;
  return material;
}

export function patchObjectCurved(obj, castShadow = true, receiveShadow = true) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = castShadow;
      child.receiveShadow = receiveShadow;
      child.frustumCulled = false; // Curved horizon shifts vertices outside raw bounding box
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => applyCurvedShader(m));
      } else if (child.material) {
        applyCurvedShader(child.material);
      }
    }
  });
}

// Procedural high-res painted textures for railyard ground, graffiti walls & ramps
export function createBallastTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Warm sun-baked railyard gravel base
  ctx.fillStyle = '#a89f91';
  ctx.fillRect(0, 0, 512, 512);

  // Gravel pebbles
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 2.8;
    const shade = 115 + Math.floor(Math.random() * 75);
    ctx.fillStyle = `rgb(${shade + 10}, ${shade + 4}, ${shade - 8})`;
    ctx.fillRect(x, y, r, r);
  }

  // Subtle track-lane gravel beds (3 darker ballast strips)
  const lanes = [86, 256, 426];
  for (const lx of lanes) {
    const grad = ctx.createLinearGradient(lx - 72, 0, lx + 72, 0);
    grad.addColorStop(0, 'rgba(70,62,54,0)');
    grad.addColorStop(0.2, 'rgba(78,70,62,0.45)');
    grad.addColorStop(0.8, 'rgba(78,70,62,0.45)');
    grad.addColorStop(1, 'rgba(70,62,54,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(lx - 72, 0, 144, 512);
  }

  // Concrete outer curbs
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 22, 512);
  ctx.fillRect(490, 0, 22, 512);
  ctx.fillStyle = '#facc15';
  for (let y = 0; y < 512; y += 64) {
    ctx.fillRect(16, y, 6, 32);
    ctx.fillRect(490, y, 6, 32);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = 8;
  return tex;
}

export function createGraffitiWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Warm terracotta urban brick wall
  ctx.fillStyle = '#b4533c';
  ctx.fillRect(0, 0, 512, 256);

  // Brick mortar lines
  ctx.strokeStyle = 'rgba(235, 220, 200, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
    const offset = ((y / 24) % 2) * 26;
    for (let x = offset; x < 512; x += 52) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 24);
      ctx.stroke();
    }
  }

  // Concrete top cap & lower grime band
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(0, 0, 512, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.fillRect(0, 210, 512, 46);

  // Vibrant street-art graffiti splash
  const colors = ['#00f0ff', '#ffe600', '#ff477e', '#4ade80'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.82;
    ctx.beginPath();
    ctx.ellipse(70 + i * 74, 132 + Math.sin(i * 1.7) * 26, 46, 28, (i % 2 ? 0.2 : -0.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = '900 italic 66px Impact, sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0f172a';
  ctx.strokeText('RUSH!', 140, 158);
  ctx.fillStyle = '#ffe600';
  ctx.fillText('RUSH!', 140, 158);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function createRampTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 256, 512);

  // Chevrons pointing up the ramp
  ctx.fillStyle = '#1e293b';
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y + 36);
    ctx.lineTo(128, y + 4);
    ctx.lineTo(256, y + 36);
    ctx.lineTo(256, y + 58);
    ctx.lineTo(128, y + 26);
    ctx.lineTo(0, y + 58);
    ctx.closePath();
    ctx.fill();
  }

  // Side rails
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, 20, 512);
  ctx.fillRect(236, 0, 20, 512);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class AssetManager {
  constructor() {
    this.loader = new GLTFLoader();
    this.gltfs = {};
    this.textures = {};
  }

  async loadAll(onProgress) {
    this.textures.ballast = createBallastTexture();
    this.textures.wall = createGraffitiWallTexture();
    this.textures.ramp = createRampTexture();

    const entries = Object.entries(MODEL_MANIFEST);
    let done = 0;

    const loadOne = async ([key, spec]) => {
      try {
        this.gltfs[key] = await this.loadWithFallback(spec.local, spec.cdn);
      } catch (err) {
        console.warn(`[Assets] Fallback primitive for ${key}:`, err.message);
        this.gltfs[key] = null;
      } finally {
        done++;
        if (onProgress) onProgress(done / entries.length, key);
      }
    };

    // Load in parallel batches of 6 for fast mobile startup
    const queue = [...entries];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (item) await loadOne(item);
      }
    });
    await Promise.all(workers);
  }

  loadWithFallback(localUrl, cdnUrl) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        localUrl,
        (gltf) => resolve(gltf),
        undefined,
        () => {
          this.loader.load(
            cdnUrl,
            (gltf) => resolve(gltf),
            undefined,
            (err) => reject(err)
          );
        }
      );
    });
  }

  /**
   * Clones a loaded GLB (skeleton-safe if rigged), normalizes its bottom to y=0,
   * centers X/Z, rotates Y if requested, and fits exact target dimensions.
   */
  instantiate(key, opts = {}) {
    const {
      targetHeight = null,
      targetWidth = null,
      targetLength = null,
      fitAxis = 'height', // 'height' | 'exact'
      rotateY = 0,
      castShadow = true,
      receiveShadow = true,
      rigged = false
    } = opts;

    const gltf = this.gltfs[key];
    if (!gltf) return null;

    const wrapper = new THREE.Group();
    const model = rigged ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);

    if (rotateY) model.rotation.y = rotateY;
    wrapper.add(model);
    wrapper.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Center X and Z, sit bottom on y=0
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;

    if (fitAxis === 'exact' && targetWidth && targetHeight && targetLength) {
      wrapper.scale.set(
        targetWidth / Math.max(0.001, size.x),
        targetHeight / Math.max(0.001, size.y),
        targetLength / Math.max(0.001, size.z)
      );
    } else if (targetHeight && size.y > 0.001) {
      const s = targetHeight / size.y;
      wrapper.scale.setScalar(s);
    } else if (targetWidth && size.x > 0.001) {
      const s = targetWidth / size.x;
      wrapper.scale.setScalar(s);
    }

    patchObjectCurved(wrapper, castShadow, receiveShadow);

    return {
      group: wrapper,
      animations: gltf.animations || []
    };
  }
}
