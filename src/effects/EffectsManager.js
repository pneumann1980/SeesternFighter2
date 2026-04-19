import * as THREE from 'three';
import { randomRange } from '../core/Utils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Simple particle pool
// ─────────────────────────────────────────────────────────────────────────────
class Particle {
  constructor() {
    const geo = new THREE.SphereGeometry(1, 4, 3);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
    this.reset();
  }

  reset() {
    this.active = false;
    this.velocity = new THREE.Vector3();
    this.life = 0;
    this.maxLife = 1;
    this.gravity = 0;
    this.mesh.visible = false;
    this.shrink = true;
    this.baseScale = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Slam ring effect
// ─────────────────────────────────────────────────────────────────────────────
class SlamRing {
  constructor(scene) {
    const geo = new THREE.RingGeometry(0.1, 0.4, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xFF8800,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    this.active = false;
    scene.add(this.mesh);
  }
}

export class EffectsManager {
  constructor(scene, events) {
    this.scene = scene;
    this.events = events;

    this._particles = [];
    this._slamRings = [];
    this._flashTimer = 0;
    this._time = 0;

    this._POOL_SIZE = 120;
    this._buildPool();
    this._buildSlamRings();
    this._setupEvents();
  }

  _buildPool() {
    const colors = [0xFF6B35, 0x00E5FF, 0xFFD700, 0xFF4444, 0x00FF88, 0xFFFFFF];
    for (let i = 0; i < this._POOL_SIZE; i++) {
      const p = new Particle();
      const color = colors[i % colors.length];
      p.mesh.material = new THREE.MeshBasicMaterial({ color, transparent: true });
      this.scene.add(p.mesh);
      this._particles.push(p);
    }
  }

  _buildSlamRings() {
    for (let i = 0; i < 4; i++) {
      this._slamRings.push(new SlamRing(this.scene));
    }
  }

  _setupEvents() {
    this.events.on('enemyHit', data => {
      this.spawnHitSparks(data.position, 6, 0xFF4444);
    });

    this.events.on('enemyKilled', data => {
      this.spawnExplosion(data.position, 18, data.type);
    });

    this.events.on('slamLanded', data => {
      this.spawnSlamImpact(data.position, data.radius);
    });

    this.events.on('playerHurt', () => {
      this.spawnHitSparks(null, 4, 0xFF0000);
    });

    this.events.on('pickupCollected', data => {
      // Visual feedback for pickups
    });
  }

  _getParticle() {
    return this._particles.find(p => !p.active) || null;
  }

  spawnHitSparks(position, count = 6, color = 0xFFFF00) {
    if (!position) return;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.material.color.set(color);
      p.mesh.material.opacity = 1;
      p.mesh.position.copy(position);
      p.mesh.position.y += 0.5;
      p.baseScale = randomRange(0.08, 0.2);
      p.mesh.scale.setScalar(p.baseScale);
      p.velocity.set(
        randomRange(-4, 4),
        randomRange(2, 7),
        randomRange(-4, 4)
      );
      p.life = 0;
      p.maxLife = randomRange(0.3, 0.7);
      p.gravity = -14;
      p.shrink = true;
    }
  }

  spawnExplosion(position, count = 20, type = 'default') {
    const colorMap = {
      fastfish: 0x00CED1,
      rangedpuffer: 0xFF8C00,
      tankcrab: 0x8B1A1A,
      default: 0xFF6B35
    };
    const color = colorMap[type] || colorMap.default;

    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.material.color.set(i % 3 === 0 ? 0xFFFFFF : color);
      p.mesh.material.opacity = 1;
      p.mesh.position.copy(position);
      p.mesh.position.y += randomRange(0, 0.8);
      p.baseScale = randomRange(0.15, 0.45);
      p.mesh.scale.setScalar(p.baseScale);
      const speed = randomRange(3, 10);
      const angle = Math.random() * Math.PI * 2;
      const vert = randomRange(-2, 8);
      p.velocity.set(
        Math.cos(angle) * speed,
        vert,
        Math.sin(angle) * speed
      );
      p.life = 0;
      p.maxLife = randomRange(0.5, 1.0);
      p.gravity = -12;
      p.shrink = true;
    }
  }

  spawnSlamImpact(position, radius) {
    // Expand ring
    const ring = this._slamRings.find(r => !r.active);
    if (ring) {
      ring.active = true;
      ring.mesh.visible = true;
      ring.mesh.position.copy(position);
      ring.mesh.position.y = 0.05;
      ring._maxRadius = radius;
      ring._progress = 0;
      ring.mesh.scale.setScalar(1);
      ring.mesh.material.opacity = 1;
    }

    // Ground particles
    for (let i = 0; i < 20; i++) {
      const p = this._getParticle();
      if (!p) break;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.material.color.set(i % 2 === 0 ? 0xFF8800 : 0xFFFF00);
      p.mesh.material.opacity = 1;
      const angle = (i / 20) * Math.PI * 2;
      const r = randomRange(0.2, radius);
      p.mesh.position.set(
        position.x + Math.cos(angle) * r * 0.5,
        0.1,
        position.z + Math.sin(angle) * r * 0.5
      );
      p.baseScale = randomRange(0.1, 0.35);
      p.mesh.scale.setScalar(p.baseScale);
      p.velocity.set(
        Math.cos(angle) * randomRange(3, 8),
        randomRange(4, 10),
        Math.sin(angle) * randomRange(3, 8)
      );
      p.life = 0;
      p.maxLife = randomRange(0.5, 0.9);
      p.gravity = -15;
      p.shrink = true;
    }
  }

  update(dt) {
    this._time += dt;

    // Update particles
    for (const p of this._particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      const t = p.life / p.maxLife;
      p.velocity.y += p.gravity * dt;
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05;
        p.velocity.y *= -0.3;
        p.velocity.x *= 0.7;
        p.velocity.z *= 0.7;
      }

      if (p.shrink) {
        const scale = p.baseScale * (1 - t);
        p.mesh.scale.setScalar(Math.max(0.001, scale));
      }

      p.mesh.material.opacity = Math.max(0, 1 - t * t);
    }

    // Update slam rings
    for (const ring of this._slamRings) {
      if (!ring.active) continue;
      ring._progress += dt * 2.5;
      if (ring._progress >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const s = ring._maxRadius * ring._progress * 3;
      ring.mesh.scale.setScalar(s);
      ring.mesh.material.opacity = 1 - ring._progress;
    }
  }

  reset() {
    for (const p of this._particles) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const r of this._slamRings) {
      r.active = false;
      r.mesh.visible = false;
    }
  }
}
