import * as THREE from 'three';
import { applyCurvedShader } from './assets.js';
import { LANES } from './world.js';

export const TRAIN_HEIGHT = 3.25;
const CAR_LENGTH = 7.6;

const TRAIN_THEMES = [
  { front: 'trainSubwayA', mid: 'trainSubwayB', rear: 'trainSubwayC' },
  { front: 'trainBulletA', mid: 'trainBulletB', rear: 'trainBulletA' },
  { front: 'trainCityA', mid: 'trainCityB', rear: 'trainCityA' },
  { front: 'trainFreightBlue', mid: 'trainFreightRed', rear: 'trainFreightGreen' }
];

export class ObstacleSpawner {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.obstacles = [];
    this.coins = [];
    this.pickups = [];
    this.nextSpawnZ = -48;
    this.patternIndex = 0;

    this.rampMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      map: this.assets.textures.ramp,
      roughness: 0.65
    }));
    this.rampBaseMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.85,
      metalness: 0.25
    }));
    this.beamMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      color: '#ef4444',
      roughness: 0.45,
      metalness: 0.25
    }));
    this.postMat = applyCurvedShader(new THREE.MeshStandardMaterial({
      color: '#facc15',
      roughness: 0.5
    }));
    this.headlightMat = applyCurvedShader(new THREE.MeshBasicMaterial({ color: '#fffbeb' }));
  }

  clearAll() {
    for (const o of this.obstacles) this.scene.remove(o.mesh);
    for (const c of this.coins) this.scene.remove(c.mesh);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.obstacles = [];
    this.coins = [];
    this.pickups = [];
    this.nextSpawnZ = -46;
    this.patternIndex = 0;
  }

  clearNearPlayer(radiusZ = 42) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (o.z > -radiusZ && o.z < 16) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
      }
    }
  }

  spawnTrain(lane, centerZ, cars = 2, opts = {}) {
    const { moving = false, hasRamp = false, themeIdx = null } = opts;
    const theme = TRAIN_THEMES[themeIdx !== null ? themeIdx : Math.floor(Math.random() * TRAIN_THEMES.length)];
    const totalLen = cars * CAR_LENGTH;
    const group = new THREE.Group();

    for (let i = 0; i < cars; i++) {
      const key = i === 0 ? theme.front : (i === cars - 1 ? theme.rear : theme.mid);
      const car = this.assets.instantiate(key, {
        targetWidth: 2.55,
        targetHeight: TRAIN_HEIGHT,
        targetLength: CAR_LENGTH - 0.14,
        fitAxis: 'exact',
        castShadow: true,
        receiveShadow: true
      });
      const zOff = (totalLen / 2) - CAR_LENGTH * (i + 0.5);
      if (car) {
        car.group.position.set(0, 0, zOff);
        group.add(car.group);
      } else {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, TRAIN_HEIGHT, CAR_LENGTH - 0.2),
          applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.4 }))
        );
        box.position.set(0, TRAIN_HEIGHT / 2, zOff);
        group.add(box);
      }
    }

    if (moving) {
      for (const hx of [-0.72, 0.72]) {
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.26, 12), this.headlightMat);
        lamp.position.set(hx, 1.35, totalLen / 2 + 0.06);
        group.add(lamp);
      }
    }

    group.position.set(LANES[lane], 0, centerZ);
    this.scene.add(group);

    this.obstacles.push({
      type: 'train',
      lane,
      mesh: group,
      z: centerZ,
      length: totalLen,
      height: TRAIN_HEIGHT,
      speedBonus: moving ? 14.5 : 0
    });

    if (hasRamp && !moving) {
      const rampLen = 7.4;
      const rampZ = centerZ + totalLen / 2 + rampLen / 2 - 0.1;
      this.spawnRamp(lane, rampZ, rampLen);
      this.spawnCoinLine(lane, centerZ + totalLen / 2 - 1.5, Math.min(7, cars * 3), TRAIN_HEIGHT + 0.85, 2.2);
    }
  }

  spawnRamp(lane, centerZ, rampLen = 7.4) {
    const group = new THREE.Group();

    // Crisp UV-mapped tilted boarding deck with chevron arrows pointing straight up the ramp
    const hyp = Math.hypot(rampLen, TRAIN_HEIGHT);
    const angle = Math.atan2(TRAIN_HEIGHT, rampLen);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.22, hyp, 1, 1, 6), this.rampMat);
    deck.position.set(0, TRAIN_HEIGHT / 2, 0);
    deck.rotation.x = angle;
    deck.castShadow = true;
    deck.receiveShadow = true;
    deck.frustumCulled = false;
    group.add(deck);

    // Solid steel wedge under-frame
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(rampLen, 0);
    shape.lineTo(rampLen, TRAIN_HEIGHT - 0.1);
    shape.closePath();
    const wedgeGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.3, bevelEnabled: false });
    wedgeGeo.rotateY(Math.PI / 2);
    wedgeGeo.translate(-2.3 / 2, 0, rampLen / 2);
    const wedge = new THREE.Mesh(wedgeGeo, this.rampBaseMat);
    wedge.castShadow = true;
    wedge.frustumCulled = false;
    group.add(wedge);

    group.position.set(LANES[lane], 0, centerZ);
    this.scene.add(group);

    this.obstacles.push({
      type: 'ramp',
      lane,
      mesh: group,
      z: centerZ,
      length: rampLen,
      height: TRAIN_HEIGHT,
      speedBonus: 0
    });
  }

  spawnLowBarrier(lane, z) {
    const group = new THREE.Group();
    const b = this.assets.instantiate('barrier', {
      targetWidth: 2.6,
      targetHeight: 1.12,
      targetLength: 0.72,
      fitAxis: 'exact',
      castShadow: true
    });
    if (b) {
      group.add(b.group);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.1, 0.45), this.beamMat);
      box.position.y = 0.55;
      group.add(box);
    }
    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);

    this.obstacles.push({
      type: 'lowBarrier',
      lane,
      mesh: group,
      z,
      length: 0.85,
      height: 1.12,
      speedBonus: 0
    });
  }

  spawnHighBarrier(lane, z) {
    const group = new THREE.Group();
    for (const sx of [-1.22, 1.22]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.8, 8), this.postMat);
      post.position.set(sx, 1.4, 0);
      post.castShadow = true;
      post.frustumCulled = false;
      group.add(post);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.15, 0.34), this.beamMat);
    sign.position.set(0, 2.1, 0);
    sign.castShadow = true;
    sign.frustumCulled = false;
    group.add(sign);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.78, 0.24, 0.38), this.postMat);
    stripe.position.set(0, 1.72, 0);
    stripe.frustumCulled = false;
    group.add(stripe);

    group.position.set(LANES[lane], 0, z);
    this.scene.add(group);

    this.obstacles.push({
      type: 'highBarrier',
      lane,
      mesh: group,
      z,
      length: 0.75,
      yBottom: 1.28,
      height: 2.8,
      speedBonus: 0
    });
  }

  spawnCoin(x, y, z) {
    let mesh;
    const inst = this.assets.instantiate('coin', {
      targetHeight: 0.78,
      castShadow: false,
      receiveShadow: false
    });
    if (inst) {
      mesh = inst.group;
    } else {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.12, 14),
        applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#ffd43b', metalness: 0.75, roughness: 0.2 }))
      );
      mesh.rotation.x = Math.PI / 2;
    }
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.coins.push({ mesh, x, y, z, magneted: false });
  }

  spawnCoinLine(lane, startZ, count = 5, y = 0.95, spacing = 2.15) {
    for (let i = 0; i < count; i++) {
      this.spawnCoin(LANES[lane], y, startZ - i * spacing);
    }
  }

  spawnCoinArc(lane, centerZ, peakY = 2.65) {
    for (let i = -2; i <= 2; i++) {
      const t = i / 2;
      const y = 0.95 + (1 - t * t) * (peakY - 0.95);
      this.spawnCoin(LANES[lane], y, centerZ + i * 1.9);
    }
  }

  spawnJetpackSkyCoins(startZ = -35) {
    for (let i = 0; i < 36; i++) {
      const z = startZ - i * 2.8;
      const lane = Math.floor(i / 6) % 3;
      this.spawnCoin(LANES[lane], 10.6, z);
      if (i % 4 === 0) {
        this.spawnCoin(LANES[(lane + 1) % 3], 10.6, z);
      }
    }
  }

  spawnPickup(kind, lane, z, y = 1.25) {
    const group = new THREE.Group();
    if (kind === 'multiplier') {
      const st = this.assets.instantiate('star', { targetHeight: 1.05, castShadow: false });
      if (st) group.add(st.group);
    } else if (kind === 'key') {
      const ky = this.assets.instantiate('key', { targetHeight: 1.0, castShadow: false });
      if (ky) group.add(ky.group);
    } else if (kind === 'jetpack') {
      const m1 = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#ff3b30', metalness: 0.6, roughness: 0.25 }));
      const m2 = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.6, roughness: 0.25 }));
      for (const sx of [-0.24, 0.24]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.85, 10), m1);
        cyl.position.x = sx;
        group.add(cyl);
      }
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.2, 0.36), m2);
      group.add(band);
    } else if (kind === 'magnet') {
      const u = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.14, 10, 18, Math.PI),
        applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.5, roughness: 0.3 }))
      );
      u.rotation.z = Math.PI;
      group.add(u);
    } else if (kind === 'sneakers') {
      const bootMat = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.35 }));
      const soleMat = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.42, 0.85), bootMat);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.9), soleMat);
      sole.position.y = -0.22;
      group.add(boot, sole);
    }

    const colors = { jetpack: '#ff6b00', magnet: '#f43f5e', sneakers: '#4ade80', multiplier: '#facc15', key: '#38bdf8' };
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.82, 20),
      applyCurvedShader(new THREE.MeshBasicMaterial({ color: colors[kind] || '#ffffff', side: THREE.DoubleSide }))
    );
    group.add(halo);

    group.position.set(LANES[lane], y, z);
    this.scene.add(group);
    this.pickups.push({ kind, mesh: group, lane, y, z, baseY: y });
  }

  spawnNextPattern(speed) {
    const z = this.nextSpawnZ;
    const p = this.patternIndex % 7;
    this.patternIndex++;
    const shuffled = [0, 1, 2].sort(() => Math.random() - 0.5);
    const allowMoving = speed > 31;

    if (p === 0) {
      this.spawnTrain(shuffled[0], z - 12, 2, { hasRamp: true });
      this.spawnTrain(shuffled[1], z - 14, 2, { moving: false });
      this.spawnLowBarrier(shuffled[2], z - 4);
      this.spawnCoinArc(shuffled[2], z - 4);
      this.spawnHighBarrier(shuffled[2], z - 18);
      this.nextSpawnZ -= 38;
    } else if (p === 1) {
      this.spawnTrain(shuffled[0], z - 18, 2, { moving: allowMoving, themeIdx: 1 });
      this.spawnTrain(shuffled[1], z - 10, 2, { moving: false, themeIdx: 0 });
      this.spawnCoinLine(shuffled[2], z - 3, 6);
      this.nextSpawnZ -= 34;
    } else if (p === 2) {
      this.spawnTrain(0, z - 14, 3, { hasRamp: true, themeIdx: 3 });
      this.spawnTrain(2, z - 14, 3, { hasRamp: true, themeIdx: 2 });
      this.spawnLowBarrier(1, z - 6);
      this.spawnHighBarrier(1, z - 20);
      this.spawnCoinLine(1, z - 9, 4);
      this.nextSpawnZ -= 44;
    } else if (p === 3) {
      this.spawnLowBarrier(0, z - 4);
      this.spawnCoinArc(0, z - 4);
      this.spawnHighBarrier(1, z - 4);
      this.spawnLowBarrier(2, z - 14);
      this.spawnHighBarrier(0, z - 14);
      this.spawnCoinLine(1, z - 11, 5);
      this.nextSpawnZ -= 28;
    } else if (p === 4) {
      this.spawnTrain(1, z - 15, 3, { hasRamp: true, themeIdx: 3 });
      this.spawnTrain(shuffled[0] === 1 ? 0 : shuffled[0], z - 22, 2, { moving: allowMoving, themeIdx: 1 });
      const freeLane = shuffled[0] === 1 ? 2 : (shuffled[0] === 0 ? 2 : 0);
      this.spawnCoinLine(freeLane, z - 5, 6);
      this.nextSpawnZ -= 42;
    } else if (p === 5) {
      this.spawnLowBarrier(shuffled[0], z - 3);
      this.spawnLowBarrier(shuffled[1], z - 3);
      this.spawnCoinArc(shuffled[0], z - 3);
      this.spawnTrain(shuffled[2], z - 14, 2, { hasRamp: true });
      this.spawnHighBarrier(shuffled[1], z - 16);
      this.nextSpawnZ -= 34;
    } else {
      this.spawnTrain(0, z - 9, 2, { moving: false, themeIdx: 0 });
      this.spawnTrain(2, z - 19, 2, { moving: allowMoving, themeIdx: 2 });
      this.spawnCoinLine(1, z - 4, 7);
      this.nextSpawnZ -= 36;
    }

    if (Math.random() < 0.44) {
      const roll = Math.random();
      let kind = 'magnet';
      if (roll < 0.24) kind = 'jetpack';
      else if (roll < 0.50) kind = 'magnet';
      else if (roll < 0.74) kind = 'sneakers';
      else if (roll < 0.93) kind = 'multiplier';
      else kind = 'key';

      const pLane = shuffled[2];
      const onRoof = p === 2 && Math.random() < 0.5;
      this.spawnPickup(kind, onRoof ? 0 : pLane, z - 10, onRoof ? TRAIN_HEIGHT + 1.25 : 1.25);
    }
  }

  update(dt, speed, player, powerups, callbacks) {
    this.nextSpawnZ += speed * dt;
    while (this.nextSpawnZ > -145) {
      this.spawnNextPattern(speed);
    }

    let dynamicGroundY = 0;
    const pBox = player.getHitbox();
    const jetActive = powerups.jetpack > 0;

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      const moveSpeed = speed + (o.speedBonus || 0);
      o.z += moveSpeed * dt;
      o.mesh.position.z = o.z;

      if (o.z - o.length / 2 > 22) {
        this.scene.remove(o.mesh);
        this.obstacles.splice(i, 1);
        continue;
      }

      if (jetActive) continue;

      const ox = LANES[o.lane];
      const xOverlap = Math.abs(pBox.x - ox) < 1.18;
      const zMin = o.z - o.length / 2;
      const zMax = o.z + o.length / 2;
      const zOverlap = pBox.zMax > zMin && pBox.zMin < zMax;

      if (!xOverlap || !zOverlap) continue;

      if (o.type === 'ramp') {
        const prog = THREE.MathUtils.clamp((zMax - 0) / o.length, 0, 1);
        const rampY = prog * o.height;
        if (player.y >= rampY - 1.1) {
          dynamicGroundY = Math.max(dynamicGroundY, rampY);
        }
      } else if (o.type === 'train') {
        if (player.y >= o.height - 0.85) {
          dynamicGroundY = Math.max(dynamicGroundY, o.height);
        } else if (player.invulnTimer <= 0) {
          const isSideClip = player.laneSwitchTimer > 0 && zMax > 1.15;
          if (isSideClip) {
            callbacks.onStumble();
          } else {
            callbacks.onCrash(o);
          }
        }
      } else if (o.type === 'lowBarrier') {
        if (pBox.yMin < o.height - 0.18 && player.invulnTimer <= 0) {
          callbacks.onCrash(o);
        }
      } else if (o.type === 'highBarrier') {
        const hitsBar = pBox.yMax > o.yBottom && pBox.yMin < o.height - 0.2;
        if (hitsBar && player.invulnTimer <= 0) {
          callbacks.onCrash(o);
        }
      }
    }

    player.groundY = dynamicGroundY;

    const magActive = powerups.magnet > 0;
    const pPos = new THREE.Vector3(player.x, player.y + 1.0, 0);

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.z += speed * dt;
      c.mesh.rotation.y += dt * 4.2;

      if (magActive) {
        const distSq = (c.x - pPos.x) ** 2 + (c.y - pPos.y) ** 2 + (c.z - pPos.z) ** 2;
        if (distSq < 155) c.magneted = true;
      }

      if (c.magneted) {
        c.x += (pPos.x - c.x) * Math.min(1, dt * 16);
        c.y += (pPos.y - c.y) * Math.min(1, dt * 16);
        c.z += (pPos.z - c.z) * Math.min(1, dt * 16);
      }

      c.mesh.position.set(c.x, c.y, c.z);

      if (Math.abs(c.z) < 1.35 && Math.abs(c.x - pPos.x) < 1.15 && Math.abs(c.y - pPos.y) < 1.25) {
        callbacks.onCoin(c.mesh.position.clone());
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
        continue;
      }

      if (c.z > 14) {
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.z += speed * dt;
      p.mesh.position.z = p.z;
      p.mesh.position.y = p.baseY + Math.sin(performance.now() * 0.005 + i) * 0.22;
      p.mesh.rotation.y += dt * 2.8;

      if (Math.abs(p.z) < 1.5 && Math.abs(LANES[p.lane] - pPos.x) < 1.35 && Math.abs(p.mesh.position.y - pPos.y) < 1.5) {
        callbacks.onPickup(p.kind, p.mesh.position.clone());
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.z > 14) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }
}
