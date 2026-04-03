'use client'

import { useTheme } from '@/lib/theme'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'

const NAV = [
  { section: 'Main', items: [
    { label: 'Home', href: '/dashboard', icon: 'home' },
  ]},
  { section: 'Work', items: [
    { label: 'Productions', href: '/dashboard/productions', icon: 'video' },
    { label: 'Tasks', href: '/dashboard/tasks', icon: 'check' },
    { label: 'Schedule', href: '/dashboard/schedule', icon: 'calendar' },
  ]},
  { section: 'Resources', items: [
    { label: 'Knowledge base', href: '/dashboard/knowledge', icon: 'book' },
    { label: 'Quick links', href: '/dashboard/links', icon: 'link' },
  ]},
  { section: 'Account', items: [
    { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
  ]},
]

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>,
  video: <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>,
  check: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  book: <><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></>,
  link: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
}

function Icon({ type }: { type: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[type]}
    </svg>
  )
}

function NavLink({ href, icon, label, onClick }: { href: string; icon: string; label: string; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <Link href={href} onClick={onClick} className={`
      flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm mb-0.5 transition-colors duration-150 border-l-2
      ${isActive
        ? 'bg-blue-500/10 text-blue-400 border-blue-500 font-medium'
        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
      }
    `}>
      <Icon type={icon} />
      {label}
    </Link>
  )
}

function SidebarInner({ onNavClick }: { onNavClick?: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('team')
        .select('name, role')
        .eq('supabase_user_id', session.user.id)
        .single()
      if (data) {
        setUserName(data.name)
        setUserRole(data.role)
      }
    }
    loadUser()
  }, [supabase])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }, [supabase, router])

  const initials = userName ? userName.slice(0, 2).toUpperCase() : 'JU'

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0d1525]">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-white/5 flex items-center">
        <Image
          src="/images/CSDtv Logo - New Logo Outlined.png"
          alt="CSDtv"
          width={110}
          height={48}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2 pt-3 pb-1">
              {section}
            </p>
            {items.map(item => (
              <NavLink key={item.href} {...item} onClick={onNavClick} />
            ))}
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-slate-200 dark:border-white/5">
        {userName && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0" style={{ background: '#e8a020', color: '#0a0f1e' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{userName}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{userRole}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 w-full transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0a0f1e] text-slate-900 dark:text-slate-100">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 fixed top-0 left-0 h-screen border-r border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d1525]">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={closeMobile}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="relative w-56 h-full flex flex-col bg-white dark:bg-[#0d1525]" onClick={e => e.stopPropagation()}>
            <SidebarInner onNavClick={closeMobile} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col md:ml-56 min-w-0">

        {/* Topbar */}
        <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0a0f1e]">

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Search */}
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-[#0d1525] border border-slate-200 dark:border-white/5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search productions, tasks, knowledge base..."
              className="bg-transparent border-none outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder-slate-400"
            />
          </div>

          {/* Notification bell */}
          <button
            className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Notifications"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#0d1525] z-10">
          {[
            { href: '/dashboard', icon: 'home', label: 'Home' },
            { href: '/dashboard/productions', icon: 'video', label: 'Productions' },
            { href: '/dashboard/tasks', icon: 'check', label: 'Tasks' },
            { href: '/dashboard/schedule', icon: 'calendar', label: 'Schedule' },
          ].map(item => (
            <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 dark:text-slate-500">
              <Icon type={item.icon} />
              <span className="text-xs">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}