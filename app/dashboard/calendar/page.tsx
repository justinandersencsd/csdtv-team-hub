'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/lib/theme'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import Loader from '../components/Loader'

interface Production {
  id: string; production_number: number; title: string
  request_type_label: string | null; status: string | null
  start_datetime: string | null; end_datetime: string | null
  organizer_name: string | null; filming_location: string | null
}

const TYPE_COLORS: Record<string, string> = {
  'Photo Headshots': '#e8a020', 'Create a Video(Film, Edit, Publish)': '#5ba3e0', 'LiveStream Meeting': '#22c55e',
  'Record Meeting': '#9b85e0', 'Podcast': '#f97316', 'Board Meeting': '#ef4444',
}

export default function CalendarPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const text = dark ? '#f0f4ff' : '#1a1f36'
  const muted = dark ? '#8899bb' : '#6b7280'
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg = dark ? '#0d1525' : '#ffffff'

  const [productions, setProductions] = useState<Production[]>([])
  const [loading, setLoading] = useState(true)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from('productions').select('id, production_number, title, request_type_label, status, start_datetime, end_datetime, organizer_name, filming_location').not('start_datetime', 'is', null).order('start_datetime')
    setProductions(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const monthLabel = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const startDow = firstOfMonth.getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const today = new Date()
  const isToday = (d: number) => viewYear === today.getFullYear() && viewMonth === today.getMonth() && d === today.getDate()

  const calDays: (number | null)[] = []
  for (let i = 0; i < startDow; i++) calDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d)
  while (calDays.length % 7 !== 0) calDays.push(null)

  const getProdsForDay = (day: number) => {
    const dayStart = new Date(viewYear, viewMonth, day)
    const dayEnd = new Date(viewYear, viewMonth, day, 23, 59, 59)
    return productions.filter(p => {
      if (!p.start_datetime) return false
      const start = new Date(p.start_datetime)
      return start >= dayStart && start <= dayEnd
    })
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11) }
    else setViewMonth(viewMonth - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0) }
    else setViewMonth(viewMonth + 1)
  }
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }

  // Upcoming list (next 14 days)
  const upcoming = productions.filter(p => {
    if (!p.start_datetime) return false
    const d = new Date(p.start_datetime)
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 14
  }).slice(0, 8)

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><Loader /></div>

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: text, margin: '0 0 4px' }}>Production calendar</h1>
      <p style={{ fontSize: '14px', color: muted, margin: '0 0 20px' }}>Upcoming shoots and events</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px' }}>
        {/* Calendar */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', padding: '20px', overflow: 'hidden' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={prevMonth} style={{ background: 'none', border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 14px', color: muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>←</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: text, margin: 0 }}>{monthLabel}</h2>
              <button onClick={goToday} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: muted, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Today</button>
            </div>
            <button onClick={nextMonth} style={{ background: 'none', border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 14px', color: muted, cursor: 'pointer', fontFamily: 'inherit', fontSize: '14px' }}>→</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ padding: '6px', textAlign: 'center' as const, fontSize: '12px', fontWeight: 600, color: muted, textTransform: 'uppercase' as const }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px' }}>
            {calDays.map((day, i) => {
              if (day === null) return <div key={i} style={{ minHeight: '80px', background: dark ? 'rgba(255,255,255,0.01)' : '#fafbfc', borderRadius: '4px' }} />
              const dayProds = getProdsForDay(day)
              const todayStyle = isToday(day)
              return (
                <div key={i} style={{ minHeight: '80px', padding: '4px', borderRadius: '6px', border: todayStyle ? '2px solid #1e6cb5' : `0.5px solid ${border}`, background: todayStyle ? (dark ? 'rgba(30,108,181,0.08)' : 'rgba(30,108,181,0.04)') : 'transparent' }}>
                  <div style={{ fontSize: '12px', fontWeight: todayStyle ? 700 : 400, color: todayStyle ? '#1e6cb5' : muted, marginBottom: '2px', textAlign: 'right' as const, padding: '2px 4px' }}>{day}</div>
                  {dayProds.slice(0, 3).map(p => {
                    const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
                    return (
                      <Link key={p.id} href={`/dashboard/productions/${p.production_number}`} style={{ textDecoration: 'none', display: 'block', fontSize: '11px', padding: '2px 4px', marginBottom: '1px', borderRadius: '3px', background: `${typeColor}18`, color: typeColor, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, borderLeft: `2px solid ${typeColor}` }}>
                        {p.title}
                      </Link>
                    )
                  })}
                  {dayProds.length > 3 && <div style={{ fontSize: '10px', color: muted, padding: '1px 4px' }}>+{dayProds.length - 3} more</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div>
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', overflow: 'hidden', position: 'sticky' as const, top: '80px' }}>
            <div style={{ padding: '16px 18px', borderBottom: `1px solid ${border}` }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: text, margin: 0 }}>Coming up</h3>
              <p style={{ fontSize: '12px', color: muted, margin: '4px 0 0' }}>Next 14 days</p>
            </div>
            {upcoming.length === 0 ? (
              <p style={{ padding: '30px 18px', color: muted, fontSize: '14px', textAlign: 'center' as const, margin: 0 }}>Nothing scheduled</p>
            ) : upcoming.map((p, i) => {
              const d = new Date(p.start_datetime!)
              const typeColor = TYPE_COLORS[p.request_type_label || ''] || '#64748b'
              return (
                <Link key={p.id} href={`/dashboard/productions/${p.production_number}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 18px', borderBottom: i < upcoming.length - 1 ? `0.5px solid ${border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '4px', height: '28px', borderRadius: '2px', background: typeColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{p.title}</p>
                      <p style={{ fontSize: '12px', color: muted, margin: '2px 0 0' }}>
                        {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 320px"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}