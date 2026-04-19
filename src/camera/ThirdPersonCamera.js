import * as THREE from 'three';
import { lerpAngle } from '../core/Utils.js';

const CAM_DISTANCE = 7;
const CAM_HEIGHT = 3.5;
const CAM_SMOOTH = 8;
const CAM_ROT_SMOOTH = 6;
const LOOK_AHEAD = 1.5;
const ELEVATION = 0.42; // radians

export class ThirdPersonCamera {
  constructor(camera, player, input) {
    this.camera = camera;
    this.player = player;
    this.input = input;

    this._azimuth = 0;
    this._targetPos = new THREE.Vector3();
    this._currentPos = new THREE.Vector3(0, CAM_HEIGHT, -CAM_DISTANCE);
    this._lookTarget = new THREE.Vector3();
    this._shakeIntensity = 0;
    this._shakeDecay = 8;
    this._shakeOffset = new THREE.Vector3();

    // Camera touch drag (right side, not on buttons)
    this._camTouchId = null;
    this._camLastX = 0;
    this._setupCameraTouch();
  }

  _setupCameraTouch() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('pointerdown', e => {
      // Right half of screen, no joystick
      const rightHalf = e.clientX > window.innerWidth * 0.5;
      if (rightHalf && this._camTouchId === null) {
        this._camTouchId = e.pointerId;
        this._camLastX = e.clientX;
      }
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== this._camTouchId) return;
      const dx = e.clientX - this._camLastX;
      this._azimuth += dx * 0.006;
      this._camLastX = e.clientX;
    });
    canvas.addEventListener('pointerup', e => {
      if (e.pointerId === this._camTouchId) this._camTouchId = null;
    });
    canvas.addEventListener('pointercancel', e => {
      if (e.pointerId === this._camTouchId) this._camTouchId = null;
    });
  }

  get azimuth() { return this._azimuth; }
  set azimuth(v) { this._azimuth = v; }

  shake(intensity = 0.3) {
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
  }

  update(dt) {
    const playerPos = this.player.group.position;

    // ── Camera shake ──
    if (this._shakeIntensity > 0.001) {
      this._shakeIntensity -= this._shakeDecay * dt * this._shakeIntensity;
      this._shakeOffset.set(
        (Math.random() - 0.5) * this._shakeIntensity,
        (Math.random() - 0.5) * this._shakeIntensity * 0.5,
        0
      );
    } else {
      this._shakeOffset.set(0, 0, 0);
    }

    // ── Camera position calculation ──
    const az = this._azimuth;
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);

    // Camera is BEHIND player: offset opposite to facing direction
    const camX = playerPos.x - sinAz * CAM_DISTANCE;
    const camY = playerPos.y + CAM_HEIGHT;
    const camZ = playerPos.z - cosAz * CAM_DISTANCE;

    this._targetPos.set(
      camX + this._shakeOffset.x,
      camY + this._shakeOffset.y,
      camZ
    );

    // Smooth follow
    this._currentPos.lerp(this._targetPos, dt * CAM_SMOOTH);
    this.camera.position.copy(this._currentPos);

    // ── Look target: slightly ahead of player ──
    this._lookTarget.set(
      playerPos.x + sinAz * LOOK_AHEAD,
      playerPos.y + 0.8,
      playerPos.z + cosAz * LOOK_AHEAD
    );

    this.camera.lookAt(this._lookTarget);

    // ── Sync controller azimuth (auto-follow movement) ──
    // The controller drives azimuth when player moves; camera touch overrides it
  }

  /** Call from controller to sync azimuth when player auto-rotates */
  syncAzimuth(azimuth) {
    if (this._camTouchId !== null) return; // user is manually rotating
    this._azimuth = lerpAngle(this._azimuth, azimuth, 0.15);
  }

  getForwardDir() {
    return new THREE.Vector3(Math.sin(this._azimuth), 0, Math.cos(this._azimuth));
  }

  getRightDir() {
    return new THREE.Vector3(Math.cos(this._azimuth), 0, -Math.sin(this._azimuth));
  }
}
