import * as THREE from 'three';

export class SceneSetup {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 300);

    this._setupScene();
    this._setupLights();
  }

  _setupScene() {
    // Underwater atmosphere
    this.scene.background = new THREE.Color(0x001428);
    this.scene.fog = new THREE.FogExp2(0x001428, 0.028);
  }

  _setupLights() {
    const scene = this.scene;

    // Ambient - cool underwater blue
    const ambient = new THREE.AmbientLight(0x0a2040, 1.8);
    scene.add(ambient);

    // Main sunlight filtering through water
    const sun = new THREE.DirectionalLight(0x80d0ff, 2.5);
    sun.position.set(8, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    // Fill light - warm from below (lava/bioluminescence)
    const fill = new THREE.PointLight(0xff6600, 1.2, 60);
    fill.position.set(0, -3, 0);
    scene.add(fill);

    // Rim / accent lights
    const rim1 = new THREE.PointLight(0x00ffcc, 0.8, 40);
    rim1.position.set(-12, 6, -12);
    scene.add(rim1);

    const rim2 = new THREE.PointLight(0x6600ff, 0.6, 40);
    rim2.position.set(12, 6, 12);
    scene.add(rim2);

    // Ambient ocean glow
    const glow = new THREE.PointLight(0x0066ff, 0.5, 80);
    glow.position.set(0, 15, 0);
    scene.add(glow);
  }
}
