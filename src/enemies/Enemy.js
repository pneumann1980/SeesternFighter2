import * as THREE from 'three';
import { lerpAngle, dist2D } from '../core/Utils.js';

export const EnemyState = {
  PATROL: 'patrol',
  CHASE: 'chase',
  ATTACK: 'attack',
  HURT: 'hurt',
  DEAD: 'dead'
};

// ─────────────────────────────────────────────────────────────────────────────
// Base Enemy
// ─────────────────────────────────────────────────────────────────────────────
export class Enemy {
  constructor(scene, position, config, events) {
    this.scene = scene;
    this.events = events;
    this.position = position.clone();
    this.position.y = 0;
    this.velocity = new THREE.Vector3();
    this.facing = Math.random() * Math.PI * 2;

    this.type = config.type;
    this.maxHealth = config.health;
    this.health = config.health;
    this.damage = config.damage;
    this.speed = config.speed;
    this.detectionRange = config.detectionRange || 14;
    this.attackRange = config.attackRange || 1.5;
    this.collisionRadius = config.collisionRadius || 0.6;
    this.height = config.height || 0.8;
    this.points = config.points || 100;
    this.attackCooldown = config.attackCooldown || 1.2;

    this.state = EnemyState.PATROL;
    this.isAlive = true;
    this._attackTimer = 0;
    this._hurtTimer = 0;
    this._patrolTarget = position.clone();
    this._patrolTimer = 0;
    this._deathTimer = 0;
    this._time = 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.position.y = this.height * 0.5;
    scene.add(this.group);

    this._buildMesh(config);
    this._buildHealthBar();
  }

  _buildMesh(config) {
    // Override in subclasses
  }

  _buildHealthBar() {
    const bgGeo = new THREE.PlaneGeometry(1.0, 0.1);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
    this._hpBg = new THREE.Mesh(bgGeo, bgMat);
    this._hpBg.position.y = this.height * 1.1 + 0.3;
    this._hpBg.rotation.x = -0.4;
    this.group.add(this._hpBg);

    const fgGeo = new THREE.PlaneGeometry(1.0, 0.08);
    const fgMat = new THREE.MeshBasicMaterial({ color: 0x44FF44, side: THREE.DoubleSide });
    this._hpBar = new THREE.Mesh(fgGeo, fgMat);
    this._hpBar.position.y = this.height * 1.1 + 0.3;
    this._hpBar.position.z = 0.001;
    this._hpBar.rotation.x = -0.4;
    this.group.add(this._hpBar);
  }

  _updateHealthBar() {
    const ratio = this.health / this.maxHealth;
    this._hpBar.scale.x = Math.max(0, ratio);
    this._hpBar.position.x = -(1 - ratio) * 0.5;
    if (ratio > 0.5) {
      this._hpBar.material.color.set(0x44FF44);
    } else if (ratio > 0.25) {
      this._hpBar.material.color.set(0xFFAA00);
    } else {
      this._hpBar.material.color.set(0xFF4444);
    }
  }

  takeDamage(amount, hitPos) {
    if (!this.isAlive) return;
    this.health = Math.max(0, this.health - amount);
    this.state = EnemyState.HURT;
    this._hurtTimer = 0.15;

    // Knockback
    if (hitPos) {
      const dx = this.position.x - hitPos.x;
      const dz = this.position.z - hitPos.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      this.velocity.x += (dx / len) * 3;
      this.velocity.z += (dz / len) * 3;
    }

    this.events.emit('enemyHit', {
      position: this.position.clone(),
      amount,
      type: this.type
    });

    this._updateHealthBar();

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.isAlive = false;
    this.state = EnemyState.DEAD;
    this._deathTimer = 0.6;
    this.events.emit('enemyKilled', { position: this.position.clone(), points: this.points, type: this.type });
  }

  attackPlayer(player) {
    if (this._attackTimer > 0) return;
    this._attackTimer = this.attackCooldown;
    player.takeDamage(this.damage, this.position);
  }

  update(dt, playerPos, arena) {
    if (!this.isAlive) {
      // Death animation
      this._deathTimer -= dt;
      if (this._deathTimer <= 0) {
        this.scene.remove(this.group);
        return;
      }
      this.group.scale.lerp(new THREE.Vector3(0.01, 0.01, 0.01), dt * 6);
      this.group.rotation.y += dt * 8;
      this.group.position.y += dt * 2;
      return;
    }

    this._time += dt;
    if (this._attackTimer > 0) this._attackTimer -= dt;

    // Hurt recovery
    if (this._hurtTimer > 0) {
      this._hurtTimer -= dt;
      if (this._hurtTimer <= 0 && this.state === EnemyState.HURT) {
        this.state = EnemyState.CHASE;
      }
    }

    const dist = dist2D(this.position, playerPos);
    this._updateAI(dt, playerPos, dist, arena);
    this._applyMovement(dt, arena);
    this._updateHealthBar();
    this._updateVisual(dt);

    // Sync group to position
    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;
    this.group.position.y = this.position.y + this.height * 0.5;
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.facing, dt * 8);

    // Health bar always faces camera (Y billboard)
    this._hpBg.rotation.y = -this.group.rotation.y;
    this._hpBar.rotation.y = -this.group.rotation.y;
  }

  _updateAI(dt, playerPos, dist, arena) {
    switch (this.state) {
      case EnemyState.PATROL:
        this._patrolTimer -= dt;
        if (this._patrolTimer <= 0) {
          this._patrolTarget.set(
            (Math.random() - 0.5) * 30,
            0,
            (Math.random() - 0.5) * 30
          );
          this._patrolTimer = 2 + Math.random() * 3;
        }
        if (dist < this.detectionRange) {
          this.state = EnemyState.CHASE;
        }
        {
          const pdx = this._patrolTarget.x - this.position.x;
          const pdz = this._patrolTarget.z - this.position.z;
          const pdist = Math.sqrt(pdx * pdx + pdz * pdz);
          if (pdist > 0.5) {
            this.velocity.x += (pdx / pdist) * this.speed * 0.4 * dt;
            this.velocity.z += (pdz / pdist) * this.speed * 0.4 * dt;
            this.facing = Math.atan2(pdx, pdz);
          }
        }
        break;

      case EnemyState.CHASE:
        if (dist > this.detectionRange * 1.5) {
          this.state = EnemyState.PATROL;
          break;
        }
        if (dist < this.attackRange) {
          this.state = EnemyState.ATTACK;
          break;
        }
        {
          const dx = playerPos.x - this.position.x;
          const dz = playerPos.z - this.position.z;
          const len = dist || 1;
          this.velocity.x += (dx / len) * this.speed * dt * 3;
          this.velocity.z += (dz / len) * this.speed * dt * 3;
          this.facing = Math.atan2(dx, dz);
        }
        break;

      case EnemyState.ATTACK:
        if (dist > this.attackRange * 1.3) {
          this.state = EnemyState.CHASE;
        }
        break;

      case EnemyState.HURT:
        // Handled above
        break;
    }
  }

  _applyMovement(dt, arena) {
    const friction = 0.88;
    this.velocity.x *= friction;
    this.velocity.z *= friction;

    // Speed cap
    const hspeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    const maxSpd = this.speed;
    if (hspeed > maxSpd) {
      this.velocity.x = (this.velocity.x / hspeed) * maxSpd;
      this.velocity.z = (this.velocity.z / hspeed) * maxSpd;
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    arena.resolveColliders(this.position, this.collisionRadius);
    arena.clampToBounds(this.position, this.collisionRadius);
  }

  _updateVisual(dt) {
    // Override for type-specific animations
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fast Fish (melee)
// ─────────────────────────────────────────────────────────────────────────────
export class FastFish extends Enemy {
  constructor(scene, position, events) {
    super(scene, position, {
      type: 'fastfish',
      health: 45,
      damage: 15,
      speed: 7,
      detectionRange: 16,
      attackRange: 1.2,
      collisionRadius: 0.5,
      height: 0.6,
      attackCooldown: 0.8,
      points: 100,
    }, events);
  }

  _buildMesh() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x00CED1, roughness: 0.4, emissive: 0x004444, emissiveIntensity: 0.5 });
    const finMat = new THREE.MeshStandardMaterial({ color: 0x00FFFF, roughness: 0.3, emissive: 0x00AAAA, emissiveIntensity: 0.4 });

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.38, 10, 6);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.scale.set(1.5, 0.65, 1.0);
    body.castShadow = true;
    this.group.add(body);

    // Tail
    const tailGeo = new THREE.ConeGeometry(0.25, 0.5, 4);
    const tail = new THREE.Mesh(tailGeo, mat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.65;
    tail.castShadow = true;
    this.group.add(tail);

    // Top fin
    const finGeo = new THREE.ConeGeometry(0.15, 0.35, 4);
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.set(0, 0.35, 0);
    this.group.add(fin);

    // Eye
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xFF4444, emissive: 0xFF0000, emissiveIntensity: 1 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), eyeMat);
    eye.position.set(0.28, 0.08, 0.2);
    this.group.add(eye);

    this._bodyMesh = body;
  }

  _updateAI(dt, playerPos, dist, arena) {
    // Dash charge at close range
    if (this.state === EnemyState.CHASE && dist < 4) {
      // Burst toward player
      const dx = playerPos.x - this.position.x;
      const dz = playerPos.z - this.position.z;
      const len = dist || 1;
      this.velocity.x += (dx / len) * this.speed * 2.5 * dt;
      this.velocity.z += (dz / len) * this.speed * 2.5 * dt;
      this.facing = Math.atan2(dx, dz);
      if (dist < this.attackRange) this.state = EnemyState.ATTACK;
      return;
    }
    super._updateAI(dt, playerPos, dist, arena);
  }

  _updateVisual(dt) {
    // Wiggle when chasing
    if (this.state === EnemyState.CHASE || this.state === EnemyState.ATTACK) {
      this._bodyMesh.rotation.z = Math.sin(this._time * 12) * 0.15;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranged Puffer (shoots projectiles)
// ─────────────────────────────────────────────────────────────────────────────
export class RangedPuffer extends Enemy {
  constructor(scene, position, events) {
    super(scene, position, {
      type: 'rangedpuffer',
      health: 60,
      damage: 12,
      speed: 3.5,
      detectionRange: 18,
      attackRange: 10,
      collisionRadius: 0.65,
      height: 0.8,
      attackCooldown: 1.8,
      points: 150,
    }, events);

    this._shootCallback = null;
  }

  onShoot(callback) {
    this._shootCallback = callback;
  }

  _buildMesh() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xFF8C00, roughness: 0.5, emissive: 0x884400, emissiveIntensity: 0.4 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xFF4400, roughness: 0.3, emissive: 0xFF2200, emissiveIntensity: 0.6 });

    // Puffer body
    const bodyGeo = new THREE.SphereGeometry(0.42, 10, 8);
    const body = new THREE.Mesh(bodyGeo, mat);
    body.castShadow = true;
    this.group.add(body);
    this._bodyMesh = body;

    // Spikes
    const spikeGeo = new THREE.ConeGeometry(0.06, 0.28, 4);
    const spikePositions = [
      [0, 0.42, 0], [0, -0.42, 0], [0.42, 0, 0], [-0.42, 0, 0], [0, 0, 0.42], [0, 0, -0.42],
      [0.3, 0.3, 0], [-0.3, 0.3, 0], [0.3, -0.3, 0], [-0.3, -0.3, 0],
    ];
    spikePositions.forEach(([x, y, z]) => {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(x, y, z);
      const dir = new THREE.Vector3(x, y, z).normalize();
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      this.group.add(spike);
    });

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xFF0000, emissiveIntensity: 2 });
    [-0.18, 0.18].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeMat);
      eye.position.set(ex, 0.1, 0.36);
      this.group.add(eye);
    });
  }

  _updateAI(dt, playerPos, dist, arena) {
    if (dist < this.detectionRange && dist > 3) {
      this.state = EnemyState.ATTACK;
      this.facing = Math.atan2(playerPos.x - this.position.x, playerPos.z - this.position.z);

      // Keep distance
      if (dist < 5) {
        const dx = this.position.x - playerPos.x;
        const dz = this.position.z - playerPos.z;
        const len = dist || 1;
        this.velocity.x += (dx / len) * this.speed * dt * 2;
        this.velocity.z += (dz / len) * this.speed * dt * 2;
      } else if (dist > 9) {
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const len = dist || 1;
        this.velocity.x += (dx / len) * this.speed * dt;
        this.velocity.z += (dz / len) * this.speed * dt;
      }

      // Shoot
      if (this._attackTimer <= 0 && this._shootCallback) {
        const dir = new THREE.Vector3(
          playerPos.x - this.position.x,
          0.2,
          playerPos.z - this.position.z
        ).normalize();
        this._shootCallback(this.position.clone().add(new THREE.Vector3(0, 0.5, 0)), dir, this.damage);
        this._attackTimer = this.attackCooldown;
      }
    } else {
      super._updateAI(dt, playerPos, dist, arena);
    }
  }

  _updateVisual(dt) {
    // Pulsate when attacking
    if (this.state === EnemyState.ATTACK) {
      const s = 1 + Math.sin(this._time * 5) * 0.08;
      this._bodyMesh.scale.setScalar(s);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tank Crab (heavy, slow, tanky)
// ─────────────────────────────────────────────────────────────────────────────
export class TankCrab extends Enemy {
  constructor(scene, position, events) {
    super(scene, position, {
      type: 'tankcrab',
      health: 180,
      damage: 25,
      speed: 3,
      detectionRange: 12,
      attackRange: 1.8,
      collisionRadius: 0.9,
      height: 0.9,
      attackCooldown: 1.5,
      points: 250,
    }, events);
  }

  _buildMesh() {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x8B1A1A, roughness: 0.6, metalness: 0.3, emissive: 0x3a0000, emissiveIntensity: 0.4 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0xAA2222, roughness: 0.5, metalness: 0.4, emissive: 0x550000, emissiveIntensity: 0.3 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00, emissive: 0xFFAA00, emissiveIntensity: 2 });

    // Shell
    const shellGeo = new THREE.BoxGeometry(1.2, 0.5, 1.0);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.castShadow = true;
    this.group.add(shell);
    this._shell = shell;

    // Shell dome
    const domeGeo = new THREE.SphereGeometry(0.5, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, shellMat);
    dome.position.y = 0.15;
    this.group.add(dome);

    // Claws
    [[-0.8, 0, 0.3], [0.8, 0, 0.3]].forEach(([cx, cy, cz], idx) => {
      const clawGeo = new THREE.BoxGeometry(0.45, 0.25, 0.35);
      const claw = new THREE.Mesh(clawGeo, clawMat);
      claw.position.set(cx, cy, cz);
      claw.rotation.y = idx === 0 ? -0.3 : 0.3;
      claw.castShadow = true;
      this.group.add(claw);

      // Claw tip
      const tipGeo = new THREE.BoxGeometry(0.2, 0.12, 0.25);
      const tip = new THREE.Mesh(tipGeo, clawMat);
      tip.position.set(cx * 1.25, 0, 0.45);
      this.group.add(tip);
    });

    // Legs (3 each side)
    for (let i = 0; i < 3; i++) {
      [-1, 1].forEach(side => {
        const legGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.6, 4);
        const leg = new THREE.Mesh(legGeo, shellMat);
        leg.position.set(side * 0.65, -0.15, (i - 1) * 0.3);
        leg.rotation.z = side * 0.7;
        this.group.add(leg);
      });
    }

    // Eyes on stalks
    [-0.25, 0.25].forEach(ex => {
      const stalkGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 4);
      const stalk = new THREE.Mesh(stalkGeo, shellMat);
      stalk.position.set(ex, 0.38, 0.4);
      this.group.add(stalk);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeMat);
      eye.position.set(ex, 0.55, 0.45);
      this.group.add(eye);
    });
  }

  _updateAI(dt, playerPos, dist, arena) {
    super._updateAI(dt, playerPos, dist, arena);

    // Charge attack at medium distance
    if (this.state === EnemyState.CHASE && dist < 6 && dist > 2) {
      if (this._attackTimer <= 0) {
        const dx = playerPos.x - this.position.x;
        const dz = playerPos.z - this.position.z;
        const len = dist || 1;
        this.velocity.x += (dx / len) * this.speed * 4;
        this.velocity.z += (dz / len) * this.speed * 4;
        this._attackTimer = 0.5;
      }
    }
  }

  _updateVisual(dt) {
    // Bob up and down while walking
    if (this.state === EnemyState.CHASE || this.state === EnemyState.ATTACK) {
      const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
      this._shell.position.y = Math.sin(this._time * 6) * 0.05 * (speed / this.speed);
    }
  }
}
