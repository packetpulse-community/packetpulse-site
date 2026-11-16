// Positions on a 1000 x 520 canvas for the lab topology.
export const CANVAS = { width: 1000, height: 520 };

export const LAB_LAYOUT: Record<string, { x: number; y: number }> = {
  "pc-a": { x: 100, y: 130 },
  "pc-b": { x: 100, y: 390 },
  sw1: { x: 320, y: 260 },
  r1: { x: 510, y: 260 },
  sw2: { x: 700, y: 260 },
  web: { x: 900, y: 130 },
  dns: { x: 900, y: 390 },
};
