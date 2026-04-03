'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface TeamMember {
  id: string
  name: string
  role: string
  avatar_color: string
}

interface ScheduleDefault {
  id: string
  user_id: string
  monday: string | null
  tuesday: string | null
  wednesday: string | null
  thursday: string | null
  friday: string | null
}

interface ScheduleOverride {
  id: string
  user_id: string
  week_start: string
  monday: string | null
  tuesday: string | null
  wednesday: string | null
  thursday: string | null
  friday: string | null
  notes: string | null
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatWeek(monday: Date): string {
  const friday = new Date(monday)
  friday.setDate(friday.getDate() + 4)
  return `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${friday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function SchedulePage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [defaults, setDefaults] = useState<ScheduleDefault[]>([])
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([])
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [editingDefault, setEditingDefault] = useState(false)
  const [editingOverride, setEditingOverride] = useState(false)
  const [myDefault, setMyDefault] = useState<Record<string, string>>({ monday: '', tuesday: '', wednesday: '', thursday: '', friday: '' })
  const [myOverride, setMyOverride] = useState<Record<string, string>>({ monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', notes: '' })

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const currentMonday = getMonday(new Date())
  currentMonday.setDate(currentMonday.getDate() + weekOffset * 7)
  const weekStr = currentMonday.toISOString().split('T')[0]

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [teamRes, userRes, defaultsRes, overridesRes] = await Promise.all([
      supabase.from('team').select('*').eq('active', true),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
      supabase.from('schedule_defaults').select('*'),
      supabase.from('schedule_overrides').select('*').eq('week_start', weekStr),
    ])
    setTeam(teamRes.data || [])
    setCurrentUser(userRes.data)
    setDefaults(defaultsRes.data || [])
    setOverrides(overridesRes.data || [])
    if (userRes.data) {
      const def = defaultsRes.data?.find(d => d.user_id === userRes.data.id)
      if (def) setMyDefault({ monday: def.monday || '', tuesday: def.tuesday || '', wednesday: def.wednesday || '', thursday: def.thursday || '', friday: def.friday || '' })
      const ov = overridesRes.data?.find(o => o.user_id === userRes.data.id)
      if (ov) setMyOverride({ monday: ov.monday || '', tuesday: ov.tuesday || '', wednesday: ov.wednesday || '', thursday: ov.thursday || '', friday: ov.friday || '', notes: ov.notes || '' })
    }
    setLoading(false)
  }, [supabase, weekStr])

  useEffect(() => { loadData() }, [loadData])

  const getSchedule = (memberId: string) => {
    const override = overrides.find(o => o.user_id === memberId)
    if (override) return override
    const def = defaults.find(d => d.user_id === memberId)
    return def || null
  }

  const saveDefault = async () => {
    if (!currentUser) return
    const existing = defaults.find(d => d.user_id === currentUser.id)
    if (existing) {
      await supabase.from('schedule_defaults').update({ ...myDefault, updated_at: new Date().toISOString() }).eq('id', existing.id)
      setDefaults(prev => prev.map(d => d.id === existing.id ? { ...d, ...myDefault } : d))
    } else {
      const { data } = await supabase.from('schedule_defaults').insert({ user_id: currentUser.id, ...myDefault }).select().single()
      if (data) setDefaults(prev => [...prev, data])
    }
    setEditingDefault(false)
  }

  const saveOverride = async () => {
    if (!currentUser) return
    const existing = overrides.find(o => o.user_id === currentUser.id)
    const payload = { user_id: currentUser.id, week_start: weekStr, ...myOverride }
    if (existing) {
      await supabase.from('schedule_overrides').update({ ...myOverride, updated_at: new Date().toISOString() }).eq('id', existing.id)
      setOverrides(prev => prev.map(o => o.id === existing.id ? { ...o, ...myOverride } : o))
    } else {
      const { data } = await supabase.from('schedule_overrides').insert(payload).select().single()
      if (data) setOverrides(prev => [...prev, data])
    }
    setEditingOverride(false)
  }

  const cellValue = (schedule: ScheduleDefault | ScheduleOverride | null, day: string) => {
    if (!schedule) return null
return (schedule as unknown as Record<string, string | null>)[day] || null
  }

  const inputStyle = { background: inputBg, border: `0.5px solid ${border}`, borderRadius: '6px', padding: '5px 8px', fontSize: '12px', color: text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading schedule...</p></div>

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Schedule</h1>
          <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>{formatWeek(currentMonday)}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setWeekOffset(p => p - 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: cardBg, border: `0.5px solid ${border}`, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => setWeekOffset(0)} style={{ fontSize: '12px', padding: '0 12px', height: '32px', borderRadius: '8px', background: cardBg, border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>This week</button>
          <button onClick={() => setWeekOffset(p => p + 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: cardBg, border: `0.5px solid ${border}`, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Team schedule grid */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(5, 1fr)', borderBottom: `0.5px solid ${border}` }}>
          <div style={{ padding: '10px 14px', fontSize: '11px', color: muted, fontWeight: 500, background: dark ? 'rgba(255,255,255,0.02)' : '#f8f9fc' }}>Person</div>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ padding: '10px 8px', fontSize: '11px', color: muted, fontWeight: 500, textAlign: 'center', background: dark ? 'rgba(255,255,255,0.02)' : '#f8f9fc' }}>{d}</div>
          ))}
        </div>
        {team.map(member => {
          const schedule = getSchedule(member.id)
          const hasOverride = overrides.some(o => o.user_id === member.id)
          return (
            <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '140px repeat(5, 1fr)', borderBottom: `0.5px solid ${border}` }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: text, margin: 0 }}>{member.name.split(' ')[0]}</p>
                  {hasOverride && <p style={{ fontSize: '9px', color: '#5ba3e0', margin: 0 }}>modified</p>}
                </div>
              </div>
              {DAYS.map(day => {
                const val = cellValue(schedule, day)
                return (
                  <div key={day} style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {val ? (
                      <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '6px', background: `${member.avatar_color}20`, color: member.avatar_color, whiteSpace: 'nowrap' }}>{val}</span>
                    ) : (
                      <span style={{ fontSize: '11px', color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)' }}>—</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* My schedule actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

        {/* Default schedule */}
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>My default schedule</h3>
              <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0' }}>Repeats every week unless overridden</p>
            </div>
            <button onClick={() => setEditingDefault(!editingDefault)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>
              {editingDefault ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingDefault ? (
            <div>
              {DAYS.map((day, i) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: muted, minWidth: '36px' }}>{DAY_LABELS[i]}</span>
                  <input value={myDefault[day]} onChange={e => setMyDefault(p => ({ ...p, [day]: e.target.value }))} placeholder="e.g. 8am–5pm or Off" style={inputStyle} />
                </div>
              ))}
              <button onClick={saveDefault} style={{ marginTop: '8px', fontSize: '12px', padding: '6px 14px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save default</button>
            </div>
          ) : (
            <div>
              {DAYS.map((day, i) => {
                const def = defaults.find(d => d.user_id === currentUser?.id)
                const val = def ? (def as unknown as Record<string, string | null>)[day] : null
                return (
                  <div key={day} style={{ display: 'flex', gap: '10px', padding: '5px 0', borderBottom: `0.5px solid ${border}`, fontSize: '12px' }}>
                    <span style={{ color: muted, minWidth: '36px' }}>{DAY_LABELS[i]}</span>
                    <span style={{ color: val ? text : muted }}>{val || 'Not set'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* This week override */}
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>This week only</h3>
              <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0' }}>Override your default for this week</p>
            </div>
            <button onClick={() => setEditingOverride(!editingOverride)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>
              {editingOverride ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingOverride ? (
            <div>
              {DAYS.map((day, i) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: muted, minWidth: '36px' }}>{DAY_LABELS[i]}</span>
                  <input value={myOverride[day]} onChange={e => setMyOverride(p => ({ ...p, [day]: e.target.value }))} placeholder="e.g. 9am–1pm or Off" style={inputStyle} />
                </div>
              ))}
              <input value={myOverride.notes} onChange={e => setMyOverride(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (optional)" style={{ ...inputStyle, marginTop: '4px', marginBottom: '8px' }} />
              <button onClick={saveOverride} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save this week</button>
            </div>
          ) : (
            <div>
              {DAYS.map((day, i) => {
                const ov = overrides.find(o => o.user_id === currentUser?.id)
                const val = ov ? (ov as unknown as Record<string, string | null>)[day] : null
                return (
                  <div key={day} style={{ display: 'flex', gap: '10px', padding: '5px 0', borderBottom: `0.5px solid ${border}`, fontSize: '12px' }}>
                    <span style={{ color: muted, minWidth: '36px' }}>{DAY_LABELS[i]}</span>
                    <span style={{ color: val ? '#5ba3e0' : muted }}>{val || 'Using default'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}