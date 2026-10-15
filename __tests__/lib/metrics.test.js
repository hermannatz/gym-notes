import {
  isWorkingSet,
  convertWeight,
  setVolume,
  totalVolume,
  workingSetCount,
  muscleAttributionFactor,
  PRIMARY_MUSCLE_FACTOR,
  SECONDARY_MUSCLE_FACTOR,
} from '@/app/lib/metrics.js';

describe('training metrics', () => {
  const working = { completed: true, set_type: 'working', weight: 100, reps: 5 };
  const warmup = { completed: true, set_type: 'warmup', weight: 60, reps: 10 };
  const incomplete = { completed: false, set_type: 'working', weight: 100, reps: 5 };
  const nullish = { completed: true, set_type: 'working', weight: null, reps: null };

  it('counts only completed working sets', () => {
    expect(isWorkingSet(working)).toBe(true);
    expect(isWorkingSet(warmup)).toBe(false); // warm-ups excluded (Req 6.4)
    expect(isWorkingSet(incomplete)).toBe(false); // incomplete excluded
  });

  it('computes set volume as weight * reps for working sets only', () => {
    expect(setVolume(working)).toBe(500);
    expect(setVolume(warmup)).toBe(0);
    expect(setVolume(incomplete)).toBe(0);
    expect(setVolume(nullish)).toBe(0);
  });

  it('totals volume excluding warm-ups and incomplete sets', () => {
    const sets = [working, warmup, incomplete, { ...working, reps: 3 }];
    // 100*5 + 0 + 0 + 100*3 = 800
    expect(totalVolume(sets)).toBe(800);
  });

  it('converts pounds and normalizes mixed-unit volume to kilograms', () => {
    expect(convertWeight(220.46226218, 'lb', 'kg')).toBeCloseTo(100, 8);
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.46226218, 8);

    const sets = [
      { ...working, weight: 100, reps: 1, weight_unit: 'kg' },
      { ...working, weight: 220.46226218, reps: 1, weight_unit: 'lb' },
    ];
    expect(totalVolume(sets, 'kg')).toBeCloseTo(200, 8);
  });

  it('counts working sets', () => {
    expect(workingSetCount([working, warmup, incomplete, working])).toBe(2);
  });

  it('handles empty input', () => {
    expect(totalVolume()).toBe(0);
    expect(workingSetCount()).toBe(0);
  });
});

describe('muscle attribution', () => {
  it('credits the primary muscle at full and secondary at a reduced share', () => {
    expect(muscleAttributionFactor('primary')).toBe(PRIMARY_MUSCLE_FACTOR);
    expect(muscleAttributionFactor('secondary')).toBe(SECONDARY_MUSCLE_FACTOR);
    expect(PRIMARY_MUSCLE_FACTOR).toBe(1);
    expect(SECONDARY_MUSCLE_FACTOR).toBe(0.5);
  });

  it('treats any non-primary role as secondary', () => {
    expect(muscleAttributionFactor('synergist')).toBe(SECONDARY_MUSCLE_FACTOR);
    expect(muscleAttributionFactor(undefined)).toBe(SECONDARY_MUSCLE_FACTOR);
  });
});
