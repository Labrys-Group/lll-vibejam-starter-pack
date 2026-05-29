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

// ---- Collision ----------------------------------------------------------

// Axis-aligned box colliders in the XZ plane (world space). Scene builders push
// footprints here; the player resolves movement against them.
interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const colliders: BoxCollider[] = [];

// Half-width of the player's collision footprint, used to inflate colliders so
// the player stops at the wall rather than clipping into it.
const PLAYER_RADIUS = 0.5;

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

// A simple emoji-style house (🏠): cream box body, terracotta pyramid roof,
// a brown door and two windows. Placed on the right (+X) edge of the play area,
// facing the camera (+Z). Registers its wall footprint as a collider.
function createHouse(): void {
  const house = new THREE.Group();

  const bodyWidth = 4.2;
  const bodyHeight = 3;
  const bodyDepth = 4.2;
  const frontZ = bodyDepth / 2;

  // Walls
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyDepth),
    new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9, metalness: 0 }),
  );
  body.position.y = bodyHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  // Roof — a 4-sided cone is a square pyramid; rotate 45° so faces align to walls,
  // radius reaches the wall corners so the eaves slightly overhang.
  const roofHeight = 2.4;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry((bodyWidth / 2) * Math.SQRT2 * 1.04, roofHeight, 4),
    new THREE.MeshStandardMaterial({ color: 0xc0552f, roughness: 0.8, metalness: 0 }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = bodyHeight + roofHeight / 2;
  roof.castShadow = true;
  roof.receiveShadow = true;
  house.add(roof);

  // Door (front face, +Z)
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.7, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.7, metalness: 0 }),
  );
  door.position.set(0, 0.85, frontZ + 0.04);
  door.castShadow = true;
  house.add(door);

  // Windows (front face, +Z)
  const windowGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.1);
  const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9fd8ef,
    roughness: 0.3,
    metalness: 0.1,
    emissive: 0x294a5a,
    emissiveIntensity: 0.3,
  });
  for (const x of [-1.25, 1.25]) {
    const win = new THREE.Mesh(windowGeometry, windowMaterial);
    win.position.set(x, 1.9, frontZ + 0.03);
    house.add(win);
  }

  const houseX = 19;
  const houseZ = -1;
  house.position.set(houseX, 0, houseZ);
  // Door/windows are built on the +Z face, which already faces the camera — no rotation needed.
  scene.add(house);

  // Register the wall footprint so the player collides with the house.
  colliders.push({
    minX: houseX - bodyWidth / 2,
    maxX: houseX + bodyWidth / 2,
    minZ: houseZ - bodyDepth / 2,
    maxZ: houseZ + bodyDepth / 2,
  });
}

// A small gold key lying flat on the grass: a ring (bow), a shaft, and a couple
// of teeth. Placed on the left (−X) side. Decorative only — no pickup logic yet.
function createKey(): void {
  const key = new THREE.Group();

  const gold = new THREE.MeshStandardMaterial({
    color: 0xe3b23c,
    metalness: 0.85,
    roughness: 0.3,
    emissive: 0x6b4e12,
    emissiveIntensity: 0.25,
  });

  const lift = 0.1; // rest just above the ground (ground sits at y ≈ -0.08)

  // Shaft — a thin rod laid along X (cylinders default to the Y axis).
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 16), gold);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0, lift, 0);
  shaft.castShadow = true;
  key.add(shaft);

  // Bow — a flat ring at the left end (torus defaults to the XY plane; lay it down).
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 12, 28), gold);
  bow.rotation.x = Math.PI / 2;
  bow.position.set(-1.05, lift, 0);
  bow.castShadow = true;
  key.add(bow);

  // Teeth — two nubs near the right end, sticking out to one side (+Z).
  const toothGeometry = new THREE.BoxGeometry(0.12, 0.14, 0.34);
  for (const x of [0.55, 0.82]) {
    const tooth = new THREE.Mesh(toothGeometry, gold);
    tooth.position.set(x, lift, 0.2);
    tooth.castShadow = true;
    key.add(tooth);
  }

  key.position.set(-16, 0, 3);
  key.rotation.y = 0.6; // a casual "dropped" angle
  key.scale.setScalar(0.5);
  scene.add(key);
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

  const pos = player.group.position;
  let nextX = THREE.MathUtils.clamp(pos.x + player.velocity.x * dt, PLAY_BOUNDS.x[0], PLAY_BOUNDS.x[1]);
  let nextZ = THREE.MathUtils.clamp(pos.z + player.velocity.z * dt, PLAY_BOUNDS.z[0], PLAY_BOUNDS.z[1]);

  // Resolve each axis separately so the player slides along walls instead of
  // sticking. X is resolved against the current Z extent, then Z against the
  // already-resolved X, which lets the player round corners cleanly.
  for (const c of colliders) {
    const overlapZ = pos.z > c.minZ - PLAYER_RADIUS && pos.z < c.maxZ + PLAYER_RADIUS;
    if (overlapZ && nextX > c.minX - PLAYER_RADIUS && nextX < c.maxX + PLAYER_RADIUS) {
      nextX = nextX < (c.minX + c.maxX) / 2 ? c.minX - PLAYER_RADIUS : c.maxX + PLAYER_RADIUS;
      player.velocity.x = 0;
    }
  }
  for (const c of colliders) {
    const overlapX = nextX > c.minX - PLAYER_RADIUS && nextX < c.maxX + PLAYER_RADIUS;
    if (overlapX && nextZ > c.minZ - PLAYER_RADIUS && nextZ < c.maxZ + PLAYER_RADIUS) {
      nextZ = nextZ < (c.minZ + c.maxZ) / 2 ? c.minZ - PLAYER_RADIUS : c.maxZ + PLAYER_RADIUS;
      player.velocity.z = 0;
    }
  }

  player.group.position.x = nextX;
  player.group.position.z = nextZ;

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
  createHouse();
  createKey();
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
