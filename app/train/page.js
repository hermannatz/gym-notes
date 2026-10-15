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
      <header className="page-header"><p className="eyebrow">Session</p><h1 className="page-title">Start training</h1><p className="page-lead">Pick up where you left off or begin something new.</p></header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {inProgress.length > 0 && (
        <section>
          <div className="section-heading"><div><p className="eyebrow">In progress</p><h2>Resume</h2></div><span className="status-dot">Live</span></div>
          <ul className="exercise-list">
            {inProgress.map((s) => (
              <li key={s.id} className="exercise-item session-list-card">
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

      <section className="start-blank-panel">
        <button
          className="btn"
          type="button"
          disabled={starting}
          onClick={() => start(null)}
        >
          <span>Start a blank workout</span><span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">Your plans</p><h2>From a template</h2></div></div>
        {loading ? (
          <p>Loading…</p>
        ) : templates.length === 0 ? (
          <p>
            No templates yet. <Link href="/templates">Create one</Link>.
          </p>
        ) : (
          <ul className="exercise-list">
            {templates.map((t) => (
              <li key={t.id} className="exercise-item template-launch-card">
                <span className="name">{t.name}</span>
                <span className="meta">{t.exercise_count} exercises</span>
                <div className="card-actions">
                  <button
                    className="btn"
                    type="button"
                    disabled={starting}
                    onClick={() => start(t.id)}
                  >
                    Start <span aria-hidden="true">→</span>
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
