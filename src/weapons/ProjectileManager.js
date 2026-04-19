import * as THREE from 'three';

const MAX_PROJECTILES = 80;
const PROJECTILE_LIFETIME = 3.0;

export class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this._projectiles = [];
    this._pool = [];
    this._materials = this._buildMaterials();
  }

  _buildMaterials() {
    return {
      bubble: new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x0088FF, emissiveIntensity: 1.2, transparent: true, opacity: 0.75, roughness: 0.1 }),
      coral:  new THREE.MeshStandardMaterial({ color: 0xFF6B35, emissive: 0xFF4400, emissiveIntensity: 1.0, roughness: 0.4 }),
      ink:    new THREE.MeshStandardMaterial({ color: 0x6600CC, emissive: 0x440088, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }),
      eel:    new THREE.MeshStandardMaterial({ color: 0xFFD700, emissive: 0xFFAA00, emissiveIntensity: 1.5, roughness: 0.2 }),
      shell:  new THREE.MeshStandardMaterial({ color: 0x8B6914, emissive: 0x5a4000, emissiveIntensity: 0.5, roughness: 0.7 }),
      enemy:  new THREE.MeshStandardMaterial({ color: 0xFF2244, emissive: 0xFF0022, emissiveIntensity: 1.0, roughness: 0.3 }),
    };
  }

  _getGeometry(type, scale) {
    const s = scale || 1;
    switch (type) {
      case 'bubble': return new THREE.SphereGeometry(0.18 * s, 8, 6);
      case 'coral':  return new THREE.DodecahedronGeometry(0.14 * s, 0);
      case 'ink':    return new THREE.SphereGeometry(0.22 * s, 6, 4);
      case 'eel':    return new THREE.CylinderGeometry(0.06, 0.06, 0.5 * s, 6);
      case 'shell':  return new THREE.OctahedronGeometry(0.18 * s, 0);
      case 'enemy':  return new THREE.SphereGeometry(0.16, 6, 4);
      default:       return new THREE.SphereGeometry(0.15 * s, 6, 4);
    }
  }

  spawn(config) {
    const {
      position,
      direction,
      speed = 18,
      damage = 10,
      type = 'bubble',
      fromPlayer = true,
      lifetime = PROJECTILE_LIFETIME,
      scale = 1,
      homing = false,
      homingStrength = 0,
    } = config;

    const geo = this._getGeometry(type, scale);
    const mat = this._materials[type] || this._materials.bubble;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.castShadow = false;

    // Eel beam: rotate to match direction
    if (type === 'eel') {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    }

    this.scene.add(mesh);

    const proj = {
      mesh,
      position: position.clone(),
      velocity: direction.clone().normalize().multiplyScalar(speed),
      damage,
      type,
      fromPlayer,
      lifetime,
      age: 0,
      homing,
      homingStrength,
      active: true,
      scale,
    };

    this._projectiles.push(proj);
    return proj;
  }

  spawnShotgun(config) {
    const { spread = 0.2, count = 5 } = config;
    const results = [];
    const baseDir = config.direction.clone();
    for (let i = 0; i < count; i++) {
      const dir = baseDir.clone();
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread * 0.3;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      results.push(this.spawn({ ...config, direction: dir, count: 1 }));
    }
    return results;
  }

  update(dt, playerPos, enemies) {
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const proj = this._projectiles[i];
      if (!proj.active) {
        this._projectiles.splice(i, 1);
        continue;
      }

      proj.age += dt;
      if (proj.age >= proj.lifetime) {
        this._remove(proj, i);
        continue;
      }

      // Homing
      if (proj.homing && proj.fromPlayer && enemies && enemies.length > 0) {
        let nearest = null;
        let nearestDist = 12;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          const dx = e.position.x - proj.position.x;
          const dz = e.position.z - proj.position.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < nearestDist) { nearest = e; nearestDist = d; }
        }
        if (nearest) {
          const toEnemy = new THREE.Vector3(
            nearest.position.x - proj.position.x,
            nearest.position.y + 0.8 - proj.position.y,
            nearest.position.z - proj.position.z
          ).normalize();
          proj.velocity.lerp(toEnemy.multiplyScalar(proj.velocity.length()), dt * proj.homingStrength);
        }
      }

      // Move
      proj.position.x += proj.velocity.x * dt;
      proj.position.y += proj.velocity.y * dt;
      proj.position.z += proj.velocity.z * dt;
      proj.mesh.position.copy(proj.position);
      proj.mesh.rotation.y += dt * 4;

      // Ground
      if (proj.position.y < 0.1) {
        this._remove(proj, i);
        continue;
      }

      // Hit detection
      let hit = false;

      if (proj.fromPlayer && enemies) {
        for (const e of enemies) {
          if (!e.isAlive) continue;
          const dx = proj.position.x - e.position.x;
          const dy = proj.position.y - (e.position.y + e.height * 0.5);
          const dz = proj.position.z - e.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy * 0.5 + dz * dz);
          if (dist < e.collisionRadius + 0.25) {
            e.takeDamage(proj.damage, proj.position);
            hit = true;
            break;
          }
        }
      } else if (!proj.fromPlayer && playerPos) {
        const dx = proj.position.x - playerPos.x;
        const dy = proj.position.y - (playerPos.y + 0.8);
        const dz = proj.position.z - playerPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy * 0.4 + dz * dz);
        if (dist < 0.7) {
          hit = true;
        }
      }

      if (hit) {
        this._remove(proj, i);
      }
    }
  }

  checkPlayerHit(playerPos) {
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const proj = this._projectiles[i];
      if (proj.fromPlayer || !proj.active) continue;
      const dx = proj.position.x - playerPos.x;
      const dz = proj.position.z - playerPos.z;
      const dy = proj.position.y - (playerPos.y + 0.8);
      if (Math.sqrt(dx * dx + dz * dz + dy * dy * 0.3) < 0.7) {
        this._remove(proj, i);
        return { damage: proj.damage };
      }
    }
    return null;
  }

  _remove(proj, idx) {
    proj.active = false;
    this.scene.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    if (idx !== undefined) {
      this._projectiles.splice(idx, 1);
    }
  }

  reset() {
    for (const proj of this._projectiles) {
      this.scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
    }
    this._projectiles = [];
  }

  getActiveProjectiles() {
    return this._projectiles;
  }
}
