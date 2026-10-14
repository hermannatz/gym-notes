'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function formatPrevious(previous) {
  if (previous === undefined) return 'Loading previous performance…';
  if (previous === null) return 'No previous performance yet';
  const sets = previous.sets.filter((set) => set.completed).map((set) => `${set.weight ?? '–'} × ${set.reps ?? '–'}`).join('  ·  ');
  return sets || 'No completed sets last time';
}

export default function LiveSessionPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [allExercises, setAllExercises] = useState([]);
  const [previous, setPrevious] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [addExerciseId, setAddExerciseId] = useState('');
  const [saving, setSaving] = useState(false);

  async function load({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    try {
      const [sessRes, exRes] = await Promise.all([fetch(`/api/sessions/${id}`), fetch('/api/exercises')]);
      if (sessRes.status === 401) throw new Error('Please sign in.');
      if (sessRes.status === 404) throw new Error('Session not found.');
      if (!sessRes.ok || !exRes.ok) throw new Error('Could not load the session.');
      const sessData = await sessRes.json();
      const exData = await exRes.json();
      setSession(sessData.session);
      setAllExercises(exData.exercises ?? []);
      setError(null);
      return sessData.session;
    } catch (err) {
      setError(err.message || 'Could not load the session.');
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadPrevious(exercises) {
    const entries = await Promise.all(exercises.map(async (exercise) => {
      try {
        const res = await fetch(`/api/sessions/${id}/exercises/${exercise.id}/previous`);
        if (!res.ok) return [exercise.id, null];
        const data = await res.json();
        return [exercise.id, data.previous];
      } catch {
        return [exercise.id, null];
      }
    }));
    setPrevious(Object.fromEntries(entries));
  }

  useEffect(() => {
    let active = true;
    load().then((loaded) => { if (active && loaded) loadPrevious(loaded.exercises); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function mutate(url, options, message) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'That change could not be saved.');
      }
      setFeedback(message);
      window.setTimeout(() => setFeedback(null), 1800);
      const refreshed = await load({ quiet: true });
      if (refreshed) await loadPrevious(refreshed.exercises);
      return true;
    } catch (err) {
      setError(err.message || 'That change could not be saved.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  const addSet = (seId) => mutate(`/api/sessions/${id}/exercises/${seId}/sets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }, 'Set added');
  const updateSet = (seId, setId, patch) => mutate(`/api/sessions/${id}/exercises/${seId}/sets/${setId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }, patch.completed !== undefined ? (patch.completed ? 'Set completed' : 'Set reopened') : 'Set saved');
  const deleteSet = (seId, setId) => mutate(`/api/sessions/${id}/exercises/${seId}/sets/${setId}`, { method: 'DELETE' }, 'Set removed');

  async function addExercise(event) {
    event.preventDefault();
    if (!addExerciseId) return;
    const ok = await mutate(`/api/sessions/${id}/exercises`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exercise_id: addExerciseId }) }, 'Exercise added');
    if (ok) setAddExerciseId('');
  }

  const toggleSkip = (seId, skipped) => mutate(`/api/sessions/${id}/exercises/${seId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skipped: !skipped }) }, skipped ? 'Exercise restored' : 'Exercise skipped');

  function removeExercise(seId) {
    if (!window.confirm('Remove this exercise and all of its sets from this workout?')) return;
    return mutate(`/api/sessions/${id}/exercises/${seId}`, { method: 'DELETE' }, 'Exercise removed');
  }

  async function finish(status) {
    const verb = status === 'completed' ? 'finish' : 'abandon';
    if (!window.confirm(`Are you sure you want to ${verb} this workout?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error('Could not update the workout.');
      router.push(status === 'completed' ? `/history/${id}` : '/train');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) return <main className="container"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-card" /></main>;
  if (error && !session) return <main className="container"><div className="notice notice-error" role="alert">{error}</div><Link href="/train">← Back to training</Link></main>;

  const isDone = session.status !== 'in_progress';
  const completed = session.exercises.reduce((sum, ex) => sum + ex.sets.filter((set) => set.completed).length, 0);
  const total = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <main className="container live-session">
      <header className="session-header">
        <Link className="back-link" href="/train">← Training</Link>
        <div className="session-heading-row"><div><p className="eyebrow">{isDone ? 'Workout record' : 'Live workout'}</p><h1 className="page-title">{session.name || 'Workout'}</h1></div><div className="session-progress" aria-label={`${completed} of ${total} sets complete`}><strong>{completed}</strong><span>/ {total}</span><small>sets</small></div></div>
        <div className="progress-track"><span style={{ width: total ? `${(completed / total) * 100}%` : '0%' }} /></div>
      </header>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {feedback && <div className="save-toast" role="status"><span>✓</span>{feedback}</div>}
      {session.exercises.length === 0 && <div className="empty-state"><strong>No exercises yet</strong><span>Add your first movement below.</span></div>}

      <div className="workout-stack">
        {session.exercises.map((ex, exerciseIndex) => (
          <section key={ex.id} className={`workout-card${ex.skipped ? ' skipped' : ''}`}>
            <div className="workout-card-header">
              <div className="exercise-number">{String(exerciseIndex + 1).padStart(2, '0')}</div>
              <div className="exercise-heading"><h2>{ex.exercise_name}{ex.skipped && <span className="badge">skipped</span>}</h2><p>{ex.primary_muscle_group || 'Exercise'}</p></div>
              {!isDone && <details className="action-menu"><summary aria-label={`Actions for ${ex.exercise_name}`}>•••</summary><div><button type="button" onClick={() => toggleSkip(ex.id, ex.skipped)}>{ex.skipped ? 'Restore' : 'Skip exercise'}</button><button className="danger-text" type="button" onClick={() => removeExercise(ex.id)}>Remove exercise</button></div></details>}
            </div>
            <div className="previous-strip"><span>Last time</span><strong>{formatPrevious(previous[ex.id])}</strong></div>
            <div className="set-grid set-grid-head" aria-hidden="true"><span>Set</span><span>Weight</span><span>Reps</span><span>Done</span><span /></div>
            <div className="set-list">
              {ex.sets.map((set, index) => (
                <div className={`set-grid set-row${set.completed ? ' complete' : ''}`} key={set.id}>
                  <span className="set-index">{index + 1}</span>
                  <label><span className="sr-only">Weight for set {index + 1}</span><input type="number" inputMode="decimal" defaultValue={set.weight ?? ''} disabled={isDone || saving} onBlur={(event) => updateSet(ex.id, set.id, { weight: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                  <label><span className="sr-only">Repetitions for set {index + 1}</span><input type="number" inputMode="numeric" defaultValue={set.reps ?? ''} disabled={isDone || saving} onBlur={(event) => updateSet(ex.id, set.id, { reps: event.target.value === '' ? null : Number(event.target.value) })} /></label>
                  <label className="complete-control"><input type="checkbox" checked={set.completed} disabled={isDone || saving} onChange={(event) => updateSet(ex.id, set.id, { completed: event.target.checked })} /><span>✓</span></label>
                  <button className="icon-button" type="button" disabled={isDone || saving} onClick={() => deleteSet(ex.id, set.id)} aria-label={`Delete set ${index + 1}`}>×</button>
                </div>
              ))}
            </div>
            {!isDone && <button className="add-set-button" type="button" disabled={saving} onClick={() => addSet(ex.id)}>+ Add set</button>}
          </section>
        ))}
      </div>

      {!isDone && <form className="add-exercise-panel" onSubmit={addExercise} aria-label="Add exercise"><div><p className="eyebrow">Keep training</p><h2>Add an exercise</h2></div><div className="inline-form"><select value={addExerciseId} onChange={(event) => setAddExerciseId(event.target.value)} aria-label="Exercise"><option value="">Choose a movement</option>{allExercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}</select><button className="btn btn-secondary" type="submit" disabled={!addExerciseId || saving}>Add</button></div></form>}

      <div className="workout-footer-spacer" />
      <footer className="workout-footer">{!isDone ? <><button className="btn btn-secondary danger-button" type="button" disabled={saving} onClick={() => finish('abandoned')}>Abandon</button><button className="btn" type="button" disabled={saving} onClick={() => finish('completed')}>{saving ? 'Saving…' : 'Finish workout'}</button></> : <Link className="btn" href="/history">Back to history</Link>}</footer>
    </main>
  );
}
