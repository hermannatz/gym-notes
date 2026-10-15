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

const POUNDS_PER_KILOGRAM = 2.2046226218;

/** Convert a weight between supported units without changing the stored value. */
export function convertWeight(weight, fromUnit = 'kg', toUnit = 'kg') {
  const value = Number(weight);
  if (!Number.isFinite(value)) return 0;
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'lb' && toUnit === 'kg') return value / POUNDS_PER_KILOGRAM;
  if (fromUnit === 'kg' && toUnit === 'lb') return value * POUNDS_PER_KILOGRAM;
  return 0;
}

/** Volume contribution in the requested unit (kg by default). */
export function setVolume(set, targetUnit = 'kg') {
  if (!isWorkingSet(set)) return 0;
  const weight = convertWeight(set.weight, set.weight_unit ?? 'kg', targetUnit);
  const reps = Number(set.reps);
  if (!Number.isFinite(weight) || !Number.isInteger(reps)) return 0;
  return weight * reps;
}

/** Total working volume across an array of sets, normalized to one unit. */
export function totalVolume(sets = [], targetUnit = 'kg') {
  return sets.reduce((sum, s) => sum + setVolume(s, targetUnit), 0);
}

/** Count of completed working sets. */
export function workingSetCount(sets = []) {
  return sets.filter(isWorkingSet).length;
}

/**
 * Muscle-group volume attribution (Req 10.2).
 *
 * A working set credits its exercise's PRIMARY muscle group at full weight and
 * each SECONDARY muscle group at a reduced share, so a set is not naively
 * counted as full volume for every muscle it touches. The secondary share is a
 * documented, tunable convention — 0.5 is a common, defensible default.
 */
export const PRIMARY_MUSCLE_FACTOR = 1;
export const SECONDARY_MUSCLE_FACTOR = 0.5;

/** The attribution factor for a muscle's involvement role. */
export function muscleAttributionFactor(role) {
  return role === 'primary' ? PRIMARY_MUSCLE_FACTOR : SECONDARY_MUSCLE_FACTOR;
}
