import * as THREE from 'three';
import { FastFish, RangedPuffer, TankCrab } from './Enemy.js';
import { EnemyState } from './Enemy.js';
import { randomSpawnPosition } from '../core/Utils.js';
import { ARENA_SIZE } from '../scene/ArenaBuilder.js';

const WAVE_DEFINITIONS = [
  // Wave 1: intro
  { fastfish: 3, puffer: 1, crab: 0 },
  // Wave 2
  { fastfish: 4, puffer: 2, crab: 1 },
  // Wave 3
  { fastfish: 5, puffer: 2, crab: 1 },
  // Wave 4
  { fastfish: 6, puffer: 3, crab: 2 },
  // Wave 5: boss wave
  { fastfish: 8, puffer: 4, crab: 3 },
];

export class EnemyManager {
  constructor(scene, player, projectileManager, events) {
    this.scene = scene;
    this.player = player;
    this.projectiles = projectileManager;
    this.events = events;

    this._enemies = [];
    this._currentWave = 0;
    this._waveActive = false;
    this._spawnQueue = [];
    this._spawnTimer = 0;
    this._spawnDelay = 0.6;

    this._slamHandler = null;
    this._setupEvents();
  }

  _setupEvents() {
    this._slamHandler = (data) => this._handleSlam(data);
    this.events.on('slamLanded', this._slamHandler);
  }

  _handleSlam({ position, radius, damage }) {
    for (const e of this._enemies) {
      if (!e.isAlive) continue;
      const dx = e.position.x - position.x;
      const dz = e.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < radius) {
        const falloff = 1 - (dist / radius);
        e.takeDamage(Math.round(damage * falloff), position);
        e.velocity.x += (dx / (dist || 1)) * 8 * falloff;
        e.velocity.z += (dz / (dist || 1)) * 8 * falloff;
      }
    }
  }

  startWave(waveNumber) {
    this._currentWave = waveNumber;
    this._waveActive = true;

    const waveDef = WAVE_DEFINITIONS[Math.min(waveNumber - 1, WAVE_DEFINITIONS.length - 1)];
    this._spawnQueue = [];

    // Fill spawn queue
    for (let i = 0; i < waveDef.fastfish; i++) this._spawnQueue.push('fastfish');
    for (let i = 0; i < waveDef.puffer; i++) this._spawnQueue.push('puffer');
    for (let i = 0; i < waveDef.crab; i++) this._spawnQueue.push('crab');

    // Shuffle
    for (let i = this._spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this._spawnQueue[i], this._spawnQueue[j]] = [this._spawnQueue[j], this._spawnQueue[i]];
    }

    this._spawnTimer = 0.5;
  }

  _spawnEnemy(type) {
    const playerPos = this.player.position;
    const pos = randomSpawnPosition(ARENA_SIZE - 2, playerPos, 7);

    let enemy;
    switch (type) {
      case 'fastfish':
        enemy = new FastFish(this.scene, pos, this.events);
        break;
      case 'puffer':
        enemy = new RangedPuffer(this.scene, pos, this.events);
        enemy.onShoot((origin, dir, dmg) => {
          this.projectiles.spawn({
            position: origin,
            direction: dir,
            speed: 10,
            damage: dmg,
            type: 'enemy',
            fromPlayer: false,
            lifetime: 2.5,
          });
        });
        break;
      case 'crab':
        enemy = new TankCrab(this.scene, pos, this.events);
        break;
      default:
        return;
    }

    this._enemies.push(enemy);
  }

  update(dt) {
    if (!this._waveActive) return;

    // Spawn queue
    if (this._spawnQueue.length > 0) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        const type = this._spawnQueue.shift();
        this._spawnEnemy(type);
        this._spawnTimer = this._spawnDelay;
      }
    }

    // Update enemies
    const playerPos = this.player.position;
    const aliveEnemies = [];

    for (const e of this._enemies) {
      if (e.isAlive) {
        e.update(dt, playerPos, this.player.scene ? { resolveColliders: (p, r) => {}, clampToBounds: (p, r) => {} } : {});
        // We need arena - inject it below
      } else {
        e.update(dt, playerPos, null);
      }
    }

    // Melee attack check
    for (const e of this._enemies) {
      if (!e.isAlive) continue;
      if (e.type === 'fastfish' || e.type === 'tankcrab') {
        const dx = e.position.x - playerPos.x;
        const dz = e.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < e.attackRange + 0.5 && e._attackTimer <= 0) {
          e.attackPlayer(this.player);
        }
      }
    }

    // Check enemy projectile hits
    const hitResult = this.projectiles.checkPlayerHit(playerPos);
    if (hitResult && this.player.isAlive) {
      this.player.takeDamage(hitResult.damage, null);
    }

    // Clean up dead enemies (fully gone after death anim)
    this._enemies = this._enemies.filter(e => {
      if (!e.isAlive && e._deathTimer <= 0) return false;
      return true;
    });

    // Wave completion check
    if (this._spawnQueue.length === 0 && this._waveActive) {
      const alive = this._enemies.filter(e => e.isAlive).length;
      if (alive === 0) {
        this._waveActive = false;
        this.events.emit('waveComplete', { wave: this._currentWave });
      }
    }
  }

  injectArena(arena) {
    this._arena = arena;
  }

  updateWithArena(dt) {
    if (!this._waveActive) return;

    if (this._spawnQueue.length > 0) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0) {
        const type = this._spawnQueue.shift();
        this._spawnEnemy(type);
        this._spawnTimer = this._spawnDelay;
      }
    }

    const playerPos = this.player.position;
    const arena = this._arena;

    for (const e of this._enemies) {
      if (e.isAlive) {
        e.update(dt, playerPos, arena);
      } else {
        e.update(dt, playerPos, arena || { resolveColliders: () => {}, clampToBounds: () => {} });
      }
    }

    // Melee attack
    for (const e of this._enemies) {
      if (!e.isAlive) continue;
      if (e.type === 'fastfish' || e.type === 'tankcrab') {
        const dx = e.position.x - playerPos.x;
        const dz = e.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < e.attackRange + 0.3 && e._attackTimer <= 0) {
          e.attackPlayer(this.player);
        }
      }
    }

    // Enemy projectile hits player
    const hitResult = this.projectiles.checkPlayerHit(playerPos);
    if (hitResult && this.player.isAlive) {
      this.player.takeDamage(hitResult.damage, null);
    }

    // Clean up dead enemies that finished death anim
    this._enemies = this._enemies.filter(e => {
      if (!e.isAlive && e._deathTimer <= 0) return false;
      return true;
    });

    // Wave complete check
    if (this._spawnQueue.length === 0 && this._waveActive) {
      const alive = this._enemies.filter(e => e.isAlive).length;
      if (alive === 0) {
        this._waveActive = false;
        this.events.emit('waveComplete', { wave: this._currentWave });
      }
    }
  }

  getAliveEnemies() {
    return this._enemies.filter(e => e.isAlive);
  }

  getEnemyCount() {
    return this._enemies.filter(e => e.isAlive).length + this._spawnQueue.length;
  }

  reset() {
    for (const e of this._enemies) {
      e.health = 0;
      e.isAlive = false;
      this.scene.remove(e.group);
    }
    this._enemies = [];
    this._spawnQueue = [];
    this._waveActive = false;
    this._currentWave = 0;
  }
}
