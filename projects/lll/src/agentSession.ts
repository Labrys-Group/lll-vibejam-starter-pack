// LiveKit session shell (issue 02b): the thin I/O wrapper around `livekit-client`
// that owns the `Room`. It connects/disconnects, publishes the MIC ONLY, attaches
// inbound agent audio, and stands up the `DataReceived` seam.
//
// Deliberately a *shell*: it holds no game state and parses no payloads. The pure,
// testable modules (`commands`, `movement`, `sense`) stay decoupled — inbound
// data is handed out raw via `onData` for issue 02c to route through
// `parseCommand` → `applyCommand`, and the HUD's agent-state/subtitle values are
// driven from there. This module is verified manually end-to-end (HITL), not unit
// tested, which is why all connection I/O lives behind this seam.

import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';

import type { TokenGrant } from './token.ts';

/** Coarse agent state surfaced to the HUD indicator. */
export type AgentState = 'disconnected' | 'listening' | 'thinking' | 'speaking';

/**
 * Observer hooks into the session. All optional so callers wire only what they
 * need; none of them throw back into the SDK's event loop.
 */
export interface AgentSessionCallbacks {
  /**
   * Connection-derived agent state. The shell emits `listening` once connected
   * (mic live) and `disconnected` on teardown; the richer `thinking`/`speaking`
   * transitions are driven from inbound `state` messages by 02c.
   */
  onAgentState?(state: AgentState): void;
  /**
   * Raw inbound data-channel payload. 02b only stands up this seam — 02c decodes
   * and routes it (`action` → game, `state`/`speech` → HUD).
   */
  onData?(payload: Uint8Array, topic?: string): void;
  /** Human-readable failure (connect/mic/playback), safe to show in the HUD. */
  onError?(message: string): void;
}

/**
 * Owns a single LiveKit `Room`. One instance per game; `connect`/`disconnect` may
 * be called repeatedly. Teardown is exhaustive so reconnecting never stacks
 * "zombie" voices from a prior session.
 */
export class AgentSession {
  private readonly callbacks: AgentSessionCallbacks;
  private room: Room | null = null;

  // <audio> elements created by `track.attach()` for inbound agent audio. Tracked
  // so disconnect can force-detach every one — `track.detach()` on unsubscribe
  // covers the normal path, this array covers an abrupt disconnect where no
  // unsubscribe fires.
  private audioElements: HTMLMediaElement[] = [];

  constructor(callbacks: AgentSessionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  get connected(): boolean {
    return this.room !== null;
  }

  /**
   * Join the room, publish the mic, and start agent audio playback. MUST be
   * called from within the Connect click handler: `startAudio()` requires a user
   * gesture, and so does the mic permission prompt. Rejects on failure after
   * cleaning up any half-open room, so the caller can surface the error and the
   * next Connect starts from a clean slate.
   */
  async connect(grant: TokenGrant): Promise<void> {
    if (this.room) await this.disconnect();

    const room = new Room();
    this.room = room;
    this.wireEvents(room);

    try {
      await room.connect(grant.url, grant.token);
      // Publish mic only (not camera). This is what triggers the browser's mic
      // permission prompt via the normal flow.
      await room.localParticipant.setMicrophoneEnabled(true);
      // Unlock audio playback inside the user gesture so agent audio that arrives
      // later autoplays. Safe to call even if already permitted.
      if (!room.canPlaybackAudio) await room.startAudio();
      this.emitState('listening');
    } catch (error) {
      // Roll the half-open session back so a retry isn't fighting a zombie room.
      await this.teardown();
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /** Leave the room and tear down all tracks/audio. Idempotent. */
  async disconnect(): Promise<void> {
    await this.teardown();
  }

  // Outbound publishing (`publishData`) is issue 03's sense-reporting seam — it is
  // intentionally not part of this inbound/connect slice.

  // ---- internals ---------------------------------------------------------

  private wireEvents(room: Room): void {
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      el.autoplay = true;
      document.body.appendChild(el);
      this.audioElements.push(el);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      // `detach()` removes the track from every element it was attached to and
      // returns them; drop those elements from the DOM and our bookkeeping.
      for (const el of track.detach()) this.removeAudioElement(el);
    });

    // Autoplay was blocked (e.g. the gesture lapsed). We already call startAudio()
    // inside connect(); surface it so the HUD can prompt a re-click if needed.
    room.on(RoomEvent.AudioPlaybackStatusChanged, (playing: boolean) => {
      if (!playing) this.callbacks.onError?.('Agent audio is blocked — click Connect again to enable sound.');
    });

    // 02b stands up the seam; 02c decodes/routes the payload.
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant, _kind, topic?: string) => {
      this.callbacks.onData?.(payload, topic);
    });

    // Server- or network-initiated disconnects land here too; mirror our cleanup.
    room.on(RoomEvent.Disconnected, () => {
      if (this.room === room) void this.teardown();
    });
  }

  private async teardown(): Promise<void> {
    const room = this.room;
    this.room = null;

    // Detach/remove every attached <audio> so no voice keeps playing after we go.
    for (const el of this.audioElements) {
      el.pause();
      el.srcObject = null;
      el.remove();
    }
    this.audioElements = [];

    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }
    this.emitState('disconnected');
  }

  private removeAudioElement(el: HTMLMediaElement): void {
    el.pause();
    el.srcObject = null;
    el.remove();
    this.audioElements = this.audioElements.filter((e) => e !== el);
  }

  private emitState(state: AgentState): void {
    this.callbacks.onAgentState?.(state);
  }
}
