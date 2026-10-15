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
      <header className="page-header"><p className="eyebrow">Training log</p><h1 className="page-title">History</h1><p className="page-lead">Your completed work, session by session.</p></header>

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
              <div className="section-heading"><div><p className="eyebrow">Continue</p><h2>Unfinished</h2></div><span className="status-dot">Live</span></div>
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

          <section className="content-section">
            <div className="section-heading"><div><p className="eyebrow">Archive</p><h2>Completed</h2></div><span className="count-badge">{past.length}</span></div>
            {past.length === 0 ? (
              <p>No completed sessions yet.</p>
            ) : (
              <ul className="exercise-list history-timeline">
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
