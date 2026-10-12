import Link from 'next/link';
import { getDbUser } from '@/app/lib/auth';

export const metadata = {
  title: 'Dashboard — Workout Tracker',
};

export default async function DashboardPage() {
  const user = await getDbUser();

  // The route is protected by Clerk middleware, so a session always exists.
  // getDbUser() provisions the users row on first visit if the webhook was
  // missed, so `user` should be present here.
  const greeting = user?.name ? `Welcome back, ${user.name}` : 'Welcome';

  return (
    <main className="container">
      <h1 className="page-title">{greeting}</h1>
      <p className="meta" style={{ marginTop: '-0.5rem', opacity: 0.75 }}>
        What would you like to do?
      </p>

      <nav className="dashboard-nav" aria-label="Primary">
        <Link className="dashboard-card" href="/exercises">
          <span className="dashboard-card-title">Exercise Library</span>
          <span className="dashboard-card-sub">
            Browse and add exercises
          </span>
        </Link>

        <Link className="dashboard-card" href="/templates">
          <span className="dashboard-card-title">Templates</span>
          <span className="dashboard-card-sub">Plan your workouts</span>
        </Link>

        {/* Placeholders for upcoming milestones. */}
        <span className="dashboard-card dashboard-card-disabled" aria-disabled="true">
          <span className="dashboard-card-title">Start Training</span>
          <span className="dashboard-card-sub">Coming soon</span>
        </span>
        <span className="dashboard-card dashboard-card-disabled" aria-disabled="true">
          <span className="dashboard-card-title">History</span>
          <span className="dashboard-card-sub">Coming soon</span>
        </span>
      </nav>
    </main>
  );
}
