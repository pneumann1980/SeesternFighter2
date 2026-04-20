import { clamp } from '../core/Utils.js';

const JOYSTICK_MAX_RADIUS = 48;
const JOYSTICK_DEADZONE = 0.12;

export class InputManager {
  constructor(events) {
    this.events = events;

    // Joystick state
    this.joystick = {
      active: false,
      touchId: null,
      startX: 0, startY: 0,
      currentX: 0, currentY: 0,
      deltaX: 0, deltaY: 0,   // normalized [-1, 1]
      magnitude: 0,            // [0, 1]
      angle: 0
    };

    // Camera drag (right side swipe not on buttons)
    this.cameraDelta = { x: 0, y: 0 };
    this._cameraTouchId = null;
    this._cameraLastX = 0;
    this._cameraLastY = 0;
    this._cameraDeltaAccum = { x: 0, y: 0 };

    // Buttons
    this.buttons = {
      fire: false,
      jump: false,
      slam: false,
      dash: false,
      weapon: false
    };
    this._buttonPrev = { fire: false, jump: false, slam: false, dash: false, weapon: false };
    this._buttonPressed = { fire: false, jump: false, slam: false, dash: false, weapon: false };
    this._buttonTouches = {}; // touchId -> action

    // Keyboard fallback
    this._keys = new Set();

    this._setupDOM();
    this._setupPointerEvents();
    this._setupKeyboard();
  }

  _setupDOM() {
    this._joystickZone = document.getElementById('joystick-zone');
    this._joystickBase = document.getElementById('joystick-base');
    this._joystickKnob = document.getElementById('joystick-knob');
    this._actionBtns = document.querySelectorAll('.action-btn');
  }

  _setupPointerEvents() {
    // Joystick zone
    this._joystickZone.addEventListener('pointerdown', e => this._onJoystickDown(e));
    this._joystickZone.addEventListener('pointermove', e => this._onJoystickMove(e));
    this._joystickZone.addEventListener('pointerup', e => this._onJoystickUp(e));
    this._joystickZone.addEventListener('pointercancel', e => this._onJoystickUp(e));

    // Action buttons
    this._actionBtns.forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation();
        this._onBtnDown(action, btn, e.pointerId);
      });
      btn.addEventListener('pointerup', e => {
        e.stopPropagation();
        this._onBtnUp(action, btn, e.pointerId);
      });
      btn.addEventListener('pointercancel', e => {
        e.stopPropagation();
        this._onBtnUp(action, btn, e.pointerId);
      });
      btn.addEventListener('pointerleave', e => {
        if (this._buttonTouches[e.pointerId] === action) {
          this._onBtnUp(action, btn, e.pointerId);
        }
      });
      btn.setPointerCapture && btn.addEventListener('pointerdown', e => {
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      });
    });
  }

  _setupKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this._keys.delete(e.code);
    });
  }

  _onJoystickDown(e) {
    e.preventDefault();
    if (this.joystick.active) return;
    this.joystick.active = true;
    this.joystick.touchId = e.pointerId;

    const rect = this._joystickZone.getBoundingClientRect();
    this.joystick.startX = e.clientX - rect.left;
    this.joystick.startY = e.clientY - rect.top;
    this.joystick.currentX = this.joystick.startX;
    this.joystick.currentY = this.joystick.startY;

    this._updateJoystickVisual(0, 0);
    try { this._joystickZone.setPointerCapture(e.pointerId); } catch (_) {}
  }

  _onJoystickMove(e) {
    if (!this.joystick.active || e.pointerId !== this.joystick.touchId) return;
    e.preventDefault();

    const rect = this._joystickZone.getBoundingClientRect();
    this.joystick.currentX = e.clientX - rect.left;
    this.joystick.currentY = e.clientY - rect.top;

    let dx = this.joystick.currentX - this.joystick.startX;
    let dy = this.joystick.currentY - this.joystick.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > JOYSTICK_MAX_RADIUS) {
      dx = (dx / dist) * JOYSTICK_MAX_RADIUS;
      dy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    }

    const norm = dist / JOYSTICK_MAX_RADIUS;
    if (norm < JOYSTICK_DEADZONE) {
      this.joystick.deltaX = 0;
      this.joystick.deltaY = 0;
      this.joystick.magnitude = 0;
    } else {
      const scaled = (norm - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
      // Negate dy: screen Y increases downward, but joystick "up" should be +1
      const angle = Math.atan2(dx, -dy);
      this.joystick.deltaX = Math.sin(angle) * scaled;
      this.joystick.deltaY = Math.cos(angle) * scaled;
      this.joystick.magnitude = clamp(scaled, 0, 1);
      this.joystick.angle = angle;
    }

    this._updateJoystickVisual(dx, dy);
  }

  _onJoystickUp(e) {
    if (e.pointerId !== this.joystick.touchId) return;
    this.joystick.active = false;
    this.joystick.touchId = null;
    this.joystick.deltaX = 0;
    this.joystick.deltaY = 0;
    this.joystick.magnitude = 0;
    this._updateJoystickVisual(0, 0);
  }

  _updateJoystickVisual(dx, dy) {
    const maxVis = JOYSTICK_MAX_RADIUS;
    const clampedDx = clamp(dx, -maxVis, maxVis);
    const clampedDy = clamp(dy, -maxVis, maxVis);
    this._joystickKnob.style.transform = `translate(${clampedDx}px, ${clampedDy}px)`;
    this._joystickBase.style.opacity = this.joystick.active ? '1' : '0.6';
  }

  _onBtnDown(action, btn, pointerId) {
    this.buttons[action] = true;
    this._buttonPressed[action] = true;
    this._buttonTouches[pointerId] = action;
    btn.classList.add('pressed');
  }

  _onBtnUp(action, btn, pointerId) {
    this.buttons[action] = false;
    delete this._buttonTouches[pointerId];
    btn.classList.remove('pressed');
  }

  // Called each frame after update to sync keyboard
  _syncKeyboard() {
    const kFire  = this._keys.has('KeyF') || this._keys.has('KeyE');
    const kJump  = this._keys.has('Space');
    const kSlam  = this._keys.has('KeyQ');
    const kDash  = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    const kWep   = this._keys.has('KeyR');

    this.buttons.fire   = this.buttons.fire  || kFire;
    this.buttons.jump   = this.buttons.jump  || kJump;
    this.buttons.slam   = this.buttons.slam  || kSlam;
    this.buttons.dash   = this.buttons.dash  || kDash;
    this.buttons.weapon = this.buttons.weapon || kWep;

    // Keyboard rising edge
    if (kFire  && !this._buttonPrev.fire)  this._buttonPressed.fire  = true;
    if (kJump  && !this._buttonPrev.jump)  this._buttonPressed.jump  = true;
    if (kSlam  && !this._buttonPrev.slam)  this._buttonPressed.slam  = true;
    if (kDash  && !this._buttonPrev.dash)  this._buttonPressed.dash  = true;
    if (kWep   && !this._buttonPrev.weapon) this._buttonPressed.weapon = true;

    // Keyboard joystick override
    if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    this._addKbJoystick(0, 1);
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  this._addKbJoystick(0, -1);
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  this._addKbJoystick(-1, 0);
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) this._addKbJoystick(1, 0);

    this._buttonPrev.fire  = kFire;
    this._buttonPrev.jump  = kJump;
    this._buttonPrev.slam  = kSlam;
    this._buttonPrev.dash  = kDash;
    this._buttonPrev.weapon = kWep;
  }

  _kbJoystickX = 0;
  _kbJoystickY = 0;

  _addKbJoystick(dx, dy) {
    if (!this.joystick.active) {
      this._kbJoystickX += dx;
      this._kbJoystickY += dy;
    }
  }

  wasPressed(action) {
    return this._buttonPressed[action];
  }

  update() {
    // Reset per-frame state
    for (const k in this._buttonPressed) this._buttonPressed[k] = false;
    this.cameraDelta.x = 0;
    this.cameraDelta.y = 0;

    // Keyboard override for joystick if no touch
    this._kbJoystickX = 0;
    this._kbJoystickY = 0;
    this._syncKeyboard();

    if (!this.joystick.active && (this._kbJoystickX !== 0 || this._kbJoystickY !== 0)) {
      const len = Math.sqrt(this._kbJoystickX ** 2 + this._kbJoystickY ** 2);
      this.joystick.deltaX = this._kbJoystickX / len;
      this.joystick.deltaY = this._kbJoystickY / len;
      this.joystick.magnitude = 1;
    } else if (!this.joystick.active) {
      this.joystick.deltaX = 0;
      this.joystick.deltaY = 0;
      this.joystick.magnitude = 0;
    }
  }
}
