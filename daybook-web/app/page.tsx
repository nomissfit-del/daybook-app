'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? '/personal' : '/login');
    });
  }, [router]);

  return <p className="font-mono text-sm text-ink-muted p-10">Loading Daybook…</p>;
}
