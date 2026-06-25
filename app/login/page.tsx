import AuthForm from '@/components/AuthForm'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-light text-ink mb-1">Daybook</h1>
          <p className="text-sm text-muted">Sign in to your account</p>
        </div>

        {searchParams.error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-sm text-sm text-red-700">
            {searchParams.error === 'auth' ? 'Authentication failed. Please try again.' : searchParams.error}
          </div>
        )}
        {searchParams.message && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-700">
            {searchParams.message}
          </div>
        )}

        <AuthForm mode="login" />

        <p className="text-center text-sm text-muted mt-6">
          No account?{' '}
          <a href="/signup" className="text-ink underline underline-offset-2 hover:text-personal transition-colors">
            Sign up
          </a>
        </p>
      </div>
    </div>
  )
}
