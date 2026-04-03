'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  created_at: string
  assigned_to: string | null
  created_by: string
  production_id: string | null
  productions?: { title: string } | null
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

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:       { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'in progress': { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  complete:      { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  high:   { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  normal: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
  low:    { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
}

export default function TasksPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'none' | 'person' | 'status'>('none')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', assigned_to: '', due_date: '' })

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [tasksRes, teamRes, userRes] = await Promise.all([
      // Use column hint to disambiguate the foreign key join
      supabase
        .from('tasks')
        .select('*, productions(title)')
        .neq('status', 'complete')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('team').select('*').eq('active', true),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
    ])

    setTasks(tasksRes.data || [])
    setTeam(teamRes.data || [])
    setCurrentUser(userRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Look up team member by ID from the team array we already loaded
  const getMember = (id: string | null): TeamMember | null => {
    if (!id) return null
    return team.find(m => m.id === id) || null
  }

  const createTask = useCallback(async () => {
    if (!newTask.title || !currentUser) return
    const { data } = await supabase
      .from('tasks')
      .insert({
        title: newTask.title,
        description: newTask.description || null,
        priority: newTask.priority,
        assigned_to: newTask.assigned_to || null,
        due_date: newTask.due_date || null,
        status: 'pending',
        created_by: currentUser.id,
      })
      .select('*, productions(title)')
      .single()
    if (data) {
      setTasks(prev => [data, ...prev])
      setNewTask({ title: '', description: '', priority: 'normal', assigned_to: '', due_date: '' })
      setShowNewTask(false)
    }
  }, [newTask, currentUser, supabase])

  const cycleStatus = useCallback(async (task: Task) => {
    const next = task.status === 'pending' ? 'in progress' : task.status === 'in progress' ? 'complete' : 'pending'
    await supabase
      .from('tasks')
      .update({ status: next, completed_at: next === 'complete' ? new Date().toISOString() : null })
      .eq('id', task.id)
    if (next === 'complete') {
      setTasks(prev => prev.filter(t => t.id !== task.id))
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    }
  }, [supabase])

  const formatDate = (d: string | null): { label: string; color: string } | null => {
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

  const filtered = tasks.filter(t => {
    const matchFilter =
      filter === 'all' ||
      (filter === 'mine' && t.assigned_to === currentUser?.id) ||
      (filter === 'unassigned' && !t.assigned_to)
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchFilter && matchStatus
  })

  const grouped = (): { label: string | null; tasks: Task[] }[] => {
    if (groupBy === 'none') return [{ label: null, tasks: filtered }]
    if (groupBy === 'status') {
      const groups: Record<string, Task[]> = {}
      filtered.forEach(t => {
        if (!groups[t.status]) groups[t.status] = []
        groups[t.status].push(t)
      })
      return Object.entries(groups).map(([label, tasks]) => ({ label, tasks }))
    }
    if (groupBy === 'person') {
      const groups: Record<string, Task[]> = {}
      filtered.forEach(t => {
        const name = getMember(t.assigned_to)?.name || 'Unassigned'
        if (!groups[name]) groups[name] = []
        groups[name].push(t)
      })
      return Object.entries(groups).map(([label, tasks]) => ({ label, tasks }))
    }
    return [{ label: null, tasks: filtered }]
  }

  const filterBtn = (active: boolean): React.CSSProperties => ({
    fontSize: '12px', padding: '5px 12px', borderRadius: '8px',
    border: `0.5px solid ${border}`,
    background: active ? '#1e6cb5' : cardBg,
    color: active ? '#fff' : muted,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', background: inputBg, border: `0.5px solid ${border}`,
    borderRadius: '8px', padding: '8px 12px', fontSize: '13px',
    color: text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  const TaskRow = ({ task }: { task: Task }) => {
    const dateInfo = formatDate(task.due_date)
    const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES['pending']
    const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES['normal']
    const assignee = getMember(task.assigned_to)

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: `0.5px solid ${border}`, flexWrap: 'wrap' }}>
        <button
          onClick={() => cycleStatus(task)}
          style={{
            width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
            border: `1.5px solid ${task.status === 'complete' ? '#22c55e' : task.status === 'in progress' ? '#f59e0b' : border}`,
            background: task.status === 'complete' ? '#22c55e' : task.status === 'in progress' ? 'rgba(245,158,11,0.15)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {task.status === 'complete' && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <p style={{ fontSize: '13px', color: text, margin: 0, fontWeight: 500 }}>{task.title}</p>
          {task.productions?.title && (
            <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0' }}>{task.productions.title}</p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
          {task.priority !== 'normal' && (
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px', background: priorityStyle.bg, color: priorityStyle.color }}>
              {task.priority}
            </span>
          )}
          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px', background: statusStyle.bg, color: statusStyle.color }}>
            {task.status}
          </span>
          {dateInfo && (
            <span style={{ fontSize: '11px', color: dateInfo.color, minWidth: '50px', textAlign: 'right' as const }}>
              {dateInfo.label}
            </span>
          )}
          {assignee ? (
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: assignee.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
              {assignee.name.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `1.5px dashed ${border}`, flexShrink: 0 }} />
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: muted, fontSize: '14px' }}>Loading tasks...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Tasks</h1>
          <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>{filtered.length} open tasks</p>
        </div>
        <button
          onClick={() => setShowNewTask(!showNewTask)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New task
        </button>
      </div>

      {showNewTask && (
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: '0 0 12px' }}>New task</h3>
          <input
            value={newTask.title}
            onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
            placeholder="Task title"
            style={{ ...inputStyle, marginBottom: '8px' }}
          />
          <textarea
            value={newTask.description}
            onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
            placeholder="Description (optional)"
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' as const, marginBottom: '8px' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '12px' }}>
            <select value={newTask.assigned_to} onChange={e => setNewTask(p => ({ ...p, assigned_to: e.target.value }))} style={inputStyle}>
              <option value="">Unassigned</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={inputStyle}>
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
            </select>
            <input
              type="date"
              value={newTask.due_date}
              onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createTask} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              Create task
            </button>
            <button onClick={() => setShowNewTask(false)} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: 'transparent', color: muted, border: `0.5px solid ${border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <button style={filterBtn(filter === 'all')} onClick={() => setFilter('all')}>All</button>
        <button style={filterBtn(filter === 'mine')} onClick={() => setFilter('mine')}>Mine</button>
        <button style={filterBtn(filter === 'unassigned')} onClick={() => setFilter('unassigned')}>Unassigned</button>
        <div style={{ width: '1px', background: border, margin: '0 4px' }} />
        <button style={filterBtn(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>All status</button>
        <button style={filterBtn(statusFilter === 'pending')} onClick={() => setStatusFilter('pending')}>Pending</button>
        <button style={filterBtn(statusFilter === 'in progress')} onClick={() => setStatusFilter('in progress')}>In progress</button>
        <div style={{ width: '1px', background: border, margin: '0 4px' }} />
        <button style={filterBtn(groupBy === 'none')} onClick={() => setGroupBy('none')}>No grouping</button>
        <button style={filterBtn(groupBy === 'person')} onClick={() => setGroupBy('person')}>By person</button>
        <button style={filterBtn(groupBy === 'status')} onClick={() => setGroupBy('status')}>By status</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: muted, fontSize: '14px' }}>No tasks match your filters</p>
        </div>
      ) : (
        grouped().map(({ label, tasks: groupTasks }) => (
          <div key={label || 'all'} style={{ marginBottom: '16px' }}>
            {label && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: muted, textTransform: 'capitalize' as const }}>{label}</span>
                <span style={{ fontSize: '11px', color: muted }}>· {groupTasks.length}</span>
              </div>
            )}
            <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
              {groupTasks.map(task => <TaskRow key={task.id} task={task} />)}
            </div>
          </div>
        ))
      )}
    </div>
  )
}