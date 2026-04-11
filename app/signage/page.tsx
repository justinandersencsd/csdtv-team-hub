'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Production {
  id: string; production_number: number; title: string
  request_type_label: string | null; status: string | null; school_year: string | null
  start_datetime: string | null; filming_location: string | null
  production_members?: { user_id: string; team: { name: string; avatar_color: string } | null }[]
}
interface TeamMember { id: string; name: string; avatar_color: string; role: string }
interface SchedDefault { id: string; user_id: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string }
interface SchedOverride { id: string; user_id: string; week_start: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string }

const TYPE_COLORS: Record<string, string> = {
  'Photo Headshots': '#e8a020', 'Create a Video(Film, Edit, Publish)': '#5ba3e0', 'LiveStream Meeting': '#22c55e',
  'Record Meeting': '#9b85e0', 'Podcast': '#f97316', 'Board Meeting': '#ef4444',
  'Other, Unsure, Or Consultation': '#64748b',
}
const TYPE_SHORT: Record<string, string> = {
  'Photo Headshots': 'Photo', 'Create a Video(Film, Edit, Publish)': 'Video', 'LiveStream Meeting': 'Livestream',
  'Record Meeting': 'Recording', 'Podcast': 'Podcast', 'Board Meeting': 'Board Mtg',
  'Other, Unsure, Or Consultation': 'Other',
}
const STATUS_COLORS: Record<string, string> = {
  'Approved/Scheduled': '#22c55e', 'In Progress': '#f59e0b', 'Complete': '#6b7280',
  'Idea/Request': '#a855f7', 'Cancelled': '#ef4444',
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DOW_KEYS_MAP: Record<number, string> = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' }
const GRID_COLS = '70px 0.6fr repeat(5, 1fr) 0.6fr'

function getSunday(d: Date): Date {
  const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); dt.setHours(0, 0, 0, 0); return dt
}
function getMondayStr(d: Date): string {
  const dt = new Date(d); const day = dt.getDay(); const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function getInitials(name: string) {
  const p = name.split(' ')
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}

export default function SignagePage() {
  const supabase = createClient()
  const [now, setNow] = useState(new Date())
  const [productions, setProductions] = useState<Production[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [schedDefaults, setSchedDefaults] = useState<SchedDefault[]>([])
  const [schedOverrides, setSchedOverrides] = useState<SchedOverride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])

  const loadData = useCallback(async () => {
    const [prodsRes, teamRes, defsRes, ovrsRes] = await Promise.all([
      supabase.from('productions').select('id, production_number, title, request_type_label, status, school_year, start_datetime, filming_location, production_members(user_id, team(name, avatar_color))').not('start_datetime', 'is', null).order('start_datetime'),
      supabase.from('team').select('id, name, avatar_color, role').eq('active', true),
      supabase.from('schedule_defaults').select('*'),
      supabase.from('schedule_overrides').select('*'),
    ])
    setProductions((prodsRes.data as any) || [])
    setTeam(teamRes.data || [])
    setSchedDefaults(defsRes.data || [])
    setSchedOverrides(ovrsRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { const r = setInterval(() => loadData(), 300000); return () => clearInterval(r) }, [loadData])

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sunday = getSunday(today)

  // 5 weeks: Sun-Sat rows
  const weeks: Date[][] = []
  for (let w = 0; w < 5; w++) {
    const wd: Date[] = []
    for (let d = 0; d < 7; d++) { const dt = new Date(sunday); dt.setDate(dt.getDate() + (w * 7) + d); wd.push(dt) }
    weeks.push(wd)
  }

  const getProdsForDay = (date: Date) => {
    const ds = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const de = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
    return productions.filter(p => { if (!p.start_datetime) return false; const s = new Date(p.start_datetime); return s >= ds && s <= de })
  }

  const todayProds = getProdsForDay(today)
  const isPast = (date: Date) => date < today
  const isTodayDate = (date: Date) => isSameDay(date, today)

  const getHoursForUser = (userId: string): string | null => {
    const dow = today.getDay()
    if (dow === 0 || dow === 6) return null
    const dayKey = DOW_KEYS_MAP[dow]
    if (!dayKey) return null
    const weekStart = getMondayStr(today)
    const override = schedOverrides.find(o => o.user_id === userId && o.week_start === weekStart)
    if (override && (override as any)[dayKey]) return (override as any)[dayKey]
    const def = schedDefaults.find(d => d.user_id === userId)
    return def ? ((def as any)[dayKey] || null) : null
  }

  // In Progress productions — active work regardless of date
  const inProgressProds = productions.filter(p => p.status === 'In Progress')

  // This week stats
  const endOfWeek = new Date(sunday); endOfWeek.setDate(endOfWeek.getDate() + 7)
  const thisWeekProds = productions.filter(p => {
    if (!p.start_datetime) return false
    const d = new Date(p.start_datetime)
    return d >= sunday && d < endOfWeek
  })
  const thisWeekByType = thisWeekProds.reduce((acc, p) => {
    const t = TYPE_SHORT[p.request_type_label || ''] || 'Other'
    acc[t] = (acc[t] || 0) + 1; return acc
  }, {} as Record<string, number>)

  // YTD
  const currentSchoolYear = (() => { const m = now.getMonth(); const y = now.getFullYear(); return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}` })()
  const ytdCompleted = productions.filter(p => p.status === 'Complete' && p.school_year === currentSchoolYear).length
  const ytdTotal = productions.filter(p => p.school_year === currentSchoolYear).length

  // Countdown
  const nextProd = productions.find(p => {
    if (!p.start_datetime || p.status === 'Complete' || p.status === 'Cancelled') return false
    return new Date(p.start_datetime) > now
  })
  const countdown = (() => {
    if (!nextProd?.start_datetime) return null
    const diff = new Date(nextProd.start_datetime).getTime() - now.getTime()
    if (diff <= 0) return null
    const hrs = Math.floor(diff / 3600000); const mins = Math.floor((diff % 3600000) / 60000)
    if (hrs >= 48) return { label: `${Math.ceil(hrs / 24)} days`, sub: nextProd.title }
    if (hrs >= 1) return { label: `${hrs}h ${mins}m`, sub: nextProd.title }
    return { label: `${mins}m`, sub: nextProd.title }
  })()

  const weekLabel = (wd: Date[]) => {
    if (isSameDay(wd[0], sunday)) return 'This week'
    return wd[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const bg = '#080e1a'; const cardBg = '#0d1525'; const text = '#f0f4ff'; const muted = '#6b7fa0'; const border = 'rgba(255,255,255,0.06)'

  if (loading) return (
    <div style={{ background: bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' as const }}>
      <p style={{ color: muted, fontSize: '18px', fontFamily: 'system-ui' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '20px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', color: text, display: 'flex', flexDirection: 'column' as const, boxSizing: 'border-box' as const }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>CSDtv Production Office</span>
          {countdown && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', color: muted }}>Next shoot in</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: '#5ba3e0' }}>{countdown.label}</span>
              <span style={{ fontSize: '13px', color: muted }}>— {countdown.sub}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <p style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, margin: '2px 0 0', color: '#5ba3e0' }}>
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexShrink: 0, flexWrap: 'wrap' as const }}>
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#5ba3e0', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>This week</span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{thisWeekProds.length} production{thisWeekProds.length !== 1 ? 's' : ''}</span>
          {Object.entries(thisWeekByType).map(([type, count]) => (
            <span key={type} style={{ fontSize: '11px', color: muted }}>{count} {type}</span>
          ))}
        </div>
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>School year</span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{ytdCompleted} completed</span>
          <span style={{ fontSize: '11px', color: muted }}>of {ytdTotal} total</span>
        </div>
      </div>

      {/* Today + In Progress row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexShrink: 0 }}>
        {/* Today */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#5ba3e0', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>Today</span>
            <span style={{ fontSize: '11px', color: muted }}>{todayProds.length} production{todayProds.length !== 1 ? 's' : ''}</span>
          </div>
          {todayProds.length === 0 ? (
            <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '14px', textAlign: 'center' as const }}>
              <p style={{ color: muted, fontSize: '13px', margin: 0 }}>No productions today</p>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' as const }}>
              {todayProds.map(p => {
                const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
                const statusColor = STATUS_COLORS[p.status || ''] || '#64748b'
                const d = new Date(p.start_datetime!)
                const members = p.production_members || []
                const isComplete = p.status === 'Complete'
                return (
                  <div key={p.id} style={{ background: cardBg, border: `0.5px solid ${border}`, borderLeft: `4px solid ${typeColor}`, borderRadius: '10px', padding: '10px 14px', minWidth: '190px', flex: '0 0 auto', opacity: isComplete ? 0.4 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: text, margin: 0, flex: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{p.title}</p>
                      <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px', background: `${statusColor}20`, color: statusColor, fontWeight: 600, flexShrink: 0 }}>{p.status}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: typeColor, margin: '0 0 2px', fontWeight: 500 }}>{TYPE_SHORT[p.request_type_label || ''] || 'Production'}</p>
                    <p style={{ fontSize: '12px', color: muted, margin: 0 }}>
                      {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {p.filming_location ? ` · ${p.filming_location}` : ''}
                    </p>
                    {members.length > 0 && (
                      <div style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                        {members.map((m, i) => (
                          <div key={i} style={{ width: '22px', height: '22px', borderRadius: '50%', background: m.team?.avatar_color || '#5ba3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#0a0f1e' }}>
                            {m.team ? getInitials(m.team.name) : '?'}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* In Progress */}
        {inProgressProds.length > 0 && (
          <div style={{ width: '280px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>In progress</span>
              <span style={{ fontSize: '11px', color: muted }}>{inProgressProds.length}</span>
            </div>
            <div style={{ background: cardBg, border: '0.5px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '8px', maxHeight: '140px', overflowY: 'auto' as const }}>
              {inProgressProds.slice(0, 6).map(p => {
                const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
                const datePart = p.start_datetime ? new Date(p.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', borderBottom: `0.5px solid ${border}` }}>
                    <div style={{ width: '3px', height: '20px', borderRadius: '2px', background: typeColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '11px', fontWeight: 500, color: text, margin: 0, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{p.title}</p>
                      <p style={{ fontSize: '10px', color: muted, margin: 0 }}>{TYPE_SHORT[p.request_type_label || ''] || 'Production'}{datePart ? ` · ${datePart}` : ''}</p>
                    </div>
                  </div>
                )
              })}
              {inProgressProds.length > 6 && <p style={{ fontSize: '10px', color: muted, margin: '4px 6px 0', textAlign: 'center' as const }}>+{inProgressProds.length - 6} more</p>}
            </div>
          </div>
        )}
      </div>

      {/* 5-week calendar — Sun-Sat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '2px', marginBottom: '2px', flexShrink: 0 }}>
          <div />
          {DOW.map((d, i) => {
            const isTodayCol = isTodayDate(weeks[0][i])
            return <div key={d} style={{ padding: '5px 4px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 700, color: isTodayCol ? '#5ba3e0' : muted, letterSpacing: '1px' }}>{d}</div>
          })}
        </div>

        {/* Week rows */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
          {weeks.map((weekDates, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '2px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: wi === 0 ? '#5ba3e0' : muted, textAlign: 'center' as const, padding: '4px', background: wi === 0 ? 'rgba(30,108,181,0.08)' : 'transparent' as const, borderRadius: '6px' }}>
                {weekLabel(weekDates)}
              </div>
              {weekDates.map((date, di) => {
                const dayProds = getProdsForDay(date)
                const past = isPast(date) && !isTodayDate(date)
                const todayCell = isTodayDate(date)
                const isWeekend = di === 0 || di === 6
                // Past days dim UNLESS they have In Progress items
                const hasInProgress = dayProds.some(p => p.status === 'In Progress')
                const cellOpacity = past ? (hasInProgress ? 0.8 : 0.3) : 1
                return (
                  <div key={di} style={{
                    background: todayCell ? 'rgba(30,108,181,0.1)' : isWeekend ? 'rgba(255,255,255,0.01)' : cardBg,
                    border: todayCell ? '1.5px solid #1e6cb5' : `0.5px solid ${border}`,
                    borderRadius: '6px', padding: '3px', overflow: 'hidden' as const,
                    opacity: cellOpacity, display: 'flex', flexDirection: 'column' as const,
                  }}>
                    <div style={{ fontSize: '10px', color: todayCell ? '#5ba3e0' : muted, fontWeight: todayCell ? 700 : 400, textAlign: 'right' as const, padding: '1px 3px', marginBottom: '1px' }}>
                      {date.getDate()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' as const }}>
                      {dayProds.slice(0, 3).map(p => {
                        const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
                        const members = p.production_members || []
                        const initials = members.map(m => m.team ? getInitials(m.team.name) : '').filter(Boolean).join(' ')
                        const isComplete = p.status === 'Complete'
                        const isActive = p.status === 'In Progress'
                        return (
                          <div key={p.id} style={{
                            fontSize: '10px', padding: '2px 4px', marginBottom: '1px', borderRadius: '3px',
                            background: isComplete ? 'rgba(255,255,255,0.03)' : isActive ? `${typeColor}25` : `${typeColor}18`,
                            color: isComplete ? muted : typeColor,
                            fontWeight: isActive ? 600 : 500,
                            overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
                            borderLeft: `2px solid ${isComplete ? '#444' : typeColor}`,
                            display: 'flex', gap: '3px', alignItems: 'center',
                            textDecoration: isComplete ? 'line-through' : 'none',
                            opacity: isComplete ? 0.5 : 1,
                          }}>
                            <span style={{ overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, flex: 1 }}>{p.title}</span>
                            {initials && <span style={{ fontSize: '8px', opacity: 0.7, flexShrink: 0 }}>{initials}</span>}
                          </div>
                        )
                      })}
                      {dayProds.length > 3 && <div style={{ fontSize: '9px', color: muted, padding: '1px 3px' }}>+{dayProds.length - 3}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Staff hours row */}
      <div style={{ marginTop: '8px', display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center', background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '8px 14px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: muted, textTransform: 'uppercase' as const, letterSpacing: '1px', flexShrink: 0 }}>Staff</span>
        {team.map(member => {
          const hours = getHoursForUser(member.id)
          return (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${border}` }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
                {getInitials(member.name)}
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 500, color: text, margin: 0 }}>{member.name.split(' ')[0]}</p>
                <p style={{ fontSize: '10px', color: hours ? '#22c55e' : muted, margin: 0, fontWeight: hours ? 500 : 400 }}>
                  {hours || 'Off'}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}