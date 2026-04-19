import { worldToScreen } from '../core/Utils.js';

export class HUD {
  constructor(events) {
    this.events = events;
    this._visible = false;
    this._time = 0;

    this._el = {
      hud:       document.getElementById('hud'),
      healthBar: document.getElementById('health-bar'),
      healthText:document.getElementById('health-text'),
      waveNum:   document.getElementById('wave-number'),
      scoreNum:  document.getElementById('score-number'),
      weaponIcon:document.getElementById('weapon-icon'),
      weaponName:document.getElementById('weapon-name'),
      weaponAmmo:document.getElementById('weapon-ammo'),
      coolBar:   document.getElementById('cooldown-bar'),
      hitMarkers:document.getElementById('hit-markers-container'),
      dmgNums:   document.getElementById('damage-numbers-container'),
    };

    this._setupEvents();
  }

  _setupEvents() {
    this.events.on('enemyHit', data => {
      this._showHitMarker();
      if (data.amount) this._showDamageNumber(data.amount, data.position);
    });

    this.events.on('weaponChanged', data => {
      if (data?.weapon) this._updateWeaponDisplay(data.weapon);
    });

    this.events.on('playerHurt', data => {
      this._flashDamage();
    });

    this.events.on('pickupCollected', data => {
      this._showPickupText(data.type);
    });
  }

  show() {
    this._visible = true;
    this._el.hud.classList.remove('hidden');
    document.getElementById('touch-controls').classList.remove('hidden');
  }

  hide() {
    this._visible = false;
    this._el.hud.classList.add('hidden');
    document.getElementById('touch-controls').classList.add('hidden');
  }

  updateScore(score) {
    this._el.scoreNum.textContent = score.toLocaleString();
    this._el.scoreNum.style.transform = 'scale(1.3)';
    setTimeout(() => { this._el.scoreNum.style.transform = 'scale(1)'; }, 200);
  }

  updateWave(wave) {
    this._el.waveNum.textContent = wave;
  }

  _updateWeaponDisplay(weapon) {
    this._el.weaponIcon.textContent = weapon.icon;
    this._el.weaponName.textContent = weapon.name;
  }

  _showHitMarker() {
    const marker = document.createElement('div');
    marker.className = 'hit-marker';
    marker.textContent = '×';
    marker.style.left = (45 + Math.random() * 10) + '%';
    marker.style.top  = (45 + Math.random() * 10) + '%';
    this._el.hitMarkers.appendChild(marker);
    setTimeout(() => marker.remove(), 420);
  }

  _showDamageNumber(amount, worldPos) {
    // Simplified: show at center with slight random offset
    const el = document.createElement('div');
    el.className = 'damage-number' + (amount >= 25 ? ' critical' : '');
    el.textContent = Math.round(amount);
    const x = 45 + Math.random() * 10;
    const y = 40 + Math.random() * 15;
    el.style.left = x + '%';
    el.style.top  = y + '%';
    this._el.dmgNums.appendChild(el);
    setTimeout(() => el.remove(), 820);
  }

  _flashDamage() {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;inset:0;background:rgba(255,0,0,0.22);
      pointer-events:none;z-index:99;border:4px solid rgba(255,0,0,0.5);
      animation:dmgAnim 0.35s forwards;border-radius:0;
    `;
    document.getElementById('hud').appendChild(overlay);
    setTimeout(() => overlay.remove(), 380);
  }

  _showPickupText(type) {
    const labels = {
      health: '♥ +30 Farbe!',
      bubble: '🫧 Bubble Blaster!',
      coral:  '🪸 Coral Shotgun!',
      ink:    '🦑 Ink Sprayer!',
      eel:    '⚡ Eel Beam!',
      shell:  '🐚 Shell Cannon!',
    };
    const text = labels[type] || '✦ Aufgehoben!';

    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = `
      position:absolute;bottom:180px;left:50%;transform:translateX(-50%);
      color:#FFD700;font-size:16px;font-weight:900;letter-spacing:2px;
      text-shadow:0 0 10px #FFD700,0 2px 4px rgba(0,0,0,0.9);
      animation:dmgAnim 1.2s forwards;pointer-events:none;white-space:nowrap;
    `;
    document.getElementById('hud').appendChild(el);
    setTimeout(() => el.remove(), 1250);
  }

  update(dt, player, weaponManager) {
    if (!this._visible) return;
    this._time += dt;

    // Health
    const ratio = player.health / player.maxHealth;
    this._el.healthBar.style.width = (ratio * 100) + '%';
    this._el.healthText.textContent = Math.ceil(player.health);

    // Health bar color
    if (ratio > 0.5) {
      this._el.healthBar.style.background = 'linear-gradient(90deg,#FF6B6B,#FF4444)';
    } else if (ratio > 0.25) {
      this._el.healthBar.style.background = 'linear-gradient(90deg,#FF8C00,#FF6600)';
    } else {
      this._el.healthBar.style.background = 'linear-gradient(90deg,#FF4444,#CC0000)';
      // Pulse at low health
      if (Math.sin(this._time * 8) > 0.5) {
        this._el.healthBar.style.filter = 'brightness(1.4)';
      } else {
        this._el.healthBar.style.filter = '';
      }
    }

    // Weapon ammo + cooldown
    if (weaponManager) {
      this._el.weaponAmmo.textContent = weaponManager.getAmmoDisplay();
      const cd = weaponManager.getFireCooldownRatio();
      this._el.coolBar.style.width = (cd * 100) + '%';

      const wep = weaponManager.currentWeapon;
      if (wep) this._updateWeaponDisplay(wep);
    }
  }
}
