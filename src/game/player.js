import * as THREE from 'three';
import { applyCurvedShader } from './assets.js';
import { LANES } from './world.js';

export const CHARACTERS = [
  { id: 'boy', key: 'charBoy', name: 'KAI', desc: 'Street Skater • Default Runner', price: 0, icon: '🧢' },
  { id: 'girl', key: 'charGirl', name: 'ZOE', desc: 'Neon Sprinter • Agile Pro', price: 450, icon: '🎧' },
  { id: 'bot', key: 'charBot', name: 'NOVA-X', desc: 'Expressive Cyber Runner', price: 1200, icon: '🤖' }
];

export const HOVERBOARDS = [
  { id: 'classic', name: 'STREET DECK', desc: 'Classic 24s Crash Shield', color: '#00f0ff', price: 0, icon: '🛹' },
  { id: 'blaze', name: 'SOLAR BLAZE', desc: 'Fiery Shockwave Thrusters', color: '#ff6b00', price: 600, icon: '🔥' },
  { id: 'plasma', name: 'HYPER PLASMA', desc: 'Violet Cyber Hover Glow', color: '#c084fc', price: 1500, icon: '⚡' }
];

export class ParticleBurstSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.geo = new THREE.SphereGeometry(0.14, 6, 6);
  }

  emit(pos, color, count = 10, spread = 4.5, life = 0.45, upward = 3.2) {
    const baseMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, baseMat.clone());
      m.position.copy(pos);
      m.scale.setScalar(0.6 + Math.random() * 0.9);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          Math.random() * upward + 0.8,
          (Math.random() - 0.5) * spread
        ),
        age: 0,
        life: life * (0.7 + Math.random() * 0.5)
      });
    }
    baseMat.dispose();
  }

  emitShockwave(pos, color = '#00f0ff') {
    const ringGeo = new THREE.RingGeometry(0.4, 1.0, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.set(pos.x, pos.y + 0.5, pos.z);
    this.scene.add(ring);
    this.particles.push({
      mesh: ring,
      isRing: true,
      age: 0,
      life: 0.52
    });
    this.emit(pos, color, 24, 12, 0.65, 6.5);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        if (p.isRing) p.mesh.geometry.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      if (p.isRing) {
        const s = 1 + t * 14;
        p.mesh.scale.set(s, s, s);
        p.mesh.material.opacity = 1 - t;
      } else {
        p.vel.y -= 14 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.setScalar(Math.max(0.01, (1 - t) * 1.1));
        p.mesh.material.opacity = 1 - t;
      }
    }
  }
}

export class PlayerController {
  constructor(scene, assets, particles) {
    this.scene = scene;
    this.assets = assets;
    this.particles = particles;

    this.root = new THREE.Group();
    this.visual = new THREE.Group();
    this.root.add(this.visual);
    this.scene.add(this.root);

    this.lane = 1;
    this.prevLane = 1;
    this.laneSwitchTimer = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.groundY = 0;
    this.isRolling = false;
    this.rollTimer = 0;
    this.isGrounded = true;
    this.runTime = 0;
    this.stumbleTimer = 0;
    this.invulnTimer = 0;

    this.jetpackMesh = this.buildJetpackRig();
    this.visual.add(this.jetpackMesh);
    this.jetpackMesh.visible = false;

    this.magnetAura = this.buildMagnetAura();
    this.root.add(this.magnetAura);
    this.magnetAura.visible = false;

    this.boardGroup = new THREE.Group();
    this.boardGlow = null;
    this.buildHoverboard();
    this.root.add(this.boardGroup);
    this.boardGroup.visible = false;

    this.charModel = null;
    this.mixer = null;
    this.actions = {};
    this.activeActionName = '';
    this.currentCharId = null;

    this.guardRoot = new THREE.Group();
    this.guardMixer = null;
    this.guardActions = {};
    this.guardZ = 3.8;
    this.guardTargetZ = 3.8;
    this.scene.add(this.guardRoot);
    this.initGuard();

    const shadowGeo = new THREE.CircleGeometry(0.72, 20);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = applyCurvedShader(new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.34,
      depthWrite: false
    }));
    this.blobShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.blobShadow.position.y = 0.06;
    this.scene.add(this.blobShadow);

    this.setCharacter('boy');
  }

  buildHoverboard() {
    const sk = this.assets.instantiate('skateboard', {
      targetWidth: 0.72,
      targetHeight: 0.24,
      targetLength: 1.85,
      fitAxis: 'exact',
      castShadow: true
    });
    if (sk) {
      this.boardGroup.add(sk.group);
    } else {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.12, 1.8),
        applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#ff2a85', metalness: 0.4, roughness: 0.3 }))
      );
      deck.position.y = 0.14;
      this.boardGroup.add(deck);
    }

    const ringGeo = new THREE.RingGeometry(0.35, 0.72, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const glowMat = applyCurvedShader(new THREE.MeshBasicMaterial({
      color: '#00f0ff',
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide
    }));
    this.boardGlow = new THREE.Mesh(ringGeo, glowMat);
    this.boardGlow.position.y = 0.05;
    this.boardGroup.add(this.boardGlow);
  }

  setBoardColor(hex) {
    if (this.boardGlow) this.boardGlow.material.color.set(hex);
  }

  buildJetpackRig() {
    const g = new THREE.Group();
    const tankMat = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#ff3b30', metalness: 0.55, roughness: 0.25 }));
    const trimMat = applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.6, roughness: 0.3 }));
    for (const sx of [-0.22, 0.22]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.76, 12), tankMat);
      tank.position.set(sx, 1.12, 0.32);
      g.add(tank);
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 10), trimMat);
      nozzle.position.set(sx, 0.68, 0.32);
      g.add(nozzle);
    }
    return g;
  }

  buildMagnetAura() {
    const geo = new THREE.TorusGeometry(1.15, 0.06, 8, 28);
    geo.rotateX(Math.PI / 2);
    const mat = applyCurvedShader(new THREE.MeshBasicMaterial({
      color: '#f43f5e',
      transparent: true,
      opacity: 0.68
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 1.05;
    return mesh;
  }

  initGuard() {
    const inst = this.assets.instantiate('charGuard', {
      targetHeight: 2.05,
      rotateY: Math.PI,
      rigged: true,
      castShadow: true
    });
    if (inst) {
      this.guardRoot.add(inst.group);
      this.guardMixer = new THREE.AnimationMixer(inst.group);
      this.guardActions = this.mapAnimations(this.guardMixer, inst.animations);
      this.playGuardAnim('idle');
    }
  }

  setCharacter(charId) {
    if (this.currentCharId === charId && this.charModel) return;
    const spec = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
    this.currentCharId = spec.id;

    if (this.charModel) {
      this.visual.remove(this.charModel);
      this.charModel = null;
    }
    this.mixer = null;
    this.actions = {};
    this.activeActionName = '';

    const inst = this.assets.instantiate(spec.key, {
      targetHeight: 1.88,
      rotateY: Math.PI,
      rigged: true,
      castShadow: true
    });

    if (inst) {
      this.charModel = inst.group;
      this.visual.add(this.charModel);
      if (inst.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.charModel);
        this.actions = this.mapAnimations(this.mixer, inst.animations);
        this.playAnim('idle');
      }
    } else {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.32, 0.75, 6, 12),
        applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 }))
      );
      body.position.y = 1.0;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        applyCurvedShader(new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.5 }))
      );
      head.position.y = 1.68;
      g.add(body, head);
      this.charModel = g;
      this.visual.add(g);
    }
  }

  mapAnimations(mixer, clips) {
    const byName = (patterns) => {
      for (const pat of patterns) {
        const hit = clips.find((c) => c.name.toLowerCase().includes(pat));
        if (hit) return mixer.clipAction(hit);
      }
      return clips[0] ? mixer.clipAction(clips[0]) : null;
    };

    return {
      run: byName(['sprint', 'running', 'run', 'walk']),
      idle: byName(['idle', 'static', 'stand', 'walk']),
      jump: byName(['jump', 'air', 'fall', 'sprint']),
      roll: byName(['crouch', 'sit', 'roll', 'duck', 'fall']),
      die: byName(['die', 'death', 'fall', 'sit'])
    };
  }

  playAnim(name, speedScale = 1.0) {
    const next = this.actions[name] || this.actions.run || this.actions.idle;
    if (!next) return;
    next.timeScale = speedScale;
    if (this.activeActionName === name) return;
    const prev = this.actions[this.activeActionName];
    this.activeActionName = name;
    next.reset().fadeIn(0.1).play();
    if (prev && prev !== next) prev.fadeOut(0.1);
  }

  playGuardAnim(name) {
    const next = this.guardActions[name] || this.guardActions.run;
    if (!next) return;
    Object.values(this.guardActions).forEach((a) => {
      if (a && a !== next) a.fadeOut(0.12);
    });
    next.reset().fadeIn(0.12).play();
  }

  resetForTitle() {
    this.lane = 1;
    this.prevLane = 1;
    this.laneSwitchTimer = 0;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.groundY = 0;
    this.isRolling = false;
    this.rollTimer = 0;
    this.isGrounded = true;
    this.stumbleTimer = 0;
    this.invulnTimer = 0;
    this.root.position.set(0, 0, 0);
    this.visual.rotation.set(0, Math.PI, 0);
    this.visual.scale.set(1, 1, 1);
    this.visual.visible = true;
    this.jetpackMesh.visible = false;
    this.magnetAura.visible = false;
    this.boardGroup.visible = false;
    this.guardZ = -2.2;
    this.guardTargetZ = -2.2;
    this.guardRoot.position.set(-1.35, 0, -2.2);
    this.guardRoot.rotation.y = Math.PI * 0.85;
    this.guardRoot.visible = true;
    this.playAnim('idle', 1.0);
    this.playGuardAnim('idle');
  }

  startRun() {
    this.stumbleTimer = 0;
    this.invulnTimer = 0;
    this.visual.visible = true;
    this.guardZ = 2.6;
    this.guardTargetZ = 14.0;
    this.guardRoot.position.set(0, 0, 2.6);
    this.guardRoot.rotation.y = 0;
    this.playAnim('run', 1.35);
    this.playGuardAnim('run');
  }

  switchLane(dir) {
    const next = Math.max(0, Math.min(2, this.lane + dir));
    if (next === this.lane) return false;
    this.prevLane = this.lane;
    this.lane = next;
    this.laneSwitchTimer = 0.28;
    return true;
  }

  revertLaneAndStumble() {
    this.lane = this.prevLane;
    this.laneSwitchTimer = 0;
    this.stumbleTimer = 7.5;
    this.guardTargetZ = 2.25;
    this.guardZ = Math.min(this.guardZ, 5.2);
    this.guardRoot.visible = true;
  }

  jump(superSneakers = false) {
    if (!this.isGrounded) return false;
    this.isRolling = false;
    this.rollTimer = 0;
    this.isGrounded = false;
    this.vy = superSneakers ? 20.8 : 15.6;
    this.playAnim('jump', 1.15);
    return true;
  }

  roll() {
    this.isRolling = true;
    this.rollTimer = 0.62;
    if (!this.isGrounded) {
      this.vy = -34.0;
    }
    this.playAnim('roll', 1.4);
  }

  getHitbox() {
    const h = this.isRolling ? 0.85 : 1.72;
    return {
      x: this.x,
      yMin: this.y,
      yMax: this.y + h,
      zMin: -0.45,
      zMax: 0.45,
      halfWidth: 0.42
    };
  }

  update(dt, state, speed, powerups) {
    this.runTime += dt;
    if (this.mixer) this.mixer.update(dt);
    if (this.guardMixer) this.guardMixer.update(dt);

    if (state === 'title') {
      this.visual.rotation.y = Math.PI + Math.sin(this.runTime * 0.9) * 0.28;
      this.root.position.set(0, 0, 0);
      this.blobShadow.position.set(0, 0.06, 0);
      this.guardRoot.position.set(-1.35, 0, -2.2);
      this.guardRoot.rotation.y = Math.PI * 0.85;
      return;
    }

    this.visual.rotation.y += (0 - this.visual.rotation.y) * Math.min(1, dt * 12);
    this.guardRoot.rotation.y = 0;

    if (state !== 'playing') return;

    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.laneSwitchTimer > 0) this.laneSwitchTimer = Math.max(0, this.laneSwitchTimer - dt);

    const targetX = LANES[this.lane];
    const dx = targetX - this.x;
    this.x += dx * Math.min(1, dt * 18.5);

    const targetLean = THREE.MathUtils.clamp(-dx * 0.16, -0.35, 0.35);
    this.visual.rotation.z += (targetLean - this.visual.rotation.z) * Math.min(1, dt * 16);

    const jetActive = powerups.jetpack > 0;
    const boardActive = powerups.hoverboard > 0 && !jetActive;
    const magActive = powerups.magnet > 0;

    this.jetpackMesh.visible = jetActive;
    this.boardGroup.visible = boardActive;
    this.magnetAura.visible = magActive;
    if (magActive) {
      this.magnetAura.rotation.z += dt * 4.2;
      const s = 1 + Math.sin(this.runTime * 10) * 0.08;
      this.magnetAura.scale.set(s, s, s);
    }

    if (jetActive) {
      this.isRolling = false;
      this.isGrounded = false;
      const cruiseY = 10.6;
      this.y += (cruiseY - this.y) * Math.min(1, dt * 6.5);
      this.vy = 0;
      this.visual.rotation.x += (-0.38 - this.visual.rotation.x) * Math.min(1, dt * 10);
      this.visual.scale.set(1, 1, 1);
      this.playAnim('jump', 0.6);

      if (Math.random() < 0.85) {
        const colors = ['#ff4757', '#ffa502', '#ffe600', '#00f0ff'];
        const col = colors[Math.floor(Math.random() * colors.length)];
        this.particles.emit(
          new THREE.Vector3(this.x + (Math.random() - 0.5) * 0.5, this.y + 0.55, 0.45),
          col,
          2,
          1.4,
          0.32,
          -1.5
        );
      }
    } else {
      const gravity = powerups.sneakers > 0 ? 44 : 49;
      this.vy -= gravity * dt;
      this.y += this.vy * dt;

      if (this.y <= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        if (!this.isGrounded) {
          this.isGrounded = true;
          if (!this.isRolling) {
            this.playAnim('run', 1.2 + speed * 0.014);
          }
        }
      } else {
        this.isGrounded = false;
      }

      if (this.isRolling) {
        this.rollTimer -= dt;
        this.visual.scale.y += (0.52 - this.visual.scale.y) * Math.min(1, dt * 22);
        this.visual.rotation.x += (0.55 - this.visual.rotation.x) * Math.min(1, dt * 18);
        if (this.rollTimer <= 0) {
          this.isRolling = false;
          this.playAnim(this.isGrounded ? 'run' : 'jump', 1.3);
        }
      } else {
        this.visual.scale.y += (1.0 - this.visual.scale.y) * Math.min(1, dt * 18);
        const runPitch = this.isGrounded ? (boardActive ? 0.05 : 0.1) : -0.14;
        this.visual.rotation.x += (runPitch - this.visual.rotation.x) * Math.min(1, dt * 12);
        if (this.isGrounded) {
          this.playAnim('run', 1.15 + speed * 0.015);
        }
      }

      if (boardActive) {
        this.visual.position.y = 0.34 + Math.sin(this.runTime * 11) * 0.06;
        this.boardGroup.position.y = 0.1 + Math.sin(this.runTime * 11) * 0.06;
        this.boardGroup.rotation.z = this.visual.rotation.z * 1.4;
        if (Math.random() < 0.45) {
          this.particles.emit(
            new THREE.Vector3(this.x, this.y + 0.15, 0.85),
            this.boardGlow.material.color.getHex(),
            1,
            0.8,
            0.22,
            0.2
          );
        }
      } else {
        this.visual.position.y = 0;
      }
    }

    this.visual.visible = this.invulnTimer <= 0 || Math.floor(this.invulnTimer * 18) % 2 === 0;
    this.root.position.set(this.x, this.y, 0);

    this.blobShadow.position.set(this.x, this.groundY + 0.06, 0);
    const heightAbove = Math.max(0, this.y - this.groundY);
    const shadowScale = Math.max(0.32, 1.0 - heightAbove * 0.08);
    this.blobShadow.scale.setScalar(shadowScale);
    this.blobShadow.material.opacity = Math.max(0.08, 0.36 - heightAbove * 0.03);

    if (this.stumbleTimer > 0) {
      this.stumbleTimer -= dt;
      if (this.stumbleTimer <= 0) {
        this.guardTargetZ = 14.0;
      }
    }
    this.guardZ += (this.guardTargetZ - this.guardZ) * Math.min(1, dt * 2.1);
    this.guardRoot.position.x += (this.x - this.guardRoot.position.x) * Math.min(1, dt * 8);
    this.guardRoot.position.y += (Math.min(this.y, 3.25) - this.guardRoot.position.y) * Math.min(1, dt * 8);
    this.guardRoot.position.z = this.guardZ;
    this.guardRoot.visible = this.guardZ < 11.5 && !jetActive;
  }
}
