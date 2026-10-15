'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/templates');
      if (res.status === 401) {
        setError('Please sign in to view your templates.');
        return;
      }
      if (!res.ok) {
        setError('Could not load templates.');
        return;
      }
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setError('Could not load templates.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createTemplate(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Template name is required.');
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not create template.');
        return;
      }
      setName('');
      setSuccess('Template created.');
      await load();
    } catch {
      setError('Could not create template.');
    } finally {
      setCreating(false);
    }
  }

  async function duplicate(id) {
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}/duplicate`, {
        method: 'POST',
      });
      if (!res.ok) {
        setError('Could not duplicate template.');
        return;
      }
      await load();
    } catch {
      setError('Could not duplicate template.');
    }
  }

  async function archive(id) {
    if (!window.confirm('Archive this template? It will be hidden from your list.'))
      return;
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not archive template.');
        return;
      }
      await load();
    } catch {
      setError('Could not archive template.');
    }
  }

  return (
    <main className="container">
      <header className="page-header"><p className="eyebrow">Programming</p><h1 className="page-title">Templates</h1><p className="page-lead">Build once, then focus on the work.</p></header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {success && <div className="notice notice-success" role="status">✓ {success}</div>}

      <form onSubmit={createTemplate} aria-label="Create template" className="inline-create-panel">
        <div className="field">
          <label htmlFor="tpl-name">New template name</label>
          <input
            id="tpl-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push A"
            autoComplete="off"
          />
        </div>
        <button className="btn" type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create template'}
        </button>
      </form>

      <section className="content-section">
        <div className="section-heading"><div><p className="eyebrow">Library</p><h2>Your plans</h2></div><span className="count-badge">{templates.length}</span></div>
        {loading ? (
          <p>Loading…</p>
        ) : templates.length === 0 ? (
          <p>No templates yet. Create one above.</p>
        ) : (
          <ul className="exercise-list">
            {templates.map((t) => (
              <li key={t.id} className="exercise-item template-list-card">
                <span className="name">
                  <Link href={`/templates/${t.id}`}>{t.name}</Link>
                </span>
                <span className="meta">
                  {t.exercise_count}{' '}
                  {t.exercise_count === 1 ? 'exercise' : 'exercises'}
                </span>
                <div className="card-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => duplicate(t.id)}
                  >
                    Duplicate
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => archive(t.id)}
                  >
                    Archive
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
