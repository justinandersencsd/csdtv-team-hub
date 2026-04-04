'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import Link from 'next/link'

interface Production {
  id: string
  production_number: number
  title: string
  type: string | null
  request_type_label: string | null
  internal_type: string | null
  internal_type_label: string | null
  status: string | null
  organizer_name: string | null
  organizer_email: string | null
  event_date: string | null
  start_datetime: string | null
  filming_location: string | null
  event_location: string | null
  school_department: string | null
  school_year: string | null
  thumbnail_url: string | null
  synced_at: string | null
  checklist_items?: { completed: boolean }[]
  production_members?: { user_id: string; team?: { name: string; avatar_color: string } }[]
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'idea/request':        { bg: 'rgba(155,133,224,0.12)', color: '#9b85e0' },
  'approved/scheduled':  { bg: 'rgba(30,108,181,0.12)',  color: '#5ba3e0' },
  'in progress':         { bg: 'rgba(232,160,32,0.12)',  color: '#e8a020' },
  'complete':            { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
  'abandoned':           { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
}

const TYPE_COLORS: Record<string, string> = {
  'LiveStream Meeting':               '#5ba3e0',
  'Record Meeting':                   '#9b85e0',
  'Create a Video(Film, Edit, Publish)': '#e8a020',
  'Create a Video':                   '#e8a020',
  'Board Meeting':                    '#22c55e',
  'Photo Headshots':                  '#f472b6',
  'Podcast':                          '#fb923c',
  'Other, Unsure, Or Consultation':   '#94a3b8',
}

function getTypeColor(prod: Production) {
  const t = prod.request_type_label || prod.type || ''
  return TYPE_COLORS[t] || '#8899bb'
}

function getTypeLabel(prod: Production) {
  return prod.request_type_label || prod.type || 'Unknown'
}

function getStatusStyle(status: string | null) {
  const key = status?.toLowerCase() || ''
  return STATUS_STYLES[key] || { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' }
}

function getProgress(prod: Production) {
  const items = prod.checklist_items || []
  if (items.length === 0) return null
  const done = items.filter(i => i.completed).length
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) }
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProductionsPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [productions, setProductions] = useState<Production[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const hoverBg = dark ? 'rgba(255,255,255,0.03)' : '#f8fafc'
  const inputBg = dark ? '#0d1525' : '#ffffff'

  const loadProductions = useCallback(async () => {
    const { data } = await supabase
      .from('productions')
      .select(`*, checklist_items(completed), production_members(user_id, team:team(name, avatar_color))`)
      .order('production_number', { ascending: false })
    setProductions(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadProductions() }, [loadProductions])

  const filtered = productions.filter(p => {
    const typeLabel = getTypeLabel(p).toLowerCase()
    const matchSearch = search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.organizer_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      typeLabel.includes(search.toLowerCase()) ||
      (p.filming_location?.toLowerCase() || '').includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status?.toLowerCase() === statusFilter
    const matchType = typeFilter === 'all' || getTypeLabel(p) === typeFilter
    return matchSearch && matchStatus && matchType
  })

  const uniqueTypes = [...new Set(productions.map(p => getTypeLabel(p)).filter(Boolean))]
  const uniqueStatuses = [...new Set(productions.map(p => p.status).filter(Boolean))]

  const filterBtn = (active: boolean) => ({
    fontSize: '14px', padding: '5px 12px', borderRadius: '8px',
    border: `0.5px solid ${border}`,
    background: active ? '#1e6cb5' : inputBg,
    color: active ? '#fff' : muted,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: muted, fontSize: '14px' }}>Loading productions...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Productions</h1>
          <p style={{ fontSize: '15px', color: muted, margin: '2px 0 0' }}>
            {productions.length} total · {productions.filter(p => p.status?.toLowerCase() === 'in progress').length} in progress
          </p>
        </div>
        <div style={{ fontSize: '13px', padding: '5px 12px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          Synced from productions site
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', marginBottom: '12px' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by title, organizer, type, location..."
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: '15px', color: text, fontFamily: 'inherit', width: '100%' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
        )}
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <button style={filterBtn(statusFilter === 'all')} onClick={() => setStatusFilter('all')}>All status</button>
        {uniqueStatuses.map(s => (
          <button key={s} style={filterBtn(statusFilter === s?.toLowerCase())} onClick={() => setStatusFilter(s?.toLowerCase() || 'all')}>
            {s}
          </button>
        ))}
      </div>

      {/* Type filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button style={filterBtn(typeFilter === 'all')} onClick={() => setTypeFilter('all')}>All types</button>
        {uniqueTypes.map(t => (
          <button key={t} style={filterBtn(typeFilter === t)} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Results count */}
      {(search || statusFilter !== 'all' || typeFilter !== 'all') && (
        <p style={{ fontSize: '14px', color: muted, marginBottom: '12px' }}>
          Showing {filtered.length} of {productions.length} productions
        </p>
      )}

      {/* Productions list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: muted, fontSize: '14px', marginBottom: '6px' }}>
            {productions.length === 0
              ? 'No productions yet — sync from the productions site to get started'
              : 'No productions match your filters'}
          </p>
          {(search || statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setStatusFilter('all'); setTypeFilter('all') }}
              style={{ fontSize: '14px', color: '#5ba3e0', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(prod => {
            const progress = getProgress(prod)
            const typeColor = getTypeColor(prod)
            const statusStyle = getStatusStyle(prod.status)
            const members = prod.production_members || []
            const dateStr = formatDate(prod.start_datetime || prod.event_date)

            return (
              <Link key={prod.id} href={`/dashboard/productions/${prod.id}`} style={{ textDecoration: 'none' }}>
                <div
                  style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', transition: 'background 0.15s', borderLeft: `3px solid ${typeColor}` }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = hoverBg}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = cardBg}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>

                    {/* Production number */}
                    <div style={{ fontSize: '14px', color: muted, minWidth: '36px', fontWeight: 500, paddingTop: '2px', flexShrink: 0 }}>
                      #{prod.production_number}
                    </div>

                    {/* Main content */}
                    <div style={{ flex: 1, minWidth: '180px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '5px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>{prod.title}</p>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: `${typeColor}18`, color: typeColor, flexShrink: 0 }}>
                          {getTypeLabel(prod)}
                        </span>
                        {prod.internal_type_label && prod.internal_type_label !== getTypeLabel(prod) && (
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: muted, flexShrink: 0 }}>
                            {prod.internal_type_label}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        {prod.organizer_name && (
                          <span style={{ fontSize: '14px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            {prod.organizer_name}
                          </span>
                        )}
                        {dateStr && (
                          <span style={{ fontSize: '14px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {dateStr}
                          </span>
                        )}
                        {prod.filming_location && (
                          <span style={{ fontSize: '14px', color: muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            {prod.filming_location}
                          </span>
                        )}
                        {prod.school_year && (
                          <span style={{ fontSize: '14px', color: muted }}>{prod.school_year}</span>
                        )}
                      </div>
                    </div>

                    {/* Right side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>

                      {/* Team avatars */}
                      {members.length > 0 && (
                        <div style={{ display: 'flex' }}>
                          {members.slice(0, 3).map((m, i) => (
                            <div key={m.user_id} style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: m.team?.avatar_color || '#e8a020',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: 600, color: '#0a0f1e',
                              marginLeft: i > 0 ? '-6px' : 0,
                              border: `2px solid ${cardBg}`,
                              position: 'relative', zIndex: members.length - i,
                            }}>
                              {m.team?.name?.slice(0, 2).toUpperCase() || '??'}
                            </div>
                          ))}
                          {members.length > 3 && (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: muted, marginLeft: '-6px', border: `2px solid ${cardBg}`, position: 'relative' }}>
                              +{members.length - 3}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Checklist progress */}
                      {progress && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '60px', height: '4px', background: dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${progress.pct}%`, height: '100%', background: '#1e6cb5', borderRadius: '2px' }} />
                          </div>
                          <span style={{ fontSize: '13px', color: muted, minWidth: '32px' }}>{progress.done}/{progress.total}</span>
                        </div>
                      )}

                      {/* Status badge */}
                      <span style={{ fontSize: '13px', fontWeight: 500, padding: '3px 10px', borderRadius: '6px', background: statusStyle.bg, color: statusStyle.color, whiteSpace: 'nowrap' }}>
                        {prod.status || 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}