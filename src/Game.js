import * as THREE from 'three';
import { EventBus } from './core/EventBus.js';
import { InputManager } from './input/InputManager.js';
import { SceneSetup } from './scene/SceneSetup.js';
import { ArenaBuilder } from './scene/ArenaBuilder.js';
import { Player } from './player/Player.js';
import { PlayerController } from './player/PlayerController.js';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera.js';
import { WeaponManager } from './weapons/WeaponManager.js';
import { ProjectileManager } from './weapons/ProjectileManager.js';
import { EnemyManager } from './enemies/EnemyManager.js';
import { EffectsManager } from './effects/EffectsManager.js';
import { HUD } from './ui/HUD.js';
import { UIManager } from './ui/UIManager.js';

export const GameState = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  DEAD: 'DEAD',
  WAVE_COMPLETE: 'WAVE_COMPLETE',
  WIN: 'WIN',
};

export class Game {
  constructor() {
    this.state = GameState.MENU;
    this.events = new EventBus();
    this.clock = new THREE.Clock(false);
    this.score = 0;
    this.wave = 1;
    this.maxWaves = 5;
  }

  async init() {
    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game-canvas'),
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // ── Input ──
    this.input = new InputManager(this.events);

    // ── Scene ──
    const sceneSetup = new SceneSetup();
    this.scene = sceneSetup.scene;
    this.camera = sceneSetup.camera;

    // ── Arena ──
    this.arena = new ArenaBuilder(this.scene);
    this.arena.build();

    // ── Player ──
    this.player = new Player(this.scene, this.events);
    this.playerController = new PlayerController(this.player, this.input, this.arena);

    // ── Camera ──
    this.tpCamera = new ThirdPersonCamera(this.camera, this.player);

    // ── Weapons ──
    this.projectileManager = new ProjectileManager(this.scene);
    this.weaponManager = new WeaponManager(this.player, this.projectileManager, this.input, this.events);

    // ── Enemies ──
    this.enemyManager = new EnemyManager(this.scene, this.player, this.projectileManager, this.events);
    this.enemyManager.injectArena(this.arena);
    this.weaponManager.injectEnemies(() => this.enemyManager.getAliveEnemies());

    // ── Effects ──
    this.effects = new EffectsManager(this.scene, this.events);
    // Camera shake on slam/hurt
    this.events.on('slamLanded', () => this.tpCamera.shake(0.4));
    this.events.on('playerHurt', () => this.tpCamera.shake(0.25));
    this.events.on('enemyKilled', () => this.tpCamera.shake(0.1));

    // ── UI ──
    this.hud = new HUD(this.events);
    this.ui = new UIManager(this.events);

    // ── Game events ──
    this._setupGameEvents();

    // ── Resize ──
    window.addEventListener('resize', () => this._onResize());

    // ── Show menu ──
    this.ui.showMenu();

    return this;
  }

  _setupGameEvents() {
    this.events.on('startGame', () => this._startGame());
    this.events.on('restart',   () => this._restart());
    this.events.on('playerDead', () => this._onPlayerDead());
    this.events.on('waveComplete', ({ wave }) => this._onWaveComplete(wave));
    this.events.on('enemyKilled', ({ points }) => {
      this.score += points;
      this.hud.updateScore(this.score);
    });
  }

  _startGame() {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.wave = 1;

    this.player.reset();
    this.weaponManager.reset();
    this.projectileManager.reset();
    this.effects.reset();
    this.arena.resetPickups();
    this.enemyManager.startWave(this.wave);

    this.hud.show();
    this.hud.updateScore(0);
    this.hud.updateWave(1);
    this.ui.hideAll();

    this.clock.start();
    this.clock.getDelta(); // burn first frame
  }

  _restart() {
    this.enemyManager.reset();
    this._startGame();
  }

  _onPlayerDead() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.DEAD;

    setTimeout(() => {
      this.hud.hide();
      this.ui.showGameOver(this.score);
    }, 1200);
  }

  _onWaveComplete(wave) {
    if (this.state !== GameState.PLAYING) return;

    if (wave >= this.maxWaves) {
      this.state = GameState.WIN;
      setTimeout(() => {
        this.hud.hide();
        this.ui.showWin(this.score);
      }, 2500);
      return;
    }

    this.state = GameState.WAVE_COMPLETE;
    // UIManager handles the countdown display.
    // Spawn next wave after delay.
    setTimeout(() => {
      if (this.state !== GameState.WAVE_COMPLETE) return;
      this.state = GameState.PLAYING;
      this.wave++;
      this.hud.updateWave(this.wave);
      this.enemyManager.startWave(this.wave);
      // Drop a pickup on wave transition
      this.arena.resetPickups();
    }, 3500);
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      this._update();
      this._render();
    };
    loop();
  }

  _update() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);

    const isActive = this.state === GameState.PLAYING || this.state === GameState.WAVE_COMPLETE;

    if (isActive) {
      // Right joystick rotates camera; camera azimuth is authority for player facing
      this.tpCamera.rotateDelta(this.input.rightJoystick.deltaX, this.input.rightJoystick.deltaY, dt);
      this.playerController.cameraAzimuth = this.tpCamera.azimuth;

      this.playerController.update(dt);
      this.player.update(dt);
      this.tpCamera.update(dt);

      if (this.state === GameState.PLAYING) {
        this.weaponManager.update(dt);
        this.projectileManager.update(dt, this.player.position, this.enemyManager.getAliveEnemies());
        this.enemyManager.updateWithArena(dt);
      }

      // Pickup collection
      const picked = this.arena.checkPlayerPickups(this.player.position);
      picked.forEach(type => this.weaponManager.pickupWeapon(type));

      this.effects.update(dt);
      this.arena.update(dt);
      this.hud.update(dt, this.player, this.weaponManager);

    } else {
      // Even in menu/dead state, keep camera alive
      this.tpCamera.update(dt);
    }

    this.input.update();
  }

  _render() {
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
