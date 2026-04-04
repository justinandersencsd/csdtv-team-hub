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

interface DaySchedule {
  monday: string | null
  tuesday: string | null
  wednesday: string | null
  thursday: string | null
  friday: string | null
}

interface ScheduleDefault extends DaySchedule {
  id: string
  user_id: string
}

interface ScheduleOverride extends DaySchedule {
  id: string
  user_id: string
  week_start: string
  notes: string | null
}

const DAYS: (keyof DaySchedule)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

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
  const [myDefault, setMyDefault] = useState<DaySchedule>({ monday: '', tuesday: '', wednesday: '', thursday: '', friday: '' })
  const [myOverride, setMyOverride] = useState<DaySchedule & { notes: string }>({ monday: '', tuesday: '', wednesday: '', thursday: '', friday: '', notes: '' })
  const [isMobile, setIsMobile] = useState(false)

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
      const def = (defaultsRes.data || []).find((d: ScheduleDefault) => d.user_id === userRes.data.id)
      if (def) setMyDefault({ monday: def.monday || '', tuesday: def.tuesday || '', wednesday: def.wednesday || '', thursday: def.thursday || '', friday: def.friday || '' })
      const ov = (overridesRes.data || []).find((o: ScheduleOverride) => o.user_id === userRes.data.id)
      if (ov) setMyOverride({ monday: ov.monday || '', tuesday: ov.tuesday || '', wednesday: ov.wednesday || '', thursday: ov.thursday || '', friday: ov.friday || '', notes: ov.notes || '' })
    }
    setLoading(false)
  }, [supabase, weekStr])

  useEffect(() => { loadData() }, [loadData])

  const getScheduleDay = (memberId: string, day: keyof DaySchedule): string | null => {
    const override = overrides.find(o => o.user_id === memberId)
    if (override) return override[day]
    const def = defaults.find(d => d.user_id === memberId)
    return def ? def[day] : null
  }

  const hasOverride = (memberId: string) => overrides.some(o => o.user_id === memberId)

  const saveDefault = async () => {
    if (!currentUser) return
    const existing = defaults.find(d => d.user_id === currentUser.id)
    if (existing) {
      await supabase.from('schedule_defaults').update({ ...myDefault }).eq('id', existing.id)
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
    const { notes, ...days } = myOverride
    if (existing) {
      await supabase.from('schedule_overrides').update({ ...days, notes: notes || null }).eq('id', existing.id)
      setOverrides(prev => prev.map(o => o.id === existing.id ? { ...o, ...days, notes: notes || null } : o))
    } else {
      const { data } = await supabase.from('schedule_overrides').insert({ user_id: currentUser.id, week_start: weekStr, ...days, notes: notes || null }).select().single()
      if (data) setOverrides(prev => [...prev, data])
    }
    setEditingOverride(false)
  }

  const inputStyle: React.CSSProperties = {
    background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px',
    padding: '10px 12px', fontSize: '14px', color: text, fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: '44px',
  }

  const btnStyle = (primary = false): React.CSSProperties => ({
    fontSize: '14px', padding: '10px 18px', borderRadius: '10px', minHeight: '44px',
    background: primary ? '#1e6cb5' : 'transparent',
    color: primary ? '#fff' : muted,
    border: primary ? 'none' : `0.5px solid ${border}`,
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: primary ? 500 : 400,
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: muted }}>Loading schedule...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Schedule</h1>
          <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>{formatWeek(currentMonday)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setWeekOffset(p => p - 1)} style={{ width: '44px', height: '44px', borderRadius: '10px', background: cardBg, border: `0.5px solid ${border}`, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => setWeekOffset(0)} style={{ fontSize: '13px', padding: '0 16px', height: '44px', borderRadius: '10px', background: cardBg, border: `0.5px solid ${border}`, color: weekOffset === 0 ? '#5ba3e0' : muted, cursor: 'pointer', fontFamily: 'inherit', fontWeight: weekOffset === 0 ? 600 : 400 }}>
            This week
          </button>
          <button onClick={() => setWeekOffset(p => p + 1)} style={{ width: '44px', height: '44px', borderRadius: '10px', background: cardBg, border: `0.5px solid ${border}`, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Schedule grid — desktop table, mobile cards */}
      {isMobile ? (
        /* Mobile: Show each person as a card with their week */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {team.map(member => (
            <div key={member.id} style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderBottom: `0.5px solid ${border}` }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>{member.name}</p>
                  <p style={{ fontSize: '11px', color: muted, margin: 0, textTransform: 'capitalize' as const }}>{member.role}{hasOverride(member.id) ? ' · Modified this week' : ''}</p>
                </div>
              </div>
              <div>
                {DAYS.map((day, i) => {
                  const val = getScheduleDay(member.id, day)
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < DAYS.length - 1 ? `0.5px solid ${border}` : 'none' }}>
                      <span style={{ fontSize: '13px', color: muted, minWidth: '40px' }}>{DAY_LABELS[i]}</span>
                      {val ? (
                        <span style={{ fontSize: '13px', fontWeight: 500, padding: '4px 12px', borderRadius: '8px', background: `${member.avatar_color}20`, color: member.avatar_color }}>{val}</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.2)' }}>Off / Not set</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop: Grid */
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)', borderBottom: `0.5px solid ${border}` }}>
            <div style={{ padding: '12px 14px', fontSize: '11px', color: muted, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px', background: dark ? 'rgba(255,255,255,0.02)' : '#f8f9fc' }}>Person</div>
            {DAY_FULL.map((d, i) => (
              <div key={d} style={{ padding: '12px 8px', fontSize: '11px', color: muted, fontWeight: 600, textAlign: 'center' as const, textTransform: 'uppercase' as const, letterSpacing: '0.5px', background: dark ? 'rgba(255,255,255,0.02)' : '#f8f9fc' }}>{DAY_LABELS[i]}</div>
            ))}
          </div>
          {team.map(member => (
            <div key={member.id} style={{ display: 'grid', gridTemplateColumns: '160px repeat(5, 1fr)', borderBottom: `0.5px solid ${border}` }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0 }}>{member.name.split(' ')[0]}</p>
                  {hasOverride(member.id) && <p style={{ fontSize: '9px', color: '#5ba3e0', margin: 0, fontWeight: 600 }}>MODIFIED</p>}
                </div>
              </div>
              {DAYS.map(day => {
                const val = getScheduleDay(member.id, day)
                return (
                  <div key={day} style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {val ? (
                      <span style={{ fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: '8px', background: `${member.avatar_color}22`, color: member.avatar_color, whiteSpace: 'nowrap' as const }}>{val}</span>
                    ) : (
                      <span style={{ fontSize: '11px', color: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.15)' }}>—</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* My schedule editors */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }}>

        {/* Default */}
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: 0 }}>My default schedule</h3>
              <p style={{ fontSize: '12px', color: muted, margin: '2px 0 0' }}>Repeats every week</p>
            </div>
            <button onClick={() => setEditingDefault(!editingDefault)} style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '8px', background: editingDefault ? (dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9') : 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit', minHeight: '40px' }}>
              {editingDefault ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingDefault ? (
            <div>
              {DAYS.map((day, i) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: muted, minWidth: '44px', fontWeight: 500 }}>{DAY_LABELS[i]}</span>
                  <input value={myDefault[day] || ''} onChange={e => setMyDefault(p => ({ ...p, [day]: e.target.value }))} placeholder="e.g. 9am–5pm or Off" style={inputStyle} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={saveDefault} style={btnStyle(true)}>Save default</button>
                <button onClick={() => setEditingDefault(false)} style={btnStyle()}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {DAYS.map((day, i) => {
                const def = defaults.find(d => d.user_id === currentUser?.id)
                const val = def ? def[day] : null
                return (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${border}` }}>
                    <span style={{ fontSize: '13px', color: muted }}>{DAY_FULL[i]}</span>
                    <span style={{ fontSize: '13px', fontWeight: val ? 500 : 400, color: val ? text : muted }}>{val || 'Not set'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Override */}
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: 0 }}>This week only</h3>
              <p style={{ fontSize: '12px', color: muted, margin: '2px 0 0' }}>Override your default</p>
            </div>
            <button onClick={() => setEditingOverride(!editingOverride)} style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '8px', background: editingOverride ? (dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9') : 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit', minHeight: '40px' }}>
              {editingOverride ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingOverride ? (
            <div>
              {DAYS.map((day, i) => (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: muted, minWidth: '44px', fontWeight: 500 }}>{DAY_LABELS[i]}</span>
                  <input value={myOverride[day] || ''} onChange={e => setMyOverride(p => ({ ...p, [day]: e.target.value }))} placeholder="e.g. 9am–1pm or Off" style={inputStyle} />
                </div>
              ))}
              <input value={myOverride.notes} onChange={e => setMyOverride(p => ({ ...p, notes: e.target.value }))} placeholder="Notes (e.g. WFH, Conference)" style={{ ...inputStyle, marginTop: '4px', marginBottom: '12px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveOverride} style={btnStyle(true)}>Save this week</button>
                <button onClick={() => setEditingOverride(false)} style={btnStyle()}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {DAYS.map((day, i) => {
                const ov = overrides.find(o => o.user_id === currentUser?.id)
                const val = ov ? ov[day] : null
                return (
                  <div key={day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `0.5px solid ${border}` }}>
                    <span style={{ fontSize: '13px', color: muted }}>{DAY_FULL[i]}</span>
                    <span style={{ fontSize: '13px', fontWeight: val ? 500 : 400, color: val ? '#5ba3e0' : muted }}>{val || 'Using default'}</span>
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