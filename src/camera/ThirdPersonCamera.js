import * as THREE from 'three';
import { clamp } from '../core/Utils.js';

// Fortnite-style over-the-shoulder TPS camera
const CAM_DIST      = 5.5;   // distance behind player (closer = more action)
const CAM_RIGHT     = 1.2;   // right-shoulder offset → player sits left-of-center
const CAM_LOOK_AHEAD = 3.5;  // look target ahead of player → open view forward
const CAM_LOOK_UP   = 1.1;   // height of look target
const CAM_SMOOTH    = 10;

const EL_DEFAULT    = 0.28;  // default elevation (~16°)
const EL_MIN        = -0.05;
const EL_MAX        = 0.65;

const SENS_H = 0.005;        // radians per pixel horizontal
const SENS_V = 0.004;        // radians per pixel vertical

export class ThirdPersonCamera {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;

    this._azimuth   = 0;
    this._elevation = EL_DEFAULT;

    this._currentPos = new THREE.Vector3(0, 3, -CAM_DIST);
    this._targetPos  = new THREE.Vector3();
    this._lookTarget = new THREE.Vector3();

    this._shakeIntensity = 0;
    this._shakeDecay     = 8;
    this._shakeOffset    = new THREE.Vector3();
  }

  get azimuth() { return this._azimuth; }
  set azimuth(v) { this._azimuth = v; }

  // Called each frame with right-joystick delta (normalized -1..1)
  rotateDelta(dx, dy, dt) {
    const ROT_H = 2.8;
    const ROT_V = 1.6;
    this._azimuth   += dx * ROT_H * dt;
    this._elevation  = clamp(this._elevation - dy * ROT_V * dt, EL_MIN, EL_MAX);
  }

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
        (Math.random() - 0.5) * this._shakeIntensity * 0.4,
        0
      );
    } else {
      this._shakeOffset.set(0, 0, 0);
    }

    const az  = this._azimuth;
    const el  = this._elevation;
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);

    // ── Over-the-right-shoulder position ──
    // Horizontal ring at distance * cos(elevation)
    const hDist = CAM_DIST * Math.cos(el);
    const vDist = CAM_DIST * Math.sin(el);

    // Camera sits BEHIND player (negated forward)
    const camX_back = playerPos.x - sinAz * hDist;
    const camY_back = playerPos.y + vDist + 0.8; // +0.8 = base shoulder height
    const camZ_back = playerPos.z - cosAz * hDist;

    // Right-shoulder shift in camera-local right direction
    // Camera right = perpendicular to forward in XZ = (cosAz, 0, -sinAz)
    this._targetPos.set(
      camX_back + cosAz * CAM_RIGHT + this._shakeOffset.x,
      camY_back               + this._shakeOffset.y,
      camZ_back - sinAz * CAM_RIGHT
    );

    this._currentPos.lerp(this._targetPos, dt * CAM_SMOOTH);
    this.camera.position.copy(this._currentPos);

    // ── Look target: ahead of player at eye level ──
    this._lookTarget.set(
      playerPos.x + sinAz * CAM_LOOK_AHEAD,
      playerPos.y + CAM_LOOK_UP,
      playerPos.z + cosAz * CAM_LOOK_AHEAD
    );
    this.camera.lookAt(this._lookTarget);
  }

  getForwardDir() {
    return new THREE.Vector3(Math.sin(this._azimuth), 0, Math.cos(this._azimuth));
  }

  getRightDir() {
    return new THREE.Vector3(Math.cos(this._azimuth), 0, -Math.sin(this._azimuth));
  }
}
