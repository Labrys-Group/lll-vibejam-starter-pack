// Command protocol: the "raw JSON -> typed command" layer of the voice-agent
// pipeline. This is a pure module with no dependency on Three.js, the render
// loop, or LiveKit, so it can be unit-tested headlessly and is the canonical
// home for the inbound command types the (separate) Python brain targets.
//
// Wire contract (inbound `type: "action"` messages over the LiveKit data
// channel) — see the PRD's "Wire contract" section:
//
//   { "type": "action", "action": "pivot",   "degrees": -90 }
//   { "type": "action", "action": "forward", "distance": 5, "speed": 1.0 }
//   { "type": "action", "action": "stop" }
//   { "type": "action", "action": "speech",  "speech": "Heading for the rock." }
//
// `degrees` is signed: positive turns the character RIGHT, negative turns LEFT
// (the asset faces +Z at yaw 0). It has no range cap — pivot as far as you like.
// `speed` is optional and defaults to DEFAULT_SPEED. A `speech` field may also
// ride along on any movement command to carry the subtitle text spoken in
// parallel with the action.
//
// Movement semantics (continuous-until-changed, bounds clamping, animation
// selection) live in the movement model (01b) and are wired in 01c; this layer
// only defines and validates the command shape.

/** Default forward speed applied when a `forward` command omits `speed`. */
export const DEFAULT_SPEED = 1;

/** Inclusive upper bound for `forward.speed`; anything above is rejected. */
export const MAX_SPEED = 10;

/**
 * A validated, typed command. Movement commands (`pivot`/`forward`/`stop`) may
 * carry optional `speech` to be narrated in parallel; `speech` is also a
 * standalone command for pure narration with no movement effect.
 */
export type AgentCommand =
  | { kind: 'pivot'; degrees: number; speech?: string }
  | { kind: 'forward'; distance: number; speed: number; speech?: string }
  | { kind: 'stop'; speech?: string }
  | { kind: 'speech'; speech: string };

/** Movement commands — the subset that may carry optional ride-along speech. */
type MovementCommand = Extract<AgentCommand, { kind: 'pivot' | 'forward' | 'stop' }>;

/** Categories of rejection, stable enough to branch/log on. */
export type ParseErrorCode =
  | 'not_object' // top-level payload was not a plain JSON object
  | 'wrong_type' // `type` was not "action"
  | 'unknown_action' // `action` missing or not one of the known tools
  | 'missing_field' // a required field for the action was absent
  | 'wrong_field_type' // a field was present but of the wrong JS type
  | 'out_of_range' // a number was non-finite or outside its allowed range
  | 'empty_speech'; // `speech` was a string but blank/whitespace-only

export interface ParseError {
  code: ParseErrorCode;
  /** Human-readable explanation, safe to surface in logs/HUD. */
  message: string;
}

/** Result of {@link parseCommand}: a typed command or a structured rejection. */
export type ParseResult =
  | { ok: true; command: AgentCommand }
  | { ok: false; error: ParseError };

const ACTION_TYPE = 'action';

function ok(command: AgentCommand): ParseResult {
  return { ok: true, command };
}

function err(code: ParseErrorCode, message: string): ParseResult {
  return { ok: false, error: { code, message } };
}

/** True for plain objects (and class instances), excluding null and arrays. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render an unknown `action` value for an error message without throwing. */
function describeAction(action: unknown): string {
  return typeof action === 'string' ? JSON.stringify(action) : `(${typeof action})`;
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; error: ParseError };

/** A present field must be a finite number (rejects non-number and NaN/±Infinity). */
function checkFiniteNumber(value: unknown, field: string): FieldResult<number> {
  if (typeof value !== 'number') {
    return { ok: false, error: { code: 'wrong_field_type', message: `\`${field}\` must be a number.` } };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, error: { code: 'out_of_range', message: `\`${field}\` must be a finite number.` } };
  }
  return { ok: true, value };
}

/** A `speech` value must be a non-empty (non-whitespace) string. */
function checkSpeechText(value: unknown): FieldResult<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: { code: 'wrong_field_type', message: '`speech` must be a string.' } };
  }
  if (value.trim().length === 0) {
    return { ok: false, error: { code: 'empty_speech', message: '`speech` must not be empty.' } };
  }
  return { ok: true, value };
}

/**
 * Optional ride-along speech: absent -> ok with no text; present -> validated
 * exactly like a standalone speech field.
 */
function parseOptionalSpeech(record: Record<string, unknown>): FieldResult<string | undefined> {
  if (!('speech' in record) || record.speech === undefined) {
    return { ok: true, value: undefined };
  }
  return checkSpeechText(record.speech);
}

/** Attach ride-along speech to a movement command, omitting the field when absent. */
function withSpeech(command: MovementCommand, speech: string | undefined): MovementCommand {
  return speech === undefined ? command : { ...command, speech };
}

function parsePivot(record: Record<string, unknown>): ParseResult {
  if (!('degrees' in record)) {
    return err('missing_field', '`pivot` requires a `degrees` field.');
  }
  const degrees = checkFiniteNumber(record.degrees, 'degrees');
  if (!degrees.ok) return { ok: false, error: degrees.error };

  const speech = parseOptionalSpeech(record);
  if (!speech.ok) return { ok: false, error: speech.error };

  return ok(withSpeech({ kind: 'pivot', degrees: degrees.value }, speech.value));
}

function parseForward(record: Record<string, unknown>): ParseResult {
  if (!('distance' in record)) {
    return err('missing_field', '`forward` requires a `distance` field.');
  }
  const distance = checkFiniteNumber(record.distance, 'distance');
  if (!distance.ok) return { ok: false, error: distance.error };
  if (distance.value <= 0) {
    return err('out_of_range', '`distance` must be greater than 0.');
  }

  let speed = DEFAULT_SPEED;
  if ('speed' in record && record.speed !== undefined) {
    const parsed = checkFiniteNumber(record.speed, 'speed');
    if (!parsed.ok) return { ok: false, error: parsed.error };
    if (parsed.value <= 0 || parsed.value > MAX_SPEED) {
      return err('out_of_range', `\`speed\` must be greater than 0 and at most ${MAX_SPEED}.`);
    }
    speed = parsed.value;
  }

  const speech = parseOptionalSpeech(record);
  if (!speech.ok) return { ok: false, error: speech.error };

  return ok(withSpeech({ kind: 'forward', distance: distance.value, speed }, speech.value));
}

function parseStop(record: Record<string, unknown>): ParseResult {
  const speech = parseOptionalSpeech(record);
  if (!speech.ok) return { ok: false, error: speech.error };

  return ok(withSpeech({ kind: 'stop' }, speech.value));
}

function parseSpeech(record: Record<string, unknown>): ParseResult {
  if (!('speech' in record) || record.speech === undefined) {
    return err('missing_field', '`speech` action requires a `speech` field.');
  }
  const speech = checkSpeechText(record.speech);
  if (!speech.ok) return { ok: false, error: speech.error };

  return ok({ kind: 'speech', speech: speech.value });
}

/**
 * Parse one inbound data-channel message into a typed {@link AgentCommand} or a
 * structured {@link ParseError}. Pure and total: it NEVER throws — every bad
 * input (including non-objects, symbols, functions, and bigints) returns a
 * rejection value so a malformed message can't crash the render loop.
 */
export function parseCommand(raw: unknown): ParseResult {
  if (!isRecord(raw)) {
    return err('not_object', 'Command must be a JSON object.');
  }
  if (raw.type !== ACTION_TYPE) {
    return err('wrong_type', `Command \`type\` must be "${ACTION_TYPE}".`);
  }

  switch (raw.action) {
    case 'pivot':
      return parsePivot(raw);
    case 'forward':
      return parseForward(raw);
    case 'stop':
      return parseStop(raw);
    case 'speech':
      return parseSpeech(raw);
    default:
      return err('unknown_action', `Unknown action: ${describeAction(raw.action)}.`);
  }
}
