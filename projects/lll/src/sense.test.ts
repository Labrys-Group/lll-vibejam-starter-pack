import { describe, it, expect } from 'vitest';

import { buildSense, type SensePayload } from './sense.ts';
import { PLAY_BOUNDS } from './config.ts';
import type { MovementState } from './movement.ts';

// MovementState fixture: a settled character at the play-area start, with
// overrides for the field under test.
function state(partial: Partial<MovementState> = {}): MovementState {
  return { x: 0, z: 4, yaw: 0, vx: 0, vz: 0, bob: 0, ...partial };
}

describe('buildSense — payload shape', () => {
  it('is tagged type: "sense" with exactly the documented keys', () => {
    const sense = buildSense(state());
    expect(sense.type).toBe('sense');
    expect(Object.keys(sense).sort()).toEqual(
      ['bounds', 'facing', 'moving', 'nearby', 'position', 'type'],
    );
  });

  it('echoes the character position', () => {
    const sense = buildSense(state({ x: 3, z: -2 }));
    expect(sense.position).toEqual({ x: 3, z: -2 });
  });

  it('reports bounds from PLAY_BOUNDS', () => {
    const sense = buildSense(state());
    expect(sense.bounds).toEqual({ x: [-24, 24], z: [-8, 10] });
  });

  it('copies the bounds tuples rather than aliasing PLAY_BOUNDS', () => {
    const sense = buildSense(state());
    expect(sense.bounds.x).not.toBe(PLAY_BOUNDS.x);
    expect(sense.bounds.z).not.toBe(PLAY_BOUNDS.z);
  });

  it('reports an empty nearby array in the baseline sandbox', () => {
    expect(buildSense(state()).nearby).toEqual([]);
  });
});

describe('buildSense — facing (yaw radians → degrees, 0–360)', () => {
  const cases: ReadonlyArray<{ name: string; yaw: number; degrees: number }> = [
    { name: 'yaw 0 → 0°', yaw: 0, degrees: 0 },
    { name: 'quarter turn → 90°', yaw: Math.PI / 2, degrees: 90 },
    { name: 'half turn → 180°', yaw: Math.PI, degrees: 180 },
    { name: 'negative quarter turn normalizes → 270°', yaw: -Math.PI / 2, degrees: 270 },
    { name: 'full turn wraps → 0°', yaw: 2 * Math.PI, degrees: 0 },
  ];

  it.each(cases)('$name', ({ yaw, degrees }) => {
    expect(buildSense(state({ yaw })).facing).toBeCloseTo(degrees);
  });

  it('keeps facing within [0, 360)', () => {
    const sense = buildSense(state({ yaw: -10 * Math.PI }));
    expect(sense.facing).toBeGreaterThanOrEqual(0);
    expect(sense.facing).toBeLessThan(360);
  });
});

describe('buildSense — moving flag', () => {
  it('is false at rest', () => {
    expect(buildSense(state({ vx: 0, vz: 0 })).moving).toBe(false);
  });

  it('is true under a meaningful velocity', () => {
    expect(buildSense(state({ vx: 4.2 })).moving).toBe(true);
    expect(buildSense(state({ vz: -6.8 })).moving).toBe(true);
  });

  it('is false for sub-epsilon velocity (settling to rest)', () => {
    expect(buildSense(state({ vx: 0.001, vz: 0.001 })).moving).toBe(false);
  });
});

describe('buildSense — purity', () => {
  it('returns deep-equal payloads for the same input', () => {
    const fixture = state({ x: 7, z: -3, yaw: Math.PI / 3, vx: 1.5 });
    const a: SensePayload = buildSense(fixture);
    const b: SensePayload = buildSense(fixture);
    expect(a).toEqual(b);
  });
});
