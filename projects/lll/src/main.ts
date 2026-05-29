import * as THREE from 'three';

import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAY_BOUNDS, PLAYER_START } from './config.ts';
import { loadManifest, loadGltf, type AssetPaths } from './manifest.ts';
import {
  type Actor,
  yawFromDirection,
  dampAngle,
  buildActionMap,
  pickActionName,
  playAction,
  normalizeToHeightAndGround,
  anchorMinYToGround,
} from './helpers.ts';

// ---- DOM ----------------------------------------------------------------

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el as T;
}

const dom = {
  wrap: requireElement<HTMLDivElement>('canvasWrap'),
  canvas: requireElement<HTMLCanvasElement>('scene'),
  loading: requireElement<HTMLDivElement>('loading'),
  status: requireElement<HTMLElement>('status'),
};

// ---- Renderer / scene / camera ------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.skyTop);
scene.fog = new THREE.FogExp2(COLORS.horizon, 0.03);

const camera = new THREE.PerspectiveCamera(46, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 220);
camera.position.set(0, 6.1, 16.2);
camera.lookAt(0, 1.25, 0);

const clock = new THREE.Clock();

// ---- Player + input state -----------------------------------------------

interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
}

const input: InputState = { up: false, down: false, left: false, right: false, run: false };

interface Player extends Actor {
  group: THREE.Group;
  velocity: THREE.Vector3;
  walkSpeed: number;
  runSpeed: number;
  accel: number;
  decel: number;
  forward: THREE.Vector3;
  bobTimer: number;
  mixer: THREE.AnimationMixer | null;
}

const player: Player = {
  group: new THREE.Group(),
  velocity: new THREE.Vector3(),
  walkSpeed: 4.2,
  runSpeed: 6.8,
  accel: 18,
  decel: 22,
  forward: new THREE.Vector3(0, 0, -1),
  bobTimer: 0,
  mixer: null,
  actions: new Map(),
  currentAction: null,
};

const cameraRig = { targetX: 0, currentX: 0, edgeThreshold: 0.55 };

// ---- Scene construction --------------------------------------------------

function addLights(): void {
  scene.add(new THREE.HemisphereLight('#BFE8FF', '#E9FFF2', 0.85));

  const dir = new THREE.DirectionalLight('#ffffff', 1.1);
  dir.position.set(6, 12, 6);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 60;
  dir.shadow.camera.left = -30;
  dir.shadow.camera.right = 30;
  dir.shadow.camera.top = 20;
  dir.shadow.camera.bottom = -20;
  scene.add(dir);

  scene.add(new THREE.AmbientLight('#ffffff', 0.15));
}

function createGround(): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 36, 1, 1),
    new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 0.85, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(80, 40, 0x3a7a2a, 0x4f9a38);
  grid.position.y = -0.07;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.opacity = 0.25;
  gridMaterial.transparent = true;
  scene.add(grid);
}

async function buildPlayer(assetPaths: AssetPaths): Promise<void> {
  const { root, animations } = await loadGltf('player', assetPaths.player);
  normalizeToHeightAndGround(root, 1.6, 0);
  player.group.add(root);
  player.group.position.set(PLAYER_START.x, 0, PLAYER_START.z);

  player.mixer = new THREE.AnimationMixer(root);
  player.actions = buildActionMap(player.mixer, animations);
  playAction(player, pickActionName(player.actions, ['Idle', 'Idle_Hold', 'Idle_Attack']), 0);
  player.mixer.update(0);
  anchorMinYToGround(root, -0.06);

  player.group.rotation.y = yawFromDirection(new THREE.Vector3(0, 0, 1));
  scene.add(player.group);
}

// ---- Input ---------------------------------------------------------------

function handleKeyDown(event: KeyboardEvent): void {
  switch (event.code) {
    case 'KeyW': case 'ArrowUp': input.up = true; break;
    case 'KeyS': case 'ArrowDown': input.down = true; break;
    case 'KeyA': case 'ArrowLeft': input.left = true; break;
    case 'KeyD': case 'ArrowRight': input.right = true; break;
    case 'ShiftLeft': case 'ShiftRight': input.run = true; break;
    default: return;
  }
  event.preventDefault();
}

function handleKeyUp(event: KeyboardEvent): void {
  switch (event.code) {
    case 'KeyW': case 'ArrowUp': input.up = false; break;
    case 'KeyS': case 'ArrowDown': input.down = false; break;
    case 'KeyA': case 'ArrowLeft': input.left = false; break;
    case 'KeyD': case 'ArrowRight': input.right = false; break;
    case 'ShiftLeft': case 'ShiftRight': input.run = false; break;
    default: return;
  }
  event.preventDefault();
}

// ---- Update loop ---------------------------------------------------------

function updatePlayer(dt: number): void {
  const direction = new THREE.Vector3();
  if (input.up) direction.z -= 1;
  if (input.down) direction.z += 1;
  if (input.left) direction.x -= 1;
  if (input.right) direction.x += 1;
  direction.normalize();

  const moving = direction.lengthSq() > 0;
  const running = moving && input.run;
  const maxSpeed = running ? player.runSpeed : player.walkSpeed;

  if (moving) {
    player.velocity.x = THREE.MathUtils.damp(player.velocity.x, direction.x * maxSpeed, player.accel, dt);
    player.velocity.z = THREE.MathUtils.damp(player.velocity.z, direction.z * maxSpeed, player.accel, dt);
    player.forward.copy(direction);
  } else {
    player.velocity.x = THREE.MathUtils.damp(player.velocity.x, 0, player.decel, dt);
    player.velocity.z = THREE.MathUtils.damp(player.velocity.z, 0, player.decel, dt);
  }

  const next = player.group.position.clone().addScaledVector(player.velocity, dt);
  next.x = THREE.MathUtils.clamp(next.x, PLAY_BOUNDS.x[0], PLAY_BOUNDS.x[1]);
  next.z = THREE.MathUtils.clamp(next.z, PLAY_BOUNDS.z[0], PLAY_BOUNDS.z[1]);
  player.group.position.x = next.x;
  player.group.position.z = next.z;

  player.bobTimer += dt * (running ? 7.2 : moving ? 6 : 2);
  player.group.position.y = Math.sin(player.bobTimer) * 0.05;

  if (moving) {
    const desiredYaw = yawFromDirection(direction);
    player.group.rotation.y = dampAngle(player.group.rotation.y, desiredYaw, 18, dt);
  }

  if (player.mixer) {
    const runName = pickActionName(player.actions, ['Run', 'Run_Hold', 'Walk', 'Walk_Hold']);
    const walkName = pickActionName(player.actions, ['Walk', 'Walk_Hold', 'Run', 'Run_Hold']);
    const idleName = pickActionName(player.actions, ['Idle', 'Idle_Hold', 'Idle_Attack']);
    playAction(player, moving ? (running ? runName : walkName) : idleName);
    player.mixer.update(dt);
  }
}

function updateCamera(dt: number): void {
  const ndc = player.group.position.clone().project(camera);
  if (ndc.x < -cameraRig.edgeThreshold) cameraRig.targetX -= 0.14;
  else if (ndc.x > cameraRig.edgeThreshold) cameraRig.targetX += 0.14;
  cameraRig.targetX = THREE.MathUtils.clamp(cameraRig.targetX, PLAY_BOUNDS.x[0] + 6, PLAY_BOUNDS.x[1] - 6);
  cameraRig.currentX = THREE.MathUtils.damp(cameraRig.currentX, cameraRig.targetX, 6.5, dt);
  camera.position.x = cameraRig.currentX;
  camera.lookAt(cameraRig.currentX, 1.2, 0);
}

function resize(): void {
  const rect = dom.wrap.getBoundingClientRect();
  renderer.domElement.style.width = `${rect.width}px`;
  renderer.domElement.style.height = `${rect.height}px`;
}
window.addEventListener('resize', resize);

function loop(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

async function bootstrap(): Promise<void> {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  addLights();
  createGround();
  const assetPaths = await loadManifest();
  await buildPlayer(assetPaths);
  dom.loading.classList.add('hidden');
  dom.status.textContent = 'ready — move with WASD';
  clock.start();
  renderer.setAnimationLoop(loop);
  resize();
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  dom.loading.textContent = `Failed to load: ${message}`;
  dom.status.textContent = 'error';
});
