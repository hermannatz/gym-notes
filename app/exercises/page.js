'use client';

import { useEffect, useState } from 'react';

export default function ExercisesPage() {
  const [exercises, setExercises] = useState([]);
  const [muscleGroups, setMuscleGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // New-exercise form state
  const [name, setName] = useState('');
  const [primaryMuscleGroupId, setPrimaryMuscleGroupId] = useState('');
  const [equipment, setEquipment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [exRes, mgRes] = await Promise.all([
        fetch('/api/exercises'),
        fetch('/api/muscle-groups'),
      ]);

      if (exRes.status === 401 || mgRes.status === 401) {
        setError('Please sign in to view your exercise library.');
        return;
      }
      if (!exRes.ok || !mgRes.ok) {
        setError('Could not load exercises. Please try again.');
        return;
      }

      const exData = await exRes.json();
      const mgData = await mgRes.json();
      setExercises(exData.exercises ?? []);
      setMuscleGroups(mgData.muscleGroups ?? []);
    } catch {
      setError('Could not load exercises. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError('Exercise name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          primary_muscle_group_id: primaryMuscleGroupId
            ? Number(primaryMuscleGroupId)
            : null,
          equipment: equipment.trim() || null,
        }),
      });

      if (res.status === 401) {
        setError('Please sign in to add an exercise.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not add the exercise.');
        return;
      }

      // Reset the form and refresh the list.
      setName('');
      setPrimaryMuscleGroupId('');
      setEquipment('');
      setSuccess('Exercise added.');
      await loadData();
    } catch {
      setError('Could not add the exercise.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <header className="page-header"><p className="eyebrow">Movement library</p><h1 className="page-title">Exercises</h1><p className="page-lead">Shared essentials and your personal movements.</p></header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice notice-success" role="status">
          {success}
        </div>
      )}

      <details className="create-drawer">
        <summary>+ Add a personal exercise</summary>
      <form onSubmit={handleSubmit} aria-label="Add exercise" className="form-panel nested">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Incline Dumbbell Press"
            autoComplete="off"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="muscle">Primary muscle group</label>
          <select
            id="muscle"
            value={primaryMuscleGroupId}
            onChange={(e) => setPrimaryMuscleGroupId(e.target.value)}
          >
            <option value="">— none —</option>
            {muscleGroups.map((mg) => (
              <option key={mg.id} value={mg.id}>
                {mg.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="equipment">Equipment (optional)</label>
          <input
            id="equipment"
            type="text"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="e.g. Dumbbell"
            autoComplete="off"
          />
        </div>

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add exercise'}
        </button>
      </form>
      </details>

      <div className="section-heading"><div><p className="eyebrow">Available</p><h2>All exercises</h2></div><span className="count-badge">{exercises.length}</span></div>

      {loading ? (
        <p>Loading…</p>
      ) : exercises.length === 0 ? (
        <p>No exercises yet. Add your first one above.</p>
      ) : (
        <ul className="exercise-list">
          {exercises.map((ex) => (
            <li key={ex.id} className="exercise-item">
              <span className="name">
                {ex.name}
                {ex.is_shared ? (
                  <span className="badge">shared</span>
                ) : (
                  <span className="badge">personal</span>
                )}
              </span>
              {(ex.primary_muscle_group || ex.equipment) && (
                <span className="meta">
                  {[ex.primary_muscle_group, ex.equipment]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
