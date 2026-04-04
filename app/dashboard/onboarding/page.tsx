'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface OnboardingTask {
  id: string
  title: string
  description: string | null
  week: number
  sort_order: number
  completed: boolean
  completed_at: string | null
  assigned_to: string
  assignee?: { name: string; avatar_color: string } | null
}

interface TeamMember {
  id: string
  name: string
  avatar_color: string
  role: string
}

interface CurrentUser {
  id: string
  name: string
  role: string
}

export default function OnboardingPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [tasks, setTasks] = useState<OnboardingTask[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', week: 1, assigned_to: '' })

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [tasksRes, teamRes, userRes] = await Promise.all([
      supabase.from('onboarding_tasks').select('*, assignee:team(name, avatar_color)').order('week').order('sort_order'),
      supabase.from('team').select('*').eq('active', true),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
    ])
    setTasks(tasksRes.data || [])
    setTeam(teamRes.data || [])
    setCurrentUser(userRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const toggleTask = useCallback(async (task: OnboardingTask) => {
    const completed = !task.completed
    await supabase.from('onboarding_tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed, completed_at: completed ? new Date().toISOString() : null } : t))
  }, [supabase])

  const addTask = useCallback(async () => {
    if (!newTask.title || !newTask.assigned_to) return
    const { data } = await supabase.from('onboarding_tasks').insert({ title: newTask.title, description: newTask.description || null, week: newTask.week, assigned_to: newTask.assigned_to, sort_order: tasks.filter(t => t.week === newTask.week).length }).select('*, assignee:team(name, avatar_color)').single()
    if (data) { setTasks(prev => [...prev, data]); setNewTask({ title: '', description: '', week: 1, assigned_to: '' }); setShowAddTask(false) }
  }, [newTask, tasks, supabase])

  const isManager = currentUser?.role === 'Manager'
  const week1 = tasks.filter(t => t.week === 1)
  const week2 = tasks.filter(t => t.week === 2)
  const totalDone = tasks.filter(t => t.completed).length
  const progress = tasks.length > 0 ? Math.round((totalDone / tasks.length) * 100) : 0

  const inputStyle: React.CSSProperties = { background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '15px', color: text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading onboarding...</p></div>

  const WeekSection = ({ weekNum, weekTasks }: { weekNum: number; weekTasks: OnboardingTask[] }) => {
    const done = weekTasks.filter(t => t.completed).length
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: 0 }}>Week {weekNum}</h2>
          <span style={{ fontSize: '13px', color: muted }}>{done} of {weekTasks.length} complete</span>
          <div style={{ flex: 1, height: '4px', background: dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', borderRadius: '2px', overflow: 'hidden', maxWidth: '100px' }}>
            <div style={{ width: `${weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : 0}%`, height: '100%', background: '#1e6cb5', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>
        {weekTasks.length === 0 ? (
          <p style={{ color: muted, fontSize: '15px', padding: '16px', background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px' }}>No tasks for week {weekNum} yet</p>
        ) : (
          <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
            {weekTasks.map((task, i) => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderBottom: i < weekTasks.length - 1 ? `0.5px solid ${border}` : 'none', background: task.completed ? (dark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.03)') : 'transparent' }}>
                <button
                  onClick={() => toggleTask(task)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${task.completed ? '#22c55e' : border}`, background: task.completed ? '#22c55e' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}
                >
                  {task.completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </button>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '15px', fontWeight: 500, color: task.completed ? muted : text, margin: 0, textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</p>
                  {task.description && <p style={{ fontSize: '13px', color: muted, margin: '3px 0 0', lineHeight: 1.4 }}>{task.description}</p>}
                </div>
                {task.assignee && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: task.assignee.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, color: '#0a0f1e' }}>
                      {task.assignee.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '13px', color: muted }}>{task.assignee.name.split(' ')[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Onboarding</h1>
          <p style={{ fontSize: '15px', color: muted, margin: '2px 0 0' }}>Two week intern onboarding checklist</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '80px', height: '6px', background: dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#22c55e' : '#1e6cb5', borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: '14px', color: muted }}>{totalDone}/{tasks.length}</span>
          </div>
          {isManager && (
            <button onClick={() => setShowAddTask(!showAddTask)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', padding: '8px 14px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add task
            </button>
          )}
        </div>
      </div>

      {showAddTask && isManager && (
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: '0 0 12px' }}>Add onboarding task</h3>
          <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title" style={{ ...inputStyle, marginBottom: '8px' }} />
          <input value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" style={{ ...inputStyle, marginBottom: '8px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <select value={newTask.week} onChange={e => setNewTask(p => ({ ...p, week: parseInt(e.target.value) }))} style={inputStyle}>
              <option value={1}>Week 1</option>
              <option value={2}>Week 2</option>
            </select>
            <select value={newTask.assigned_to} onChange={e => setNewTask(p => ({ ...p, assigned_to: e.target.value }))} style={inputStyle}>
              <option value="">Assign to...</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addTask} style={{ fontSize: '15px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Add task</button>
            <button onClick={() => setShowAddTask(false)} style={{ fontSize: '15px', padding: '7px 16px', borderRadius: '8px', background: 'transparent', color: muted, border: `0.5px solid ${border}`, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      <WeekSection weekNum={1} weekTasks={week1} />
      <WeekSection weekNum={2} weekTasks={week2} />
    </div>
  )
}