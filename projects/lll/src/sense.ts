import { PLAY_BOUNDS } from './config.ts';
import type { MovementState } from './movement.ts';

// Pure "game state → outbound sense JSON" layer. Same input → same output, no
// I/O, no globals, and deliberately no Three.js import (MovementState is a
// type-only import, so its runtime `three` dependency is erased at compile).
// This is the single testable place that computes what the agent perceives;
// publishing it over the LiveKit data channel is a separate concern (03b).

// A puzzle object the character can perceive. Unpopulated in the baseline
// sandbox — `nearby` is always `[]` for now; this shape is forward-looking.
export interface NearbyObject {
  name: string;
  bearing: number; // degrees relative to facing
  distance: number;
}

// The outbound wire contract ("Wire contract → Outbound" in the PRD). `facing`
// is the yaw-in-degrees form (the cardinal "north" alternative is not used).
export interface SensePayload {
  type: 'sense';
  position: { x: number; z: number };
  facing: number; // degrees, normalized 0–360
  moving: boolean;
  bounds: { x: [number, number]; z: [number, number] };
  nearby: NearbyObject[];
}

// Velocity magnitude below this counts as at rest. Walk/run speeds are 4.2/6.8,
// so this cleanly separates a settled character from one in motion.
const MOVING_EPSILON = 0.01;

const RAD_TO_DEG = 180 / Math.PI;

export function buildSense(state: MovementState): SensePayload {
  const deg = state.yaw * RAD_TO_DEG;
  const facing = ((deg % 360) + 360) % 360;

  return {
    type: 'sense',
    position: { x: state.x, z: state.z },
    facing,
    moving: Math.hypot(state.vx, state.vz) > MOVING_EPSILON,
    bounds: {
      x: [PLAY_BOUNDS.x[0], PLAY_BOUNDS.x[1]],
      z: [PLAY_BOUNDS.z[0], PLAY_BOUNDS.z[1]],
    },
    nearby: [],
  };
}
