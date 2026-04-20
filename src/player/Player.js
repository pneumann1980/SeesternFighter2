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

    this._moveMagnitude = 0; // set by PlayerController each frame

    this.group = new THREE.Group();
    this._buildMesh();
    scene.add(this.group);

    this._time = 0;
    this._TAU = Math.PI * 2;
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

    // Facing direction — follow camera instantly (Fortnite-style)
    this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, this.facing, dt * 22);

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

    this._animateStarfish(dt);
  }

  _animateStarfish(dt) {
    const t   = this._time;
    const TAU = this._TAU;
    const mag = this._moveMagnitude;
    const moving  = mag > 0.08;
    const airborne = !this.isGrounded;
    const slamming = this.state === PlayerState.SLAMMING;

    // ── Body float bob ──
    const bobFreq = moving ? 7 : 1.5;
    const bobAmp  = moving ? 0.07 * mag : 0.03;
    this._body.position.y = Math.sin(t * bobFreq) * bobAmp;

    // ── Body forward tilt when running ──
    const tiltTarget = moving ? -0.22 * mag : 0;
    this._body.rotation.x = THREE.MathUtils.lerp(
      this._body.rotation.x || 0, tiltTarget, dt * 6
    );

    // ── Arm wave animation ──
    // pivot.rotation.z rotates around the arm's own outward axis,
    // which moves the arm tip UP (negative z) or DOWN (positive z).
    this._arms.forEach(({ pivot }, i) => {
      const phase = (i / 5) * TAU;

      if (slamming) {
        // Tuck all arms sharply downward for the dive
        pivot.rotation.z = THREE.MathUtils.lerp(pivot.rotation.z,  1.5, dt * 20);
        pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x,  0,   dt * 10);

      } else if (airborne) {
        // Arms flare outward (up) – heroic spread
        const spread = this.velocity.y > 1 ? -0.7 : -0.4;
        pivot.rotation.z = THREE.MathUtils.lerp(pivot.rotation.z, spread, dt * 9);
        // Small secondary flutter
        pivot.rotation.x = Math.sin(t * 4 + phase) * 0.1;

      } else if (moving) {
        // Starfish swimming: sequential up-down wave through all arms
        const freq = 5 + mag * 4;   // faster the harder joystick is pushed
        const amp  = 0.30 + mag * 0.30;
        // Each arm hits its peak at a different time → ripple effect
        pivot.rotation.z = Math.sin(t * freq + phase) * -amp;
        // Secondary side-sway for extra life
        pivot.rotation.x = Math.sin(t * freq + phase + Math.PI / 3) * 0.12;

      } else {
        // Idle gentle undulation – each arm drifts at its own pace
        const idleTarget = Math.sin(t * 1.8 + phase) * 0.18;
        pivot.rotation.z = THREE.MathUtils.lerp(pivot.rotation.z, idleTarget, dt * 3);
        pivot.rotation.x = Math.sin(t * 1.3 + phase + 1) * 0.09;
      }
    });

    // ── Squash & stretch (jump / land) ──
    if (airborne) {
      const vy = this.velocity.y;
      this.group.scale.y = THREE.MathUtils.lerp(this.group.scale.y, 1 + vy * 0.05, dt * 16);
      this.group.scale.x = THREE.MathUtils.lerp(this.group.scale.x, 1 - vy * 0.02, dt * 16);
      this.group.scale.z = THREE.MathUtils.lerp(this.group.scale.z, 1 - vy * 0.02, dt * 16);
    } else {
      this.group.scale.x = THREE.MathUtils.lerp(this.group.scale.x, 1, dt * 10);
      this.group.scale.y = THREE.MathUtils.lerp(this.group.scale.y, 1, dt * 10);
      this.group.scale.z = THREE.MathUtils.lerp(this.group.scale.z, 1, dt * 10);
    }

    // ── Hurt shake ──
    if (this.state === PlayerState.HURT && this.hurtTimer > 0) {
      this.group.position.x += (Math.random() - 0.5) * 0.07;
      this.group.position.z += (Math.random() - 0.5) * 0.07;
    }
  }
}
