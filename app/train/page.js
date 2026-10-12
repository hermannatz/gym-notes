'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function StartTrainingPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [inProgress, setInProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [tplRes, sessRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/sessions?status=in_progress'),
      ]);
      if (tplRes.status === 401 || sessRes.status === 401) {
        setError('Please sign in to start training.');
        return;
      }
      const tplData = await tplRes.json();
      const sessData = await sessRes.json();
      setTemplates(tplData.templates ?? []);
      setInProgress(sessData.sessions ?? []);
    } catch {
      setError('Could not load. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function start(templateId) {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateId ? { template_id: templateId } : {}),
      });
      if (!res.ok) {
        setError('Could not start the session.');
        return;
      }
      const data = await res.json();
      router.push(`/train/${data.session.id}`);
    } catch {
      setError('Could not start the session.');
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className="container">
      <h1 className="page-title">Start Training</h1>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {inProgress.length > 0 && (
        <section>
          <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
            Resume
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
                  In progress · {s.exercise_count} exercises
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: '1.5rem' }}>
        <button
          className="btn"
          type="button"
          disabled={starting}
          onClick={() => start(null)}
        >
          Start a blank workout
        </button>
      </section>

      <section style={{ marginTop: '1.5rem' }}>
        <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
          From a template
        </h2>
        {loading ? (
          <p>Loading…</p>
        ) : templates.length === 0 ? (
          <p>
            No templates yet. <Link href="/templates">Create one</Link>.
          </p>
        ) : (
          <ul className="exercise-list">
            {templates.map((t) => (
              <li key={t.id} className="exercise-item">
                <span className="name">{t.name}</span>
                <span className="meta">{t.exercise_count} exercises</span>
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    className="btn"
                    type="button"
                    disabled={starting}
                    onClick={() => start(t.id)}
                  >
                    Start
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
