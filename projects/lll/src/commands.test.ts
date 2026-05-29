import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  DEFAULT_SPEED,
  MAX_SPEED,
  type AgentCommand,
  type ParseResult,
} from './commands.ts';

// Narrowing helpers so the table-driven assertions read cleanly and a failed
// parse never silently passes a `command`-shaped assertion.
function expectOk(result: ParseResult): AgentCommand {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected ok, got error ${result.error.code}`);
  return result.command;
}

describe('parseCommand — valid commands', () => {
  it('parses a right pivot (positive degrees)', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'pivot', degrees: 90 }));
    expect(cmd).toEqual({ kind: 'pivot', degrees: 90 });
  });

  it('parses a left pivot (negative degrees)', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'pivot', degrees: -45 }));
    expect(cmd).toEqual({ kind: 'pivot', degrees: -45 });
  });

  it('accepts a zero-degree pivot', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'pivot', degrees: 0 }));
    expect(cmd).toEqual({ kind: 'pivot', degrees: 0 });
  });

  it('accepts arbitrarily large pivots (no range cap)', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'pivot', degrees: 7200 }));
    expect(cmd).toEqual({ kind: 'pivot', degrees: 7200 });
  });

  it('parses forward with explicit distance and speed', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'forward', distance: 5, speed: 2 }));
    expect(cmd).toEqual({ kind: 'forward', distance: 5, speed: 2 });
  });

  it('defaults speed when only distance is given', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'forward', distance: 5 }));
    expect(cmd).toEqual({ kind: 'forward', distance: 5, speed: DEFAULT_SPEED });
  });

  it('accepts speed at the upper bound', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'forward', distance: 1, speed: MAX_SPEED }));
    expect(cmd).toEqual({ kind: 'forward', distance: 1, speed: MAX_SPEED });
  });

  it('parses stop', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'stop' }));
    expect(cmd).toEqual({ kind: 'stop' });
  });

  it('parses standalone speech', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'speech', speech: 'Heading for the rock.' }));
    expect(cmd).toEqual({ kind: 'speech', speech: 'Heading for the rock.' });
  });
});

describe('parseCommand — speech riding along on movement commands', () => {
  it('attaches speech to a pivot', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'pivot', degrees: 90, speech: 'Turning.' }));
    expect(cmd).toEqual({ kind: 'pivot', degrees: 90, speech: 'Turning.' });
  });

  it('attaches speech to a forward', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'forward', distance: 3, speech: 'On my way.' }));
    expect(cmd).toEqual({ kind: 'forward', distance: 3, speed: DEFAULT_SPEED, speech: 'On my way.' });
  });

  it('attaches speech to a stop', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'stop', speech: 'Halting.' }));
    expect(cmd).toEqual({ kind: 'stop', speech: 'Halting.' });
  });

  it('omits the speech field entirely when absent (not undefined)', () => {
    const cmd = expectOk(parseCommand({ type: 'action', action: 'stop' }));
    expect('speech' in cmd).toBe(false);
  });
});

describe('parseCommand — structured rejections', () => {
  const cases: ReadonlyArray<{ name: string; input: unknown; code: string }> = [
    // not an action object
    { name: 'null', input: null, code: 'not_object' },
    { name: 'undefined', input: undefined, code: 'not_object' },
    { name: 'a number', input: 5, code: 'not_object' },
    { name: 'a string', input: 'pivot', code: 'not_object' },
    { name: 'an array', input: [{ type: 'action', action: 'stop' }], code: 'not_object' },

    // wrong / missing message type
    { name: 'missing type', input: { action: 'stop' }, code: 'wrong_type' },
    { name: 'non-action type', input: { type: 'state', state: 'thinking' }, code: 'wrong_type' },

    // unknown / malformed action discriminant
    { name: 'missing action', input: { type: 'action' }, code: 'unknown_action' },
    { name: 'unknown action', input: { type: 'action', action: 'jump' }, code: 'unknown_action' },
    { name: 'non-string action', input: { type: 'action', action: 123 }, code: 'unknown_action' },

    // pivot.degrees
    { name: 'pivot missing degrees', input: { type: 'action', action: 'pivot' }, code: 'missing_field' },
    { name: 'pivot degrees as string', input: { type: 'action', action: 'pivot', degrees: '90' }, code: 'wrong_field_type' },
    { name: 'pivot degrees NaN', input: { type: 'action', action: 'pivot', degrees: NaN }, code: 'out_of_range' },
    { name: 'pivot degrees +Infinity', input: { type: 'action', action: 'pivot', degrees: Infinity }, code: 'out_of_range' },
    { name: 'pivot degrees -Infinity', input: { type: 'action', action: 'pivot', degrees: -Infinity }, code: 'out_of_range' },

    // forward.distance
    { name: 'forward missing distance', input: { type: 'action', action: 'forward' }, code: 'missing_field' },
    { name: 'forward distance as string', input: { type: 'action', action: 'forward', distance: '5' }, code: 'wrong_field_type' },
    { name: 'forward distance NaN', input: { type: 'action', action: 'forward', distance: NaN }, code: 'out_of_range' },
    { name: 'forward distance Infinity', input: { type: 'action', action: 'forward', distance: Infinity }, code: 'out_of_range' },
    { name: 'forward distance zero', input: { type: 'action', action: 'forward', distance: 0 }, code: 'out_of_range' },
    { name: 'forward distance negative', input: { type: 'action', action: 'forward', distance: -3 }, code: 'out_of_range' },

    // forward.speed (optional, but validated when present)
    { name: 'forward speed as string', input: { type: 'action', action: 'forward', distance: 5, speed: 'fast' }, code: 'wrong_field_type' },
    { name: 'forward speed NaN', input: { type: 'action', action: 'forward', distance: 5, speed: NaN }, code: 'out_of_range' },
    { name: 'forward speed Infinity', input: { type: 'action', action: 'forward', distance: 5, speed: Infinity }, code: 'out_of_range' },
    { name: 'forward speed zero', input: { type: 'action', action: 'forward', distance: 5, speed: 0 }, code: 'out_of_range' },
    { name: 'forward speed negative', input: { type: 'action', action: 'forward', distance: 5, speed: -1 }, code: 'out_of_range' },
    { name: 'forward speed above max', input: { type: 'action', action: 'forward', distance: 5, speed: MAX_SPEED + 0.1 }, code: 'out_of_range' },

    // standalone speech
    { name: 'speech missing text', input: { type: 'action', action: 'speech' }, code: 'missing_field' },
    { name: 'speech non-string text', input: { type: 'action', action: 'speech', speech: 123 }, code: 'wrong_field_type' },
    { name: 'speech empty text', input: { type: 'action', action: 'speech', speech: '' }, code: 'empty_speech' },
    { name: 'speech whitespace-only text', input: { type: 'action', action: 'speech', speech: '   ' }, code: 'empty_speech' },

    // ride-along speech validated like standalone (when present)
    { name: 'forward ride-along speech wrong type', input: { type: 'action', action: 'forward', distance: 5, speech: 5 }, code: 'wrong_field_type' },
    { name: 'stop ride-along speech empty', input: { type: 'action', action: 'stop', speech: '   ' }, code: 'empty_speech' },
  ];

  it.each(cases)('rejects $name with code $code', ({ input, code }) => {
    const result = parseCommand(input);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected rejection');
    expect(result.error.code).toBe(code);
    expect(typeof result.error.message).toBe('string');
    expect(result.error.message.length).toBeGreaterThan(0);
  });
});

describe('parseCommand — never throws for any input', () => {
  const hostile: ReadonlyArray<unknown> = [
    null,
    undefined,
    NaN,
    Infinity,
    Symbol('x'),
    () => {},
    [],
    {},
    { type: 'action' },
    { type: 'action', action: 'pivot', degrees: { nested: true } },
    { type: 'action', action: 'forward', distance: [], speed: {} },
    { type: Symbol('action') },
    new Map([['type', 'action']]),
    0,
    '',
    true,
    false,
    BigInt(10),
  ];

  it.each(hostile.map((input, i) => ({ i, input })))(
    'returns a result (no throw) for hostile input #$i',
    ({ input }) => {
      let result: ParseResult;
      expect(() => {
        result = parseCommand(input);
      }).not.toThrow();
      // Every hostile input is invalid; assert it produced a structured rejection.
      result = parseCommand(input);
      expect(result.ok).toBe(false);
    },
  );
});
