'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LiveSessionPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [allExercises, setAllExercises] = useState([]);
  const [previous, setPrevious] = useState({}); // seId -> previous payload
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addExerciseId, setAddExerciseId] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [sessRes, exRes] = await Promise.all([
        fetch(`/api/sessions/${id}`),
        fetch('/api/exercises'),
      ]);
      if (sessRes.status === 401) {
        setError('Please sign in.');
        return;
      }
      if (sessRes.status === 404) {
        setError('Session not found.');
        return;
      }
      const sessData = await sessRes.json();
      const exData = await exRes.json();
      setSession(sessData.session);
      setAllExercises(exData.exercises ?? []);
    } catch {
      setError('Could not load the session.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadPrevious(seId) {
    const res = await fetch(`/api/sessions/${id}/exercises/${seId}/previous`);
    if (res.ok) {
      const data = await res.json();
      setPrevious((p) => ({ ...p, [seId]: data.previous }));
    }
  }

  async function addSet(seId) {
    await fetch(`/api/sessions/${id}/exercises/${seId}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await load();
  }

  async function updateSet(seId, setId, patch) {
    await fetch(`/api/sessions/${id}/exercises/${seId}/sets/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await load();
  }

  async function deleteSet(seId, setId) {
    await fetch(`/api/sessions/${id}/exercises/${seId}/sets/${setId}`, {
      method: 'DELETE',
    });
    await load();
  }

  async function addExercise(e) {
    e.preventDefault();
    if (!addExerciseId) return;
    await fetch(`/api/sessions/${id}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise_id: addExerciseId }),
    });
    setAddExerciseId('');
    await load();
  }

  async function toggleSkip(seId, skipped) {
    await fetch(`/api/sessions/${id}/exercises/${seId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skipped: !skipped }),
    });
    await load();
  }

  async function removeExercise(seId) {
    await fetch(`/api/sessions/${id}/exercises/${seId}`, { method: 'DELETE' });
    await load();
  }

  async function finish(status) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) router.push('/train');
  }

  if (loading) {
    return (
      <main className="container">
        <p>Loading…</p>
      </main>
    );
  }
  if (error && !session) {
    return (
      <main className="container">
        <div className="notice notice-error" role="alert">
          {error}
        </div>
        <Link href="/train">← Back</Link>
      </main>
    );
  }

  const isDone = session.status !== 'in_progress';

  return (
    <main className="container">
      <Link href="/train">← Training</Link>
      <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
        {session.name || 'Workout'}
      </h1>
      <p className="meta" style={{ opacity: 0.7 }}>Status: {session.status}</p>

      {session.exercises.length === 0 && <p>No exercises yet. Add one below.</p>}

      {session.exercises.map((ex) => (
        <section
          key={ex.id}
          className="exercise-item"
          style={{ marginBottom: '1rem', opacity: ex.skipped ? 0.5 : 1 }}
        >
          <div className="name">
            {ex.exercise_name}
            {ex.skipped && <span className="badge">skipped</span>}
          </div>
          {ex.primary_muscle_group && (
            <div className="meta">{ex.primary_muscle_group}</div>
          )}

          <button
            className="btn btn-secondary"
            type="button"
            style={{ marginTop: '0.5rem', alignSelf: 'flex-start' }}
            onClick={() => loadPrevious(ex.id)}
          >
            Show last time
          </button>
          {previous[ex.id] !== undefined && (
            <div className="meta" style={{ marginTop: '0.25rem' }}>
              {previous[ex.id] === null
                ? 'No previous performance.'
                : `Last: ${previous[ex.id].sets
                    .map((s) => `${s.weight ?? '-'}×${s.reps ?? '-'}`)
                    .join(', ')}`}
            </div>
          )}

          <table className="set-table" style={{ marginTop: '0.5rem' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>kg</th>
                <th>reps</th>
                <th>✓</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((s, idx) => (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      defaultValue={s.weight ?? ''}
                      disabled={isDone}
                      onBlur={(e) =>
                        updateSet(ex.id, s.id, {
                          weight: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      aria-label="weight"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      inputMode="numeric"
                      defaultValue={s.reps ?? ''}
                      disabled={isDone}
                      onBlur={(e) =>
                        updateSet(ex.id, s.id, {
                          reps: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      aria-label="reps"
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.completed}
                      disabled={isDone}
                      onChange={(e) =>
                        updateSet(ex.id, s.id, { completed: e.target.checked })
                      }
                      aria-label="completed"
                    />
                  </td>
                  <td>
                    {!isDone && (
                      <button
                        className="btn btn-secondary btn-small"
                        type="button"
                        onClick={() => deleteSet(ex.id, s.id)}
                        aria-label="delete set"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isDone && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn" type="button" onClick={() => addSet(ex.id)}>
                + Set
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => toggleSkip(ex.id, ex.skipped)}
              >
                {ex.skipped ? 'Unskip' : 'Skip'}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => removeExercise(ex.id)}
              >
                Remove
              </button>
            </div>
          )}
        </section>
      ))}

      {!isDone && (
        <form onSubmit={addExercise} aria-label="Add exercise" style={{ marginTop: '1rem' }}>
          <div className="field">
            <label htmlFor="add-ex">Add an exercise</label>
            <select
              id="add-ex"
              value={addExerciseId}
              onChange={(e) => setAddExerciseId(e.target.value)}
            >
              <option value="">— choose —</option>
              {allExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary" type="submit">
            Add exercise
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        {!isDone ? (
          <>
            <button className="btn" type="button" onClick={() => finish('completed')}>
              Finish workout
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => finish('abandoned')}
            >
              Abandon
            </button>
          </>
        ) : (
          <Link className="btn" href="/train">
            Done
          </Link>
        )}
      </div>
    </main>
  );
}
