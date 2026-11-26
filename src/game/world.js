import * as THREE from 'three';
import { applyCurvedShader, WORLD_CURVE } from './assets.js';

export const LANE_WIDTH = 3.2;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH];
const CHUNK_LEN = 26;
const CHUNK_COUNT = 7;

const COMMERCIAL_KEYS = ['buildingA', 'buildingB', 'buildingE', 'buildingG', 'buildingSkyA', 'buildingSkyB'];
const INDUSTRIAL_KEYS = ['buildingIndA', 'buildingIndC'];

export class WorldManager {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.chunks = [];
    this.clouds = [];
    this.curveTimer = 0;
    this.targetCurveX = 0;
    this.targetCurveY = 0.00145;

    this.buildSkyAndLights();
    this.buildChunks();
  }

  buildSkyAndLights() {
    // Vibrant sunny sky dome shader
    const skyGeo = new THREE.SphereGeometry(280, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#0c6cf2') },
        midColor: { value: new THREE.Color('#38bdf8') },
        botColor: { value: new THREE.Color('#bae6fd') },
        sunDir: { value: new THREE.Vector3(0.38, 0.55, -0.74).normalize() }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPos;
        void main() {
          float h = clamp(vWorldPos.y, 0.0, 1.0);
          vec3 col = mix(botColor, midColor, smoothstep(0.0, 0.25, h));
          col = mix(col, topColor, smoothstep(0.22, 0.85, h));
          float sunAmt = max(dot(vWorldPos, sunDir), 0.0);
          col += vec3(1.0, 0.96, 0.78) * pow(sunAmt, 42.0) * 0.75;
          col += vec3(1.0, 0.9, 0.65) * pow(sunAmt, 6.0) * 0.16;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // Distance fog matching warm bright horizon
    this.scene.fog = new THREE.Fog('#87d8ff', 72, 168);

    // Warm daylight Hemisphere + Crisp Directional Sun with soft shadows
    const hemi = new THREE.HemisphereLight('#d4f1ff', '#8c7a6b', 1.15);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#fff8e6', 2.05);
    sun.position.set(16, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 75;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 26;
    sun.shadow.camera.bottom = -12;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);

    // Stylized drifting fluffy clouds
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92 });
    const puffGeo = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 14; i++) {
      const cg = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(puffGeo, cloudMat);
        const s = 2.8 + Math.random() * 2.4;
        m.scale.set(s * 1.4, s * 0.75, s);
        m.position.set((p - 1.2) * 3.4, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.8);
        cg.add(m);
      }
      cg.position.set(
        (Math.random() - 0.5) * 160,
        36 + Math.random() * 24,
        -30 - Math.random() * 145
      );
      this.scene.add(cg);
      this.clouds.push({ group: cg, speed: 1.2 + Math.random() * 1.6 });
    }
  }

  buildChunks() {
    const groundMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      map: this.assets.textures.ballast,
      roughness: 0.92,
      metalness: 0.04
    }));

    const sidewalkMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      roughness: 0.85
    }));

    const wallMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      map: this.assets.textures.wall,
      roughness: 0.86
    }));

    const sleeperMat = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.95 }));
    const railMat = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.25 }));

    // Subdivided floor plane so curved-world vertex shader bends smoothly
    const groundGeo = new THREE.PlaneGeometry(12.2, CHUNK_LEN, 4, 14);
    groundGeo.rotateX(-Math.PI / 2);

    const sidewalkGeo = new THREE.BoxGeometry(16, 0.35, CHUNK_LEN, 2, 1, 10);
    const wallGeo = new THREE.BoxGeometry(0.65, 3.8, CHUNK_LEN, 1, 2, 10);

    for (let i = 0; i < CHUNK_COUNT; i++) {
      const chunk = new THREE.Group();
      chunk.position.z = CHUNK_LEN - i * CHUNK_LEN;

      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.receiveShadow = true;
      ground.frustumCulled = false;
      chunk.add(ground);

      for (const side of [-1, 1]) {
        const sw = new THREE.Mesh(sidewalkGeo, sidewalkMat);
        sw.position.set(side * 14.1, 0.15, 0);
        sw.receiveShadow = true;
        sw.frustumCulled = false;
        chunk.add(sw);

        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.set(side * 6.35, 1.9, 0);
        wall.castShadow = true;
        wall.receiveShadow = true;
        wall.frustumCulled = false;
        chunk.add(wall);
      }

      for (const lx of LANES) {
        this.addTrackLane(chunk, lx, sleeperMat, railMat);
      }

      this.populateCityScenery(chunk, i);

      if (i % 2 === 1) {
        const gantry = this.assets.instantiate('gantry', {
          targetWidth: 13.6,
          targetHeight: 8.8,
          targetLength: 2.2,
          fitAxis: 'exact',
          castShadow: true
        });
        if (gantry) {
          gantry.group.position.set(0, 0, 0);
          chunk.add(gantry.group);
        }
      }

      this.scene.add(chunk);
      this.chunks.push(chunk);
    }
  }

  addTrackLane(chunk, laneX, sleeperMat, railMat) {
    const segCount = 5;
    const segLen = CHUNK_LEN / segCount;
    const hasModel = !!this.assets.gltfs.trackDetailed;

    if (hasModel) {
      for (let s = 0; s < segCount; s++) {
        const t = this.assets.instantiate('trackDetailed', {
          targetWidth: 2.35,
          targetHeight: 0.22,
          targetLength: segLen + 0.08,
          fitAxis: 'exact',
          castShadow: false,
          receiveShadow: true
        });
        if (t) {
          t.group.position.set(laneX, 0.01, -CHUNK_LEN / 2 + segLen * (s + 0.5));
          chunk.add(t.group);
        }
      }
    } else {
      for (const offset of [-0.72, 0.72]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, CHUNK_LEN, 1, 1, 10), railMat);
        rail.position.set(laneX + offset, 0.09, 0);
        rail.frustumCulled = false;
        chunk.add(rail);
      }
      for (let z = -CHUNK_LEN / 2 + 1; z < CHUNK_LEN / 2; z += 1.6) {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.08, 0.28), sleeperMat);
        tie.position.set(laneX, 0.04, z);
        tie.frustumCulled = false;
        chunk.add(tie);
      }
    }
  }

  populateCityScenery(chunk, seedIndex) {
    const allKeys = [...COMMERCIAL_KEYS, ...INDUSTRIAL_KEYS];
    for (const side of [-1, 1]) {
      for (let b = 0; b < 2; b++) {
        const key = allKeys[(seedIndex * 3 + b * 2 + (side > 0 ? 1 : 0)) % allKeys.length];
        const isSky = key.includes('Sky');
        const h = isSky ? 20 + ((seedIndex + b) % 3) * 4.5 : 10.5 + ((seedIndex * 2 + b) % 4) * 2.8;
        const w = 8.8 + ((seedIndex + b) % 2) * 1.6;
        const inst = this.assets.instantiate(key, {
          targetWidth: w,
          targetHeight: h,
          targetLength: 11.4,
          fitAxis: 'exact',
          rotateY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
          castShadow: false,
          receiveShadow: true
        });

        if (inst) {
          inst.group.position.set(
            side * (11.8 + (b % 2) * 0.9),
            0.3,
            b === 0 ? -6.5 : 6.5
          );
          chunk.add(inst.group);
        }
      }

      const light = this.assets.instantiate('streetlight', {
        targetHeight: 7.5,
        rotateY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        castShadow: false
      });
      if (light) {
        light.group.position.set(side * 6.9, 0.3, -2);
        chunk.add(light.group);
      }

      const propKey = (seedIndex + (side > 0 ? 1 : 0)) % 2 === 0 ? 'tree' : 'dumpster';
      const prop = this.assets.instantiate(propKey, {
        targetHeight: propKey === 'tree' ? 5.6 : 1.9,
        rotateY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        castShadow: false
      });
      if (prop) {
        prop.group.position.set(side * 7.6, 0.3, 8.5);
        chunk.add(prop.group);
      }
    }
  }

  update(dt, speed, isRunning) {
    if (isRunning) {
      const dz = speed * dt;
      for (const chunk of this.chunks) {
        chunk.position.z += dz;
        if (chunk.position.z > CHUNK_LEN * 1.45) {
          chunk.position.z -= CHUNK_LEN * CHUNK_COUNT;
        }
      }

      // Dynamically shift curved-world bend left / straight / right every ~14s
      this.curveTimer += dt;
      if (this.curveTimer > 14) {
        this.curveTimer = 0;
        const choices = [-0.0011, -0.00055, 0.0, 0.00055, 0.0011];
        this.targetCurveX = choices[Math.floor(Math.random() * choices.length)];
        this.targetCurveY = 0.00125 + Math.random() * 0.00045;
      }
    } else {
      this.targetCurveX = 0.00035;
      this.targetCurveY = 0.00135;
    }

    WORLD_CURVE.uCurveX.value += (this.targetCurveX - WORLD_CURVE.uCurveX.value) * Math.min(1, dt * 0.45);
    WORLD_CURVE.uCurveY.value += (this.targetCurveY - WORLD_CURVE.uCurveY.value) * Math.min(1, dt * 0.45);

    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 90) c.group.position.x = -90;
    }
  }
}
