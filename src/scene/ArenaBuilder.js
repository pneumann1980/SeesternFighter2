import * as THREE from 'three';
import { randomRange, randomInt } from '../core/Utils.js';

export const ARENA_SIZE = 22; // half-size

export class ArenaBuilder {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // { center: Vector3, radius: number }
    this.pickupSpawnPoints = [];
    this.spawnPoints = [];
    this._pickupMeshes = [];
    this._pickupData = []; // { mesh, type, collected }
    this._time = 0;
  }

  build() {
    this._buildFloor();
    this._buildBoundaryWalls();
    this._buildCoral();
    this._buildRocks();
    this._buildKelp();
    this._buildDecorations();
    this._defineSpawnPoints();
    this._placePickups();
  }

  _buildFloor() {
    const geo = new THREE.PlaneGeometry(ARENA_SIZE * 2, ARENA_SIZE * 2, 20, 20);
    // Slightly perturb vertices for organic look
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) === 0 && pos.getX(i) !== 0) {
        pos.setZ(i, pos.getZ(i) + randomRange(-0.15, 0.15));
      }
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a4a2a,
      roughness: 0.95,
      metalness: 0.0
    });

    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Floor grid lines (subtle)
    const gridHelper = new THREE.GridHelper(ARENA_SIZE * 2, 20, 0x003322, 0x002211);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  _buildBoundaryWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0a2035,
      roughness: 0.8,
      transparent: true,
      opacity: 0.7,
      side: THREE.BackSide
    });

    const wallGeo = new THREE.BoxGeometry(ARENA_SIZE * 2 + 2, 14, 1);
    const positions = [
      [0, 7, -ARENA_SIZE],  // North
      [0, 7, ARENA_SIZE],   // South
    ];
    positions.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x, y, z);
      if (z === 0) w.rotation.y = Math.PI / 2;
      this.scene.add(w);
    });

    const sideGeo = new THREE.BoxGeometry(1, 14, ARENA_SIZE * 2 + 2);
    [[-ARENA_SIZE, 7, 0], [ARENA_SIZE, 7, 0]].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(sideGeo, wallMat);
      w.position.set(x, y, z);
      this.scene.add(w);
    });

    // Invisible boundary colliders
    const bs = ARENA_SIZE - 0.5;
    this.colliders.push({ center: new THREE.Vector3(0, 0, -bs), radius: 2, isWall: true, normal: new THREE.Vector3(0, 0, 1) });
    this.colliders.push({ center: new THREE.Vector3(0, 0, bs), radius: 2, isWall: true, normal: new THREE.Vector3(0, 0, -1) });
    this.colliders.push({ center: new THREE.Vector3(-bs, 0, 0), radius: 2, isWall: true, normal: new THREE.Vector3(1, 0, 0) });
    this.colliders.push({ center: new THREE.Vector3(bs, 0, 0), radius: 2, isWall: true, normal: new THREE.Vector3(-1, 0, 0) });
  }

  _buildCoral() {
    const coralColors = [0xFF6B35, 0xFF1493, 0xFF8C00, 0x00CED1, 0xFF69B4, 0x7CFC00];
    const positions = [
      [-8, 0, -8], [8, 0, -8], [-8, 0, 8], [8, 0, 8],
      [0, 0, -12], [0, 0, 12], [-12, 0, 0], [12, 0, 0],
      [-5, 0, 3], [5, 0, -3], [-3, 0, -5], [3, 0, 5],
    ];

    positions.forEach(([x, y, z]) => {
      const clusterSize = randomInt(2, 4);
      for (let i = 0; i < clusterSize; i++) {
        const cx = x + randomRange(-1.5, 1.5);
        const cz = z + randomRange(-1.5, 1.5);
        const height = randomRange(1.5, 4.5);
        const radius = randomRange(0.3, 0.7);
        const color = coralColors[randomInt(0, coralColors.length - 1)];

        // Stem
        const stemGeo = new THREE.CylinderGeometry(radius * 0.5, radius, height, 7);
        const stemMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, emissive: color, emissiveIntensity: 0.15 });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(cx, height / 2, cz);
        stem.rotation.y = randomRange(0, Math.PI * 2);
        stem.castShadow = true;
        this.scene.add(stem);

        // Top cap
        const capGeo = new THREE.SphereGeometry(radius * 1.2, 8, 6);
        const cap = new THREE.Mesh(capGeo, stemMat);
        cap.position.set(cx, height + radius * 0.5, cz);
        cap.castShadow = true;
        this.scene.add(cap);

        // Add collider (only for taller corals)
        if (height > 2.5) {
          this.colliders.push({ center: new THREE.Vector3(cx, 0, cz), radius: radius + 0.3 });
        }
      }
    });
  }

  _buildRocks() {
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.95, metalness: 0.05 });
    const rockPositions = [
      [-14, 0, -5], [14, 0, 5], [-14, 0, 8], [14, 0, -8],
      [-6, 0, 14], [6, 0, -14], [0, 0, 18], [0, 0, -18],
    ];

    rockPositions.forEach(([x, y, z]) => {
      const sx = randomRange(1.5, 3.5);
      const sy = randomRange(0.8, 2.2);
      const sz = randomRange(1.5, 3.5);
      const geo = new THREE.DodecahedronGeometry(1, 0);
      const rock = new THREE.Mesh(geo, rockMat);
      rock.scale.set(sx, sy, sz);
      rock.position.set(x, sy * 0.5, z);
      rock.rotation.set(randomRange(-0.3, 0.3), randomRange(0, Math.PI * 2), randomRange(-0.3, 0.3));
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);

      if (Math.abs(x) < ARENA_SIZE - 2 && Math.abs(z) < ARENA_SIZE - 2) {
        this.colliders.push({ center: new THREE.Vector3(x, 0, z), radius: Math.max(sx, sz) * 0.7 });
      }
    });
  }

  _buildKelp() {
    const kelpMat = new THREE.MeshStandardMaterial({ color: 0x228822, roughness: 0.8, emissive: 0x002200, emissiveIntensity: 0.3 });
    for (let i = 0; i < 30; i++) {
      const x = randomRange(-ARENA_SIZE + 2, ARENA_SIZE - 2);
      const z = randomRange(-ARENA_SIZE + 2, ARENA_SIZE - 2);
      if (Math.abs(x) < 6 && Math.abs(z) < 6) continue; // Keep center clear

      const segments = randomInt(3, 6);
      const height = randomRange(2, 6);
      const geo = new THREE.CylinderGeometry(0.06, 0.1, height, 5, segments);
      // Wave the top vertices
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const py = pos.getY(v);
        if (py > 0) {
          pos.setX(v, pos.getX(v) + py * randomRange(-0.15, 0.15));
          pos.setZ(v, pos.getZ(v) + py * randomRange(-0.15, 0.15));
        }
      }
      geo.computeVertexNormals();

      const kelp = new THREE.Mesh(geo, kelpMat);
      kelp.position.set(x, height / 2, z);
      this.scene.add(kelp);
    }
  }

  _buildDecorations() {
    // Glowing bioluminescent orbs
    const orbColors = [0x00FFFF, 0xFF00FF, 0x00FF88, 0xFFAA00];
    for (let i = 0; i < 12; i++) {
      const x = randomRange(-ARENA_SIZE + 3, ARENA_SIZE - 3);
      const z = randomRange(-ARENA_SIZE + 3, ARENA_SIZE - 3);
      const y = randomRange(0.3, 3);
      const color = orbColors[randomInt(0, orbColors.length - 1)];

      const geo = new THREE.SphereGeometry(0.12, 8, 6);
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2 });
      const orb = new THREE.Mesh(geo, mat);
      orb.position.set(x, y, z);
      this.scene.add(orb);

      const light = new THREE.PointLight(color, 0.6, 5);
      light.position.copy(orb.position);
      this.scene.add(light);
      orb.userData.light = light;
      orb.userData.baseY = y;
      orb.userData.phase = randomRange(0, Math.PI * 2);
    }
  }

  _defineSpawnPoints() {
    const positions = [
      [-15, 0, -15], [15, 0, -15], [-15, 0, 15], [15, 0, 15],
      [0, 0, -18], [0, 0, 18], [-18, 0, 0], [18, 0, 0],
    ];
    positions.forEach(([x, y, z]) => {
      this.spawnPoints.push(new THREE.Vector3(
        Math.min(Math.max(x, -ARENA_SIZE + 2), ARENA_SIZE - 2),
        y,
        Math.min(Math.max(z, -ARENA_SIZE + 2), ARENA_SIZE - 2)
      ));
    });
  }

  _placePickups() {
    const pickupPositions = [
      [0, 0, -10], [0, 0, 10], [-10, 0, 0], [10, 0, 0],
      [-7, 0, 7], [7, 0, -7], [-7, 0, -7], [7, 0, 7],
    ];
    const weaponTypes = ['bubble', 'coral', 'ink', 'eel', 'shell'];

    pickupPositions.forEach(([x, y, z], idx) => {
      const type = idx < 2 ? 'health' : weaponTypes[idx % weaponTypes.length];
      this._createPickup(new THREE.Vector3(x, 0.8, z), type);
    });
  }

  _createPickup(position, type) {
    const colors = {
      health: 0xFF4444,
      bubble: 0x00E5FF,
      coral:  0xFF6B35,
      ink:    0x9B59B6,
      eel:    0xFFD700,
      shell:  0x8B6914
    };

    const geo = new THREE.OctahedronGeometry(0.35, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: colors[type] || 0xffffff,
      emissive: colors[type] || 0xffffff,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.5
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    mesh.castShadow = false;
    this.scene.add(mesh);

    // Glow ring
    const ringGeo = new THREE.RingGeometry(0.5, 0.65, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colors[type] || 0xffffff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.position.y = 0.05;
    this.scene.add(ring);

    const data = { mesh, ring, type, collected: false, baseY: position.y };
    this._pickupData.push(data);
    this.pickupSpawnPoints.push(position.clone());

    return data;
  }

  getPickups() {
    return this._pickupData;
  }

  resetPickups() {
    this._pickupData.forEach(p => {
      p.collected = false;
      p.mesh.visible = true;
      p.ring.visible = true;
    });
  }

  checkPlayerPickups(playerPos, playerRadius = 1.2) {
    const results = [];
    this._pickupData.forEach(p => {
      if (p.collected) return;
      const dx = p.mesh.position.x - playerPos.x;
      const dz = p.mesh.position.z - playerPos.z;
      if (Math.sqrt(dx * dx + dz * dz) < playerRadius + 0.5) {
        p.collected = true;
        p.mesh.visible = false;
        p.ring.visible = false;
        results.push(p.type);
      }
    });
    return results;
  }

  clampToBounds(position, radius = 0.5) {
    const bound = ARENA_SIZE - radius;
    position.x = Math.max(-bound, Math.min(bound, position.x));
    position.z = Math.max(-bound, Math.min(bound, position.z));
  }

  resolveColliders(position, radius = 0.5) {
    this.clampToBounds(position, radius);

    for (const col of this.colliders) {
      if (col.isWall) continue;
      const dx = position.x - col.center.x;
      const dz = position.z - col.center.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = radius + col.radius;
      if (dist < minDist && dist > 0.001) {
        const push = (minDist - dist) / dist;
        position.x += dx * push;
        position.z += dz * push;
      }
    }
  }

  update(dt) {
    this._time += dt;
    const t = this._time;

    // Animate pickups
    this._pickupData.forEach((p, i) => {
      if (p.collected) return;
      p.mesh.position.y = p.baseY + Math.sin(t * 2 + i) * 0.15;
      p.mesh.rotation.y += dt * 1.5;
    });
  }
}
