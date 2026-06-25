'use client';

import { usePathname } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import NavBar from '@/components/NavBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWork = pathname?.startsWith('/work');

  return (
    <div style={{ ['--accent' as string]: isWork ? 'var(--work)' : 'var(--personal)' }}>
      <AuthGuard>
        <NavBar />
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </AuthGuard>
    </div>
  );
}
