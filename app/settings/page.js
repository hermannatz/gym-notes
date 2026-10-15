'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [unit, setUnit] = useState('kg');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.status === 401) {
          setError('Please sign in.');
          return;
        }
        if (!res.ok) {
          setError('Could not load settings.');
          return;
        }
        const data = await res.json();
        setUnit(data.settings.preferred_unit ?? 'kg');
      } catch {
        setError('Could not load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Permanently delete your account and all workout data? This cannot be undone.'
    );
    if (!confirmed) return;
    // Second confirmation for an irreversible action.
    if (!window.confirm('This is permanent. Delete everything?')) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not delete your account. Please try again.');
        return;
      }
      // Account gone — send them to the public landing page.
      window.location.href = '/';
    } catch {
      setError('Could not delete your account. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function save(nextUnit) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_unit: nextUnit }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Could not save.');
        return;
      }
      setUnit(nextUnit);
      setSaved(true);
    } catch {
      setError('Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container">
      <h1 className="page-title">Settings</h1>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="notice notice-success" role="status">
          Saved.
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <section>
          <div className="field">
            <label id="unit-label">Preferred weight unit</label>
            <div
              className="segmented"
              role="group"
              aria-labelledby="unit-label"
            >
              {['kg', 'lb'].map((u) => (
                <button
                  key={u}
                  type="button"
                  className={`segmented-option${unit === u ? ' is-active' : ''}`}
                  aria-pressed={unit === u}
                  disabled={saving}
                  onClick={() => u !== unit && save(u)}
                >
                  {u === 'kg' ? 'Kilograms (kg)' : 'Pounds (lb)'}
                </button>
              ))}
            </div>
            <p className="meta" style={{ color: 'var(--text-dim)', marginTop: '0.4rem' }}>
              Changes how weights are shown. Your recorded workouts keep their
              original values — only the display converts.
            </p>
          </div>
        </section>
      )}

      {!loading && (
        <section className="danger-zone">
          <h2 className="page-title" style={{ fontSize: '1.1rem' }}>
            Danger zone
          </h2>
          <p className="meta" style={{ color: 'var(--text-dim)' }}>
            Deleting your account permanently removes your templates, exercises,
            sessions, and history. This cannot be undone.
          </p>
          <button
            type="button"
            className="btn btn-secondary danger-button"
            disabled={deleting}
            onClick={deleteAccount}
          >
            {deleting ? 'Deleting…' : 'Delete my account'}
          </button>
        </section>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
    </main>
  );
}
