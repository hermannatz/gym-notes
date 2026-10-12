'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

export default function TemplateEditorPage({ params }) {
  const { id } = use(params);

  const [template, setTemplate] = useState(null);
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('');
  const [targetSets, setTargetSets] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tplRes, exRes] = await Promise.all([
        fetch(`/api/templates/${id}`),
        fetch('/api/exercises'),
      ]);
      if (tplRes.status === 401) {
        setError('Please sign in.');
        return;
      }
      if (tplRes.status === 404) {
        setError('Template not found.');
        return;
      }
      if (!tplRes.ok || !exRes.ok) {
        setError('Could not load the template.');
        return;
      }
      const tplData = await tplRes.json();
      const exData = await exRes.json();
      setTemplate(tplData.template);
      setName(tplData.template.name);
      setAllExercises(exData.exercises ?? []);
    } catch {
      setError('Could not load the template.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function rename() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch(`/api/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    await load();
  }

  async function addExercise(e) {
    e.preventDefault();
    if (!selectedExercise) {
      setError('Choose an exercise to add.');
      return;
    }
    const body = { exercise_id: selectedExercise };
    if (targetSets) body.target_sets = Number(targetSets);
    const res = await fetch(`/api/templates/${id}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not add exercise.');
      return;
    }
    setSelectedExercise('');
    setTargetSets('');
    setError(null);
    await load();
  }

  async function removeExercise(teId) {
    await fetch(`/api/templates/${id}/exercises/${teId}`, {
      method: 'DELETE',
    });
    await load();
  }

  async function move(index, direction) {
    const items = [...template.exercises];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= items.length) return;
    [items[index], items[swapWith]] = [items[swapWith], items[index]];
    const order = items.map((it) => it.id);
    await fetch(`/api/templates/${id}/exercises/order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    await load();
  }

  if (loading) {
    return (
      <main className="container">
        <p>Loading…</p>
      </main>
    );
  }

  if (error && !template) {
    return (
      <main className="container">
        <div className="notice notice-error" role="alert">
          {error}
        </div>
        <Link href="/templates">← Back to templates</Link>
      </main>
    );
  }

  return (
    <main className="container">
      <Link href="/templates">← Templates</Link>

      {error && (
        <div className="notice notice-error" role="alert" style={{ marginTop: '0.75rem' }}>
          {error}
        </div>
      )}

      <div className="field" style={{ marginTop: '1rem' }}>
        <label htmlFor="tpl-rename">Template name</label>
        <input
          id="tpl-rename"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
        />
      </div>

      <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
        Exercises
      </h2>

      {template.exercises.length === 0 ? (
        <p>No exercises yet. Add one below.</p>
      ) : (
        <ul className="exercise-list">
          {template.exercises.map((te, i) => (
            <li key={te.id} className="exercise-item">
              <span className="name">{te.exercise_name}</span>
              <span className="meta">
                {[
                  te.primary_muscle_group,
                  te.target_sets ? `${te.target_sets} sets` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${te.exercise_name} up`}
                >
                  ↑
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === template.exercises.length - 1}
                  aria-label={`Move ${te.exercise_name} down`}
                >
                  ↓
                </button>
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => removeExercise(te.id)}
                  aria-label={`Remove ${te.exercise_name}`}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addExercise} aria-label="Add exercise to template" style={{ marginTop: '1.5rem' }}>
        <div className="field">
          <label htmlFor="add-ex">Add exercise</label>
          <select
            id="add-ex"
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
          >
            <option value="">— choose an exercise —</option>
            {allExercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="target-sets">Target sets (optional)</label>
          <input
            id="target-sets"
            type="number"
            inputMode="numeric"
            min="0"
            value={targetSets}
            onChange={(e) => setTargetSets(e.target.value)}
          />
        </div>
        <button className="btn" type="submit">
          Add to template
        </button>
      </form>
    </main>
  );
}
