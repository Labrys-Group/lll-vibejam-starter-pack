// Voice-session HUD (issue 02b): the bottom-center control bar — Connect /
// Disconnect, an agent-state indicator, and a subtitle line. This module owns the
// DOM behaviour only; it holds no session or game state. The session shell drives
// `setAgentState`/`setConnectionPhase`, and 02c drives `setSubtitle`/`setAgentState`
// from inbound data. Markup + styling live in `game/index.html` (alongside the
// existing #hud), mirroring this project's HTML-owns-structure convention.

import type { AgentState } from './agentSession.ts';

/** Connection lifecycle as the button reflects it. */
export type ConnectionPhase = 'idle' | 'connecting' | 'connected';

export interface VoiceHudCallbacks {
  /** Fired when the user clicks Connect (from `idle`). */
  onConnect(): void;
  /** Fired when the user clicks Disconnect (from `connected`). */
  onDisconnect(): void;
}

/** Imperative handle the rest of the app drives the HUD through. */
export interface VoiceHud {
  setConnectionPhase(phase: ConnectionPhase): void;
  setAgentState(state: AgentState): void;
  /** Set the subtitle line; blank/whitespace hides it. */
  setSubtitle(text: string): void;
  /** Set the small explanatory status (errors / degrade reason); blank hides it. */
  setStatus(message: string): void;
  /** Gate the Connect button independently of phase (e.g. token endpoint absent). */
  setConnectEnabled(enabled: boolean): void;
}

const AGENT_STATE_LABELS: Record<AgentState, string> = {
  disconnected: 'Disconnected',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} element`);
  return el as T;
}

export function createVoiceHud(callbacks: VoiceHudCallbacks): VoiceHud {
  const subtitle = requireElement<HTMLDivElement>('subtitle');
  const pill = requireElement<HTMLSpanElement>('agentState');
  const button = requireElement<HTMLButtonElement>('connectBtn');
  const status = requireElement<HTMLSpanElement>('voiceStatus');

  let phase: ConnectionPhase = 'idle';
  let connectAllowed = true;

  button.addEventListener('click', () => {
    // The click is the audio/mic user gesture — keep the handler synchronous to
    // the event so the session can call startAudio()/setMicrophoneEnabled() within
    // it. Dispatch by the phase the button currently represents.
    if (phase === 'idle' && connectAllowed) callbacks.onConnect();
    else if (phase === 'connected') callbacks.onDisconnect();
  });

  function refreshButton(): void {
    button.dataset.phase = phase;
    if (phase === 'connecting') {
      button.textContent = 'Connecting…';
      button.disabled = true;
    } else if (phase === 'connected') {
      button.textContent = 'Disconnect';
      button.disabled = false;
    } else {
      button.textContent = 'Connect';
      button.disabled = !connectAllowed;
    }
  }

  const hud: VoiceHud = {
    setConnectionPhase(next) {
      phase = next;
      refreshButton();
    },
    setAgentState(state) {
      pill.textContent = AGENT_STATE_LABELS[state];
      pill.dataset.state = state;
    },
    setSubtitle(text) {
      subtitle.textContent = text;
      subtitle.classList.toggle('empty', text.trim().length === 0);
    },
    setStatus(message) {
      status.textContent = message;
      status.classList.toggle('empty', message.trim().length === 0);
    },
    setConnectEnabled(enabled) {
      connectAllowed = enabled;
      refreshButton();
    },
  };

  // Initial paint from the markup's defaults.
  hud.setAgentState('disconnected');
  hud.setConnectionPhase('idle');

  return hud;
}
