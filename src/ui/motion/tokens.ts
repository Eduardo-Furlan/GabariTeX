export const durations = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
  slow: 0.34,
  signature: 0.7,
} as const;

export const easings = {
  easeOut: [0.22, 1, 0.36, 1] as const,
  easeInOut: [0.65, 0, 0.35, 1] as const,
} as const;

export const springs = {
  snappy: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const,
  soft: { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const,
} as const;
