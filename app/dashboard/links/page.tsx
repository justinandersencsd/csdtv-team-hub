'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface QuickLink {
  id: string
  title: string
  url: string
  description: string | null
  category: string
  active: boolean
  sort_order: number
}

interface CurrentUser {
  id: string
  name: string
  role: string
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Tools:         { bg: 'rgba(30,108,181,0.12)',  color: '#5ba3e0' },
  Storage:       { bg: 'rgba(232,160,32,0.12)',  color: '#e8a020' },
  Communication: { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
  Production:    { bg: 'rgba(155,133,224,0.12)', color: '#9b85e0' },
  District:      { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  General:       { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
}

export default function QuickLinksPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [links, setLinks] = useState<QuickLink[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', url: '', description: '', category: 'General' })

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [linksRes, userRes] = await Promise.all([
      supabase.from('quick_links').select('*').eq('active', true).order('sort_order'),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
    ])
    setLinks(linksRes.data || [])
    setCurrentUser(userRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const addLink = async () => {
    if (!form.title || !form.url || !currentUser) return
    const url = form.url.startsWith('http') ? form.url : `https://${form.url}`
    const { data } = await supabase.from('quick_links').insert({ title: form.title, url, description: form.description || null, category: form.category, created_by: currentUser.id, sort_order: links.length }).select().single()
    if (data) { setLinks(prev => [...prev, data]); setForm({ title: '', url: '', description: '', category: 'General' }); setShowNew(false) }
  }

  const deleteLink = async (id: string) => {
    await supabase.from('quick_links').update({ active: false }).eq('id', id)
    setLinks(prev => prev.filter(l => l.id !== id))
  }

  const grouped = links.reduce((acc, link) => {
    if (!acc[link.category]) acc[link.category] = []
    acc[link.category].push(link)
    return acc
  }, {} as Record<string, QuickLink[]>)

  const isManager = currentUser?.role === 'Manager'
  const inputStyle = { background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading links...</p></div>

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Quick links</h1>
          <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>Useful tools and resources for the team</p>
        </div>
        {isManager && (
          <button onClick={() => setShowNew(!showNew)} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add link
          </button>
        )}
      </div>

      {showNew && isManager && (
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: '0 0 12px' }}>Add new link</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Link title" style={inputStyle} />
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="URL" style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Description (optional)" style={inputStyle} />
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
              {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addLink} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Add link</button>
            <button onClick={() => setShowNew(false)} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: 'transparent', color: muted, border: `0.5px solid ${border}`, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ color: muted, fontSize: '14px', marginBottom: '6px' }}>No links yet</p>
          {isManager && <p style={{ color: muted, fontSize: '12px' }}>Add links your team uses regularly</p>}
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryLinks]) => {
          const catStyle = CATEGORY_COLORS[category] || CATEGORY_COLORS.General
          return (
            <div key={category} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 10px', borderRadius: '6px', background: catStyle.bg, color: catStyle.color }}>{category}</span>
                <span style={{ fontSize: '11px', color: muted }}>{categoryLinks.length} links</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px' }}>
                {categoryLinks.map(link => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
                    <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '14px', transition: 'border-color 0.15s', position: 'relative' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#1e6cb5'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = border}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.title}</p>
                          {link.description && <p style={{ fontSize: '11px', color: muted, margin: 0, lineHeight: 1.4 }}>{link.description}</p>}
                          <p style={{ fontSize: '10px', color: muted, margin: '5px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.6 }}>{link.url}</p>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </div>
                      {isManager && (
                        <button onClick={e => { e.preventDefault(); e.stopPropagation(); deleteLink(link.id) }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', color: muted, cursor: 'pointer', opacity: 0, padding: '2px', display: 'flex' }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}