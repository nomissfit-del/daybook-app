'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.replace('/personal');
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo('Check your email to confirm your account, then sign in.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm border border-line rounded-lg p-8 bg-paper">
        <h1 className="font-display text-2xl font-semibold">Daybook</h1>
        <p className="font-mono text-xs text-ink-muted mb-6">targets · projects · tasks</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-ink-muted mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b border-line focus:border-[var(--accent)] outline-none py-1"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-ink-muted mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-line focus:border-[var(--accent)] outline-none py-1"
            />
          </div>

          {error && <p className="text-sm text-[var(--accent)]">{error}</p>}
          {info && <p className="text-sm text-ink-muted">{info}</p>}

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-[var(--accent)] text-white rounded py-2 text-sm font-medium disabled:opacity-60"
          >
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="mt-4 text-xs font-mono text-ink-muted hover:text-[var(--accent)]"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
