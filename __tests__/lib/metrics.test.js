import {
  isWorkingSet,
  setVolume,
  totalVolume,
  workingSetCount,
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

  it('counts working sets', () => {
    expect(workingSetCount([working, warmup, incomplete, working])).toBe(2);
  });

  it('handles empty input', () => {
    expect(totalVolume()).toBe(0);
    expect(workingSetCount()).toBe(0);
  });
});
