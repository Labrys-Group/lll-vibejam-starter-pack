import * as THREE from 'three';

import { PLAY_BOUNDS } from './config.ts';
import { DEFAULT_SPEED, type AgentCommand } from './commands.ts';

// Tank-style movement model. Pure: same inputs → same outputs, no Three.js
// scene-graph or DOM. Both keyboard and (later, in 01c) agent commands fold
// into the single shared `ControlIntent`, which `stepMovement` advances.

// The desired motion. `turn` pivots facing in place (-1 left / +1 right / 0
// none); `drive` drives forward along current facing; `run` selects run speed.
export interface ControlIntent {
  turn: -1 | 0 | 1;
  drive: boolean;
  run: boolean;
}

// Pure numeric pose + velocity (no THREE.Group). `bob` is the running phase of
// the subtle vertical bob; `yaw` follows the +Z-at-yaw-0 facing convention.
export interface MovementState {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  bob: number;
}

// Raw keyboard state (tank mapping): W/↑ forward, S/↓ stop, A/← and D/→ pivot,
// Shift run. Matches the InputState `main.ts` accumulates from key events.
export interface KeyboardInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
}

export type AnimKey = 'idle' | 'walk' | 'run';

export interface MovementResult extends MovementState {
  anim: AnimKey;
}

// Tuning constants (ported from main.ts's player config + a pivot rate).
export const TURN_SPEED = 2.4; // rad/s
export const WALK_SPEED = 4.2;
export const RUN_SPEED = 6.8;
export const ACCEL = 18;
export const DECEL = 22;

// Fold keyboard state into the shared intent. When no steering key is held the
// keyboard yields control: the existing intent (e.g. a later agent command) is
// preserved unchanged.
export function applyKeyboard(intent: ControlIntent, input: KeyboardInput): ControlIntent {
  const steering = input.up || input.down || input.left || input.right;
  if (!steering) return intent;

  const turn: -1 | 0 | 1 = input.left ? -1 : input.right ? 1 : 0;
  return {
    turn,
    drive: input.up && !input.down,
    run: input.run,
  };
}

// Fold an agent command into the shared intent. The command protocol is richer
// than the binary intent (`pivot` carries signed degrees, `forward` carries
// distance + speed), so this projects each command onto the continuous-until-
// changed intent: each command fully sets the intent, persisting until the next.
//   pivot   -> turn = sign(degrees), drive cleared (magnitude/exact angle not
//              honored — the model has no target-angle/odometry).
//   forward -> drive set, turn cleared; speed above the default selects run.
//   stop    -> turn + drive cleared.
//   speech  -> no movement effect (intent unchanged).
export function applyCommand(intent: ControlIntent, command: AgentCommand): ControlIntent {
  switch (command.kind) {
    case 'pivot': {
      const turn: -1 | 0 | 1 = command.degrees < 0 ? -1 : command.degrees > 0 ? 1 : 0;
      return { turn, drive: false, run: intent.run };
    }
    case 'forward':
      return { turn: 0, drive: true, run: command.speed > DEFAULT_SPEED };
    case 'stop':
      return { turn: 0, drive: false, run: false };
    case 'speech':
      return intent;
  }
}

export function stepMovement(
  state: MovementState,
  intent: ControlIntent,
  dt: number,
): MovementResult {
  const yaw = state.yaw + intent.turn * TURN_SPEED * dt;

  // Facing vector under the +Z-at-yaw-0 convention (inverse of yawFromDirection).
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);

  // Drive toward facing*maxSpeed; otherwise decelerate to rest.
  const maxSpeed = intent.run ? RUN_SPEED : WALK_SPEED;
  const targetVx = intent.drive ? forwardX * maxSpeed : 0;
  const targetVz = intent.drive ? forwardZ * maxSpeed : 0;
  const rate = intent.drive ? ACCEL : DECEL;
  const vx = THREE.MathUtils.damp(state.vx, targetVx, rate, dt);
  const vz = THREE.MathUtils.damp(state.vz, targetVz, rate, dt);

  const x = THREE.MathUtils.clamp(state.x + vx * dt, PLAY_BOUNDS.x[0], PLAY_BOUNDS.x[1]);
  const z = THREE.MathUtils.clamp(state.z + vz * dt, PLAY_BOUNDS.z[0], PLAY_BOUNDS.z[1]);

  // Subtle vertical bob: fastest running, slower walking, slowest at rest.
  const bobRate = intent.drive ? (intent.run ? 7.2 : 6) : 2;
  const bob = state.bob + dt * bobRate;

  const anim: AnimKey = intent.drive ? (intent.run ? 'run' : 'walk') : 'idle';

  return { x, z, yaw, vx, vz, bob, anim };
}
