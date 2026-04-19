import * as THREE from 'three';

export const PlayerState = {
  IDLE: 'idle',
  MOVING: 'moving',
  JUMPING: 'jumping',
  FALLING: 'falling',
  SLAMMING: 'slamming',
  DASHING: 'dashing',
  HURT: 'hurt',
  DEAD: 'dead'
};

export class Player {
  constructor(scene, events) {
    this.scene = scene;
    this.events = events;

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.state = PlayerState.IDLE;
    this.facing = 0; // Y rotation in radians

    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(0, 0, 0);

    this.collisionRadius = 0.55;
    this.height = 0.8;

    this.isGrounded = false;
    this.isAlive = true;

    this.hurtTimer = 0;
    this.invincibleTimer = 0;
    this.INVINCIBLE_DURATION = 0.4;

    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);

    this._time = 0;
  }

  _buildMesh() {
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xFF6B35,
      roughness: 0.5,
      metalness: 0.1,
      emissive: 0xFF4400,
      emissiveIntensity: 0.12
    });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x00FFFF, emissive: 0x00FFFF, emissiveIntensity: 1 });

    // Body
    const bodyGeo = new THREE.SphereGeometry(0.38, 12, 8);
    this._body = new THREE.Mesh(bodyGeo, orangeMat);
    this._body.castShadow = true;
    this.group.add(this._body);

    // Flatten body
    this._body.scale.y = 0.55;

    // 5 Arms
    this._arms = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const pivot = new THREE.Group();
      pivot.rotation.y = angle;

      const armGeo = new THREE.CylinderGeometry(0.09, 0.05, 1.1, 6);
      const arm = new THREE.Mesh(armGeo, orangeMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.x = 0.55;
      arm.castShadow = true;
      pivot.add(arm);

      // Arm tip
      const tipGeo = new THREE.SphereGeometry(0.1, 6, 4);
      const tip = new THREE.Mesh(tipGeo, orangeMat);
      tip.position.x = 1.1;
      tip.castShadow = true;
      pivot.add(tip);

      this.group.add(pivot);
      this._arms.push({ pivot, arm });
    }

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 6);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.12, 0.22, 0.3);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.12, 0.22, 0.3);
    this.group.add(rightEye);

    // Pupils
    const pupilGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const lPupil = new THREE.Mesh(pupilGeo, pupilMat);
    lPupil.position.set(-0.12, 0.22, 0.37);
    this.group.add(lPupil);

    const rPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rPupil.position.set(0.12, 0.22, 0.37);
    this.group.add(rPupil);

    // Shadow indicator on ground
    const shadowGeo = new THREE.CircleGeometry(0.5, 12);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    this._shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this._shadow.rotation.x = -Math.PI / 2;
    this._shadow.position.y = 0.02;
    this.scene.add(this._shadow);

    // Weapon hold point
    this._weaponMount = new THREE.Group();
    this._weaponMount.position.set(0.5, 0.2, 0.4);
    this.group.add(this._weaponMount);

    this.group.position.copy(this.position);
    this.group.position.y = this.height;
  }

  takeDamage(amount, fromPosition) {
    if (!this.isAlive || this.invincibleTimer > 0) return false;

    this.health = Math.max(0, this.health - amount);
    this.invincibleTimer = this.INVINCIBLE_DURATION;
    this.hurtTimer = 0.15;
    this.state = PlayerState.HURT;

    this.events.emit('playerHurt', { amount, health: this.health });

    if (this.health <= 0) {
      this.die();
      return true;
    }

    // Knockback
    if (fromPosition) {
      const dx = this.position.x - fromPosition.x;
      const dz = this.position.z - fromPosition.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      this.velocity.x += (dx / len) * 4;
      this.velocity.z += (dz / len) * 4;
    }

    return true;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  die() {
    this.isAlive = false;
    this.state = PlayerState.DEAD;
    this.events.emit('playerDead', {});
  }

  reset() {
    this.health = this.maxHealth;
    this.state = PlayerState.IDLE;
    this.isAlive = true;
    this.velocity.set(0, 0, 0);
    this.position.set(0, 0, 0);
    this.group.position.set(0, this.height, 0);
    this.facing = 0;
    this.invincibleTimer = 0;
    this.hurtTimer = 0;
  }

  getWorldPosition() {
    return this.group.position.clone();
  }

  getFireOrigin() {
    const p = this.group.position.clone();
    p.y += 0.2;
    return p;
  }

  update(dt) {
    this._time += dt;

    // Sync group to position
    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;
    this.group.position.y = this.position.y + this.height;

    // Facing direction
    const targetRotY = this.facing;
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotY, dt * 12);

    // Shadow
    this._shadow.position.x = this.position.x;
    this._shadow.position.z = this.position.z;
    const heightAboveGround = Math.max(0, this.position.y);
    const shadowScale = Math.max(0.2, 1 - heightAboveGround * 0.12);
    this._shadow.scale.setScalar(shadowScale);
    this._shadow.material.opacity = 0.25 * shadowScale;

    // Timers
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
      // Flash effect
      const flash = Math.sin(this._time * 40) > 0;
      this.group.visible = flash || this.invincibleTimer <= 0;
    } else {
      this.group.visible = this.isAlive;
    }

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0 && this.state === PlayerState.HURT) {
        this.state = PlayerState.IDLE;
      }
    }

    // Arm animation
    const bobSpeed = this.state === PlayerState.MOVING ? 6 : 1.5;
    const bobAmp = this.state === PlayerState.MOVING ? 0.08 : 0.03;
    this._arms.forEach((arm, i) => {
      arm.pivot.rotation.z = Math.sin(this._time * bobSpeed + i * 1.2) * bobAmp;
    });

    // Jump stretch
    if (!this.isGrounded) {
      const vy = this.velocity.y;
      this.group.scale.y = 1 + vy * 0.04;
      this.group.scale.x = 1 - vy * 0.02;
      this.group.scale.z = 1 - vy * 0.02;
    } else {
      this.group.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 10);
    }
  }
}
