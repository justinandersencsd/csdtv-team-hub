'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import Link from 'next/link'

interface Production {
  id: string; title: string; production_number: number
  request_type_label: string | null; start_datetime: string | null; status: string | null
}

interface Task {
  id: string; title: string; description: string | null; status: string; priority: string
  due_date: string | null; created_at: string; assigned_to: string | null; created_by: string
  production_id: string | null; needs_equipment: boolean; notes: string | null
  completed_at: string | null
  productions?: { id: string; title: string; production_number: number; request_type_label: string | null; start_datetime: string | null; status: string | null } | null
}

interface TeamMember { id: string; name: string; role: string; avatar_color: string; email: string }
interface CurrentUser { id: string; name: string; role: string }

const PRIORITIES = ['low', 'normal', 'high', 'day of']
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:       { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  'in progress': { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  complete:      { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e' },
}
const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  'day of': { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  high:     { bg: 'rgba(249,115,22,0.15)',  color: '#f97316' },
  normal:   { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
  low:      { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
}

export default function TasksPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [tasks, setTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [allProductions, setAllProductions] = useState<Production[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<Set<string>>(new Set())
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activeTab, setActiveTab] = useState<'open' | 'completed'>('open')
  const [filter, setFilter] = useState<'all' | 'mine' | 'unassigned'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'none' | 'person' | 'status' | 'priority'>('none')
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'normal', assigned_to: '', due_date: '', production_id: '', needs_equipment: false })
  const [panelNotes, setPanelNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const panelBg = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'
  const hoverBg = dark ? 'rgba(255,255,255,0.03)' : '#f8fafc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [tasksRes, completedRes, teamRes, userRes, prodsRes] = await Promise.all([
      supabase.from('tasks').select('*, productions(id,title,production_number,request_type_label,start_datetime,status)').neq('status', 'complete').order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('tasks').select('*, productions(id,title,production_number,request_type_label,start_datetime,status)').eq('status', 'complete').order('completed_at', { ascending: false }).limit(50),
      supabase.from('team').select('*').eq('active', true),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
      supabase.from('productions').select('id,title,production_number,request_type_label,start_datetime,status').order('production_number', { ascending: false }).limit(100),
    ])
    setTasks(tasksRes.data || [])
    setCompletedTasks(completedRes.data || [])
    setTeam(teamRes.data || [])
    setCurrentUser(userRes.data)
    setAllProductions(prodsRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const getMember = (id: string | null) => id ? team.find(m => m.id === id) || null : null

  const openTask = (task: Task) => { setSelectedTask(task); setPanelNotes(task.notes || '') }
  const closePanel = () => setSelectedTask(null)

  const sendAssignEmail = useCallback(async (assigneeId: string, taskTitle: string) => {
    const assignee = team.find(m => m.id === assigneeId)
    if (!assignee || !currentUser) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          type: 'task_assigned',
          recipientEmail: assignee.email,
          recipientName: assignee.name.split(' ')[0],
          subject: `New task assigned: ${taskTitle}`,
          body: `${currentUser.name} assigned you a task: "${taskTitle}". Log in to see the details and get started.`,
          actionUrl: '/dashboard/tasks',
          actionLabel: 'View task',
        }),
      })
    } catch { /* email failure is non-critical */ }
  }, [team, currentUser, supabase])

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    await supabase.from('tasks').update(updates).eq('id', id)
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    setSelectedTask(prev => prev?.id === id ? { ...prev, ...updates } : prev)
    // Send email if assignee changed
    if (updates.assigned_to && updates.assigned_to !== selectedTask?.assigned_to) {
      const task = tasks.find(t => t.id === id)
      if (task) sendAssignEmail(updates.assigned_to, task.title)
    }
  }, [supabase, selectedTask, tasks, sendAssignEmail])

  const saveNotes = useCallback(async () => {
    if (!selectedTask) return
    setSavingNotes(true)
    await updateTask(selectedTask.id, { notes: panelNotes })
    setSavingNotes(false)
  }, [selectedTask, panelNotes, updateTask])

  const createTask = useCallback(async () => {
    if (!newTask.title || !currentUser) return
    const { data } = await supabase.from('tasks').insert({
      title: newTask.title, description: newTask.description || null,
      priority: newTask.priority, assigned_to: newTask.assigned_to || null,
      due_date: newTask.due_date || null, production_id: newTask.production_id || null,
      needs_equipment: newTask.needs_equipment, status: 'pending', created_by: currentUser.id,
    }).select('*, productions(id,title,production_number,request_type_label,start_datetime,status)').single()
    if (data) {
      setTasks(prev => [data, ...prev])
      if (newTask.assigned_to) sendAssignEmail(newTask.assigned_to, newTask.title)
      setNewTask({ title: '', description: '', priority: 'normal', assigned_to: '', due_date: '', production_id: '', needs_equipment: false })
      setShowNewTask(false)
    }
  }, [newTask, currentUser, supabase, sendAssignEmail])

  const cycleStatus = useCallback(async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = task.status === 'pending' ? 'in progress' : task.status === 'in progress' ? 'complete' : 'pending'
    await supabase.from('tasks').update({ status: next, completed_at: next === 'complete' ? new Date().toISOString() : null }).eq('id', task.id)
    if (next === 'complete') {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'complete' } : t))
      setCompleting(prev => new Set(prev).add(task.id))
      if (selectedTask?.id === task.id) closePanel()
      setTimeout(() => {
        const completed = { ...task, status: 'complete', completed_at: new Date().toISOString() }
        setCompletedTasks(prev => [completed, ...prev])
        setTasks(prev => prev.filter(t => t.id !== task.id))
        setCompleting(prev => { const n = new Set(prev); n.delete(task.id); return n })
      }, 3000)
    } else {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
      setSelectedTask(prev => prev?.id === task.id ? { ...prev, status: next } : prev)
    }
  }, [supabase, selectedTask])

  const reopenTask = useCallback(async (task: Task) => {
    await supabase.from('tasks').update({ status: 'pending', completed_at: null }).eq('id', task.id)
    setCompletedTasks(prev => prev.filter(t => t.id !== task.id))
    setTasks(prev => [{ ...task, status: 'pending', completed_at: null }, ...prev])
  }, [supabase])

  const formatDate = (d: string | null): { label: string; color: string } | null => {
    if (!d) return null
    const date = new Date(d), today = new Date()
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { label: 'Overdue', color: '#ef4444' }
    if (diff === 0) return { label: 'Today', color: '#f59e0b' }
    if (diff === 1) return { label: 'Tomorrow', color: '#f59e0b' }
    if (diff <= 7) return { label: `${diff}d`, color: muted }
    return { label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: muted }
  }

  const formatEventDate = (d: string | null) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const eventCountdown = (d: string | null): { label: string; color: string } | null => {
    if (!d) return null
    const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { label: 'Event passed', color: muted }
    if (diff === 0) return { label: 'Event is TODAY', color: '#ef4444' }
    if (diff <= 1) return { label: 'Event tomorrow', color: '#f97316' }
    if (diff <= 3) return { label: `Event in ${diff} days`, color: '#f97316' }
    if (diff <= 7) return { label: `Event in ${diff} days`, color: '#f59e0b' }
    return { label: `Event in ${diff} days`, color: muted }
  }

  const filtered = tasks.filter(t => {
    const matchFilter = filter === 'all' || (filter === 'mine' && t.assigned_to === currentUser?.id) || (filter === 'unassigned' && !t.assigned_to)
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchFilter && matchStatus
  })

  const grouped = (): { label: string | null; tasks: Task[] }[] => {
    if (groupBy === 'none') return [{ label: null, tasks: filtered }]
    if (groupBy === 'priority') {
      const order = ['day of', 'high', 'normal', 'low']
      const groups: Record<string, Task[]> = {}
      filtered.forEach(t => { if (!groups[t.priority]) groups[t.priority] = []; groups[t.priority].push(t) })
      return order.filter(p => groups[p]).map(p => ({ label: p, tasks: groups[p] }))
    }
    if (groupBy === 'person') {
      const groups: Record<string, Task[]> = {}
      filtered.forEach(t => { const n = getMember(t.assigned_to)?.name || 'Unassigned'; if (!groups[n]) groups[n] = []; groups[n].push(t) })
      return Object.entries(groups).map(([label, tasks]) => ({ label, tasks }))
    }
    if (groupBy === 'status') {
      const groups: Record<string, Task[]> = {}
      filtered.forEach(t => { if (!groups[t.status]) groups[t.status] = []; groups[t.status].push(t) })
      return Object.entries(groups).map(([label, tasks]) => ({ label, tasks }))
    }
    return [{ label: null, tasks: filtered }]
  }

  const filterBtn = (active: boolean): React.CSSProperties => ({
    fontSize: '14px', padding: '6px 14px', borderRadius: '8px', border: `0.5px solid ${border}`,
    background: active ? '#1e6cb5' : cardBg, color: active ? '#fff' : muted,
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', minHeight: '36px',
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px',
    padding: '9px 12px', fontSize: '14px', color: text, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading tasks...</p></div>

  const openCount = filtered.filter(t => !completing.has(t.id)).length

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: text, margin: 0 }}>Tasks</h1>
            <p style={{ fontSize: '14px', color: muted, margin: '2px 0 0' }}>{openCount} open · {completedTasks.length} completed</p>
          </div>
          <button onClick={() => setShowNewTask(!showNewTask)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', padding: '10px 18px', borderRadius: '10px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New task
          </button>
        </div>

        {/* Tabs: Open / Completed */}
        <div style={{ display: 'flex', borderBottom: `0.5px solid ${border}`, marginBottom: '16px' }}>
          {([['open', `Open (${openCount})`], ['completed', `Completed (${completedTasks.length})`]] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ fontSize: '14px', padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: activeTab === tab ? '#5ba3e0' : muted, borderBottom: activeTab === tab ? '2px solid #1e6cb5' : '2px solid transparent', fontWeight: activeTab === tab ? 500 : 400 }}>
              {label}
            </button>
          ))}
        </div>

        {/* New task form */}
        {showNewTask && (
          <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 14px' }}>New task</h3>
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title" style={{ ...inputStyle, marginBottom: '8px' }} />
            <textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' as const, marginBottom: '8px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '8px' }}>
              <select value={newTask.assigned_to} onChange={e => setNewTask(p => ({ ...p, assigned_to: e.target.value }))} style={inputStyle}>
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={inputStyle}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p === 'day of' ? 'Day of event' : p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
              <input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} style={inputStyle} />
            </div>
            <select value={newTask.production_id} onChange={e => setNewTask(p => ({ ...p, production_id: e.target.value }))} style={{ ...inputStyle, marginBottom: '10px' }}>
              <option value="">Not linked to a production</option>
              {allProductions.map(p => <option key={p.id} value={p.id}>#{p.production_number} — {p.title}</option>)}
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <input type="checkbox" id="needs_equipment" checked={newTask.needs_equipment} onChange={e => setNewTask(p => ({ ...p, needs_equipment: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="needs_equipment" style={{ fontSize: '14px', color: muted, cursor: 'pointer' }}>Needs equipment pulled</label>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={createTask} style={{ fontSize: '14px', padding: '8px 18px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Create task</button>
              <button onClick={() => setShowNewTask(false)} style={{ fontSize: '14px', padding: '8px 18px', borderRadius: '8px', background: 'transparent', color: muted, border: `0.5px solid ${border}`, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* OPEN TAB */}
        {activeTab === 'open' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <button style={filterBtn(filter === 'all')} onClick={() => setFilter('all')}>All</button>
              <button style={filterBtn(filter === 'mine')} onClick={() => setFilter('mine')}>Mine</button>
              <button style={filterBtn(filter === 'unassigned')} onClick={() => setFilter('unassigned')}>Unassigned</button>
              <div style={{ width: '1px', background: border, margin: '0 4px' }} />
              <button style={filterBtn(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>All status</button>
              <button style={filterBtn(statusFilter === 'pending')} onClick={() => setStatusFilter('pending')}>Pending</button>
              <button style={filterBtn(statusFilter === 'in progress')} onClick={() => setStatusFilter('in progress')}>In progress</button>
              <div style={{ width: '1px', background: border, margin: '0 4px' }} />
              <button style={filterBtn(groupBy === 'none')} onClick={() => setGroupBy('none')}>No grouping</button>
              <button style={filterBtn(groupBy === 'priority')} onClick={() => setGroupBy('priority')}>Priority</button>
              <button style={filterBtn(groupBy === 'person')} onClick={() => setGroupBy('person')}>Person</button>
              <button style={filterBtn(groupBy === 'status')} onClick={() => setGroupBy('status')}>Status</button>
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ color: muted, fontSize: '15px' }}>No tasks match your filters</p>
              </div>
            ) : grouped().map(({ label, tasks: groupTasks }) => (
              <div key={label || 'all'} style={{ marginBottom: '16px' }}>
                {label && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: PRIORITY_STYLES[label]?.color || muted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                      {label === 'day of' ? '🎬 Day of event' : label}
                    </span>
                    <span style={{ fontSize: '12px', color: muted }}>· {groupTasks.length}</span>
                  </div>
                )}
                <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
                  {groupTasks.map((task, i) => {
                    const isCompleting = completing.has(task.id)
                    const isSelected = selectedTask?.id === task.id
                    const dateInfo = formatDate(task.due_date)
                    const statusStyle = STATUS_STYLES[task.status] || STATUS_STYLES['pending']
                    const priorityStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES['normal']
                    const assignee = getMember(task.assigned_to)
                    return (
                      <div key={task.id} onClick={() => !isCompleting && openTask(task)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < groupTasks.length - 1 ? `0.5px solid ${border}` : 'none', background: isSelected ? (dark ? 'rgba(30,108,181,0.12)' : 'rgba(30,108,181,0.06)') : isCompleting ? 'rgba(34,197,94,0.06)' : 'transparent', cursor: isCompleting ? 'default' : 'pointer', transition: 'background 0.15s', opacity: isCompleting ? 0.7 : 1, borderLeft: isSelected ? '3px solid #1e6cb5' : '3px solid transparent' }}
                        onMouseEnter={e => { if (!isSelected && !isCompleting) (e.currentTarget as HTMLDivElement).style.background = hoverBg }}
                        onMouseLeave={e => { if (!isSelected && !isCompleting) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      >
                        <button onClick={e => cycleStatus(task, e)} style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, border: `1.5px solid ${isCompleting || task.status === 'complete' ? '#22c55e' : task.status === 'in progress' ? '#f59e0b' : border}`, background: isCompleting || task.status === 'complete' ? '#22c55e' : task.status === 'in progress' ? 'rgba(245,158,11,0.15)' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                          {(isCompleting || task.status === 'complete') && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '15px', color: isCompleting ? muted : text, margin: 0, fontWeight: 500, textDecoration: isCompleting ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {task.needs_equipment && <span style={{ marginRight: '5px' }}>📦</span>}
                            {task.title}
                          </p>
                          {task.productions?.title && <p style={{ fontSize: '13px', color: '#5ba3e0', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>🎬 #{task.productions.production_number} {task.productions.title}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {isCompleting ? <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 500 }}>Done ✓</span> : (
                            <>
                              {task.priority !== 'normal' && <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: priorityStyle.bg, color: priorityStyle.color, whiteSpace: 'nowrap' as const }}>{task.priority === 'day of' ? 'Day of' : task.priority}</span>}
                              <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: statusStyle.bg, color: statusStyle.color }}>{task.status}</span>
                              {dateInfo && <span style={{ fontSize: '13px', color: dateInfo.color, fontWeight: 500, minWidth: '52px', textAlign: 'right' as const }}>{dateInfo.label}</span>}
                            </>
                          )}
                          {assignee ? (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: assignee.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>{assignee.name.slice(0, 2).toUpperCase()}</div>
                          ) : <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `1.5px dashed ${border}`, flexShrink: 0 }} />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* COMPLETED TAB */}
        {activeTab === 'completed' && (
          <div>
            {completedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <p style={{ fontSize: '15px', color: muted }}>No completed tasks yet</p>
              </div>
            ) : (
              <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
                {completedTasks.map((task, i) => {
                  const assignee = getMember(task.assigned_to)
                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < completedTasks.length - 1 ? `0.5px solid ${border}` : 'none' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, border: '1.5px solid #22c55e', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', color: muted, margin: 0, textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{task.title}</p>
                        {task.productions?.title && <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0', opacity: 0.7 }}>#{task.productions.production_number} {task.productions.title}</p>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        {task.completed_at && <span style={{ fontSize: '13px', color: muted }}>{new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        {assignee && <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: assignee.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#0a0f1e' }}>{assignee.name.slice(0, 2).toUpperCase()}</div>}
                        <button onClick={() => reopenTask(task)} style={{ fontSize: '13px', padding: '4px 12px', borderRadius: '6px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>Reopen</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <div style={{ width: '360px', flexShrink: 0, position: 'sticky', top: '80px', background: panelBg, border: `0.5px solid ${border}`, borderRadius: '14px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `0.5px solid ${border}` }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: muted, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Task detail</span>
            <button onClick={closePanel} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ padding: '18px' }}>
            <p style={{ fontSize: '17px', fontWeight: 600, color: text, margin: '0 0 18px', lineHeight: 1.3 }}>{selectedTask.title}</p>

            {selectedTask.productions && (
              <div style={{ background: dark ? 'rgba(91,163,224,0.08)' : 'rgba(30,108,181,0.06)', border: '0.5px solid rgba(30,108,181,0.2)', borderRadius: '10px', padding: '13px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', color: '#5ba3e0', fontWeight: 700, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>🎬 Linked production</p>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>#{selectedTask.productions.production_number} — {selectedTask.productions.title}</p>
                    {selectedTask.productions.request_type_label && <p style={{ fontSize: '13px', color: muted, margin: '0 0 6px' }}>{selectedTask.productions.request_type_label}</p>}
                    {selectedTask.productions.start_datetime && <p style={{ fontSize: '13px', color: muted, margin: '0 0 4px' }}>📅 {formatEventDate(selectedTask.productions.start_datetime)}</p>}
                    {(() => { const c = eventCountdown(selectedTask.productions.start_datetime); return c ? <p style={{ fontSize: '13px', fontWeight: 600, color: c.color, margin: 0 }}>⏱ {c.label}</p> : null })()}
                  </div>
                  <Link href={`/dashboard/productions/${selectedTask.productions.id}`} style={{ fontSize: '13px', color: '#5ba3e0', textDecoration: 'none', padding: '5px 12px', borderRadius: '6px', border: '0.5px solid rgba(30,108,181,0.3)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>Open →</Link>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <p style={{ fontSize: '12px', color: muted, margin: '0 0 4px' }}>Status</p>
                <select value={selectedTask.status} onChange={e => updateTask(selectedTask.id, { status: e.target.value })} style={{ ...inputStyle, fontSize: '14px' }}>
                  <option value="pending">Pending</option>
                  <option value="in progress">In progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
              <div>
                <p style={{ fontSize: '12px', color: muted, margin: '0 0 4px' }}>Priority</p>
                <select value={selectedTask.priority} onChange={e => updateTask(selectedTask.id, { priority: e.target.value })} style={{ ...inputStyle, fontSize: '14px' }}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p === 'day of' ? 'Day of event' : p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '12px', color: muted, margin: '0 0 4px' }}>Assigned to</p>
              <select value={selectedTask.assigned_to || ''} onChange={e => updateTask(selectedTask.id, { assigned_to: e.target.value || null })} style={{ ...inputStyle, fontSize: '14px' }}>
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <p style={{ fontSize: '12px', color: muted, margin: '0 0 4px' }}>Due date</p>
              <input type="date" value={selectedTask.due_date || ''} onChange={e => updateTask(selectedTask.id, { due_date: e.target.value || null })} style={{ ...inputStyle, fontSize: '14px' }} />
            </div>

            {!selectedTask.productions && (
              <div style={{ marginBottom: '14px' }}>
                <p style={{ fontSize: '12px', color: muted, margin: '0 0 4px' }}>Link to production</p>
                <select value={selectedTask.production_id || ''} onChange={e => updateTask(selectedTask.id, { production_id: e.target.value || null })} style={{ ...inputStyle, fontSize: '14px' }}>
                  <option value="">No production linked</option>
                  {allProductions.map(p => <option key={p.id} value={p.id}>#{p.production_number} — {p.title}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', padding: '11px 13px', background: selectedTask.needs_equipment ? 'rgba(249,115,22,0.1)' : inputBg, borderRadius: '8px', border: `0.5px solid ${selectedTask.needs_equipment ? 'rgba(249,115,22,0.3)' : border}`, cursor: 'pointer' }}
              onClick={() => updateTask(selectedTask.id, { needs_equipment: !selectedTask.needs_equipment })}>
              <input type="checkbox" checked={selectedTask.needs_equipment} onChange={() => {}} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <span style={{ fontSize: '14px', color: selectedTask.needs_equipment ? '#f97316' : muted, fontWeight: selectedTask.needs_equipment ? 600 : 400 }}>📦 Needs equipment pulled</span>
            </div>

            {selectedTask.description && (
              <div style={{ marginBottom: '18px' }}>
                <p style={{ fontSize: '12px', color: muted, margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Description</p>
                <p style={{ fontSize: '14px', color: text, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>{selectedTask.description}</p>
              </div>
            )}

            <div>
              <p style={{ fontSize: '12px', color: muted, margin: '0 0 6px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Notes</p>
              <textarea value={panelNotes} onChange={e => setPanelNotes(e.target.value)} placeholder="Add internal notes..." style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' as const, lineHeight: 1.5, marginBottom: '8px' }} />
              <button onClick={saveNotes} disabled={savingNotes} style={{ fontSize: '14px', padding: '8px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: savingNotes ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                {savingNotes ? 'Saving...' : 'Save notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}