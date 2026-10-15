'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { totalVolume, workingSetCount } from '@/app/lib/metrics';

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export default function HistorySessionPage({ params }) {
  const { id } = use(params);
  const [session, setSession] = useState(null);
  const [unit, setUnit] = useState('kg');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`);
        if (res.status === 401) {
          setError('Please sign in.');
          return;
        }
        if (res.status === 404) {
          setError('Session not found.');
          return;
        }
        if (!res.ok) {
          setError('Could not load the session.');
          return;
        }
        const data = await res.json();
        setSession(data.session);
        const setRes = await fetch('/api/settings');
        if (setRes.ok) {
          const setData = await setRes.json();
          setUnit(setData.settings?.preferred_unit ?? 'kg');
        }
      } catch {
        setError('Could not load the session.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <main className="container">
        <p>Loading…</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="container">
        <div className="notice notice-error" role="alert">
          {error}
        </div>
        <Link href="/history">← Back to history</Link>
      </main>
    );
  }

  const sessionVolume = session.exercises.reduce(
    (sum, ex) => sum + totalVolume(ex.sets, unit),
    0
  );

  return (
    <main className="container">
      <Link href="/history">← History</Link>
      <h1 className="page-title" style={{ marginTop: '0.5rem' }}>
        {session.name || 'Workout'}
      </h1>
      <p className="meta" style={{ opacity: 0.7 }}>
        {formatDate(session.finished_at || session.started_at)} ·{' '}
        {session.status}
      </p>
      <p className="meta" style={{ opacity: 0.7 }}>
        Total working volume: {Math.round(sessionVolume).toLocaleString()} {unit}
      </p>

      {session.exercises.length === 0 ? (
        <p>No exercises were recorded.</p>
      ) : (
        session.exercises.map((ex) => {
          const completedSets = ex.sets.filter((s) => s.completed);
          return (
            <section
              key={ex.id}
              className="exercise-item"
              style={{ marginBottom: '1rem', opacity: ex.skipped ? 0.5 : 1 }}
            >
              <div className="name">
                {ex.exercise_name}
                {ex.skipped && <span className="badge">skipped</span>}
              </div>
              <div className="meta">
                {[
                  ex.primary_muscle_group,
                  `${workingSetCount(ex.sets)} working sets`,
                  `${Math.round(totalVolume(ex.sets, unit)).toLocaleString()} ${unit}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>

              {completedSets.length === 0 ? (
                <p className="meta">No completed sets.</p>
              ) : (
                <table className="set-table" style={{ marginTop: '0.5rem' }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>weight</th>
                      <th>reps</th>
                      <th>type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.sets.map((s, idx) => (
                      <tr key={s.id} style={{ opacity: s.completed ? 1 : 0.5 }}>
                        <td>{idx + 1}</td>
                        <td>
                          {s.weight ?? '-'} {s.weight_unit}
                        </td>
                        <td>{s.reps ?? '-'}</td>
                        <td>{s.set_type === 'warmup' ? 'warm-up' : 'working'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
