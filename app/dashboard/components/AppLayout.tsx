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
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 10px',
        borderRadius: '8px',
        fontSize: '13px',
        marginBottom: '2px',
        textDecoration: 'none',
        borderLeft: isActive ? '2px solid #1e6cb5' : '2px solid transparent',
        background: isActive ? 'rgba(30,108,181,0.12)' : 'transparent',
        color: isActive ? '#5ba3e0' : '#8899bb',
        fontWeight: isActive ? 500 : 400,
        transition: 'all 0.15s',
      }}
    >
      <Icon type={icon} />
      {label}
    </Link>
  )
}

function SidebarInner({ onNavClick, colors }: { onNavClick?: () => void; colors: ReturnType<typeof getColors> }) {
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

  const initials = userName ? userName.slice(0, 2).toUpperCase() : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.sidebar, borderRight: `0.5px solid ${colors.border}` }}>
      <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${colors.border}` }}>
        <Image
          src="/images/CSDtv Logo - New Logo Outlined.png"
          alt="CSDtv"
          width={110}
          height={48}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p style={{ fontSize: '9px', fontWeight: 500, color: colors.textMuted, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '10px 8px 4px' }}>
              {section}
            </p>
            {items.map(item => (
              <NavLink key={item.href} {...item} onClick={onNavClick} />
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding: '8px', borderTop: `0.5px solid ${colors.border}` }}>
        {initials && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', marginBottom: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e8a020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
              <p style={{ fontSize: '11px', color: colors.textMuted, textTransform: 'capitalize' }}>{userRole}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', fontSize: '13px', color: colors.textMuted, background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
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

function getColors(dark: boolean) {
  return {
    bg: dark ? '#0a0f1e' : '#f8f9fc',
    sidebar: dark ? '#0d1525' : '#ffffff',
    topbar: dark ? '#0a0f1e' : '#ffffff',
    border: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#f0f4ff' : '#1a1f36',
    textMuted: dark ? '#8899bb' : '#6b7280',
    searchBg: dark ? '#0d1525' : '#f3f4f6',
    iconBg: dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6',
    mobileNavBg: dark ? '#0d1525' : '#ffffff',
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const dark = theme === 'dark'
  const c = getColors(dark)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: c.bg, color: c.text, fontFamily: 'system-ui, -apple-system, sans-serif', transition: 'background 0.2s, color 0.2s' }}>

      {/* Desktop sidebar */}
      <aside style={{ width: '220px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', display: 'none' }} className="desktop-sidebar">
        <SidebarInner colors={c} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={closeMobile}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <aside style={{ position: 'relative', width: '220px', height: '100%' }} onClick={e => e.stopPropagation()}>
            <SidebarInner colors={c} onNavClick={closeMobile} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 0 }} className="main-area">

        {/* Topbar */}
        <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: `0.5px solid ${c.border}`, background: c.topbar, transition: 'background 0.2s' }}>

          {/* Mobile menu */}
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: c.textMuted, cursor: 'pointer' }} className="mobile-menu-btn" aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Search */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: c.searchBg, border: `0.5px solid ${c.border}`, borderRadius: '8px', padding: '7px 12px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.textMuted} strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search productions, tasks, knowledge base..."
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: c.text, fontFamily: 'inherit', width: '100%' }}
            />
          </div>

          {/* Bell */}
          <button style={{ position: 'relative', width: '32px', height: '32px', borderRadius: '8px', background: c.iconBg, border: `0.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: c.textMuted, flexShrink: 0 }} aria-label="Notifications">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span style={{ position: 'absolute', top: '5px', right: '5px', width: '7px', height: '7px', background: '#e8a020', borderRadius: '50%' }} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            style={{ width: '32px', height: '32px', borderRadius: '8px', background: c.iconBg, border: `0.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '20px', paddingBottom: '80px' }}>
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0', borderTop: `0.5px solid ${c.border}`, background: c.mobileNavBg, zIndex: 10 }} className="mobile-nav">
          {[
            { href: '/dashboard', icon: 'home', label: 'Home' },
            { href: '/dashboard/productions', icon: 'video', label: 'Productions' },
            { href: '/dashboard/tasks', icon: 'check', label: 'Tasks' },
            { href: '/dashboard/schedule', icon: 'calendar', label: 'Schedule' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 12px', color: c.textMuted, textDecoration: 'none', fontSize: '11px' }}>
              <Icon type={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .desktop-sidebar { display: flex !important; flex-direction: column; }
          .main-area { margin-left: 220px !important; }
          .mobile-menu-btn { display: none !important; }
          .mobile-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          main { padding-bottom: 80px !important; }
        }
      `}</style>
    </div>
  )
}