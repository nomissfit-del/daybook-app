'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const isWork = pathname?.startsWith('/work');

  async function signOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-line">
      <Link href="/personal" className="font-display text-xl font-semibold">
        Daybook
      </Link>
      <nav className="flex items-center gap-4">
        <Link
          href="/personal"
          className={!isWork ? 'text-[var(--accent)] font-semibold' : 'text-ink-muted'}
        >
          Personal
        </Link>
        <Link
          href="/work"
          className={isWork ? 'text-[var(--accent)] font-semibold' : 'text-ink-muted'}
        >
          Work
        </Link>
        <button
          onClick={signOut}
          className="text-xs font-mono uppercase text-ink-muted hover:text-[var(--accent)] ml-2"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
