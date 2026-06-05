import * as THREE from "three";

import { AgentSession, type AgentState } from "./agentSession.ts";
import { parseCommand, type ParseResult } from "./commands.ts";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COLORS,
  PLAY_BOUNDS,
  PLAYER_START,
} from "./config.ts";
import {
  anchorMinYToGround,
  buildActionMap,
  normalizeToHeightAndGround,
  pickActionName,
  playAction,
  yawFromDirection,
  type Actor,
} from "./helpers.ts";
import { createVoiceHud } from "./hud.ts";
import { loadGltf, loadManifest, type AssetPaths } from "./manifest.ts";
import { installMockInjector } from "./mockInjector.ts";
import {
  applyCommand,
  applyKeyboard,
  stepMovement,
  type ControlIntent,
  type KeyboardInput,
  type MovementState,
} from "./movement.ts";
import { fetchToken } from "./token.ts";

// ---- DOM ----------------------------------------------------------------

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el as T;
}

const dom = {
  wrap: requireElement<HTMLDivElement>("canvasWrap"),
  canvas: requireElement<HTMLCanvasElement>("scene"),
  loading: requireElement<HTMLDivElement>("loading"),
  status: requireElement<HTMLElement>("status"),
};

// ---- Renderer / scene / camera ------------------------------------------

const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.skyTop);
scene.fog = new THREE.FogExp2(COLORS.horizon, 0.03);

const camera = new THREE.PerspectiveCamera(
  46,
  CANVAS_WIDTH / CANVAS_HEIGHT,
  0.1,
  220,
);
camera.position.set(0, 6.1, 16.2);
camera.lookAt(0, 1.25, 0);

const clock = new THREE.Clock();

// ---- Player + input state -----------------------------------------------

// Raw keyboard state. Folded into the shared `intent` each frame via
// `applyKeyboard`; shape matches the movement model's `KeyboardInput`.
const input: KeyboardInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  run: false,
};

interface Player extends Actor {
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
}

const player: Player = {
  group: new THREE.Group(),
  mixer: null,
  actions: new Map(),
  currentAction: null,
};

// The single shared control intent. Both keyboard (`applyKeyboard`) and injected
// agent commands (`applyCommand`) fold into this same object; the keyboard
// overrides the agent intent while a steering key is held, otherwise the agent
// intent persists. `stepMovement` advances `motion` from it each frame.
let intent: ControlIntent = { turn: 0, drive: false, run: false };

// Pure pose/velocity state advanced by `stepMovement`. yaw 0 faces +Z (matches
// the initial facing set in `buildPlayer`).
const motion: MovementState = {
  x: PLAYER_START.x,
  z: PLAYER_START.z,
  yaw: 0,
  vx: 0,
  vz: 0,
  bob: 0,
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
  scene.add(new THREE.HemisphereLight("#BFE8FF", "#E9FFF2", 0.85));

  const dir = new THREE.DirectionalLight("#ffffff", 1.1);
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

  scene.add(new THREE.AmbientLight("#ffffff", 0.15));
}

function createGround(): void {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 36, 1, 1),
    new THREE.MeshStandardMaterial({
      color: COLORS.grass,
      roughness: 0.85,
      metalness: 0,
    }),
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
    new THREE.MeshStandardMaterial({
      color: 0xe8d8b0,
      roughness: 0.9,
      metalness: 0,
    }),
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
    new THREE.MeshStandardMaterial({
      color: 0xc0552f,
      roughness: 0.8,
      metalness: 0,
    }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.position.y = bodyHeight + roofHeight / 2;
  roof.castShadow = true;
  roof.receiveShadow = true;
  house.add(roof);

  // Door (front face, +Z)
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.7, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x6b4226,
      roughness: 0.7,
      metalness: 0,
    }),
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
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.8, 16),
    gold,
  );
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
  const { root, animations } = await loadGltf("player", assetPaths.player);
  normalizeToHeightAndGround(root, 1.6, 0);
  player.group.add(root);
  player.group.position.set(PLAYER_START.x, 0, PLAYER_START.z);

  player.mixer = new THREE.AnimationMixer(root);
  player.actions = buildActionMap(player.mixer, animations);
  playAction(
    player,
    pickActionName(player.actions, ["Idle", "Idle_Hold", "Idle_Attack"]),
    0,
  );
  player.mixer.update(0);
  anchorMinYToGround(root, -0.06);

  player.group.rotation.y = yawFromDirection(new THREE.Vector3(0, 0, 1));
  scene.add(player.group);
}

// ---- Input ---------------------------------------------------------------

function handleKeyDown(event: KeyboardEvent): void {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      input.up = true;
      break;
    case "KeyS":
    case "ArrowDown":
      input.down = true;
      break;
    case "KeyA":
    case "ArrowLeft":
      input.left = true;
      break;
    case "KeyD":
    case "ArrowRight":
      input.right = true;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      input.run = true;
      break;
    default:
      return;
  }
  event.preventDefault();
}

function handleKeyUp(event: KeyboardEvent): void {
  switch (event.code) {
    case "KeyW":
    case "ArrowUp":
      input.up = false;
      break;
    case "KeyS":
    case "ArrowDown":
      input.down = false;
      break;
    case "KeyA":
    case "ArrowLeft":
      input.left = false;
      break;
    case "KeyD":
    case "ArrowRight":
      input.right = false;
      break;
    case "ShiftLeft":
    case "ShiftRight":
      input.run = false;
      break;
    default:
      return;
  }
  event.preventDefault();
}

// ---- Update loop ---------------------------------------------------------

function updatePlayer(dt: number): void {
  // Keyboard folds into the shared intent (overrides the agent intent while a
  // steering key is held; otherwise leaves the agent intent untouched), then the
  // pure model advances pose/velocity/bob/anim — including PLAY_BOUNDS clamping.
  intent = applyKeyboard(intent, input);
  const result = stepMovement(motion, intent, dt);

  // Collision resolution (preserved from the house & key slice): the pure model
  // only clamps to PLAY_BOUNDS, so resolve the stepped position against the box
  // colliders here. Resolve each axis separately so the player slides along
  // walls; zero the matching velocity on a hit so the model stops accumulating
  // into the wall next frame.
  let nextX = result.x;
  let nextZ = result.z;
  let vx = result.vx;
  let vz = result.vz;

  for (const c of colliders) {
    const overlapZ =
      motion.z > c.minZ - PLAYER_RADIUS && motion.z < c.maxZ + PLAYER_RADIUS;
    if (
      overlapZ &&
      nextX > c.minX - PLAYER_RADIUS &&
      nextX < c.maxX + PLAYER_RADIUS
    ) {
      nextX =
        nextX < (c.minX + c.maxX) / 2
          ? c.minX - PLAYER_RADIUS
          : c.maxX + PLAYER_RADIUS;
      vx = 0;
    }
  }
  for (const c of colliders) {
    const overlapX =
      nextX > c.minX - PLAYER_RADIUS && nextX < c.maxX + PLAYER_RADIUS;
    if (
      overlapX &&
      nextZ > c.minZ - PLAYER_RADIUS &&
      nextZ < c.maxZ + PLAYER_RADIUS
    ) {
      nextZ =
        nextZ < (c.minZ + c.maxZ) / 2
          ? c.minZ - PLAYER_RADIUS
          : c.maxZ + PLAYER_RADIUS;
      vz = 0;
    }
  }

  // Commit the resolved values back into the shared state so the next step
  // continues from where collision left the player.
  motion.x = nextX;
  motion.z = nextZ;
  motion.vx = vx;
  motion.vz = vz;
  motion.yaw = result.yaw;
  motion.bob = result.bob;

  // Map the pure result onto the Three.js group. The model owns yaw integration
  // (continuous turn at TURN_SPEED), so set rotation directly — no extra damping.
  player.group.position.set(motion.x, Math.sin(motion.bob) * 0.05, motion.z);
  player.group.rotation.y = motion.yaw;

  if (player.mixer) {
    const name =
      result.anim === "run"
        ? pickActionName(player.actions, [
            "Run",
            "Run_Hold",
            "Walk",
            "Walk_Hold",
          ])
        : result.anim === "walk"
          ? pickActionName(player.actions, [
              "Walk",
              "Walk_Hold",
              "Run",
              "Run_Hold",
            ])
          : pickActionName(player.actions, [
              "Idle",
              "Idle_Hold",
              "Idle_Attack",
            ]);
    playAction(player, name);
    player.mixer.update(dt);
  }
}

function updateCamera(dt: number): void {
  const ndc = player.group.position.clone().project(camera);
  if (ndc.x < -cameraRig.edgeThreshold) cameraRig.targetX -= 0.14;
  else if (ndc.x > cameraRig.edgeThreshold) cameraRig.targetX += 0.14;
  cameraRig.targetX = THREE.MathUtils.clamp(
    cameraRig.targetX,
    PLAY_BOUNDS.x[0] + 6,
    PLAY_BOUNDS.x[1] - 6,
  );
  cameraRig.currentX = THREE.MathUtils.damp(
    cameraRig.currentX,
    cameraRig.targetX,
    6.5,
    dt,
  );
  camera.position.x = cameraRig.currentX;
  camera.lookAt(cameraRig.currentX, 1.2, 0);
}

function resize(): void {
  const rect = dom.wrap.getBoundingClientRect();
  renderer.domElement.style.width = `${rect.width}px`;
  renderer.domElement.style.height = `${rect.height}px`;
}
window.addEventListener("resize", resize);

function loop(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  updatePlayer(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

// Injection seam: route one raw data-channel command (the exact JSON the brain
// will send) through `parseCommand` -> `applyCommand` into the live intent, and
// return the parse result so the mock injector can surface rejections. This is
// the single code path from JSON to intent shared by the panel buttons, the raw
// box, and `window.__inject`.
function injectCommand(raw: unknown): ParseResult {
  const result = parseCommand(raw);
  if (result.ok) intent = applyCommand(intent, result.command);
  return result;
}

// ---- Voice session (LiveKit) --------------------------------------------

// Room the browser asks the external token server for (sent as the `?room=` query
// param by `fetchToken`). The server owns the room and agent dispatch; this is
// just the name we request a join token for. It MUST match the room the agent is
// dispatched into. Configurable via `VITE_VOICE_ROOM` so changing rooms needs no
// code edit; falls back to `test-room`.
const VOICE_ROOM = import.meta.env.VITE_VOICE_ROOM?.trim() || "test-room";

// Stand up the LiveKit session shell and its HUD. Connect/Disconnect drive the
// `AgentSession`; the session emits agent-state + raw inbound data back. Inbound
// data routing (commands → game, state/speech → HUD) is wired in 02c via the
// `onData` seam below; this slice only stands it up.
function setupVoiceSession(): void {
  const hud = createVoiceHud({
    onConnect: () => void connect(),
    onDisconnect: () => void disconnect(),
  });

  const session = new AgentSession({
    onAgentState: (state: AgentState) => hud.setAgentState(state),
    onData: () => {
      // 02c decodes the payload and routes it through parseCommand → applyCommand
      // (and updates the subtitle / agent-state indicator). Seam only for now.
    },
    onError: (message: string) => hud.setStatus(message),
  });

  async function connect(): Promise<void> {
    hud.setStatus("");
    hud.setConnectionPhase("connecting");

    const result = await fetchToken(VOICE_ROOM);
    if (!result.ok) {
      // Graceful degrade: no token → explain why and re-enable Connect. The plain
      // sandbox keeps running regardless. (`reason` is a stable code; `message`
      // is the human-readable text for the HUD.)
      hud.setStatus(result.message);
      hud.setConnectionPhase("idle");
      return;
    }

    try {
      // Runs within the Connect click gesture so the mic prompt + audio autoplay
      // unlock are allowed by the browser.
      await session.connect({ token: result.token, url: result.url });
      hud.setConnectionPhase("connected");
    } catch (error) {
      hud.setStatus(
        `Connect failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      hud.setConnectionPhase("idle");
    }
  }

  async function disconnect(): Promise<void> {
    await session.disconnect();
    hud.setConnectionPhase("idle");
  }
}

async function bootstrap(): Promise<void> {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  addLights();
  createGround();
  createHouse();
  createKey();
  const assetPaths = await loadManifest();
  await buildPlayer(assetPaths);
  installMockInjector({ inject: injectCommand });
  setupVoiceSession();
  dom.loading.classList.add("hidden");
  dom.status.textContent = "ready — W drive · A/D pivot · S stop · Shift run";
  clock.start();
  renderer.setAnimationLoop(loop);
  resize();
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  dom.loading.textContent = `Failed to load: ${message}`;
  dom.status.textContent = "error";
});
