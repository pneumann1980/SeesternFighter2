import * as THREE from 'three';
import { PlayerState } from './Player.js';
import { clamp, lerpAngle } from '../core/Utils.js';

const GRAVITY = -22;
const GROUND_Y = 0;
const MOVE_SPEED = 8;
const SPRINT_MULT = 1.4;
const JUMP_FORCE = 10;
const AIR_CONTROL = 0.6;
const DASH_FORCE = 14;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 1.2;
const SLAM_FALL_SPEED = -28;

export class PlayerController {
  constructor(player, input, arena) {
    this.player = player;
    this.input = input;
    this.arena = arena;

    this._dashTimer = 0;
    this._dashCooldown = 0;
    this._dashDir = new THREE.Vector3();

    this._slamPending = false;
    this._slamTriggered = false;

    this._cameraAzimuth = 0; // exposed for camera to sync
  }

  get cameraAzimuth() { return this._cameraAzimuth; }
  set cameraAzimuth(v) { this._cameraAzimuth = v; }

  update(dt) {
    const p = this.player;
    if (!p.isAlive) return;

    const joystick = this.input.joystick;
    const hasInput = joystick.magnitude > 0.05;

    // ── Movement direction (relative to camera) ──
    const az = this._cameraAzimuth;
    const camFwdX = Math.sin(az);
    const camFwdZ = Math.cos(az);
    const camRightX = Math.cos(az);
    const camRightZ = -Math.sin(az);

    const moveX = joystick.deltaX * camRightX + joystick.deltaY * camFwdX;
    const moveZ = joystick.deltaX * camRightZ + joystick.deltaY * camFwdZ;

    const speed = MOVE_SPEED * joystick.magnitude * (this.input.buttons.dash ? 0 : 1);
    const airMult = p.isGrounded ? 1 : AIR_CONTROL;

    // ── Dash ──
    if (this._dashCooldown > 0) this._dashCooldown -= dt;

    if (this.input.wasPressed('dash') && this._dashCooldown <= 0 && hasInput) {
      this._dashDir.set(moveX, 0, moveZ).normalize();
      this._dashTimer = DASH_DURATION;
      this._dashCooldown = DASH_COOLDOWN;
      p.state = PlayerState.DASHING;
    }

    if (this._dashTimer > 0) {
      this._dashTimer -= dt;
      p.velocity.x = this._dashDir.x * DASH_FORCE;
      p.velocity.z = this._dashDir.z * DASH_FORCE;
      if (this._dashTimer <= 0) {
        p.state = PlayerState.IDLE;
      }
    } else {
      // Normal movement
      const targetVX = moveX * speed * airMult;
      const targetVZ = moveZ * speed * airMult;
      const accel = p.isGrounded ? 16 : 6;
      p.velocity.x = THREE.MathUtils.lerp(p.velocity.x, targetVX, dt * accel);
      p.velocity.z = THREE.MathUtils.lerp(p.velocity.z, targetVZ, dt * accel);
    }

    // ── Jump ──
    if (this.input.wasPressed('jump') && p.isGrounded) {
      p.velocity.y = JUMP_FORCE;
      p.isGrounded = false;
      p.state = PlayerState.JUMPING;
      this._slamPending = true;
      this._slamTriggered = false;
    }

    // ── Slam ──
    if (this.input.wasPressed('slam') && !p.isGrounded && this._slamPending) {
      p.velocity.y = SLAM_FALL_SPEED;
      p.state = PlayerState.SLAMMING;
      this._slamPending = false;
      this._slamTriggered = true;
    }

    // ── Gravity ──
    if (!p.isGrounded) {
      p.velocity.y += GRAVITY * dt;
    }

    // ── Apply velocity ──
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.position.z += p.velocity.z * dt;

    // ── Ground collision ──
    if (p.position.y <= GROUND_Y) {
      const wasSlam = p.state === PlayerState.SLAMMING;
      p.position.y = GROUND_Y;
      p.isGrounded = true;
      this._slamPending = false;

      if (wasSlam && this._slamTriggered) {
        this._slamTriggered = false;
        this.player.events.emit('slamLanded', { position: p.position.clone(), radius: 3.5, damage: 35 });
      }

      if (p.velocity.y < -1) {
        // Squash on landing
        p.group.scale.set(1.3, 0.6, 1.3);
      }
      p.velocity.y = 0;

      if (p.state === PlayerState.JUMPING || p.state === PlayerState.FALLING || p.state === PlayerState.SLAMMING) {
        p.state = PlayerState.IDLE;
      }
    } else {
      p.isGrounded = false;
      if (p.velocity.y < -2 && p.state !== PlayerState.SLAMMING) {
        p.state = PlayerState.FALLING;
      }
    }

    // ── Arena collision ──
    this.arena.resolveColliders(p.position, p.collisionRadius);
    this.arena.clampToBounds(p.position, p.collisionRadius);

    // ── Player facing ──
    if (hasInput && this._dashTimer <= 0) {
      const movAngle = Math.atan2(moveX, moveZ);
      p.facing = lerpAngle(p.facing, movAngle, dt * 10);

      // Auto-rotate camera to follow movement
      this._cameraAzimuth = lerpAngle(this._cameraAzimuth, movAngle, dt * 3.5);
    }

    // ── State ──
    if (this._dashTimer <= 0 && p.state !== PlayerState.HURT && p.state !== PlayerState.DEAD) {
      if (p.isGrounded) {
        p.state = hasInput ? PlayerState.MOVING : PlayerState.IDLE;
      }
    }
  }
}
