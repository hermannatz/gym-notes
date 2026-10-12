/**
 * Shared training-metric definitions. Keeping these in one place ensures
 * history, summaries, and future analytics all count volume the same way.
 *
 * Working volume rule (Req 6.4): only completed, non-warm-up ("working") sets
 * count toward volume. Volume for a set = weight * reps (0 when either is null).
 */

/** True when a set counts toward working volume. */
export function isWorkingSet(set) {
  return set.completed === true && set.set_type !== 'warmup';
}

/** Volume contribution of a single set (0 unless it is a counted working set). */
export function setVolume(set) {
  if (!isWorkingSet(set)) return 0;
  const weight = Number(set.weight);
  const reps = Number(set.reps);
  if (!Number.isFinite(weight) || !Number.isInteger(reps)) return 0;
  return weight * reps;
}

/** Total working volume across an array of sets. */
export function totalVolume(sets = []) {
  return sets.reduce((sum, s) => sum + setVolume(s), 0);
}

/** Count of completed working sets. */
export function workingSetCount(sets = []) {
  return sets.filter(isWorkingSet).length;
}
