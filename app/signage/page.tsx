'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

interface Production {
  id: string; production_number: number; title: string
  request_type_label: string | null; status: string | null
  start_datetime: string | null; filming_location: string | null
  production_members?: { user_id: string; team: { name: string; avatar_color: string } | null }[]
}
interface TeamMember { id: string; name: string; avatar_color: string; role: string }
interface ScheduleDefault { id: string; user_id: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string }
interface ScheduleOverride { id: string; user_id: string; week_start: string; monday: string; tuesday: string; wednesday: string; thursday: string; friday: string }

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

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const

function getMonday(d: Date): Date {
  const dt = new Date(d); const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff); dt.setHours(0, 0, 0, 0); return dt
}

function getMondayStr(d: Date): string {
  const m = getMonday(d)
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function SignagePage() {
  const supabase = createClient()

  const [now, setNow] = useState(new Date())
  const [productions, setProductions] = useState<Production[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [schedDefaults, setSchedDefaults] = useState<ScheduleDefault[]>([])
  const [schedOverrides, setSchedOverrides] = useState<ScheduleOverride[]>([])
  const [loading, setLoading] = useState(true)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const loadData = useCallback(async () => {
    const [prodsRes, teamRes, defsRes, ovrsRes] = await Promise.all([
      supabase.from('productions').select('id, production_number, title, request_type_label, status, start_datetime, filming_location, production_members(user_id, team(name, avatar_color))').not('start_datetime', 'is', null).order('start_datetime'),
      supabase.from('team').select('id, name, avatar_color, role').eq('active', true),
      supabase.from('schedule_defaults').select('*'),
      supabase.from('schedule_overrides').select('*'),
    ])
    setProductions(prodsRes.data || [])
    setTeam(teamRes.data || [])
    setSchedDefaults(defsRes.data || [])
    setSchedOverrides(ovrsRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const refresh = setInterval(() => loadData(), 300000)
    return () => clearInterval(refresh)
  }, [loadData])

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monday = getMonday(today)

  // Build 5 weeks of dates (current + 4 ahead)
  const weeks: Date[][] = []
  for (let w = 0; w < 5; w++) {
    const weekDates: Date[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(monday)
      dt.setDate(dt.getDate() + (w * 7) + d)
      weekDates.push(dt)
    }
    weeks.push(weekDates)
  }

  const getProdsForDay = (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
    return productions.filter(p => {
      if (!p.start_datetime) return false
      const s = new Date(p.start_datetime)
      return s >= dayStart && s <= dayEnd
    })
  }

  const todayProds = getProdsForDay(today)

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  }

  const getHoursForUser = (userId: string): string | null => {
    const dow = today.getDay()
    if (dow === 0 || dow === 6) return null
    const dayKey = DOW_KEYS[dow - 1]
    const weekStart = getMondayStr(today)
    const override = schedOverrides.find(o => o.user_id === userId && o.week_start === weekStart)
    if (override && (override as any)[dayKey]) return (override as any)[dayKey]
    const def = schedDefaults.find(d => d.user_id === userId)
    return def ? ((def as any)[dayKey] || null) : null
  }

  const isPast = (date: Date) => date < today
  const isToday = (date: Date) => isSameDay(date, today)

  const weekLabel = (weekDates: Date[]) => {
    const m1 = weekDates[0]
    const isThisWeek = isSameDay(m1, monday)
    if (isThisWeek) return 'This week'
    return `${m1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  // Colors
  const bg = '#080e1a'
  const cardBg = '#0d1525'
  const text = '#f0f4ff'
  const muted = '#6b7fa0'
  const border = 'rgba(255,255,255,0.06)'
  const todayBorder = '#1e6cb5'

  if (loading) return (
    <div style={{ background: bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: muted, fontSize: '18px', fontFamily: 'system-ui' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: '100vh', padding: '24px 28px', fontFamily: 'system-ui, -apple-system, sans-serif', color: text, display: 'flex', flexDirection: 'column' as const, boxSizing: 'border-box' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>CSDtv Production Office</span>
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <p style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>
            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <p style={{ fontSize: '28px', fontWeight: 700, margin: '2px 0 0', color: '#5ba3e0' }}>
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Today strip */}
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#5ba3e0', textTransform: 'uppercase' as const, letterSpacing: '1.5px' }}>Today</span>
          <span style={{ fontSize: '13px', color: muted }}>{todayProds.length} production{todayProds.length !== 1 ? 's' : ''}</span>
        </div>
        {todayProds.length === 0 ? (
          <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '20px', textAlign: 'center' as const }}>
            <p style={{ color: muted, fontSize: '15px', margin: 0 }}>No productions today</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' as const }}>
            {todayProds.map(p => {
              const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
              const d = new Date(p.start_datetime!)
              const members = p.production_members || []
              return (
                <div key={p.id} style={{ background: cardBg, border: `0.5px solid ${border}`, borderLeft: `4px solid ${typeColor}`, borderRadius: '12px', padding: '14px 18px', minWidth: '220px', flex: '0 0 auto' }}>
                  <p style={{ fontSize: '16px', fontWeight: 600, color: text, margin: '0 0 6px' }}>{p.title}</p>
                  <p style={{ fontSize: '13px', color: typeColor, margin: '0 0 4px', fontWeight: 500 }}>{TYPE_SHORT[p.request_type_label || ''] || p.request_type_label || 'Production'}</p>
                  <p style={{ fontSize: '14px', color: muted, margin: '0 0 4px' }}>
                    {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    {p.filming_location ? ` · ${p.filming_location}` : ''}
                  </p>
                  {members.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                      {members.map((m, i) => (
                        <div key={i} style={{ width: '26px', height: '26px', borderRadius: '50%', background: m.team?.avatar_color || '#5ba3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#0a0f1e' }}>
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

      {/* 5-week calendar grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, minHeight: 0 }}>
        {/* Day header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: '2px', marginBottom: '2px', flexShrink: 0 }}>
          <div />
          {DOW.map((d, i) => {
            const dateForHeader = weeks[0][i]
            const isTodayCol = isToday(dateForHeader)
            return (
              <div key={d} style={{ padding: '6px 4px', textAlign: 'center' as const, fontSize: '12px', fontWeight: 700, color: isTodayCol ? '#5ba3e0' : muted, letterSpacing: '1px' }}>
                {d}
              </div>
            )
          })}
        </div>

        {/* Week rows */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: '2px' }}>
          {weeks.map((weekDates, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, 1fr)', gap: '2px', flex: 1 }}>
              {/* Week label */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: wi === 0 ? '#5ba3e0' : muted, textAlign: 'center' as const, padding: '4px', background: wi === 0 ? 'rgba(30,108,181,0.08)' : 'transparent', borderRadius: '6px' }}>
                {weekLabel(weekDates)}
              </div>

              {/* Day cells */}
              {weekDates.map((date, di) => {
                const dayProds = getProdsForDay(date)
                const past = isPast(date) && !isToday(date)
                const todayCell = isToday(date)
                const isWeekend = di >= 5
                return (
                  <div key={di} style={{
                    background: todayCell ? 'rgba(30,108,181,0.1)' : isWeekend ? 'rgba(255,255,255,0.01)' : cardBg,
                    border: todayCell ? `1.5px solid ${todayBorder}` : `0.5px solid ${border}`,
                    borderRadius: '6px', padding: '4px', overflow: 'hidden' as const,
                    opacity: past ? 0.35 : 1,
                    transition: 'opacity 0.2s',
                    display: 'flex', flexDirection: 'column' as const,
                  }}>
                    <div style={{ fontSize: '11px', color: todayCell ? '#5ba3e0' : muted, fontWeight: todayCell ? 700 : 400, textAlign: 'right' as const, padding: '1px 3px', marginBottom: '2px' }}>
                      {date.getDate()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' as const }}>
                      {dayProds.slice(0, 3).map(p => {
                        const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
                        const members = p.production_members || []
                        const initials = members.map(m => m.team ? getInitials(m.team.name) : '').filter(Boolean).join(' ')
                        return (
                          <div key={p.id} style={{ fontSize: '10px', padding: '2px 4px', marginBottom: '1px', borderRadius: '3px', background: `${typeColor}18`, color: typeColor, fontWeight: 500, overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const, borderLeft: `2px solid ${typeColor}`, display: 'flex', gap: '3px', alignItems: 'center' }}>
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
      <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center', background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '10px 16px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: muted, textTransform: 'uppercase' as const, letterSpacing: '1px', flexShrink: 0 }}>Today</span>
        {team.map(member => {
          const hours = getHoursForUser(member.id)
          return (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${border}` }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
                {getInitials(member.name)}
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 500, color: text, margin: 0 }}>{member.name.split(' ')[0]}</p>
                <p style={{ fontSize: '11px', color: hours ? '#22c55e' : muted, margin: 0, fontWeight: hours ? 500 : 400 }}>
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