// Static configuration for the LLL sandbox: fixed render resolution, palette,
// and the open play area the player roams within.

export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 540;

export const COLORS = {
  skyTop: 0xbfe8ff,
  horizon: 0xe9fff2,
  grass: 0x6cc04a,
} as const;

// Open, flat sandbox. Player roams freely; camera pans along X to follow.
export const PLAY_BOUNDS = {
  x: [-24, 24] as const,
  z: [-8, 10] as const,
};

export const PLAYER_START = { x: 0, z: 4 } as const;
