import { clamp } from '../core/Utils.js';

const JOYSTICK_MAX_RADIUS = 48;
const JOYSTICK_DEADZONE = 0.12;

function makeJoystickState() {
  return { active: false, touchId: null, startX: 0, startY: 0, deltaX: 0, deltaY: 0, magnitude: 0, angle: 0 };
}

export class InputManager {
  constructor(events) {
    this.events = events;

    this.joystick = makeJoystickState();
    this.rightJoystick = makeJoystickState();

    // Buttons (jump/slam come from right-stick gestures, not touch buttons)
    this.buttons = { fire: false, jump: false, slam: false, dash: false, weapon: false };
    this._buttonPrev    = { fire: false, jump: false, slam: false, dash: false, weapon: false };
    this._buttonPressed = { fire: false, jump: false, slam: false, dash: false, weapon: false };
    this._buttonTouches = {};

    // Right-stick gesture state (starts armed so first flick works immediately)
    this._rightGestureArmed = true;

    this._keys = new Set();

    this._setupDOM();
    this._setupPointerEvents();
    this._setupKeyboard();
  }

  _setupDOM() {
    this._leftZone  = document.getElementById('left-joy-zone');
    this._leftBase  = document.getElementById('left-joy-base');
    this._leftKnob  = document.getElementById('left-joy-knob');
    this._rightZone = document.getElementById('right-joy-zone');
    this._rightBase = document.getElementById('right-joy-base');
    this._rightKnob = document.getElementById('right-joy-knob');
    this._actionBtns = document.querySelectorAll('.action-btn');
  }

  _setupPointerEvents() {
    // Left joystick
    this._bindJoystick(this._leftZone, this._leftBase, this._leftKnob, this.joystick);

    // Right joystick (camera yaw + tap=fire + gestures)
    this._bindJoystick(this._rightZone, this._rightBase, this._rightKnob, this.rightJoystick, () => {
      this._buttonPressed.fire = true; // tap on right zone = fire
    });

    // Action buttons
    this._actionBtns.forEach(btn => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', e => {
        e.stopPropagation();
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
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
    });
  }

  _bindJoystick(zone, base, knob, state, onTap = null) {
    let tapT0 = 0, tapMaxDist = 0;

    zone.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (state.active) return;
      state.active = true;
      state.touchId = e.pointerId;
      const rect = zone.getBoundingClientRect();
      state.startX = e.clientX - rect.left;
      state.startY = e.clientY - rect.top;
      tapT0 = Date.now();
      tapMaxDist = 0;
      this._updateJoystickVisual(knob, base, 0, 0, true);
      try { zone.setPointerCapture(e.pointerId); } catch (_) {}
    });

    zone.addEventListener('pointermove', e => {
      if (!state.active || e.pointerId !== state.touchId) return;
      e.preventDefault();
      const rect = zone.getBoundingClientRect();
      let dx = (e.clientX - rect.left) - state.startX;
      let dy = (e.clientY - rect.top)  - state.startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > tapMaxDist) tapMaxDist = dist;

      if (dist > JOYSTICK_MAX_RADIUS) {
        dx = (dx / dist) * JOYSTICK_MAX_RADIUS;
        dy = (dy / dist) * JOYSTICK_MAX_RADIUS;
      }

      const norm = dist / JOYSTICK_MAX_RADIUS;
      if (norm < JOYSTICK_DEADZONE) {
        state.deltaX = 0; state.deltaY = 0; state.magnitude = 0;
      } else {
        const scaled = (norm - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
        const angle = Math.atan2(dx, -dy);
        state.deltaX    = Math.sin(angle) * scaled;
        state.deltaY    = Math.cos(angle) * scaled;
        state.magnitude = clamp(scaled, 0, 1);
        state.angle     = angle;
      }
      this._updateJoystickVisual(knob, base, dx, dy, true);
    });

    const release = e => {
      if (e.pointerId !== state.touchId) return;
      // Tap = quick touch without much movement → fire
      if (onTap && Date.now() - tapT0 < 220 && tapMaxDist < 14) onTap();
      state.active = false; state.touchId = null;
      state.deltaX = 0; state.deltaY = 0; state.magnitude = 0;
      this._updateJoystickVisual(knob, base, 0, 0, false);
    };
    zone.addEventListener('pointerup',     release);
    zone.addEventListener('pointercancel', release);
  }

  _updateJoystickVisual(knob, base, dx, dy, active) {
    const max = JOYSTICK_MAX_RADIUS;
    knob.style.transform = `translate(${clamp(dx, -max, max)}px, ${clamp(dy, -max, max)}px)`;
    base.style.opacity = active ? '1' : '0.6';
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

  _setupKeyboard() {
    window.addEventListener('keydown', e => {
      this._keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this._keys.delete(e.code);
    });
  }

  _syncKeyboard() {
    const kFire = this._keys.has('KeyF') || this._keys.has('KeyE');
    const kJump = this._keys.has('Space');
    const kSlam = this._keys.has('KeyQ');
    const kDash = this._keys.has('ShiftLeft') || this._keys.has('ShiftRight');
    const kWep  = this._keys.has('KeyR');

    this.buttons.fire   = this.buttons.fire   || kFire;
    this.buttons.jump   = this.buttons.jump   || kJump;
    this.buttons.slam   = this.buttons.slam   || kSlam;
    this.buttons.dash   = this.buttons.dash   || kDash;
    this.buttons.weapon = this.buttons.weapon || kWep;

    if (kFire && !this._buttonPrev.fire)   this._buttonPressed.fire   = true;
    if (kJump && !this._buttonPrev.jump)   this._buttonPressed.jump   = true;
    if (kSlam && !this._buttonPrev.slam)   this._buttonPressed.slam   = true;
    if (kDash && !this._buttonPrev.dash)   this._buttonPressed.dash   = true;
    if (kWep  && !this._buttonPrev.weapon) this._buttonPressed.weapon = true;

    // Keyboard camera rotation via arrow keys
    if (!this.rightJoystick.active) {
      if (this._keys.has('ArrowLeft'))  { this.rightJoystick.deltaX = -1; this.rightJoystick.magnitude = 1; }
      if (this._keys.has('ArrowRight')) { this.rightJoystick.deltaX =  1; this.rightJoystick.magnitude = 1; }
      if (this._keys.has('ArrowUp'))    { this.rightJoystick.deltaY =  1; this.rightJoystick.magnitude = 1; }
      if (this._keys.has('ArrowDown'))  { this.rightJoystick.deltaY = -1; this.rightJoystick.magnitude = 1; }
    }

    // Keyboard movement
    if (!this.joystick.active) {
      let kx = 0, ky = 0;
      if (this._keys.has('KeyW') || this._keys.has('KeyS') || this._keys.has('KeyA') || this._keys.has('KeyD')) {
        if (this._keys.has('KeyW')) ky += 1;
        if (this._keys.has('KeyS')) ky -= 1;
        if (this._keys.has('KeyA')) kx -= 1;
        if (this._keys.has('KeyD')) kx += 1;
        const len = Math.sqrt(kx * kx + ky * ky) || 1;
        this.joystick.deltaX = kx / len;
        this.joystick.deltaY = ky / len;
        this.joystick.magnitude = 1;
      }
    }

    this._buttonPrev.fire   = kFire;
    this._buttonPrev.jump   = kJump;
    this._buttonPrev.slam   = kSlam;
    this._buttonPrev.dash   = kDash;
    this._buttonPrev.weapon = kWep;
  }

  wasPressed(action) {
    return this._buttonPressed[action];
  }

  update() {
    for (const k in this._buttonPressed) this._buttonPressed[k] = false;
    if (!this.joystick.active) { this.joystick.deltaX = 0; this.joystick.deltaY = 0; this.joystick.magnitude = 0; }
    if (!this.rightJoystick.active) { this.rightJoystick.deltaX = 0; this.rightJoystick.deltaY = 0; this.rightJoystick.magnitude = 0; }
    this._detectRightGestures();
    this._syncKeyboard();
  }

  _detectRightGestures() {
    const ry  = this.rightJoystick.deltaY;
    const mag = this.rightJoystick.magnitude;

    // Re-arm once stick returns near center
    if (mag < 0.25) {
      this._rightGestureArmed = true;
    }

    if (this._rightGestureArmed && mag > 0.25) {
      if (ry > 0.6) {         // flick up → jump
        this._buttonPressed.jump = true;
        this._rightGestureArmed = false;
      } else if (ry < -0.6) { // flick down → slam
        this._buttonPressed.slam = true;
        this._rightGestureArmed = false;
      }
    }
  }
}
