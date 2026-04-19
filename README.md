# Seestern Fighters Arena

A browser-playable 3D third-person arena action game with an underwater starfish theme.
Built with Three.js — no build step, runs directly in any modern browser.

---

## Architecture Overview

```
SeesternFighter2/
├── index.html              Entry point, HTML structure, importmap
├── style.css               All styles (HUD, touch controls, screens)
└── src/
    ├── main.js             Bootstrap: create Game, call init + start
    ├── Game.js             Orchestrator: state machine, update/render loop
    ├── core/
    │   ├── EventBus.js     Lightweight pub/sub (decouples all systems)
    │   └── Utils.js        Math helpers (lerp, lerpAngle, dist2D, clamp…)
    ├── input/
    │   └── InputManager.js Virtual joystick + touch buttons + keyboard fallback
    ├── scene/
    │   ├── SceneSetup.js   Three.js scene, camera, lights (underwater atmos)
    │   └── ArenaBuilder.js Coral reef arena geometry, colliders, pickups
    ├── player/
    │   ├── Player.js       Starfish mesh, health, state, animations
    │   └── PlayerController.js Movement, jump, slam, dash, arena collision
    ├── camera/
    │   └── ThirdPersonCamera.js Over-the-shoulder camera, shake, touch-drag rotate
    ├── weapons/
    │   ├── WeaponManager.js  Weapon slots, fire logic, aim assist, pickup handling
    │   └── ProjectileManager.js Projectile pool, movement, hit detection
    ├── enemies/
    │   ├── Enemy.js        Base AI + FastFish / RangedPuffer / TankCrab types
    │   └── EnemyManager.js Wave spawning, lifecycle, slam handler
    ├── effects/
    │   └── EffectsManager.js Particle pool, slam rings, explosions, hit sparks
    └── ui/
        ├── HUD.js          Health, weapon, score, hit markers, damage numbers
        └── UIManager.js    Menu / game-over / win / wave-complete screens
```

### Data Flow

```
InputManager ──joystick/buttons──► PlayerController ──velocity──► Player
                                                    └──azimuth──► ThirdPersonCamera
Player ──position──► WeaponManager ──fire──► ProjectileManager
                                            ↕ collision
                    EnemyManager ──────────► Enemy AI
                         ↓ events (enemyHit / killed / slamLanded)
                    EffectsManager  ◄──────  EventBus
                    HUD             ◄──────  EventBus
```

All inter-system communication goes through **EventBus** — systems never
import each other directly. This makes each module independently testable
and replaceable.

---

## Run Instructions

### Option A — VS Code Live Server (recommended)
1. Open the `SeesternFighter2` folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.
4. Game opens at `http://127.0.0.1:5500`.

### Option B — Python
```bash
cd SeesternFighter2
python3 -m http.server 8080
# Open http://localhost:8080
```

### Option C — Node.js
```bash
cd SeesternFighter2
npx serve .
```

> **Important:** The game uses ES modules (`<script type="module">`).
> You **must** serve via HTTP — opening `index.html` as a `file://` URL will
> fail due to CORS restrictions on module imports.

### Mobile Testing
Use the browser's **DevTools → Device Toolbar** (Ctrl+Shift+M) and select a
phone preset in landscape mode. Or deploy to any static host (GitHub Pages,
Netlify, Vercel) and open on your phone.

---

## Touch Controls

```
┌────────────────────────────────────────────┐
│                   ARENA                    │
│                                            │
│  ┌──────┐                   [SPRING ↑]    │
│  │  ●   │                [FEUER ●] ← BIG  │
│  │ JOY  │           [SLAM ★]  [DASH »]    │
│  └──────┘                      [WAFFE ⇄]  │
└────────────────────────────────────────────┘
   LEFT HALF                    RIGHT HALF
```

| Zone | Gesture | Action |
|---|---|---|
| Left half | Press & drag | Virtual joystick — 360° movement |
| Right side canvas | Drag (not on buttons) | Rotate camera |
| FEUER (big red) | Tap / hold | Fire current weapon (auto-repeats) |
| SPRING | Tap | Jump |
| SLAM ★ | Tap while airborne | Slam attack — AOE damage on landing |
| DASH » | Tap | Dash in movement direction |
| WAFFE ⇄ | Tap | Cycle weapon slot |

**Aim assist** is always active: projectiles automatically bend 65% toward the
nearest enemy within range and in front of the player. No right-stick aiming
needed on mobile.

**Camera auto-orbit:** when moving, the camera gently rotates to stay behind
the player's direction of travel. Manual camera drag overrides this.

---

## Weapons

| Weapon | Icon | Behaviour |
|---|---|---|
| Bubble Blaster | 🫧 | Infinite ammo, homing shots |
| Coral Shotgun | 🪸 | 5-pellet spread, limited ammo |
| Ink Sprayer | 🦑 | Fast, spammy, close-range |
| Eel Beam | ⚡ | High damage, instant, long range |
| Shell Cannon | 🐚 | Slow, massive damage per shot |

Weapon pickups appear as glowing octahedrons on the arena floor.
Health packs are red and restore 30 HP.

---

## Enemy Types

| Enemy | Behaviour |
|---|---|
| **Fast Fish** (cyan) | Dashes at close range, aggressive melee |
| **Ranged Puffer** (orange) | Keeps distance, fires projectiles at player |
| **Tank Crab** (dark red) | Slow, high HP, charge attack, heavy melee |

---

## Game Loop

1. **Menu** → tap *KAMPF BEGINNEN*
2. **Wave 1–5** spawn with increasing enemy counts
3. Clear all enemies → 3-second intermission → next wave
4. Player HP reaches 0 → **Game Over** screen with score
5. Survive all 5 waves → **Victory** screen

Score: Fast Fish 100 pts · Puffer 150 pts · Tank Crab 250 pts

---

## Next-Step Improvements

### High priority (game feel)
- [ ] Right-stick camera orbit as a second virtual joystick (right half)
- [ ] Weapon recoil camera kick on fire
- [ ] Enemy hit-flash (material color pulse on damage)
- [ ] Footstep / landing audio (Web Audio API)
- [ ] Aim-assist indicator (subtle glow on targeted enemy)

### Gameplay depth
- [ ] Boss wave (wave 5 unique boss enemy)
- [ ] Arena hazards (volcanic vents, electric coral, current zones)
- [ ] Combo system — kills within 2 s give score multiplier
- [ ] Loot drops from enemies (ammo, HP, temporary buffs)
- [ ] Second arena layout (kelp forest / shipwreck)

### Technical
- [ ] Object pooling for enemy meshes (reuse geometries)
- [ ] GLTF loader for real character models
- [ ] LOD system for distant enemies
- [ ] Save score to localStorage (leaderboard)
- [ ] Gamepad API support (console-style controls)
- [ ] Frame-rate independent camera lerp (pass dt to syncAzimuth)
- [ ] NavMesh / simple grid pathfinding for smarter enemy movement

### Polish
- [ ] Intro cinematic (camera fly-through of arena)
- [ ] Per-weapon muzzle flash meshes
- [ ] Underwater caustic light animation (vertex shader)
- [ ] Bubble trail particles behind projectiles
- [ ] Screen-space slam shockwave (post-processing)
