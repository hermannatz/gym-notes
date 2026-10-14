'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/templates', label: 'Plans', icon: 'plans' },
  { href: '/train', label: 'Train', icon: 'train', primary: true },
  { href: '/history', label: 'History', icon: 'history' },
  { href: '/exercises', label: 'Exercises', icon: 'exercises' },
];

function NavIcon({ name }) {
  const paths = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
    plans: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    train: <><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></>,
    history: <><path d="M4 5v5h5" /><path d="M5.5 18a8 8 0 1 0-1.3-8" /><path d="M12 7v5l3 2" /></>,
    exercises: <><path d="M8 4h8M9 4v4l-4 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-4-9V4" /><path d="M7 15h10" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isApp = items.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  const isLiveSession = /^\/train\/[^/]+$/.test(pathname);

  if (!isApp) return children;

  return (
    <div className={`app-shell${isLiveSession ? ' app-shell-focus' : ''}`}>
      <header className="app-header">
        <Link className="app-wordmark" href="/dashboard" aria-label="GymNotes home">
          GYM<span>NOTES</span>
        </Link>
        <span className="app-mode"><i aria-hidden="true" /> Ready to train</span>
      </header>
      <div className="app-content">{children}</div>
      {!isLiveSession && (
        <nav className="bottom-nav" aria-label="App navigation">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${active ? 'active ' : ''}${item.primary ? 'primary' : ''}`.trim()}
                aria-current={active ? 'page' : undefined}
              >
                <span className="nav-icon"><NavIcon name={item.icon} /></span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
