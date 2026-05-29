// Dev mock injector: a hidden HUD panel + a `window.__inject(json)` entry point
// that feed raw command JSON through the SAME `parseCommand` -> `applyCommand`
// path the LiveKit brain will later drive over the data channel. This lets the
// whole game-side command pipeline be exercised offline, before the brain or any
// LiveKit connection exists.
//
// Design (the "thin seam" from the 01d ticket): this module owns no game state.
// `main.ts` holds the single shared `ControlIntent` and passes an `inject`
// callback that runs `parseCommand` -> `applyCommand` against it and returns the
// `ParseResult` so the panel can surface rejections. Every route — buttons, the
// raw-JSON box, and `window.__inject` — goes through that one callback, so there
// is exactly one code path from JSON to intent.

import type { ParseResult } from './commands.ts';

declare global {
  interface Window {
    /**
     * Dev entry point: push one raw data-channel command (the exact JSON the
     * brain will send) through the live `parseCommand` -> `applyCommand` path.
     * Mirrors the buttons in the injector panel.
     */
    __inject?: (raw: unknown) => void;
  }
}

export interface MockInjectorOptions {
  /**
   * Route one raw command payload through `parseCommand` -> `applyCommand` into
   * the live intent, returning the parse result so the panel can show feedback.
   */
  inject: (raw: unknown) => ParseResult;
}

// Canonical preset commands — the exact `{ type: 'action', ... }` shapes the
// brain emits, matched to what `parseCommand` accepts (signed `degrees` for
// pivot, `distance`/`speed` for forward). `applyCommand` maps the sign of
// `degrees` to a turn direction and `speed > 1` to a run.
const PRESETS: ReadonlyArray<{ label: string; command: Record<string, unknown> }> = [
  { label: 'Pivot ◀ left', command: { type: 'action', action: 'pivot', degrees: -90 } },
  { label: 'Pivot right ▶', command: { type: 'action', action: 'pivot', degrees: 90 } },
  { label: 'Forward', command: { type: 'action', action: 'forward', distance: 5 } },
  { label: 'Forward (run)', command: { type: 'action', action: 'forward', distance: 5, speed: 5 } },
  { label: 'Stop', command: { type: 'action', action: 'stop' } },
  { label: 'Speech', command: { type: 'action', action: 'speech', speech: 'Heading for the rock.' } },
];

// Single-command building blocks, reused by the chained sequences below.
const FORWARD: Record<string, unknown> = { type: 'action', action: 'forward', distance: 10 };
const PIVOT_LEFT: Record<string, unknown> = { type: 'action', action: 'pivot', degrees: -90 };
const PIVOT_RIGHT: Record<string, unknown> = { type: 'action', action: 'pivot', degrees: 90 };
const STOP: Record<string, unknown> = { type: 'action', action: 'stop' };

interface SequenceStep {
  command: Record<string, unknown>;
  /** How long to hold this command before injecting the next. */
  holdMs: number;
}

// Multi-step sequences for exercising a *chain* of movement. Each step injects a
// command then holds for `holdMs` before the next — necessary because the model
// is continuous-until-changed with no odometry, so "turn 90° / drive a bit" is
// expressed as "hold this command for N ms". At TURN_SPEED 2.4 rad/s, ~650ms of
// pivot ≈ 90° and ~1300ms ≈ 180°; tune the holds to taste.
const SEQUENCES: ReadonlyArray<{ label: string; steps: ReadonlyArray<SequenceStep> }> = [
  {
    label: '▣ Square',
    steps: [
      { command: FORWARD, holdMs: 1200 },
      { command: PIVOT_RIGHT, holdMs: 650 },
      { command: FORWARD, holdMs: 1200 },
      { command: PIVOT_RIGHT, holdMs: 650 },
      { command: FORWARD, holdMs: 1200 },
      { command: PIVOT_RIGHT, holdMs: 650 },
      { command: FORWARD, holdMs: 1200 },
      { command: PIVOT_RIGHT, holdMs: 650 },
      { command: STOP, holdMs: 0 },
    ],
  },
  {
    label: '↩ There & back',
    steps: [
      { command: FORWARD, holdMs: 1500 },
      { command: PIVOT_RIGHT, holdMs: 1300 }, // ≈ 180° about-face
      { command: FORWARD, holdMs: 1500 },
      { command: STOP, holdMs: 0 },
    ],
  },
  {
    label: '◔ Look around',
    steps: [
      { command: PIVOT_LEFT, holdMs: 1300 },
      { command: PIVOT_RIGHT, holdMs: 2600 },
      { command: STOP, holdMs: 0 },
    ],
  },
];

const TOGGLE_KEY = 'Backquote'; // the ` / ~ key

function describeResult(result: ParseResult): string {
  return result.ok
    ? `✓ ${result.command.kind}`
    : `✕ ${result.error.code}: ${result.error.message}`;
}

/**
 * Build and mount the hidden injector panel and install `window.__inject`.
 * Starts hidden; press the ` (backtick) key to toggle the panel. Self-contained:
 * it creates its own DOM (no edits to `game/index.html`) and the only coupling to
 * the game is the `inject` callback.
 */
export function installMockInjector(options: MockInjectorOptions): void {
  const { inject } = options;

  const panel = document.createElement('div');
  panel.id = 'mockInjector';
  Object.assign(panel.style, {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    width: '248px',
    padding: '12px',
    display: 'none',
    flexDirection: 'column',
    gap: '8px',
    background: 'rgba(12, 16, 22, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '8px',
    color: '#e8eef5',
    font: '12px system-ui, -apple-system, "Segoe UI", sans-serif',
    letterSpacing: '0.2px',
    backdropFilter: 'blur(6px)',
    pointerEvents: 'auto',
    zIndex: '20',
  } satisfies Partial<CSSStyleDeclaration>);

  const title = document.createElement('div');
  title.textContent = 'mock injector';
  Object.assign(title.style, { fontWeight: '700', color: '#7fd1ff' });
  panel.appendChild(title);

  const status = document.createElement('div');
  status.textContent = 'idle — feed the brain’s command JSON';
  Object.assign(status.style, {
    minHeight: '16px',
    fontSize: '11px',
    color: '#9fb0c3',
    wordBreak: 'break-word',
  } satisfies Partial<CSSStyleDeclaration>);

  function setStatus(message: string, ok: boolean): void {
    status.textContent = message;
    status.style.color = ok ? '#8fe3a0' : '#ff9d9d';
  }

  // Run one payload through the shared path and reflect the outcome in the panel.
  function route(raw: unknown): ParseResult {
    const result = inject(raw);
    setStatus(describeResult(result), result.ok);
    return result;
  }

  const buttons = document.createElement('div');
  Object.assign(buttons.style, { display: 'flex', flexWrap: 'wrap', gap: '6px' } satisfies Partial<CSSStyleDeclaration>);
  for (const { label, command } of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      flex: '1 1 auto',
      padding: '5px 8px',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: '5px',
      color: 'inherit',
      font: 'inherit',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    button.addEventListener('click', () => route(command));
    buttons.appendChild(button);
  }
  panel.appendChild(buttons);

  // Chained sequences: fire a series of commands on a timer to test multi-step
  // movement. A run schedules one timeout per step; starting another sequence (or
  // Stop) cancels any pending steps so chains never overlap.
  let sequenceTimers: number[] = [];
  function cancelSequence(): void {
    for (const id of sequenceTimers) clearTimeout(id);
    sequenceTimers = [];
  }
  function runSequence(label: string, steps: ReadonlyArray<SequenceStep>): void {
    cancelSequence();
    let elapsed = 0;
    steps.forEach((step, index) => {
      sequenceTimers.push(
        window.setTimeout(() => {
          route(step.command);
          const done = index === steps.length - 1;
          setStatus(done ? `✓ “${label}” complete` : `▶ ${label} · step ${index + 1}/${steps.length}`, true);
        }, elapsed),
      );
      elapsed += step.holdMs;
    });
  }

  const sequenceLabel = document.createElement('div');
  sequenceLabel.textContent = 'chains';
  Object.assign(sequenceLabel.style, { fontSize: '11px', color: '#9fb0c3', marginTop: '2px' } satisfies Partial<CSSStyleDeclaration>);
  panel.appendChild(sequenceLabel);

  const sequences = document.createElement('div');
  Object.assign(sequences.style, { display: 'flex', flexWrap: 'wrap', gap: '6px' } satisfies Partial<CSSStyleDeclaration>);
  for (const { label, steps } of SEQUENCES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      flex: '1 1 auto',
      padding: '5px 8px',
      background: 'rgba(143, 227, 160, 0.12)',
      border: '1px solid rgba(143, 227, 160, 0.34)',
      borderRadius: '5px',
      color: 'inherit',
      font: 'inherit',
      cursor: 'pointer',
    } satisfies Partial<CSSStyleDeclaration>);
    button.addEventListener('click', () => runSequence(label, steps));
    sequences.appendChild(button);
  }
  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.textContent = '■ Cancel';
  Object.assign(cancelButton.style, {
    flex: '1 1 auto',
    padding: '5px 8px',
    background: 'rgba(255, 157, 157, 0.12)',
    border: '1px solid rgba(255, 157, 157, 0.34)',
    borderRadius: '5px',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  cancelButton.addEventListener('click', () => {
    cancelSequence();
    route(STOP);
    setStatus('■ chain cancelled — stopped', true);
  });
  sequences.appendChild(cancelButton);
  panel.appendChild(sequences);

  // Raw-JSON box: paste any payload (e.g. a captured brain message) and inject it
  // verbatim, exercising the parser's rejection paths too.
  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.spellcheck = false;
  textarea.placeholder = '{ "type": "action", "action": "forward", "distance": 5 }';
  Object.assign(textarea.style, {
    width: '100%',
    resize: 'vertical',
    padding: '6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: '5px',
    color: 'inherit',
    font: '11px ui-monospace, SFMono-Regular, Menlo, monospace',
  } satisfies Partial<CSSStyleDeclaration>);
  // The game listens for WASD on `window` and calls preventDefault, which would
  // swallow typing in the box. Stop the events here so they never reach it.
  textarea.addEventListener('keydown', (event) => event.stopPropagation());
  panel.appendChild(textarea);

  const injectButton = document.createElement('button');
  injectButton.type = 'button';
  injectButton.textContent = 'Inject JSON';
  Object.assign(injectButton.style, {
    padding: '6px 8px',
    background: 'rgba(127, 209, 255, 0.18)',
    border: '1px solid rgba(127, 209, 255, 0.4)',
    borderRadius: '5px',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  } satisfies Partial<CSSStyleDeclaration>);
  injectButton.addEventListener('click', () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(textarea.value);
    } catch (error) {
      setStatus(`✕ invalid JSON: ${error instanceof Error ? error.message : String(error)}`, false);
      return;
    }
    route(parsed);
  });
  panel.appendChild(injectButton);
  panel.appendChild(status);

  document.body.appendChild(panel);

  // `window.__inject`: console/automation entry point, routed identically.
  window.__inject = (raw: unknown): void => {
    route(raw);
  };

  // Hidden by default; toggle with the ` key. The textarea stops propagation, so
  // typing a backtick into it won't close the panel.
  window.addEventListener('keydown', (event) => {
    if (event.code !== TOGGLE_KEY) return;
    event.preventDefault();
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });

  console.info('[mock-injector] press ` to toggle the dev command panel · window.__inject(json) is also available');
}
