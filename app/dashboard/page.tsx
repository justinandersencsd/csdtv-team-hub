'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  status: string
  due_date: string | null
  priority: string
  productions?: { title: string } | null
}

interface Production {
  id: string
  production_number: number
  title: string
  request_type_label: string | null
  type: string | null
  status: string | null
  event_date: string | null
  start_datetime: string | null
  checklist_items?: { completed: boolean }[]
}

interface TeamMember {
  id: string
  name: string
  role: string
  avatar_color: string
}

interface CurrentUser {
  id: string
  name: string
  role: string
}

export default function DashboardPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [myProductions, setMyProductions] = useState<Production[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [view, setView] = useState<'my' | 'team'>('my')
  const [loading, setLoading] = useState(true)

  const text      = dark ? '#f0f4ff' : '#1a1f36'
  const muted     = dark ? '#94a3b8' : '#6b7280'
  const border    = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const cardBg    = dark ? '#111827' : '#ffffff'
  const metricBg  = dark ? '#1e2a3a' : '#f0f4ff'
  const rowHover  = dark ? 'rgba(255,255,255,0.04)' : '#f8fafc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: user } = await supabase
      .from('team')
      .select('*')
      .eq('supabase_user_id', session.user.id)
      .single()

    if (!user) return
    setCurrentUser(user)

    const [tasksRes, prodMembersRes, teamRes, allTasksRes] = await Promise.all([
      supabase.from('tasks').select('*, productions(title)').eq('assigned_to', user.id).neq('status', 'complete').order('due_date', { ascending: true, nullsFirst: false }).limit(8),
      supabase.from('production_members').select('production_id').eq('user_id', user.id),
      supabase.from('team').select('*').eq('active', true),
      supabase.from('tasks').select('*, productions(title)').neq('status', 'complete').order('due_date', { ascending: true, nullsFirst: false }).limit(8),
    ])

    setMyTasks(tasksRes.data || [])
    setTeamMembers(teamRes.data || [])
    setAllTasks(allTasksRes.data || [])

    if (prodMembersRes.data && prodMembersRes.data.length > 0) {
      const ids = prodMembersRes.data.map(p => p.production_id)
      const { data: prods } = await supabase
        .from('productions')
        .select('*, checklist_items(completed)')
        .in('id', ids)
        .neq('status', 'Complete')
        .order('start_datetime', { ascending: true, nullsFirst: false })
        .limit(5)
      setMyProductions(prods || [])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = (d: string | null) => {
    if (!d) return null
    const date = new Date(d)
    const today = new Date()
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { label: 'Overdue', color: '#ef4444' }
    if (diff === 0) return { label: 'Today', color: '#f59e0b' }
    if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b' }
    if (diff <= 7) return { label: `${diff}d`, color: muted }
    return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: muted }
  }

  const getProgress = (prod: Production) => {
    const items = prod.checklist_items || []
    if (items.length === 0) return null
    const done = items.filter(i => i.completed).length
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
  }

  const overdueCount = myTasks.filter(t => {
    if (!t.due_date) return false
    return new Date(t.due_date) < new Date()
  }).length

  const urgentCount = myTasks.filter(t => t.priority === 'high').length

  const nextDue = myTasks.find(t => t.due_date)
  const nextDueInfo = nextDue ? formatDate(nextDue.due_date) : null

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      'in progress': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
      'pending':     { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
      'complete':    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },
    }
    const s = styles[status?.toLowerCase()] || styles.pending
    return (
      <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
        {status}
      </span>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: muted, fontSize: '14px' }}>Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: text, margin: '0 0 4px' }}>
          {greeting()}, {currentUser?.name?.split(' ')[0]}
        </h1>
        <p style={{ fontSize: '13px', color: muted, margin: 0 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '4px', background: dark ? '#1e2a3a' : '#e2e8f0', borderRadius: '10px', padding: '3px', width: 'fit-content', marginBottom: '24px' }}>
        {(['my', 'team'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            fontSize: '13px', padding: '6px 18px', borderRadius: '8px', border: 'none',
            background: view === v ? '#1e6cb5' : 'transparent',
            color: view === v ? '#fff' : muted,
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: view === v ? 500 : 400,
            transition: 'all 0.15s',
          }}>
            {v === 'my' ? 'My day' : 'Team view'}
          </button>
        ))}
      </div>

      {/* MY DAY */}
      {view === 'my' && (
        <div>
          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Open tasks</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: text, margin: '0 0 2px', lineHeight: 1 }}>{myTasks.length}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>assigned to you</p>
            </div>
            <div style={{ background: overdueCount > 0 ? 'rgba(239,68,68,0.12)' : metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${overdueCount > 0 ? 'rgba(239,68,68,0.3)' : border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: overdueCount > 0 ? '#ef4444' : muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overdue</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: overdueCount > 0 ? '#ef4444' : text, margin: '0 0 2px', lineHeight: 1 }}>{overdueCount}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>{overdueCount === 0 ? 'all on track' : 'need attention'}</p>
            </div>
            <div style={{ background: urgentCount > 0 ? 'rgba(245,158,11,0.1)' : metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${urgentCount > 0 ? 'rgba(245,158,11,0.3)' : border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: urgentCount > 0 ? '#f59e0b' : muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High priority</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: urgentCount > 0 ? '#f59e0b' : text, margin: '0 0 2px', lineHeight: 1 }}>{urgentCount}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>{urgentCount === 0 ? 'nothing urgent' : 'urgent tasks'}</p>
            </div>
            <div style={{ background: metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next due</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: nextDueInfo ? nextDueInfo.color : text, margin: '0 0 2px', lineHeight: 1 }}>{nextDueInfo?.label || '—'}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextDue?.title || 'no tasks due'}</p>
            </div>
            <div style={{ background: metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Productions</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: text, margin: '0 0 2px', lineHeight: 1 }}>{myProductions.length}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>you are assigned to</p>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {[
              { href: '/dashboard/tasks', label: 'New task', desc: 'Create a task', color: '#3b82f6', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> },
              { href: '/dashboard/productions', label: 'Productions', desc: '309 total', color: '#f59e0b', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> },
              { href: '/dashboard/schedule', label: 'My schedule', desc: 'Set your hours', color: '#22c55e', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
              { href: '/dashboard/knowledge', label: 'Knowledge base', desc: 'Guides & processes', color: '#a78bfa', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg> },
            ].map(({ href, label, desc, color, icon }) => (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = border; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                    {icon}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: text, margin: '0 0 2px' }}>{label}</p>
                    <p style={{ fontSize: '11px', color: muted, margin: 0 }}>{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Tasks + Productions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>

            {/* My tasks */}
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: text, margin: 0 }}>My tasks</h2>
                <Link href="/dashboard/tasks" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
              </div>
              {myTasks.length === 0 ? (
                <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '32px 20px', margin: 0 }}>No open tasks</p>
              ) : myTasks.map((task, i) => {
                const dateInfo = formatDate(task.due_date)
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 16px', borderBottom: i < myTasks.length - 1 ? `1px solid ${border}` : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = rowHover}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${task.status === 'in progress' ? '#f59e0b' : border}`, flexShrink: 0, background: task.status === 'in progress' ? 'rgba(245,158,11,0.1)' : 'transparent' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      {task.productions && <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0' }}>{task.productions.title}</p>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                      {statusBadge(task.status)}
                      {dateInfo && <span style={{ fontSize: '10px', color: dateInfo.color, fontWeight: 500 }}>{dateInfo.label}</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* My productions */}
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: text, margin: 0 }}>My productions</h2>
                <Link href="/dashboard/productions" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
              </div>
              {myProductions.length === 0 ? (
                <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '32px 20px', margin: 0 }}>No active productions</p>
              ) : myProductions.map((prod, i) => {
                const progress = getProgress(prod)
                const typeLabel = prod.request_type_label || prod.type || 'Unknown'
                return (
                  <Link key={prod.id} href={`/dashboard/productions/${prod.id}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 16px', borderBottom: i < myProductions.length - 1 ? `1px solid ${border}` : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = rowHover}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{prod.title}</p>
                      <span style={{ fontSize: '10px', color: muted, marginLeft: '8px', flexShrink: 0 }}>{progress ? `${progress.pct}%` : 'No checklist'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {progress ? (
                        <div style={{ flex: 1, height: '4px', background: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress.pct}%`, height: '100%', background: progress.pct === 100 ? '#22c55e' : '#3b82f6', borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                      ) : (
                        <div style={{ flex: 1, height: '4px', background: dark ? 'rgba(255,255,255,0.04)' : '#f1f5f9', borderRadius: '2px' }} />
                      )}
                      <span style={{ fontSize: '11px', color: muted, flexShrink: 0 }}>{typeLabel}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TEAM VIEW */}
      {view === 'team' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team members</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: text, margin: '0 0 2px', lineHeight: 1 }}>{teamMembers.length}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>active</p>
            </div>
            <div style={{ background: metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Open tasks</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: text, margin: '0 0 2px', lineHeight: 1 }}>{allTasks.length}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>across team</p>
            </div>
            <div style={{ background: allTasks.filter(t => t.priority === 'high').length > 0 ? 'rgba(239,68,68,0.1)' : metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${allTasks.filter(t => t.priority === 'high').length > 0 ? 'rgba(239,68,68,0.3)' : border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: allTasks.filter(t => t.priority === 'high').length > 0 ? '#ef4444' : muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High priority</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: allTasks.filter(t => t.priority === 'high').length > 0 ? '#ef4444' : text, margin: '0 0 2px', lineHeight: 1 }}>{allTasks.filter(t => t.priority === 'high').length}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>team wide</p>
            </div>
            <div style={{ background: metricBg, borderRadius: '12px', padding: '16px 18px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: '11px', fontWeight: 500, color: muted, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: text, margin: '0 0 2px', lineHeight: 1 }}>{new Date().toLocaleDateString('en-US', { weekday: 'short' })}</p>
              <p style={{ fontSize: '11px', color: muted, margin: 0 }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: text, margin: 0 }}>Team</h2>
              </div>
              {teamMembers.map((member, i) => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: i < teamMembers.length - 1 ? `1px solid ${border}` : 'none' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0 }}>{member.name}</p>
                    <p style={{ fontSize: '11px', color: muted, margin: 0, textTransform: 'capitalize' }}>{member.role}</p>
                  </div>
                  <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '20px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 500 }}>Active</span>
                </div>
              ))}
            </div>

            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${border}` }}>
                <h2 style={{ fontSize: '14px', fontWeight: 600, color: text, margin: 0 }}>All open tasks</h2>
                <Link href="/dashboard/tasks" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
              </div>
              {allTasks.length === 0 ? (
                <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '32px 20px', margin: 0 }}>No open tasks</p>
              ) : allTasks.map((task, i) => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderBottom: i < allTasks.length - 1 ? `1px solid ${border}` : 'none' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1.5px solid ${border}`, flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: text, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                  {statusBadge(task.status)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}