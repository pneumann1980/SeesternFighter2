import * as THREE from 'three';

export const WEAPONS = {
  bubble: {
    name: 'Bubble Blaster',
    icon: '🫧',
    damage: 12,
    fireRate: 0.22,
    speed: 20,
    type: 'bubble',
    ammo: Infinity,
    spread: 0,
    count: 1,
    homing: true,
    homingStrength: 4,
    range: 25,
    color: 0x00E5FF,
  },
  coral: {
    name: 'Coral Shotgun',
    icon: '🪸',
    damage: 8,
    fireRate: 0.55,
    speed: 16,
    type: 'coral',
    ammo: 30,
    spread: 0.3,
    count: 5,
    homing: false,
    range: 14,
    color: 0xFF6B35,
  },
  ink: {
    name: 'Ink Sprayer',
    icon: '🦑',
    damage: 7,
    fireRate: 0.08,
    speed: 14,
    type: 'ink',
    ammo: 60,
    spread: 0.18,
    count: 1,
    homing: false,
    range: 12,
    color: 0x6600CC,
  },
  eel: {
    name: 'Eel Beam',
    icon: '⚡',
    damage: 20,
    fireRate: 0.65,
    speed: 30,
    type: 'eel',
    ammo: 15,
    spread: 0,
    count: 1,
    homing: false,
    range: 30,
    color: 0xFFD700,
  },
  shell: {
    name: 'Shell Cannon',
    icon: '🐚',
    damage: 35,
    fireRate: 1.1,
    speed: 12,
    type: 'shell',
    ammo: 10,
    spread: 0,
    count: 1,
    homing: false,
    range: 20,
    scale: 1.4,
    color: 0x8B6914,
  },
};

export class WeaponManager {
  constructor(player, projectileManager, input, events) {
    this.player = player;
    this.projectiles = projectileManager;
    this.input = input;
    this.events = events;

    // Player carries up to 2 weapons; slot 0 = always bubble
    this._slots = [
      { key: 'bubble', ammo: Infinity },
    ];
    this._currentSlot = 0;
    this._fireCooldown = 0;
    this._weaponSwitchCooldown = 0;

    this._enemies = null; // injected after enemy manager is created
  }

  injectEnemies(getEnemies) {
    this._getEnemies = getEnemies;
  }

  get currentWeaponKey() { return this._slots[this._currentSlot]?.key || 'bubble'; }
  get currentWeapon()    { return WEAPONS[this.currentWeaponKey]; }
  get currentAmmo()      { return this._slots[this._currentSlot]?.ammo ?? 0; }

  pickupWeapon(type) {
    if (type === 'health') {
      this.player.heal(30);
      this.events.emit('pickupCollected', { type: 'health' });
      return;
    }

    if (!WEAPONS[type]) return;

    // Check if we already have it
    const existing = this._slots.find(s => s.key === type);
    if (existing) {
      existing.ammo = Math.min(existing.ammo + WEAPONS[type].ammo, WEAPONS[type].ammo * 2);
      this.events.emit('pickupCollected', { type });
      return;
    }

    // Add to slot 1 (replace if full)
    if (this._slots.length < 2) {
      this._slots.push({ key: type, ammo: WEAPONS[type].ammo });
    } else {
      this._slots[1] = { key: type, ammo: WEAPONS[type].ammo };
    }
    // Switch to new weapon
    this._currentSlot = this._slots.length - 1;
    this.events.emit('pickupCollected', { type });
    this.events.emit('weaponChanged', { weapon: this.currentWeapon, slot: this._currentSlot });
  }

  _getFireDirection(enemies) {
    const az = this.player.facing;
    const baseDir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));

    // Aim assist: find nearest enemy in front
    const wep = this.currentWeapon;
    if (wep.homing || enemies?.length > 0) {
      const playerPos = this.player.position;
      let bestEnemy = null;
      let bestScore = Infinity;

      for (const e of (enemies || [])) {
        if (!e.isAlive) continue;
        const toEnemy = new THREE.Vector3(
          e.position.x - playerPos.x,
          0,
          e.position.z - playerPos.z
        );
        const dist = toEnemy.length();
        if (dist > wep.range + 4) continue;
        toEnemy.normalize();

        const dot = toEnemy.dot(baseDir);
        if (dot < 0.3) continue; // Must be roughly in front

        const score = dist * (1 - dot * 0.7);
        if (score < bestScore) {
          bestScore = score;
          bestEnemy = e;
        }
      }

      if (bestEnemy) {
        const toEnemy = new THREE.Vector3(
          bestEnemy.position.x - playerPos.x,
          0.3,
          bestEnemy.position.z - playerPos.z
        ).normalize();
        // Blend toward enemy: strong assist
        baseDir.lerp(toEnemy, 0.65).normalize();
      }
    }

    return baseDir;
  }

  update(dt) {
    if (!this.player.isAlive) return;

    if (this._fireCooldown > 0) this._fireCooldown -= dt;
    if (this._weaponSwitchCooldown > 0) this._weaponSwitchCooldown -= dt;

    // Weapon switch
    if (this.input.wasPressed('weapon') && this._weaponSwitchCooldown <= 0 && this._slots.length > 1) {
      this._currentSlot = (this._currentSlot + 1) % this._slots.length;
      this._weaponSwitchCooldown = 0.3;
      this.events.emit('weaponChanged', { weapon: this.currentWeapon });
    }

    // Auto-reload if out of ammo, switch to bubble
    const slot = this._slots[this._currentSlot];
    if (slot && slot.ammo === 0 && this.currentWeaponKey !== 'bubble') {
      this._slots.splice(this._currentSlot, 1);
      this._currentSlot = 0;
      this.events.emit('weaponChanged', { weapon: this.currentWeapon });
    }

    // Fire
    if (this.input.buttons.fire && this._fireCooldown <= 0) {
      this._fire();
    }
  }

  _fire() {
    const wep = this.currentWeapon;
    const slot = this._slots[this._currentSlot];

    if (slot.ammo !== Infinity) {
      if (slot.ammo <= 0) return;
      slot.ammo -= wep.count;
    }

    this._fireCooldown = wep.fireRate;

    const enemies = this._getEnemies ? this._getEnemies() : [];
    const dir = this._getFireDirection(enemies);
    const origin = this.player.getFireOrigin();

    if (wep.count > 1) {
      this.projectiles.spawnShotgun({
        position: origin,
        direction: dir,
        speed: wep.speed,
        damage: wep.damage,
        type: wep.type,
        fromPlayer: true,
        spread: wep.spread,
        count: wep.count,
        homing: wep.homing || false,
        homingStrength: wep.homingStrength || 0,
      });
    } else {
      const d = dir.clone();
      if (wep.spread > 0) {
        d.x += (Math.random() - 0.5) * wep.spread;
        d.z += (Math.random() - 0.5) * wep.spread;
        d.normalize();
      }
      this.projectiles.spawn({
        position: origin,
        direction: d,
        speed: wep.speed,
        damage: wep.damage,
        type: wep.type,
        fromPlayer: true,
        scale: wep.scale || 1,
        homing: wep.homing || false,
        homingStrength: wep.homingStrength || 0,
      });
    }

    this.events.emit('playerFired', { weapon: wep });
  }

  getAmmoDisplay() {
    const slot = this._slots[this._currentSlot];
    if (!slot) return '';
    return slot.ammo === Infinity ? '∞' : String(slot.ammo);
  }

  getFireCooldownRatio() {
    const wep = this.currentWeapon;
    return 1 - Math.min(1, this._fireCooldown / wep.fireRate);
  }

  reset() {
    this._slots = [{ key: 'bubble', ammo: Infinity }];
    this._currentSlot = 0;
    this._fireCooldown = 0;
  }
}
