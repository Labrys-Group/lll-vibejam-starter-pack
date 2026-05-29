import { describe, it, expect } from "vitest";

import {
  type ControlIntent,
  type KeyboardInput,
  type MovementResult,
  type MovementState,
  applyCommand,
  applyKeyboard,
  stepMovement,
  WALK_SPEED,
} from "../src/movement.ts";
import { type AgentCommand, DEFAULT_SPEED, MAX_SPEED } from "../src/commands.ts";
import { PLAY_BOUNDS } from "../src/config.ts";

const DT = 1 / 60;

function restState(overrides: Partial<MovementState> = {}): MovementState {
  return { x: 0, z: 0, yaw: 0, vx: 0, vz: 0, bob: 0, ...overrides };
}

function intent(overrides: Partial<ControlIntent> = {}): ControlIntent {
  return { turn: 0, drive: false, run: false, ...overrides };
}

// Advance many fixed steps to observe accumulated motion.
function run(
  state: MovementState,
  control: ControlIntent,
  steps: number,
): MovementResult {
  let s: MovementResult = stepMovement(state, control, DT);
  for (let i = 1; i < steps; i++) s = stepMovement(s, control, DT);
  return s;
}

describe("stepMovement — pivot", () => {
  it("pivot left decreases yaw and produces no translation", () => {
    const state = restState({ yaw: 0 });
    const next = stepMovement(state, intent({ turn: -1 }), DT);

    expect(next.yaw).toBeLessThan(0);
    expect(next.x).toBeCloseTo(0, 6);
    expect(next.z).toBeCloseTo(0, 6);
  });

  it("pivot right increases yaw", () => {
    const next = stepMovement(restState({ yaw: 0 }), intent({ turn: 1 }), DT);
    expect(next.yaw).toBeGreaterThan(0);
  });
});

describe("stepMovement — forward", () => {
  it("advances along current facing (+Z at yaw 0) and selects walk", () => {
    const next = run(restState({ yaw: 0 }), intent({ drive: true }), 30);

    expect(next.z).toBeGreaterThan(0);
    expect(next.x).toBeCloseTo(0, 6);
    expect(next.anim).toBe("walk");
  });

  it("drives along +X when facing yaw = +90°", () => {
    const next = run(
      restState({ yaw: Math.PI / 2 }),
      intent({ drive: true }),
      30,
    );

    expect(next.x).toBeGreaterThan(0);
    expect(next.z).toBeCloseTo(0, 6);
  });

  it("selects run when the run flag is set", () => {
    const next = run(
      restState({ yaw: 0 }),
      intent({ drive: true, run: true }),
      30,
    );
    expect(next.anim).toBe("run");
  });

  it("run reaches a greater forward speed than walk over the same steps", () => {
    const walked = run(restState({ yaw: 0 }), intent({ drive: true }), 30);
    const ran = run(
      restState({ yaw: 0 }),
      intent({ drive: true, run: true }),
      30,
    );
    expect(ran.z).toBeGreaterThan(walked.z);
  });
});

describe("stepMovement — stop", () => {
  it("decelerates velocity toward zero and selects idle", () => {
    const moving = restState({ yaw: 0, vz: WALK_SPEED });

    const one = stepMovement(moving, intent(), DT);
    expect(Math.abs(one.vz)).toBeLessThan(WALK_SPEED);
    expect(one.anim).toBe("idle");

    const settled = run(moving, intent(), 240);
    expect(settled.vz).toBeCloseTo(0, 3);
    expect(settled.vx).toBeCloseTo(0, 3);
  });

  it("pivoting in place selects idle (no drive)", () => {
    const next = stepMovement(restState(), intent({ turn: -1 }), DT);
    expect(next.anim).toBe("idle");
  });
});

describe("stepMovement — bob", () => {
  it("advances the bob phase, faster while driving than idle", () => {
    const idle = stepMovement(restState({ bob: 0 }), intent(), DT);
    const driving = stepMovement(
      restState({ bob: 0 }),
      intent({ drive: true }),
      DT,
    );

    expect(idle.bob).toBeGreaterThan(0);
    expect(driving.bob).toBeGreaterThan(idle.bob);
  });
});

describe("stepMovement — bounds", () => {
  it("clamps position to PLAY_BOUNDS when driving past the far +Z edge", () => {
    // facing +Z, start near the +Z edge; drive long enough to overrun it.
    const next = run(
      restState({ x: 0, z: 9, yaw: 0 }),
      intent({ drive: true }),
      600,
    );
    expect(next.z).toBeLessThanOrEqual(PLAY_BOUNDS.z[1]);
    expect(next.z).toBeCloseTo(PLAY_BOUNDS.z[1], 6);
  });

  it("clamps position to PLAY_BOUNDS when driving past the +X edge", () => {
    const next = run(
      restState({ x: 23, z: 0, yaw: Math.PI / 2 }),
      intent({ drive: true }),
      600,
    );
    expect(next.x).toBeLessThanOrEqual(PLAY_BOUNDS.x[1]);
    expect(next.x).toBeCloseTo(PLAY_BOUNDS.x[1], 6);
  });
});

function keys(overrides: Partial<KeyboardInput> = {}): KeyboardInput {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    ...overrides,
  };
}

describe("applyKeyboard", () => {
  it("W (up) drives forward without turning", () => {
    const next = applyKeyboard(intent(), keys({ up: true }));
    expect(next.drive).toBe(true);
    expect(next.turn).toBe(0);
  });

  it("A (left) pivots left; D (right) pivots right", () => {
    expect(applyKeyboard(intent(), keys({ left: true })).turn).toBe(-1);
    expect(applyKeyboard(intent(), keys({ right: true })).turn).toBe(1);
  });

  it("S (down) clears drive — a stop", () => {
    const next = applyKeyboard(intent({ drive: true }), keys({ down: true }));
    expect(next.drive).toBe(false);
  });

  it("Shift sets the run flag while steering", () => {
    const next = applyKeyboard(intent(), keys({ up: true, run: true }));
    expect(next.run).toBe(true);
  });

  it("drives the same motion as the equivalent intent", () => {
    const fromKeys = applyKeyboard(intent(), keys({ up: true }));
    const fromIntent = intent({ drive: true });
    expect(stepMovement(restState(), fromKeys, DT)).toEqual(
      stepMovement(restState(), fromIntent, DT),
    );
  });

  it("preserves the existing intent when no keys are pressed", () => {
    const agentIntent = intent({ drive: true, run: true });
    expect(applyKeyboard(agentIntent, keys())).toEqual(agentIntent);
  });
});

describe("applyCommand", () => {
  it("pivot with negative degrees turns left and clears drive", () => {
    const next = applyCommand(intent({ drive: true }), { kind: "pivot", degrees: -90 });
    expect(next.turn).toBe(-1);
    expect(next.drive).toBe(false);
  });

  it("pivot with positive degrees turns right", () => {
    expect(applyCommand(intent(), { kind: "pivot", degrees: 45 }).turn).toBe(1);
  });

  it("pivot with zero degrees produces no turn", () => {
    expect(applyCommand(intent(), { kind: "pivot", degrees: 0 }).turn).toBe(0);
  });

  it("forward drives without turning; default speed walks, faster speed runs", () => {
    const walk = applyCommand(intent(), {
      kind: "forward",
      distance: 5,
      speed: DEFAULT_SPEED,
    });
    expect(walk).toEqual({ turn: 0, drive: true, run: false });

    const fast = applyCommand(intent(), { kind: "forward", distance: 5, speed: MAX_SPEED });
    expect(fast.run).toBe(true);
  });

  it("stop clears turn, drive, and run", () => {
    const next = applyCommand(intent({ turn: 1, drive: true, run: true }), { kind: "stop" });
    expect(next).toEqual({ turn: 0, drive: false, run: false });
  });

  it("speech has no movement effect (intent unchanged)", () => {
    const before = intent({ turn: -1, drive: true, run: true });
    expect(applyCommand(before, { kind: "speech", speech: "on my way" })).toEqual(before);
  });
});

describe("applyCommand — drives the same movement path", () => {
  it("an injected forward command advances along facing and selects walk/run", () => {
    const forward: AgentCommand = { kind: "forward", distance: 5, speed: DEFAULT_SPEED };
    const driven = run(restState({ yaw: 0 }), applyCommand(intent(), forward), 30);
    expect(driven.z).toBeGreaterThan(0);
    expect(driven.x).toBeCloseTo(0, 6);
    expect(driven.anim).toBe("walk");

    const ranIntent = applyCommand(intent(), { kind: "forward", distance: 5, speed: MAX_SPEED });
    expect(run(restState({ yaw: 0 }), ranIntent, 30).anim).toBe("run");
  });

  it("an injected pivot command changes yaw only", () => {
    const pivoted = applyCommand(intent(), { kind: "pivot", degrees: -90 });
    const next = stepMovement(restState({ yaw: 0 }), pivoted, DT);
    expect(next.yaw).toBeLessThan(0);
    expect(next.x).toBeCloseTo(0, 6);
    expect(next.z).toBeCloseTo(0, 6);
    expect(next.anim).toBe("idle");
  });
});

describe("keyboard overrides agent intent", () => {
  it("a held steering key overrides an active agent forward intent", () => {
    const agentDriving = applyCommand(intent(), {
      kind: "forward",
      distance: 5,
      speed: DEFAULT_SPEED,
    });
    const overridden = applyKeyboard(agentDriving, keys({ left: true }));
    expect(overridden.turn).toBe(-1);
    expect(overridden.drive).toBe(false);
  });

  it("the agent intent persists when no keys are pressed", () => {
    const agentDriving = applyCommand(intent(), {
      kind: "forward",
      distance: 5,
      speed: DEFAULT_SPEED,
    });
    expect(applyKeyboard(agentDriving, keys())).toEqual(agentDriving);
  });
});
