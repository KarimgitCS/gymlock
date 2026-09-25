function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
}

export const SETS_OPTIONS = range(1, 8);
export const REPS_OPTIONS = range(1, 16);
export const WEIGHT_STEP = 5;
export const WEIGHT_OPTIONS = range(5, 300, WEIGHT_STEP);

export const DEFAULT_SETS = 3;
export const DEFAULT_REPS = 10;
export const DEFAULT_WEIGHT = 45;

export const REST_OPTIONS = range(15, 300, 15);
