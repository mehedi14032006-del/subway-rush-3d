import * as THREE from 'three';
import { AssetManager } from './assets.js';
import { AudioManager } from './audio.js';
import { WorldManager } from './world.js';
import { PlayerController, ParticleBurstSystem, CHARACTERS, HOVERBOARDS } from './player.js';
import { ObstacleSpawner } from './obstacles.js';

const SAVE_KEY = 'subway_rush_3d_save_v2';

const MISSIONS = [
  { type: 'coins', target: 40, label: 'Collect 40 Coins' },
  { type: 'jumps', target: 12, label: 'Jump 12 Times' },
  { type: 'rolls', target: 8, label: 'Roll 8 Times' },
  { type: 'dist', target: 350, label: 'Sprint 350 Meters' },
  { type: 'pickups', target: 3, label: 'Grab 3 Power-Ups' },
  { type: 'score', target: 3500, label: 'Score 3,500 Points' }
];

const UPGRADES = [
  { id: 'jetpack', name: 'JETPACK BOOST', desc: 'Fly longer above the tracks', icon: '🚀', basePrice: 300 },
  { id: 'magnet', name: 'COIN MAGNET', desc: 'Pull coins from all 3 lanes longer', icon: '🧲', basePrice: 300 },
  { id: 'sneakers', name: 'SUPER SNEAKERS', desc: 'Leap onto train roofs longer', icon: '👟', basePrice: 250 },
  { id: 'multiplier', name: '2X MULTIPLIER', desc: 'Double score duration', icon: '⭐', basePrice: 350 }
];

const POWERUP_META = {
  jetpack: { icon: '🚀', max: (lv) => 7.5 + lv * 1.8 },
  magnet: { icon: '🧲', max: (lv) => 9.0 + lv * 2.0 },
  sneakers: { icon: '👟', max: (lv) => 9.0 + lv * 2.0 },
  multiplier: { icon: '⭐', max: (lv) => 10.0 + lv * 2.2 },
  hoverboard: { icon: '🛹', max: () => 24.0 }
};

export class SubwayRushGame {
  constructor() {
    this.save = this.loadSave();
    this.audio = new AudioManager();
    this.assets = new AssetManager();

    this.state = 'loading'; // loading | title | playing | paused | revive | gameover
    this.score = 0;
    this.runCoins = 0;
    this.distance = 0;
    this.speed = 25;
    this.revivesUsed = 0;
    this.reviveCountdown = 4;
    this.reviveInterval = null;
    this.cameraShake = 0;
    this.toastTimer = null;

    // Input buffer for crisp jump right as feet touch down
    this.bufferedJump = 0;
    this.lastTapTime = 0;

    this.powerups = {
      jetpack: 0,
      magnet: 0,
      sneakers: 0,
      multiplier: 0,
      hoverboard: 0
    };

    this.dom = this.queryDom();
    this.initRenderer();
    this.bindUI();
    this.bindControls();
  }

  loadSave() {
    const defaults = {
      coins: 250,
      keys: 3,
      boards: 5,
      highScore: 0,
      baseMult: 1,
      missionIdx: 0,
      missionProg: 0,
      selectedChar: 'boy',
      unlockedChars: ['boy'],
      selectedBoard: 'classic',
      unlockedBoards: ['classic'],
      upgrades: { jetpack: 1, magnet: 1, sneakers: 1, multiplier: 1 }
    };
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        ...defaults,
        ...raw,
        upgrades: { ...defaults.upgrades, ...(raw.upgrades || {}) }
      };
    } catch {
      return defaults;
    }
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {}
  }

  queryDom() {
    const $ = (id) => document.getElementById(id);
    return {
      canvas: $('game-canvas'),
      speedLines: $('speed-lines'),
      hitFlash: $('hit-flash'),
      loading: $('loading-screen'),
      loaderFill: $('loader-bar-fill'),
      loaderStatus: $('loader-status'),
      title: $('title-screen'),
      titleCoins: $('title-coins'),
      titleKeys: $('title-keys'),
      titleMult: $('title-mult'),
      titleHigh: $('title-highscore'),
      btnSoundTitle: $('btn-sound-title'),
      tapToPlay: $('tap-to-play'),
      btnMissions: $('btn-open-missions'),
      btnCrew: $('btn-open-crew'),
      btnShop: $('btn-open-shop'),
      hud: $('hud'),
      btnPause: $('btn-pause'),
      powerupStack: $('powerup-stack'),
      hudMult: $('hud-mult'),
      hudScore: $('hud-score'),
      hudCoins: $('hud-coins'),
      hudToast: $('hud-toast'),
      btnBoard: $('btn-hoverboard'),
      hudBoardsCount: $('hud-boards-count'),
      pause: $('pause-screen'),
      pauseMissionText: $('pause-mission-text'),
      pauseMissionBar: $('pause-mission-bar'),
      btnResume: $('btn-resume'),
      btnPauseSound: $('btn-pause-sound'),
      btnQuit: $('btn-quit'),
      revive: $('revive-screen'),
      reviveTimer: $('revive-timer'),
      reviveCost: $('revive-cost'),
      btnReviveKey: $('btn-revive-key'),
      btnSkipRevive: $('btn-skip-revive'),
      gameover: $('gameover-screen'),
      newRecordBadge: $('new-record-badge'),
      goScore: $('go-score'),
      goBest: $('go-best'),
      goCoins: $('go-coins'),
      goDist: $('go-dist'),
      btnGoHome: $('btn-go-home'),
      btnPlayAgain: $('btn-play-again'),
      drawer: $('drawer-modal'),
      drawerTitle: $('drawer-title'),
      drawerCoins: $('drawer-coins'),
      btnCloseDrawer: $('btn-close-drawer'),
      drawerContent: $('drawer-content')
    };
  }

  initRenderer() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.25, 340);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.dom.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async boot() {
    await this.assets.loadAll((progress) => {
      const pct = Math.round(progress * 100);
      this.dom.loaderFill.style.width = `${Math.max(5, pct)}%`;
      this.dom.loaderStatus.textContent = `Loading Real 3D Characters & Trains... ${pct}%`;
    });

    this.particles = new ParticleBurstSystem(this.scene);
    this.world = new WorldManager(this.scene, this.assets);
    this.player = new PlayerController(this.scene, this.assets, this.particles);
    this.spawner = new ObstacleSpawner(this.scene, this.assets);

    this.applySavedLoadout();
    this.dom.loading.classList.add('hidden');
    this.enterTitle();

    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  applySavedLoadout() {
    this.player.setCharacter(this.save.selectedChar);
    const b = HOVERBOARDS.find((x) => x.id === this.save.selectedBoard) || HOVERBOARDS[0];
    this.player.setBoardColor(b.color);
  }

  refreshTitleUI() {
    this.dom.titleCoins.textContent = this.save.coins.toLocaleString();
    this.dom.titleKeys.textContent = this.save.keys;
    this.dom.titleMult.textContent = this.save.baseMult;
    this.dom.titleHigh.textContent = Math.floor(this.save.highScore).toLocaleString();
    this.dom.btnSoundTitle.textContent = this.audio.muted ? '🔇' : '🔊';
    this.dom.btnPauseSound.textContent = this.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
  }

  enterTitle() {
    this.state = 'title';
    this.audio.stopMusic();
    this.spawner.clearAll();
    this.player.resetForTitle();
    this.resetPowerups();
    this.dom.hud.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.revive.classList.add('hidden');
    this.dom.gameover.classList.add('hidden');
    this.dom.speedLines.classList.add('hidden');
    this.dom.title.classList.remove('hidden');
    this.refreshTitleUI();
  }

  startNewRun() {
    this.audio.unlock();
    this.audio.playWhistle();
    this.audio.startMusic();

    this.state = 'playing';
    this.score = 0;
    this.runCoins = 0;
    this.distance = 0;
    this.speed = 26;
    this.revivesUsed = 0;
    this.bufferedJump = 0;
    this.resetPowerups();
    this.spawner.clearAll();
    this.player.resetForTitle();
    this.player.startRun();

    this.dom.title.classList.add('hidden');
    this.dom.drawer.classList.add('hidden');
    this.dom.gameover.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.hud.classList.remove('hidden');
    this.updateHUD();
  }

  resetPowerups() {
    for (const k of Object.keys(this.powerups)) this.powerups[k] = 0;
    this.dom.powerupStack.innerHTML = '';
  }

  getActiveMultiplier() {
    return this.save.baseMult * (this.powerups.multiplier > 0 ? 2 : 1);
  }

  showToast(msg) {
    this.dom.hudToast.textContent = msg;
    this.dom.hudToast.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.dom.hudToast.classList.add('hidden'), 1800);
  }

  flashScreen(type = 'white') {
    const cls = type === 'red' ? 'flash-red' : 'flash-white';
    this.dom.hitFlash.classList.add(cls);
    setTimeout(() => this.dom.hitFlash.classList.remove(cls), 140);
  }

  activateHoverboard() {
    if (this.state !== 'playing') return;
    if (this.powerups.hoverboard > 0 || this.powerups.jetpack > 0) return;
    if (this.save.boards <= 0) {
      this.showToast('No Hoverboards! Buy in Shop');
      return;
    }
    this.save.boards--;
    this.persist();
    this.powerups.hoverboard = POWERUP_META.hoverboard.max();
    this.audio.playHoverboard();
    const b = HOVERBOARDS.find((x) => x.id === this.save.selectedBoard) || HOVERBOARDS[0];
    this.particles.emit(new THREE.Vector3(this.player.x, this.player.y + 0.4, 0), b.color, 16, 6, 0.45, 3);
    this.showToast(`🛹 ${b.name} ACTIVE!`);
    this.updateHUD();
  }

  recordMission(type, amount = 1) {
    const m = MISSIONS[this.save.missionIdx % MISSIONS.length];
    if (m.type !== type) return;
    this.save.missionProg = type === 'score' ? Math.max(this.save.missionProg, amount) : this.save.missionProg + amount;
    if (this.save.missionProg >= m.target) {
      this.save.missionIdx++;
      this.save.missionProg = 0;
      this.save.baseMult = Math.min(30, this.save.baseMult + 1);
      this.persist();
      this.audio.playPowerup();
      this.showToast(`🎯 MISSION COMPLETE! x${this.save.baseMult} MULTIPLIER!`);
    }
  }

  handleStumble() {
    if (this.player.stumbleTimer > 0) {
      // Second stumble while Inspector is right behind you -> Caught!
      this.handleCrash();
      return;
    }
    this.player.revertLaneAndStumble();
    this.audio.playWhistle();
    this.cameraShake = 0.42;
    this.flashScreen('red');
    this.showToast('⚠️ INSPECTOR RIGHT BEHIND YOU!');
  }

  handleCrash() {
    if (this.player.invulnTimer > 0) return;

    // Hoverboard saves you with a huge shockwave explosion!
    if (this.powerups.hoverboard > 0) {
      this.powerups.hoverboard = 0;
      this.player.invulnTimer = 1.8;
      this.player.stumbleTimer = 0;
      this.player.guardTargetZ = 14.0;
      this.spawner.clearNearPlayer(46);
      const b = HOVERBOARDS.find((x) => x.id === this.save.selectedBoard) || HOVERBOARDS[0];
      this.particles.emitShockwave(new THREE.Vector3(this.player.x, this.player.y, 0), b.color);
      this.audio.playShockwave();
      this.cameraShake = 0.72;
      this.flashScreen('white');
      this.showToast('💥 BOARD SHIELD SAVED YOU!');
      return;
    }

    this.audio.playCrash();
    this.audio.stopMusic();
    this.cameraShake = 0.85;
    this.flashScreen('red');
    this.player.playAnim('die', 1.0);
    this.player.guardZ = 1.6;
    this.player.guardRoot.visible = true;

    const reviveCost = Math.pow(2, this.revivesUsed);
    if (this.save.keys >= reviveCost && this.revivesUsed < 3) {
      this.enterRevivePrompt(reviveCost);
    } else {
      this.enterGameOver();
    }
  }

  enterRevivePrompt(cost) {
    this.state = 'revive';
    this.reviveCountdown = 4;
    this.dom.reviveCost.textContent = cost;
    this.dom.reviveTimer.textContent = this.reviveCountdown;
    this.dom.revive.classList.remove('hidden');

    if (this.reviveInterval) clearInterval(this.reviveInterval);
    this.reviveInterval = setInterval(() => {
      this.reviveCountdown--;
      this.dom.reviveTimer.textContent = this.reviveCountdown;
      if (this.reviveCountdown <= 0) {
        clearInterval(this.reviveInterval);
        this.enterGameOver();
      }
    }, 1000);
  }

  useReviveKey() {
    const cost = Math.pow(2, this.revivesUsed);
    if (this.save.keys < cost) return;
    if (this.reviveInterval) clearInterval(this.reviveInterval);

    this.save.keys -= cost;
    this.revivesUsed++;
    this.persist();

    this.dom.revive.classList.add('hidden');
    this.spawner.clearNearPlayer(52);
    this.player.invulnTimer = 2.4;
    this.player.stumbleTimer = 0;
    this.player.guardTargetZ = 14.0;
    this.player.playAnim('run', 1.3);
    this.particles.emitShockwave(new THREE.Vector3(this.player.x, this.player.y, 0), '#ffd43b');
    this.audio.playPowerup();
    this.audio.startMusic();
    this.state = 'playing';
    this.showToast('🔑 SAVED! KEEP RUNNING!');
  }

  enterGameOver() {
    if (this.reviveInterval) clearInterval(this.reviveInterval);
    this.state = 'gameover';
    this.dom.revive.classList.add('hidden');
    this.dom.hud.classList.add('hidden');
    this.dom.speedLines.classList.add('hidden');

    const finalScore = Math.floor(this.score);
    const isRecord = finalScore > this.save.highScore;
    if (isRecord) this.save.highScore = finalScore;
    this.save.coins += this.runCoins;
    this.persist();

    this.dom.newRecordBadge.classList.toggle('hidden', !isRecord);
    this.dom.goScore.textContent = finalScore.toLocaleString();
    this.dom.goBest.textContent = Math.floor(this.save.highScore).toLocaleString();
    this.dom.goCoins.textContent = `+${this.runCoins}`;
    this.dom.goDist.textContent = `${Math.floor(this.distance)}m`;
    this.dom.gameover.classList.remove('hidden');
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.stopMusic();
    const m = MISSIONS[this.save.missionIdx % MISSIONS.length];
    this.dom.pauseMissionText.textContent = `${m.label} (${Math.min(Math.floor(this.save.missionProg), m.target)}/${m.target})`;
    this.dom.pauseMissionBar.style.width = `${Math.min(100, (this.save.missionProg / m.target) * 100)}%`;
    this.dom.btnPauseSound.textContent = this.audio.muted ? 'SOUND: OFF' : 'SOUND: ON';
    this.dom.pause.classList.remove('hidden');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.dom.pause.classList.add('hidden');
    this.audio.startMusic();
    this.lastFrame = performance.now();
  }

  updateHUD() {
    this.dom.hudScore.textContent = String(Math.floor(this.score)).padStart(6, '0');
    this.dom.hudCoins.textContent = this.runCoins;
    this.dom.hudMult.textContent = `x${this.getActiveMultiplier()}`;
    this.dom.hudBoardsCount.textContent = this.save.boards;

    // Render active power-up timer bars
    let html = '';
    for (const [key, meta] of Object.entries(POWERUP_META)) {
      const rem = this.powerups[key];
      if (rem > 0) {
        const lv = this.save.upgrades[key] || 1;
        const pct = Math.max(0, Math.min(100, (rem / meta.max(lv)) * 100));
        html += `<div class="pu-chip"><span class="pu-chip-ico">${meta.icon}</span><div class="pu-bar-bg"><div class="pu-bar-fill" style="width:${pct}%"></div></div></div>`;
      }
    }
    this.dom.powerupStack.innerHTML = html;
  }

  openDrawer(tab) {
    this.audio.unlock();
    this.audio.playClick();
    this.dom.drawer.classList.remove('hidden');
    this.dom.drawerCoins.textContent = this.save.coins.toLocaleString();
    const content = this.dom.drawerContent;
    content.innerHTML = '';

    if (tab === 'shop') {
      this.dom.drawerTitle.textContent = 'BOOST SHOP';

      // Consumables: Hoverboard & Key
      this.appendShopRow(content, {
        icon: '🛹',
        name: `HOVERBOARD (Owned: ${this.save.boards})`,
        desc: 'Double-tap mid-run for a 24s crash shield',
        btnText: '300 🪙',
        btnClass: 'buy',
        disabled: this.save.coins < 300,
        onClick: () => {
          this.save.coins -= 300;
          this.save.boards += 1;
          this.persist();
          this.audio.playPowerup();
          this.openDrawer('shop');
          this.refreshTitleUI();
        }
      });

      this.appendShopRow(content, {
        icon: '🔑',
        name: `REVIVE KEY (Owned: ${this.save.keys})`,
        desc: 'Use after a crash to keep your high-score run alive',
        btnText: '900 🪙',
        btnClass: 'buy',
        disabled: this.save.coins < 900,
        onClick: () => {
          this.save.coins -= 900;
          this.save.keys += 1;
          this.persist();
          this.audio.playPowerup();
          this.openDrawer('shop');
          this.refreshTitleUI();
        }
      });

      for (const upg of UPGRADES) {
        const lv = this.save.upgrades[upg.id] || 1;
        const maxLv = 5;
        const price = upg.basePrice * lv;
        const pips = Array.from({ length: maxLv }, (_, idx) => `<span class="pip ${idx < lv ? 'on' : ''}"></span>`).join('');
        this.appendShopRow(content, {
          icon: upg.icon,
          name: upg.name,
          desc: `${upg.desc}<div class="level-pips">${pips}</div>`,
          btnText: lv >= maxLv ? 'MAX' : `${price} 🪙`,
          btnClass: lv >= maxLv ? 'equipped' : 'buy',
          disabled: lv >= maxLv || this.save.coins < price,
          onClick: () => {
            this.save.coins -= price;
            this.save.upgrades[upg.id] = lv + 1;
            this.persist();
            this.audio.playPowerup();
            this.openDrawer('shop');
            this.refreshTitleUI();
          }
        });
      }
    } else if (tab === 'crew') {
      this.dom.drawerTitle.textContent = 'CREW & BOARDS';

      for (const ch of CHARACTERS) {
        const owned = this.save.unlockedChars.includes(ch.id);
        const active = this.save.selectedChar === ch.id;
        this.appendShopRow(content, {
          icon: ch.icon,
          name: ch.name,
          desc: ch.desc,
          selected: active,
          btnText: active ? 'ACTIVE' : (owned ? 'SELECT' : `${ch.price} 🪙`),
          btnClass: active ? 'equipped' : (owned ? 'equip' : 'buy'),
          disabled: active || (!owned && this.save.coins < ch.price),
          onClick: () => {
            if (!owned) {
              this.save.coins -= ch.price;
              this.save.unlockedChars.push(ch.id);
            }
            this.save.selectedChar = ch.id;
            this.persist();
            this.applySavedLoadout();
            this.audio.playPowerup();
            this.openDrawer('crew');
            this.refreshTitleUI();
          }
        });
      }

      for (const bd of HOVERBOARDS) {
        const owned = this.save.unlockedBoards.includes(bd.id);
        const active = this.save.selectedBoard === bd.id;
        this.appendShopRow(content, {
          icon: bd.icon,
          name: bd.name,
          desc: bd.desc,
          selected: active,
          btnText: active ? 'EQUIPPED' : (owned ? 'EQUIP' : `${bd.price} 🪙`),
          btnClass: active ? 'equipped' : (owned ? 'equip' : 'buy'),
          disabled: active || (!owned && this.save.coins < bd.price),
          onClick: () => {
            if (!owned) {
              this.save.coins -= bd.price;
              this.save.unlockedBoards.push(bd.id);
            }
            this.save.selectedBoard = bd.id;
            this.persist();
            this.applySavedLoadout();
            this.audio.playHoverboard();
            this.openDrawer('crew');
            this.refreshTitleUI();
          }
        });
      }
    } else if (tab === 'missions') {
      this.dom.drawerTitle.textContent = `MISSIONS (x${this.save.baseMult})`;
      const current = MISSIONS[this.save.missionIdx % MISSIONS.length];
      const prog = Math.min(Math.floor(this.save.missionProg), current.target);
      const pct = Math.min(100, (prog / current.target) * 100);

      const box = document.createElement('div');
      box.className = 'mission-mini-box';
      box.innerHTML = `
        <div class="mission-mini-label">CURRENT GOAL • REWARD: +1x PERMANENT MULTIPLIER</div>
        <div class="mission-mini-text">${current.label} (${prog}/${current.target})</div>
        <div class="mini-progress-track"><div class="mini-progress-fill" style="width:${pct}%"></div></div>
      `;
      content.appendChild(box);

      const nextM = MISSIONS[(this.save.missionIdx + 1) % MISSIONS.length];
      const upcoming = document.createElement('div');
      upcoming.className = 'shop-item';
      upcoming.innerHTML = `
        <div class="shop-ico">🔜</div>
        <div class="shop-info">
          <div class="shop-name">UP NEXT: ${nextM.label}</div>
          <div class="shop-desc">Complete missions to reach up to x30 Score Multiplier!</div>
        </div>
      `;
      content.appendChild(upcoming);
    }
  }

  appendShopRow(container, cfg) {
    const row = document.createElement('div');
    row.className = `shop-item ${cfg.selected ? 'selected' : ''}`;
    row.innerHTML = `
      <div class="shop-ico">${cfg.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${cfg.name}</div>
        <div class="shop-desc">${cfg.desc}</div>
      </div>
      <button class="shop-buy-btn ${cfg.btnClass}" ${cfg.disabled ? 'disabled' : ''}>${cfg.btnText}</button>
    `;
    const btn = row.querySelector('button');
    btn.addEventListener('click', cfg.onClick);
    container.appendChild(row);
  }

  bindUI() {
    this.dom.tapToPlay.addEventListener('click', () => this.startNewRun());
    this.dom.btnMissions.addEventListener('click', () => this.openDrawer('missions'));
    this.dom.btnCrew.addEventListener('click', () => this.openDrawer('crew'));
    this.dom.btnShop.addEventListener('click', () => this.openDrawer('shop'));
    this.dom.btnCloseDrawer.addEventListener('click', () => {
      this.audio.playClick();
      this.dom.drawer.classList.add('hidden');
    });

    const toggleAudio = () => {
      this.audio.unlock();
      this.audio.toggleMute();
      this.refreshTitleUI();
    };
    this.dom.btnSoundTitle.addEventListener('click', toggleAudio);
    this.dom.btnPauseSound.addEventListener('click', toggleAudio);

    this.dom.btnPause.addEventListener('click', () => this.pauseGame());
    this.dom.btnResume.addEventListener('click', () => this.resumeGame());
    this.dom.btnQuit.addEventListener('click', () => this.enterTitle());
    this.dom.btnBoard.addEventListener('click', (e) => {
      e.stopPropagation();
      this.activateHoverboard();
    });

    this.dom.btnReviveKey.addEventListener('click', () => this.useReviveKey());
    this.dom.btnSkipRevive.addEventListener('click', () => this.enterGameOver());
    this.dom.btnGoHome.addEventListener('click', () => this.enterTitle());
    this.dom.btnPlayAgain.addEventListener('click', () => this.startNewRun());
  }

  bindControls() {
    // Low-latency Android swipe gestures (fires mid-swipe at 26px — zero lift delay!)
    let startX = 0;
    let startY = 0;
    let consumed = false;

    const triggerDir = (action) => {
      if (this.state !== 'playing') return;
      if (action === 'left') {
        if (this.player.switchLane(-1)) this.audio.playSwipe();
      } else if (action === 'right') {
        if (this.player.switchLane(1)) this.audio.playSwipe();
      } else if (action === 'up') {
        const superS = this.powerups.sneakers > 0;
        if (this.player.jump(superS)) {
          this.audio.playJump(superS);
          this.recordMission('jumps', 1);
        } else {
          this.bufferedJump = 0.16;
        }
      } else if (action === 'down') {
        this.player.roll();
        this.audio.playRoll();
        this.recordMission('rolls', 1);
      }
    };

    const target = this.dom.canvas;
    target.addEventListener('touchstart', (e) => {
      if (this.state !== 'playing' || !e.touches.length) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      consumed = false;
    }, { passive: true });

    target.addEventListener('touchmove', (e) => {
      if (this.state !== 'playing' || consumed || !e.touches.length) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.hypot(dx, dy) < 26) return;
      consumed = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        triggerDir(dx < 0 ? 'left' : 'right');
      } else {
        triggerDir(dy < 0 ? 'up' : 'down');
      }
    }, { passive: true });

    target.addEventListener('touchend', () => {
      if (this.state !== 'playing' || consumed) return;
      const now = performance.now();
      if (now - this.lastTapTime < 280) {
        this.activateHoverboard();
        this.lastTapTime = 0;
      } else {
        this.lastTapTime = now;
      }
    }, { passive: true });

    // Full desktop keyboard support as well
    window.addEventListener('keydown', (e) => {
      if (this.state === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        this.startNewRun();
        return;
      }
      if (this.state === 'playing') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') triggerDir('left');
        else if (e.code === 'ArrowRight' || e.code === 'KeyD') triggerDir('right');
        else if (e.code === 'ArrowUp' || e.code === 'KeyW') triggerDir('up');
        else if (e.code === 'ArrowDown' || e.code === 'KeyS') triggerDir('down');
        else if (e.code === 'Space') this.activateHoverboard();
        else if (e.code === 'Escape' || e.code === 'KeyP') this.pauseGame();
      } else if (this.state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
        this.resumeGame();
      }
    });
  }

  updateCamera(dt) {
    if (this.state === 'title') {
      const t = performance.now() * 0.0005;
      this.camera.position.set(Math.sin(t) * 0.75, 2.75, 5.2);
      this.camera.lookAt(0, 1.35, -1.5);
      this.camera.fov += (56 - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();
      return;
    }

    const jetActive = this.powerups.jetpack > 0;
    const desiredX = this.player.x * 0.68;
    const desiredY = this.player.y + (jetActive ? 4.4 : 5.3);
    const desiredZ = jetActive ? 9.6 : 8.4;

    this.camera.position.x += (desiredX - this.camera.position.x) * Math.min(1, dt * 9.5);
    this.camera.position.y += (desiredY - this.camera.position.y) * Math.min(1, dt * 7.5);
    this.camera.position.z += (desiredZ - this.camera.position.z) * Math.min(1, dt * 6.0);

    // Camera impact shake
    let sx = 0;
    let sy = 0;
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.4);
      sx = (Math.random() - 0.5) * this.cameraShake * 0.9;
      sy = (Math.random() - 0.5) * this.cameraShake * 0.9;
    }
    this.camera.position.x += sx;
    this.camera.position.y += sy;

    const targetFov = jetActive ? 74 : Math.min(72, 60 + (this.speed - 26) * 0.32);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    this.camera.lookAt(this.player.x * 0.42, this.player.y + (jetActive ? 1.5 : 2.1), -12);
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.state === 'playing') {
      // Smooth progressive speed ramp up to exhilarating 56 m/s
      const jetBoost = this.powerups.jetpack > 0 ? 15 : 0;
      this.speed = Math.min(54, 26 + this.distance * 0.012);
      const effectiveSpeed = this.speed + jetBoost;

      // Update power-up timers
      for (const k of Object.keys(this.powerups)) {
        if (this.powerups[k] > 0) {
          this.powerups[k] = Math.max(0, this.powerups[k] - dt);
        }
      }

      // Buffered jump execution on touchdown
      if (this.bufferedJump > 0) {
        this.bufferedJump -= dt;
        if (this.player.isGrounded) {
          const superS = this.powerups.sneakers > 0;
          if (this.player.jump(superS)) {
            this.audio.playJump(superS);
            this.recordMission('jumps', 1);
            this.bufferedJump = 0;
          }
        }
      }

      // Distance & Score
      const deltaDist = effectiveSpeed * dt * 0.42;
      this.distance += deltaDist;
      this.score += deltaDist * 4.5 * this.getActiveMultiplier();
      this.recordMission('dist', deltaDist);
      this.recordMission('score', Math.floor(this.score));

      // Speed lines overlay at high velocity or Jetpack
      this.dom.speedLines.classList.toggle('hidden', effectiveSpeed < 42);

      this.world.update(dt, effectiveSpeed, true);
      this.spawner.update(dt, effectiveSpeed, this.player, this.powerups, {
        onCoin: (pos) => {
          this.runCoins++;
          this.score += 10 * this.getActiveMultiplier();
          this.audio.playCoin();
          this.particles.emit(pos, '#ffd43b', 5, 3.2, 0.28, 2.5);
          this.recordMission('coins', 1);
        },
        onPickup: (kind, pos) => {
          this.audio.playPowerup();
          this.particles.emit(pos, '#4ade80', 14, 5.5, 0.45, 4.0);
          if (kind === 'key') {
            this.save.keys++;
            this.persist();
            this.showToast('🔑 +1 REVIVE KEY!');
          } else {
            const lv = this.save.upgrades[kind] || 1;
            this.powerups[kind] = POWERUP_META[kind].max(lv);
            const names = { jetpack: '🚀 JETPACK FLIGHT!', magnet: '🧲 COIN MAGNET!', sneakers: '👟 SUPER SNEAKERS!', multiplier: '⭐ 2X SCORE!' };
            this.showToast(names[kind] || 'POWER-UP!');
            if (kind === 'jetpack') {
              this.spawner.spawnJetpackSkyCoins(-32);
            }
          }
          this.recordMission('pickups', 1);
        },
        onStumble: () => this.handleStumble(),
        onCrash: () => this.handleCrash()
      });

      this.player.update(dt, 'playing', effectiveSpeed, this.powerups);
      this.particles.update(dt);
      this.updateHUD();
    } else if (this.state === 'title') {
      this.world.update(dt, 0, false);
      this.player.update(dt, 'title', 0, this.powerups);
      this.particles.update(dt);
    } else {
      this.particles.update(dt);
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
