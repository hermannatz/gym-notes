import { ClerkProvider } from '@clerk/nextjs';
import AppShell from '@/app/ui/app-shell';
import './globals.css';

export const metadata = {
  title: 'Workout Tracker',
  description: 'An offline-first workout tracking application.',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html lang="en">
        <body><AppShell>{children}</AppShell></body>
      </html>
    </ClerkProvider>
  );
}
