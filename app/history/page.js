'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

function formatDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/sessions');
        if (res.status === 401) {
          setError('Please sign in to view your history.');
          return;
        }
        if (!res.ok) {
          setError('Could not load history.');
          return;
        }
        const data = await res.json();
        setSessions(data.sessions ?? []);
      } catch {
        setError('Could not load history.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inProgress = sessions.filter((s) => s.status === 'in_progress');
  const past = sessions.filter((s) => s.status !== 'in_progress');

  return (
    <main className="container">
      <h1 className="page-title">History</h1>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {inProgress.length > 0 && (
            <section>
              <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
                Unfinished
              </h2>
              <ul className="exercise-list">
                {inProgress.map((s) => (
                  <li key={s.id} className="exercise-item">
                    <span className="name">
                      <Link href={`/train/${s.id}`}>
                        {s.name || 'Workout'}
                      </Link>
                    </span>
                    <span className="meta">
                      Started {formatDate(s.started_at)} · resume to continue
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section style={{ marginTop: inProgress.length ? '1.5rem' : 0 }}>
            <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
              Completed
            </h2>
            {past.length === 0 ? (
              <p>No completed sessions yet.</p>
            ) : (
              <ul className="exercise-list">
                {past.map((s) => (
                  <li key={s.id} className="exercise-item">
                    <span className="name">
                      <Link href={`/history/${s.id}`}>
                        {s.name || 'Workout'}
                      </Link>
                      {s.status === 'abandoned' && (
                        <span className="badge">abandoned</span>
                      )}
                    </span>
                    <span className="meta">
                      {formatDate(s.finished_at || s.started_at)} ·{' '}
                      {s.exercise_count}{' '}
                      {s.exercise_count === 1 ? 'exercise' : 'exercises'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
