'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type NavTab = 'personal' | 'work' | 'goals'

const TABS: { id: NavTab; label: string; href: string; color: string; light: string }[] = [
  { id: 'personal', label: 'Personal', href: '/personal', color: '#B85C38', light: '#F5E6DF' },
  { id: 'work',     label: 'Work',     href: '/work',     color: '#1B3A6B', light: '#DDE6F2' },
  { id: 'goals',    label: 'Goals',    href: '/goals',    color: '#3F6E4F', light: '#E2ECDF' },
]

interface Props {
  active: NavTab
  userEmail: string
}

export default function NavBar({ active, userEmail }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="border-b border-border bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-serif text-xl text-ink mr-2 sm:mr-4">Daybook</span>
          {TABS.map(tab => {
            const isActive = tab.id === active
            return (
              <a
                key={tab.id}
                href={tab.href}
                className={`px-2.5 sm:px-3 py-1.5 text-sm rounded-sm transition-colors ${
                  isActive ? 'font-medium' : 'text-muted hover:text-ink'
                }`}
                style={isActive ? { color: tab.color, backgroundColor: tab.light } : {}}
              >
                {tab.label}
              </a>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted hidden sm:block font-mono">{userEmail}</span>
          <button onClick={handleSignOut} className="btn-ghost text-xs">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
