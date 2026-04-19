import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpAngle(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI) diff -= TAU;
  while (diff < -Math.PI) diff += TAU;
  return a + diff * t;
}

export function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function dist2DSq(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

export function randomPositionInArena(arenaSize = 14, minDist = 3) {
  const pos = new THREE.Vector3(
    randomRange(-arenaSize + 2, arenaSize - 2),
    0,
    randomRange(-arenaSize + 2, arenaSize - 2)
  );
  return pos;
}

export function randomSpawnPosition(arenaSize, avoidPos, minDist = 6) {
  let pos, attempts = 0;
  do {
    pos = randomPositionInArena(arenaSize);
    attempts++;
  } while (dist2D(pos, avoidPos) < minDist && attempts < 20);
  return pos;
}

export function worldToScreen(worldPos, camera, width, height) {
  const vector = worldPos.clone().project(camera);
  return {
    x: (vector.x * 0.5 + 0.5) * width,
    y: (-vector.y * 0.5 + 0.5) * height,
    visible: vector.z < 1
  };
}
