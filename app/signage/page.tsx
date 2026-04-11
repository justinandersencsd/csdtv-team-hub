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
  'Photo Headshots': '#f0b840', 'Create a Video(Film, Edit, Publish)': '#60b8f0', 'LiveStream Meeting': '#34d399',
  'Record Meeting': '#b8a0f0', 'Podcast': '#fb923c', 'Board Meeting': '#f87171',
  'Other, Unsure, Or Consultation': '#94a3b8',
}
const TYPE_SHORT: Record<string, string> = {
  'Photo Headshots': 'Photo', 'Create a Video(Film, Edit, Publish)': 'Video', 'LiveStream Meeting': 'Livestream',
  'Record Meeting': 'Recording', 'Podcast': 'Podcast', 'Board Meeting': 'Board Mtg',
  'Other, Unsure, Or Consultation': 'Other',
}
const STATUS_COLORS: Record<string, string> = {
  'Approved/Scheduled': '#34d399', 'In Progress': '#fbbf24', 'Complete': '#94a3b8',
}

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DOW_KEYS_MAP: Record<number, string> = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' }
const GRID_COLS = '70px 0.5fr repeat(5, 1fr) 0.5fr'

function getSunday(d: Date): Date { const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); dt.setHours(0, 0, 0, 0); return dt }
function getMondayStr(d: Date): string { const dt = new Date(d); const day = dt.getDay(); dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day)); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` }
function isSameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }
function getInitials(name: string) { const p = name.split(' '); return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase() }

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
    const dow = today.getDay(); if (dow === 0 || dow === 6) return null
    const dayKey = DOW_KEYS_MAP[dow]; if (!dayKey) return null
    const weekStart = getMondayStr(today)
    const override = schedOverrides.find(o => o.user_id === userId && o.week_start === weekStart)
    if (override && (override as any)[dayKey]) return (override as any)[dayKey]
    const def = schedDefaults.find(d => d.user_id === userId)
    return def ? ((def as any)[dayKey] || null) : null
  }

  const inProgressProds = productions.filter(p => p.status === 'In Progress')

  const endOfWeek = new Date(sunday); endOfWeek.setDate(endOfWeek.getDate() + 7)
  const thisWeekProds = productions.filter(p => { if (!p.start_datetime) return false; const d = new Date(p.start_datetime); return d >= sunday && d < endOfWeek })
  const thisWeekByType = thisWeekProds.reduce((acc, p) => { const t = TYPE_SHORT[p.request_type_label || ''] || 'Other'; acc[t] = (acc[t] || 0) + 1; return acc }, {} as Record<string, number>)

  const currentSchoolYear = (() => { const m = now.getMonth(); const y = now.getFullYear(); return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}` })()
  const ytdCompleted = productions.filter(p => p.status === 'Complete' && p.school_year === currentSchoolYear).length
  const ytdTotal = productions.filter(p => p.school_year === currentSchoolYear).length

  const nextProd = productions.find(p => { if (!p.start_datetime || p.status === 'Complete' || p.status === 'Cancelled') return false; return new Date(p.start_datetime) > now })
  const countdown = (() => {
    if (!nextProd?.start_datetime) return null
    const diff = new Date(nextProd.start_datetime).getTime() - now.getTime()
    if (diff <= 0) return null
    const hrs = Math.floor(diff / 3600000); const mins = Math.floor((diff % 3600000) / 60000)
    if (hrs >= 48) return { label: `${Math.ceil(hrs / 24)} days`, sub: nextProd.title }
    if (hrs >= 1) return { label: `${hrs}h ${mins}m`, sub: nextProd.title }
    return { label: `${mins}m`, sub: nextProd.title }
  })()

  const weekLabel = (wd: Date[]) => isSameDay(wd[0], sunday) ? 'This week' : wd[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const bg = '#070d18'; const cardBg = '#0f1828'; const text = '#eef2ff'; const muted = '#8899bb'; const dimmed = '#4a5670'; const border = 'rgba(255,255,255,0.08)'

  if (loading) return (
    <div style={{ background: bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' as const }}>
      <p style={{ color: muted, fontSize: '22px', fontFamily: 'system-ui' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ background: bg, height: '100vh', padding: '16px 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: text, display: 'flex', flexDirection: 'column' as const, boxSizing: 'border-box' as const, overflow: 'hidden' as const }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '2px' }}>CSDtv Production Office</div>
          {countdown && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '15px', color: muted }}>Next shoot in</span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#60b8f0' }}>{countdown.label}</span>
              <span style={{ fontSize: '15px', color: muted }}>— {countdown.sub}</span>
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ fontSize: '18px', fontWeight: 500, color: '#ccd5e8' }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#60b8f0', lineHeight: 1.1 }}>
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexShrink: 0, alignItems: 'center' }}>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#60b8f0', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>This week</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: text }}>{thisWeekProds.length} production{thisWeekProds.length !== 1 ? 's' : ''}</span>
          {Object.entries(thisWeekByType).map(([type, count]) => (
            <span key={type} style={{ fontSize: '13px', color: '#ccd5e8' }}>{count} {type}</span>
          ))}
        </div>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>Year</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: text }}>{ytdCompleted} completed</span>
          <span style={{ fontSize: '13px', color: '#ccd5e8' }}>of {ytdTotal}</span>
        </div>
        {/* Staff hours inline */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {team.map(member => {
            const hours = getHoursForUser(member.id)
            return (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', background: cardBg, border: `1px solid ${border}` }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0a0f1e' }}>
                  {getInitials(member.name)}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: text }}>{member.name.split(' ')[0]}</span>
                <span style={{ fontSize: '13px', color: hours ? '#34d399' : dimmed, fontWeight: 600 }}>{hours || 'Off'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Today + In Progress row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#60b8f0', textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: '6px' }}>
            Today{todayProds.length > 0 ? ` · ${todayProds.length}` : ''}
          </div>
          {todayProds.length === 0 ? (
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '18px', textAlign: 'center' as const }}>
              <span style={{ color: dimmed, fontSize: '16px' }}>No productions today</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' as const }}>
              {todayProds.map(p => {
                const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#94a3b8'
                const statusColor = STATUS_COLORS[p.status || ''] || '#94a3b8'
                const d = new Date(p.start_datetime!)
                const members = p.production_members || []
                const isComplete = p.status === 'Complete'
                return (
                  <div key={p.id} style={{ background: cardBg, border: `1px solid ${border}`, borderLeft: `5px solid ${typeColor}`, borderRadius: '10px', padding: '14px 16px', minWidth: '240px', flex: '0 0 auto', opacity: isComplete ? 0.35 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '17px', fontWeight: 700, color: text, flex: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{p.title}</span>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: `${statusColor}25`, color: statusColor, fontWeight: 700, flexShrink: 0 }}>{p.status}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: typeColor, fontWeight: 600, marginBottom: '2px' }}>{TYPE_SHORT[p.request_type_label || ''] || 'Production'}</div>
                    <div style={{ fontSize: '15px', color: '#ccd5e8' }}>
                      {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {p.filming_location ? ` · ${p.filming_location}` : ''}
                    </div>
                    {members.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                        {members.map((m, i) => (
                          <div key={i} style={{ width: '26px', height: '26px', borderRadius: '50%', background: m.team?.avatar_color || '#60b8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#0a0f1e' }}>
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
        {inProgressProds.length > 0 && (
          <div style={{ width: '300px', flexShrink: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' as const, letterSpacing: '1.5px', marginBottom: '6px' }}>
              In progress · {inProgressProds.length}
            </div>
            <div style={{ background: cardBg, border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px', padding: '10px', maxHeight: '120px', overflowY: 'auto' as const }}>
              {inProgressProds.slice(0, 5).map(p => {
                const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#94a3b8'
                const datePart = p.start_datetime ? new Date(p.start_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', borderBottom: `1px solid ${border}` }}>
                    <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: typeColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: text, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{p.title}</div>
                      <div style={{ fontSize: '12px', color: muted }}>{TYPE_SHORT[p.request_type_label || ''] || 'Production'}{datePart ? ` · ${datePart}` : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5-week calendar — Sun-Sat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '3px', marginBottom: '3px', flexShrink: 0 }}>
          <div />
          {DOW.map((d, i) => {
            const isTodayCol = isTodayDate(weeks[0][i])
            return <div key={d} style={{ padding: '4px', textAlign: 'center' as const, fontSize: '14px', fontWeight: 800, color: isTodayCol ? '#60b8f0' : '#ccd5e8', letterSpacing: '1px' }}>{d}</div>
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '3px' }}>
          {weeks.map((weekDates, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: GRID_COLS, gap: '3px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: wi === 0 ? '#60b8f0' : muted, textAlign: 'center' as const, padding: '4px', background: wi === 0 ? 'rgba(96,184,240,0.08)' : 'transparent' as const, borderRadius: '6px' }}>
                {weekLabel(weekDates)}
              </div>
              {weekDates.map((date, di) => {
                const dayProds = getProdsForDay(date)
                const past = isPast(date) && !isTodayDate(date)
                const todayCell = isTodayDate(date)
                const isWeekend = di === 0 || di === 6
                const hasInProgress = dayProds.some(p => p.status === 'In Progress')
                const cellOpacity = past ? (hasInProgress ? 0.85 : 0.3) : 1
                return (
                  <div key={di} style={{
                    background: todayCell ? 'rgba(96,184,240,0.12)' : isWeekend ? 'rgba(255,255,255,0.015)' : cardBg,
                    border: todayCell ? '2px solid #60b8f0' : `1px solid ${border}`,
                    borderRadius: '8px', padding: '4px 5px', overflow: 'hidden' as const,
                    opacity: cellOpacity, display: 'flex', flexDirection: 'column' as const,
                  }}>
                    <div style={{ flex: 1, overflow: 'hidden' as const }}>
                      {dayProds.slice(0, 2).map(p => {
                        const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#94a3b8'
                        const members = p.production_members || []
                        const initials = members.map(m => m.team ? getInitials(m.team.name) : '').filter(Boolean).join(' ')
                        const isComplete = p.status === 'Complete'
                        const isActive = p.status === 'In Progress'
                        const d = p.start_datetime ? new Date(p.start_datetime) : null
                        const timeStr = d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
                        const locShort = p.filming_location ? (p.filming_location.length > 28 ? p.filming_location.slice(0, 26) + '...' : p.filming_location) : ''
                        return (
                          <div key={p.id} style={{
                            padding: '4px 5px', marginBottom: '3px', borderRadius: '4px',
                            background: isComplete ? 'rgba(255,255,255,0.03)' : `${typeColor}20`,
                            borderLeft: `3px solid ${isComplete ? '#555' : typeColor}`,
                            opacity: isComplete ? 0.45 : 1,
                            textDecoration: isComplete ? 'line-through' : 'none',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 600, color: isComplete ? dimmed : typeColor, flex: 1, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>{p.title}</span>
                              {initials && <span style={{ fontSize: '10px', color: isComplete ? dimmed : muted, flexShrink: 0, fontWeight: 600 }}>{initials}</span>}
                            </div>
                            {(timeStr || locShort) && (
                              <div style={{ fontSize: '11px', color: '#9ab0cc', marginTop: '1px', overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const }}>
                                {timeStr}{timeStr && locShort ? ' · ' : ''}{locShort}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {dayProds.length > 2 && <div style={{ fontSize: '12px', color: muted, padding: '1px 4px', fontWeight: 600 }}>+{dayProds.length - 2}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}