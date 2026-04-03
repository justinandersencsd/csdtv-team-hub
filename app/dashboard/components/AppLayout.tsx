'use client'

import { useTheme } from '@/lib/theme'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import NotificationPanel from './NotificationPanel'
import SearchPanel from './SearchPanel'

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
    { label: 'Onboarding', href: '/dashboard/onboarding', icon: 'star' },
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
  star: <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
}

function Icon({ type }: { type: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[type]}
    </svg>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userColor, setUserColor] = useState('#e8a020')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const dark = theme === 'dark'

  const bg       = dark ? '#0a0f1e' : '#f8f9fc'
  const sidebar  = dark ? '#0d1525' : '#ffffff'
  const border   = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const text     = dark ? '#f0f4ff' : '#1a1f36'
  const muted    = dark ? '#8899bb' : '#6b7280'
  const searchBg = dark ? '#0d1525' : '#f3f4f6'
  const iconBg   = dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6'

  useEffect(() => {
    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase.from('team').select('name, role, avatar_color').eq('supabase_user_id', session.user.id).single()
      if (data) { setUserName(data.name); setUserRole(data.role); setUserColor(data.avatar_color || '#e8a020') }
    }
    loadUser()
  }, [])

  useEffect(() => {
    const loadUnread = async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('read', false)
      setUnreadCount(count || 0)
    }
    loadUnread()
  }, [])

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }, [])

  const isActive = (href: string) => href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const navLink = (href: string, icon: string, label: string, onClick?: () => void) => (
    <Link key={href} href={href} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px',
      borderRadius: '8px', fontSize: '13px', marginBottom: '2px', textDecoration: 'none',
      borderLeft: isActive(href) ? '2px solid #1e6cb5' : '2px solid transparent',
      background: isActive(href) ? 'rgba(30,108,181,0.12)' : 'transparent',
      color: isActive(href) ? '#5ba3e0' : muted,
      fontWeight: isActive(href) ? 500 : 400,
    }}>
      <Icon type={icon} />
      {label}
    </Link>
  )

  const sidebarContent = (onClick?: () => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: sidebar }}>
      <div style={{ padding: '12px 16px', borderBottom: `0.5px solid ${border}` }}>
        <Image src="/images/CSDtv Logo - New Logo Outlined.png" alt="CSDtv" width={110} height={48} style={{ objectFit: 'contain' }} priority />
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <p style={{ fontSize: '9px', fontWeight: 500, color: muted, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '10px 8px 4px', margin: 0 }}>{section}</p>
            {items.map(item => navLink(item.href, item.icon, item.label, onClick))}
          </div>
        ))}
      </nav>
      <div style={{ padding: '8px', borderTop: `0.5px solid ${border}` }}>
        {userName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', marginBottom: '4px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</p>
              <p style={{ fontSize: '11px', color: muted, textTransform: 'capitalize', margin: 0 }}>{userRole}</p>
            </div>
          </div>
        )}
        <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', fontSize: '13px', color: muted, background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <aside style={{ width: '220px', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', borderRight: `0.5px solid ${border}`, display: 'none' }} className="csdtv-sidebar">
        {sidebarContent()}
      </aside>

      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setMobileOpen(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          <aside style={{ position: 'relative', width: '220px', height: '100%', borderRight: `0.5px solid ${border}` }} onClick={e => e.stopPropagation()}>
            {sidebarContent(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="csdtv-main">
        <header style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: `0.5px solid ${border}`, background: sidebar }}>

          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'none' }} className="csdtv-hamburger">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          <button onClick={() => setShowSearch(true)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: searchBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '7px 12px', cursor: 'text', textAlign: 'left' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{ fontSize: '13px', color: muted }}>Search productions, tasks, knowledge base...</span>
          </button>

          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowSearch(false) }}
            style={{ position: 'relative', width: '32px', height: '32px', borderRadius: '8px', background: iconBg, border: `0.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: muted, flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '4px', right: '4px', minWidth: '14px', height: '14px', borderRadius: '7px', background: '#e8a020', fontSize: '9px', fontWeight: 700, color: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button onClick={toggleTheme} style={{ width: '32px', height: '32px', borderRadius: '8px', background: iconBg, border: `0.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>
            {dark ? '☀️' : '🌙'}
          </button>
        </header>

        <main style={{ flex: 1, padding: '20px' }} className="csdtv-content">
          {children}
        </main>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'none', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0', borderTop: `0.5px solid ${border}`, background: sidebar, zIndex: 10 }} className="csdtv-mobile-nav">
          {[
            { href: '/dashboard', icon: 'home', label: 'Home' },
            { href: '/dashboard/productions', icon: 'video', label: 'Productions' },
            { href: '/dashboard/tasks', icon: 'check', label: 'Tasks' },
            { href: '/dashboard/schedule', icon: 'calendar', label: 'Schedule' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px 12px', color: isActive(item.href) ? '#5ba3e0' : muted, textDecoration: 'none', fontSize: '11px' }}>
              <Icon type={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {showNotifications && (
        <NotificationPanel onClose={() => setShowNotifications(false)} onUnreadChange={setUnreadCount} />
      )}

      {showSearch && (
        <SearchPanel onClose={() => setShowSearch(false)} />
      )}

      <style>{`
        @media (min-width: 768px) {
          .csdtv-sidebar { display: flex !important; flex-direction: column; }
          .csdtv-main { margin-left: 220px !important; }
          .csdtv-hamburger { display: none !important; }
          .csdtv-mobile-nav { display: none !important; }
        }
        @media (max-width: 767px) {
          .csdtv-hamburger { display: flex !important; }
          .csdtv-mobile-nav { display: flex !important; }
          .csdtv-content { padding-bottom: 80px !important; }
        }
      `}</style>
    </div>
  )
}