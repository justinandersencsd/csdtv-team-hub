'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface Article {
  id: string
  title: string
  content: string
  category: string
  created_by: string
  created_at: string
  updated_at: string
  author?: { name: string } | null
}

interface CurrentUser {
  id: string
  name: string
  role: string
}

const CATEGORIES = ['Process', 'Reference', 'Policy', 'Workflow', 'Other']

export default function KnowledgePage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [articles, setArticles] = useState<Article[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selected, setSelected] = useState<Article | null>(null)
  const [editing, setEditing] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'Process' })

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
    Process:   { bg: 'rgba(30,108,181,0.12)',  color: '#5ba3e0' },
    Reference: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' },
    Policy:    { bg: 'rgba(155,133,224,0.12)', color: '#9b85e0' },
    Workflow:  { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
    Other:     { bg: 'rgba(232,160,32,0.12)',  color: '#e8a020' },
  }

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [articlesRes, userRes] = await Promise.all([
      supabase.from('knowledge_base').select('*, author:team(name)').order('updated_at', { ascending: false }),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
    ])
    setArticles(articlesRes.data || [])
    setCurrentUser(userRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const saveArticle = async () => {
    if (!form.title || !form.content || !currentUser) return
    if (editing && selected) {
      const { data } = await supabase.from('knowledge_base').update({ title: form.title, content: form.content, category: form.category, updated_at: new Date().toISOString() }).eq('id', selected.id).select('*, author:team(name)').single()
      if (data) { setArticles(prev => prev.map(a => a.id === data.id ? data : a)); setSelected(data) }
    } else {
      const { data } = await supabase.from('knowledge_base').insert({ title: form.title, content: form.content, category: form.category, created_by: currentUser.id }).select('*, author:team(name)').single()
      if (data) setArticles(prev => [data, ...prev])
    }
    setEditing(false)
    setShowNew(false)
    setForm({ title: '', content: '', category: 'Process' })
  }

  const filtered = articles.filter(a => {
    const matchSearch = search === '' || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || a.category === categoryFilter
    return matchSearch && matchCat
  })

  const inputStyle = { background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading knowledge base...</p></div>

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Knowledge base</h1>
          <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>{articles.length} articles</p>
        </div>
        <button onClick={() => { setShowNew(true); setSelected(null); setForm({ title: '', content: '', category: 'Process' }) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New article
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected || showNew ? '1fr 1.5fr' : '1fr', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: cardBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', marginBottom: '10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: text, fontFamily: 'inherit', width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {['all', ...CATEGORIES].map(cat => {
              const active = categoryFilter === cat
              const style = cat !== 'all' ? CATEGORY_COLORS[cat] : null
              return (
                <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `0.5px solid ${border}`, background: active ? (style?.bg || '#1e6cb5') : cardBg, color: active ? (style?.color || '#fff') : muted, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {cat === 'all' ? 'All' : cat}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.length === 0 ? (
              <p style={{ color: muted, fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No articles found</p>
            ) : filtered.map(article => {
              const catStyle = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.Other
              const isSelected = selected?.id === article.id
              return (
                <div key={article.id} onClick={() => { setSelected(article); setShowNew(false); setEditing(false) }} style={{ padding: '12px 14px', background: isSelected ? (dark ? 'rgba(30,108,181,0.15)' : 'rgba(30,108,181,0.08)') : cardBg, border: `0.5px solid ${isSelected ? '#1e6cb5' : border}`, borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0, flex: 1 }}>{article.title}</p>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '6px', background: catStyle.bg, color: catStyle.color, flexShrink: 0 }}>{article.category}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {article.content.slice(0, 80)}...
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {(selected || showNew) && (
          <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '20px', position: 'sticky', top: '80px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
            {(editing || showNew) ? (
              <div>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Article title" style={{ ...inputStyle, fontSize: '16px', fontWeight: 500, marginBottom: '10px' }} />
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inputStyle, marginBottom: '10px' }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Write your article content here... Use line breaks for formatting." style={{ ...inputStyle, minHeight: '300px', resize: 'vertical', lineHeight: 1.6 }} />
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button onClick={saveArticle} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save</button>
                  <button onClick={() => { setEditing(false); setShowNew(false) }} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: 'transparent', color: muted, border: `0.5px solid ${border}`, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              </div>
            ) : selected && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: (CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.Other).bg, color: (CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.Other).color }}>{selected.category}</span>
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: 500, color: text, margin: 0 }}>{selected.title}</h2>
                    <p style={{ fontSize: '11px', color: muted, margin: '4px 0 0' }}>
                      {selected.author?.name && `By ${selected.author.name} · `}
                      Updated {new Date(selected.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => { setEditing(true); setForm({ title: selected.title, content: selected.content, category: selected.category }) }} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Edit</button>
                </div>
                <div style={{ fontSize: '13px', color: text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.content}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}