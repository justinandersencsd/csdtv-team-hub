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
  assigned_to: string | null
  production_id: string | null
  productions?: { title: string } | null
  assignee?: { name: string } | null
}

interface Production {
  id: string
  production_number: number
  title: string
  type: string
  status: string
  event_date: string | null
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
  supabase_user_id: string
}

function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color || '#e8a020',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, color: '#0a0f1e',
      flexShrink: 0,
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending:     { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', label: 'Pending' },
    'in progress': { bg: 'rgba(232,160,32,0.12)', color: '#e8a020', label: 'In progress' },
    complete:    { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e', label: 'Complete' },
    approved:    { bg: 'rgba(30,108,181,0.12)', color: '#5ba3e0', label: 'Approved' },
    urgent:      { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', label: 'Urgent' },
  }
  const s = styles[status?.toLowerCase()] || styles.pending
  return (
    <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '6px', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return (
    <div style={{
      background: dark ? '#0d1525' : '#ffffff',
      border: `0.5px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: '12px',
      padding: '16px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function QuickAction({ icon, label, href, color }: { icon: React.ReactNode; label: string; href: string; color: string }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: dark ? '#0d1525' : '#ffffff',
        border: `0.5px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '12px',
        padding: '14px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        cursor: 'pointer', transition: 'transform 0.15s, border-color 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.borderColor = color }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)' }}
      >
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </div>
        <span style={{ fontSize: '11px', color: dark ? '#8899bb' : '#6b7280', textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
      </div>
    </Link>
  )
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
  const muted     = dark ? '#8899bb' : '#6b7280'
  const border    = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const metricBg  = dark ? 'rgba(255,255,255,0.03)' : '#f8f9fc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Load current user
    const { data: user } = await supabase
      .from('team')
      .select('*')
      .eq('supabase_user_id', session.user.id)
      .single()

    if (!user) return
    setCurrentUser(user)

    // Load my tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*, productions(title)')
      .eq('assigned_to', user.id)
      .neq('status', 'complete')
      .order('due_date', { ascending: true })
      .limit(6)

    setMyTasks(tasks || [])

    // Load my productions
    const { data: prodMembers } = await supabase
      .from('production_members')
      .select('production_id')
      .eq('user_id', user.id)

    if (prodMembers && prodMembers.length > 0) {
      const ids = prodMembers.map(p => p.production_id)
      const { data: prods } = await supabase
        .from('productions')
        .select('*, checklist_items(completed)')
        .in('id', ids)
        .neq('status', 'complete')
        .order('event_date', { ascending: true })
        .limit(4)
      setMyProductions(prods || [])
    }

    // Load team members
    const { data: team } = await supabase
      .from('team')
      .select('*')
      .eq('active', true)
    setTeamMembers(team || [])

    // Load all open tasks for team view
    const { data: allT } = await supabase
      .from('tasks')
      .select('*, productions(title)')
      .neq('status', 'complete')
      .order('due_date', { ascending: true })
      .limit(8)
    setAllTasks(allT || [])

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
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff < 0) return 'Overdue'
    if (diff <= 7) return `${diff}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getProgress = (prod: Production) => {
    const items = prod.checklist_items || []
    if (items.length === 0) return 0
    return Math.round((items.filter(i => i.completed).length / items.length) * 100)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: muted, fontSize: '14px' }}>Loading your dashboard...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>
          {greeting()}{currentUser?.name ? `, ${currentUser.name.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '4px', background: dark ? '#0d1525' : '#f1f5f9', border: `0.5px solid ${border}`, borderRadius: '10px', padding: '3px', width: 'fit-content', marginBottom: '20px' }}>
        {(['my', 'team'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            fontSize: '13px', padding: '6px 16px', borderRadius: '8px', border: 'none',
            background: view === v ? (dark ? '#1e6cb5' : '#1e6cb5') : 'transparent',
            color: view === v ? '#fff' : muted,
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: view === v ? 500 : 400,
            transition: 'all 0.15s',
          }}>
            {v === 'my' ? 'My day' : 'Team view'}
          </button>
        ))}
      </div>

      {/* MY DAY VIEW */}
      {view === 'my' && (
        <div>
          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            <QuickAction href="/dashboard/tasks?new=1" label="New task" color="#5ba3e0"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            />
            <QuickAction href="/dashboard/productions" label="Productions" color="#e8a020"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>}
            />
            <QuickAction href="/dashboard/schedule" label="My schedule" color="#22c55e"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            />
            <QuickAction href="/dashboard/knowledge" label="Knowledge base" color="#9b85e0"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>}
            />
          </div>

          {/* Tasks + Productions grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>

            {/* My tasks */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>My tasks</h2>
                <Link href="/dashboard/tasks" style={{ fontSize: '11px', color: '#5ba3e0', textDecoration: 'none' }}>View all</Link>
              </div>
              {myTasks.length === 0 ? (
                <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '20px 0' }}>No open tasks</p>
              ) : (
                myTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: `0.5px solid ${border}` }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${border}`, flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      {task.productions && (
                        <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0' }}>{task.productions.title}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                      <StatusBadge status={task.status} />
                      {task.due_date && (
                        <span style={{ fontSize: '10px', color: formatDate(task.due_date) === 'Overdue' ? '#ef4444' : muted }}>
                          {formatDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </Card>

            {/* My productions */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>My productions</h2>
                <Link href="/dashboard/productions" style={{ fontSize: '11px', color: '#5ba3e0', textDecoration: 'none' }}>View all</Link>
              </div>
              {myProductions.length === 0 ? (
                <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '20px 0' }}>No active productions</p>
              ) : (
                myProductions.map(prod => {
                  const pct = getProgress(prod)
                  return (
                    <Link key={prod.id} href={`/dashboard/productions/${prod.id}`} style={{ textDecoration: 'none', display: 'block', padding: '8px 0', borderBottom: `0.5px solid ${border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <p style={{ fontSize: '13px', color: text, margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{prod.title}</p>
                        <span style={{ fontSize: '10px', color: muted, marginLeft: '8px', flexShrink: 0 }}>{pct}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: '#1e6cb5', borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: muted, flexShrink: 0 }}>{prod.type}</span>
                      </div>
                    </Link>
                  )
                })
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TEAM VIEW */}
      {view === 'team' && (
        <div>
          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Team members', value: teamMembers.length },
              { label: 'Open tasks', value: allTasks.length },
              { label: 'This week', value: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: metricBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '12px 16px' }}>
                <p style={{ fontSize: '11px', color: muted, margin: '0 0 4px' }}>{label}</p>
                <p style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>

            {/* Team */}
            <Card>
              <h2 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: '0 0 12px' }}>Team</h2>
              {teamMembers.map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: `0.5px solid ${border}` }}>
                  <Avatar name={member.name} color={member.avatar_color} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0 }}>{member.name}</p>
                    <p style={{ fontSize: '11px', color: muted, margin: 0, textTransform: 'capitalize' }}>{member.role}</p>
                  </div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Active</span>
                </div>
              ))}
            </Card>

            {/* All open tasks */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h2 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>All open tasks</h2>
                <Link href="/dashboard/tasks" style={{ fontSize: '11px', color: '#5ba3e0', textDecoration: 'none' }}>View all</Link>
              </div>
              {allTasks.length === 0 ? (
                <p style={{ fontSize: '13px', color: muted, textAlign: 'center', padding: '20px 0' }}>No open tasks</p>
              ) : (
                allTasks.map(task => (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: `0.5px solid ${border}` }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1px solid ${border}`, flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', color: text, margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                    <StatusBadge status={task.status} />
                  </div>
                ))
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
