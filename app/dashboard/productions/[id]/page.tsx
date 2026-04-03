'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { getSchoolName } from '@/lib/schools'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Production {
  id: string
  production_number: number
  title: string
  type: string | null
  request_type_label: string | null
  request_type_number: number | null
  internal_type_label: string | null
  internal_type_number: number | null
  status: string | null
  organizer_name: string | null
  organizer_email: string | null
  school_department: string | null
  school_year: string | null
  focus_area: string | null
  start_datetime: string | null
  end_datetime: string | null
  filming_location: string | null
  event_location: string | null
  additional_notes: string | null
  video_description: string | null
  video_shoot_type: string | null
  livestream_url: string | null
  thumbnail_url: string | null
  camera_options: string | null
  video_addons: string | null
  audio_options: string | null
  delivery_streaming: string | null
  file_url: string | null
  project_lead: string | null
  synced_at: string | null
}

interface ChecklistItem {
  id: string
  title: string
  completed: boolean
  completed_at: string | null
  assigned_to: string | null
  sort_order: number
  team?: { name: string; avatar_color: string } | null
}

interface TeamMember {
  id: string
  name: string
  role: string
  avatar_color: string
}

interface ProductionLink {
  id: string
  title: string
  url: string
  created_at: string
}

interface ActivityItem {
  id: string
  action: string
  detail: string | null
  created_at: string
  team?: { name: string } | null
}

const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  'LiveStream Meeting': ['Create thumbnail', 'Create livestream link', 'Assign staff', 'Determine if students needed', 'Confirm equipment type and pack', 'Email organizer'],
  'Record Meeting': ['Gather equipment', 'Record', 'Edit', 'Send for feedback', 'Final export', 'Send to organizer'],
  'Create a Video(Film, Edit, Publish)': ['Work with organizer on script', 'Create shot guide', 'Prep shoot and schedule', 'Pack equipment', 'Film', 'Edit', 'Send for feedback', 'Final export', 'Send to organizer'],
  'Create a Video': ['Work with organizer on script', 'Create shot guide', 'Prep shoot and schedule', 'Pack equipment', 'Film', 'Edit', 'Send for feedback', 'Final export', 'Send to organizer'],
  'Board Meeting': ['Setup board room', 'Find out if any virtual attendees', 'Create stream link', 'Create thumbnail', 'Email link to comms', 'Add to agenda', 'Stream meeting', 'Export board comments and run through AI', 'Email to Jeff'],
  'Photo Headshots': ['Confirm appointment', 'Send email — what to wear', 'Pack up shoot', 'Shoot', 'Edit photos', 'Send to organizer'],
  'Podcast': ['Confirm guest and topic', 'Prep equipment', 'Record', 'Edit audio', 'Create artwork or thumbnail', 'Export and publish'],
  'Other, Unsure, Or Consultation': ['Initial consultation', 'Define scope and deliverables', 'Execute', 'Review and deliver'],
}

export default function ProductionDetailPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string

  const [production, setProduction] = useState<Production | null>(null)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [links, setLinks] = useState<ProductionLink[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [assignSuccess, setAssignSuccess] = useState(false)
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [activeTab, setActiveTab] = useState<'checklist' | 'info' | 'links' | 'activity'>('checklist')

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'
  const pageBg  = dark ? '#0a0f1e' : '#f8f9fc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [prodRes, checkRes, teamRes, linksRes, actRes, userRes] = await Promise.all([
      supabase.from('productions').select('*').eq('id', id).single(),
      supabase.from('checklist_items').select('*, team:team(name, avatar_color)').eq('production_id', id).order('sort_order'),
      supabase.from('team').select('*').eq('active', true),
      supabase.from('production_links').select('*').eq('production_id', id).order('created_at'),
      supabase.from('production_activity').select('*, team:team(name)').eq('production_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
    ])

    setProduction(prodRes.data)
    setChecklist(checkRes.data || [])
    setTeam(teamRes.data || [])
    setLinks(linksRes.data || [])
    setActivity(actRes.data || [])
    setCurrentUser(userRes.data)
    setLoading(false)
  }, [supabase, id])

  useEffect(() => { loadData() }, [loadData])

  const getTypeLabel = (prod: Production) => prod.request_type_label || prod.type || 'Unknown'

  const initChecklist = useCallback(async () => {
    if (!production || !currentUser) return
    const typeLabel = getTypeLabel(production)
    const template = CHECKLIST_TEMPLATES[typeLabel] || CHECKLIST_TEMPLATES['Other, Unsure, Or Consultation']
    const items = template.map((title, i) => ({
      production_id: id,
      title,
      sort_order: i,
      completed: false,
    }))
    const { data } = await supabase.from('checklist_items').insert(items).select('*, team:team(name, avatar_color)')
    if (data) {
      setChecklist(data)
      await logActivity('Initialized checklist', `Added ${data.length} steps from ${typeLabel} template`)
    }
  }, [production, currentUser, id, supabase])

  const toggleItem = useCallback(async (item: ChecklistItem) => {
    const updates = {
      completed: !item.completed,
      completed_at: !item.completed ? new Date().toISOString() : null,
      completed_by: !item.completed ? currentUser?.id : null,
    }
    await supabase.from('checklist_items').update(updates).eq('id', item.id)
    setChecklist(prev => prev.map(c => c.id === item.id ? { ...c, ...updates } : c))
    await logActivity(
      !item.completed ? 'Completed step' : 'Uncompleted step',
      item.title
    )
  }, [supabase, currentUser])

  const massAssign = useCallback(async () => {
    if (!selectedMember) return
    await supabase.from('checklist_items').update({ assigned_to: selectedMember }).eq('production_id', id)
    const member = team.find(m => m.id === selectedMember)
    setChecklist(prev => prev.map(c => ({ ...c, assigned_to: selectedMember, team: member ? { name: member.name, avatar_color: member.avatar_color } : c.team })))
    setSelectedMember(null)
    setAssignSuccess(true)
    setTimeout(() => setAssignSuccess(false), 2500)
    await logActivity('Mass assigned checklist', `All steps assigned to ${member?.name}`)
  }, [selectedMember, id, supabase, team])

  const assignItem = useCallback(async (itemId: string, memberId: string | null) => {
    await supabase.from('checklist_items').update({ assigned_to: memberId }).eq('id', itemId)
    const member = team.find(m => m.id === memberId)
    setChecklist(prev => prev.map(c => c.id === itemId ? { ...c, assigned_to: memberId, team: member ? { name: member.name, avatar_color: member.avatar_color } : null } : c))
  }, [supabase, team])

  const addLink = useCallback(async () => {
    if (!newLinkTitle || !newLinkUrl || !currentUser) return
    const url = newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`
    const { data } = await supabase.from('production_links').insert({
      production_id: id,
      title: newLinkTitle,
      url,
      added_by: currentUser.id,
    }).select().single()
    if (data) {
      setLinks(prev => [...prev, data])
      setNewLinkTitle('')
      setNewLinkUrl('')
      setShowLinkForm(false)
    }
  }, [newLinkTitle, newLinkUrl, currentUser, id, supabase])

  const logActivity = useCallback(async (action: string, detail?: string) => {
    if (!currentUser) return
    await supabase.from('production_activity').insert({
      production_id: id,
      user_id: currentUser.id,
      action,
      detail: detail || null,
    })
  }, [currentUser, id, supabase])

  const formatDateTime = (d: string | null) => {
    if (!d) return null
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const completedCount = checklist.filter(c => c.completed).length
  const progress = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0

  const tabBtn = (tab: typeof activeTab, label: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      style={{
        fontSize: '13px', padding: '8px 16px', border: 'none',
        background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
        color: activeTab === tab ? '#5ba3e0' : muted,
        borderBottom: activeTab === tab ? '2px solid #1e6cb5' : '2px solid transparent',
        fontWeight: activeTab === tab ? 500 : 400,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: muted, fontSize: '14px' }}>Loading production...</p>
      </div>
    )
  }

  if (!production) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: muted, fontSize: '14px', marginBottom: '12px' }}>Production not found</p>
        <Link href="/dashboard/productions" style={{ color: '#5ba3e0', fontSize: '13px' }}>Back to productions</Link>
      </div>
    )
  }

  const typeLabel = getTypeLabel(production)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Back link */}
      <Link href="/dashboard/productions" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: muted, fontSize: '13px', textDecoration: 'none', marginBottom: '16px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        Productions
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: muted }}>#{production.production_number}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(30,108,181,0.12)', color: '#5ba3e0' }}>{typeLabel}</span>
              {production.internal_type_label && production.internal_type_label !== typeLabel && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: muted }}>{production.internal_type_label}</span>
              )}
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>{production.status}</span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: '0 0 6px' }}>{production.title}</h1>
            {production.organizer_name && (
              <p style={{ fontSize: '13px', color: muted, margin: 0 }}>
                {production.organizer_name}
                {production.organizer_email && <span> · <a href={`mailto:${production.organizer_email}`} style={{ color: '#5ba3e0', textDecoration: 'none' }}>{production.organizer_email}</a></span>}
              </p>
            )}
          </div>

          {/* Thumbnail */}
          {production.thumbnail_url && (
            <div style={{ width: '120px', height: '68px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: border }}>
              <img src={production.thumbnail_url} alt="Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
          )}
        </div>

        {/* Quick info strip */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px', padding: '10px 14px', background: cardBg, borderRadius: '10px', border: `0.5px solid ${border}` }}>
          {production.start_datetime && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: muted }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span style={{ color: text }}>{formatDateTime(production.start_datetime)}</span>
            </div>
          )}
          {production.filming_location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: muted }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ color: text }}>{getSchoolName(production.filming_location)}</span>
            </div>
          )}
          {production.event_location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: muted }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <span style={{ color: text }}>{production.event_location}</span>
            </div>
          )}
          {production.school_department && production.school_department !== '0' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: muted }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
              <span style={{ color: text }}>{getSchoolName(production.school_department)}</span>
            </div>
          )}
          {production.livestream_url && production.livestream_url.length > 0 && (
            <a href={production.livestream_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5ba3e0', textDecoration: 'none' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
              Livestream link
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `0.5px solid ${border}`, marginBottom: '20px', gap: '0' }}>
        {tabBtn('checklist', `Checklist ${checklist.length > 0 ? `(${completedCount}/${checklist.length})` : ''}`)}
        {tabBtn('info', 'Production info')}
        {tabBtn('links', `Links ${links.length > 0 ? `(${links.length})` : ''}`)}
        {tabBtn('activity', 'Activity')}
      </div>

      {/* CHECKLIST TAB */}
      {activeTab === 'checklist' && (
        <div>
          {checklist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: cardBg, borderRadius: '12px', border: `0.5px solid ${border}` }}>
              <p style={{ color: muted, fontSize: '14px', marginBottom: '12px' }}>No checklist yet for this production</p>
              <button
                onClick={initChecklist}
                style={{ fontSize: '13px', padding: '8px 20px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
              >
                Load {typeLabel} template
              </button>
            </div>
          ) : (
            <div>
              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ flex: 1, height: '6px', background: dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#22c55e' : '#1e6cb5', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '12px', color: muted, flexShrink: 0 }}>{completedCount} of {checklist.length} complete</span>
              </div>

              {/* Mass assign bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: muted, flexShrink: 0 }}>Mass assign all to:</span>
                <div style={{ display: 'flex', gap: '6px', flex: 1, flexWrap: 'wrap' }}>
                  {team.map(member => (
                    <button
                      key={member.id}
                      onClick={() => setSelectedMember(selectedMember === member.id ? null : member.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                        border: `0.5px solid ${selectedMember === member.id ? '#22c55e' : border}`,
                        background: selectedMember === member.id ? 'rgba(34,197,94,0.1)' : 'transparent',
                        color: selectedMember === member.id ? '#22c55e' : muted,
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, color: '#0a0f1e' }}>
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      {member.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={massAssign}
                  disabled={!selectedMember}
                  style={{
                    fontSize: '12px', padding: '6px 14px', borderRadius: '8px', border: 'none',
                    background: selectedMember ? '#1e6cb5' : (dark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'),
                    color: selectedMember ? '#fff' : muted,
                    cursor: selectedMember ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 500,
                    flexShrink: 0, transition: 'all 0.15s',
                  }}
                >
                  {assignSuccess ? '✓ Assigned' : 'Assign all'}
                </button>
              </div>

              {/* Checklist items */}
              <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', overflow: 'hidden' }}>
                {checklist.map((item, i) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px',
                      borderBottom: i < checklist.length - 1 ? `0.5px solid ${border}` : 'none',
                      background: item.completed ? (dark ? 'rgba(34,197,94,0.04)' : 'rgba(34,197,94,0.03)') : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item)}
                      style={{
                        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                        border: `1.5px solid ${item.completed ? '#22c55e' : border}`,
                        background: item.completed ? '#22c55e' : 'transparent',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                    >
                      {item.completed && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>

                    {/* Title */}
                    <span style={{ flex: 1, fontSize: '13px', color: item.completed ? muted : text, textDecoration: item.completed ? 'line-through' : 'none' }}>
                      {item.title}
                    </span>

                    {/* Assignee selector */}
                    <select
                      value={item.assigned_to || ''}
                      onChange={e => assignItem(item.id, e.target.value || null)}
                      style={{
                        fontSize: '11px', padding: '3px 8px', borderRadius: '6px',
                        border: `0.5px solid ${border}`,
                        background: inputBg, color: item.assigned_to ? text : muted,
                        cursor: 'pointer', fontFamily: 'inherit', maxWidth: '120px',
                      }}
                    >
                      <option value="">Unassigned</option>
                      {team.map(m => (
                        <option key={m.id} value={m.id}>{m.name.split(' ')[0]}</option>
                      ))}
                    </select>

                    {/* Assigned avatar */}
                    {item.team && (
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: item.team.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
                        {item.team.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add custom step */}
              <button
                onClick={async () => {
                  const title = prompt('New step title:')
                  if (!title) return
                  const { data } = await supabase.from('checklist_items').insert({ production_id: id, title, sort_order: checklist.length, completed: false }).select('*, team:team(name, avatar_color)').single()
                  if (data) setChecklist(prev => [...prev, data])
                }}
                style={{ marginTop: '10px', fontSize: '12px', color: muted, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 0' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add step
              </button>
            </div>
          )}
        </div>
      )}

      {/* INFO TAB */}
      {activeTab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

          <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 500, color: muted, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Organizer</h3>
            {[
              { label: 'Name', value: production.organizer_name },
              { label: 'Email', value: production.organizer_email },
              { label: 'School', value: getSchoolName(production.school_department) },
              { label: 'School year', value: production.school_year },
              { label: 'Focus area', value: production.focus_area },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ display: 'flex', gap: '10px', padding: '6px 0', borderBottom: `0.5px solid ${border}`, fontSize: '13px' }}>
                <span style={{ color: muted, minWidth: '90px', flexShrink: 0 }}>{label}</span>
                <span style={{ color: text }}>{value}</span>
              </div>
            ) : null)}
          </div>

          <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: 500, color: muted, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Schedule & location</h3>
            {[
              { label: 'Start', value: formatDateTime(production.start_datetime) },
              { label: 'End', value: formatDateTime(production.end_datetime) },
              { label: 'Filming at', value: getSchoolName(production.filming_location) },
              { label: 'Event location', value: production.event_location },
            ].map(({ label, value }) => value ? (
              <div key={label} style={{ display: 'flex', gap: '10px', padding: '6px 0', borderBottom: `0.5px solid ${border}`, fontSize: '13px' }}>
                <span style={{ color: muted, minWidth: '90px', flexShrink: 0 }}>{label}</span>
                <span style={{ color: text }}>{value}</span>
              </div>
            ) : null)}
          </div>

          {production.additional_notes && (
            <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 500, color: muted, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Organizer notes</h3>
              <p style={{ fontSize: '13px', color: text, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{production.additional_notes}</p>
            </div>
          )}

          {production.video_description && (
            <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 500, color: muted, textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 10px' }}>Video description</h3>
              <p style={{ fontSize: '13px', color: text, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{production.video_description}</p>
            </div>
          )}
        </div>
      )}

      {/* LINKS TAB */}
      {activeTab === 'links' && (
        <div>
          {links.length === 0 && !showLinkForm && (
            <p style={{ color: muted, fontSize: '13px', marginBottom: '12px' }}>No links added yet</p>
          )}

          {links.map(link => (
            <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: cardBg, border: `0.5px solid ${border}`, borderRadius: '10px', marginBottom: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              <div style={{ flex: 1 }}>
                <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#5ba3e0', textDecoration: 'none', fontWeight: 500 }}>{link.title}</a>
                <p style={{ fontSize: '11px', color: muted, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</p>
              </div>
            </div>
          ))}

          {showLinkForm ? (
            <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '16px' }}>
              <input
                value={newLinkTitle}
                onChange={e => setNewLinkTitle(e.target.value)}
                placeholder="Link title (e.g. Shot guide, Script)"
                style={{ width: '100%', background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: text, fontFamily: 'inherit', outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
              />
              <input
                value={newLinkUrl}
                onChange={e => setNewLinkUrl(e.target.value)}
                placeholder="URL (e.g. https://docs.google.com/...)"
                style={{ width: '100%', background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: text, fontFamily: 'inherit', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addLink} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Add link</button>
                <button onClick={() => setShowLinkForm(false)} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: 'transparent', color: muted, border: `0.5px solid ${border}`, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowLinkForm(true)} style={{ fontSize: '13px', color: '#5ba3e0', background: 'none', border: `0.5px solid ${border}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontFamily: 'inherit' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add link
            </button>
          )}
        </div>
      )}

      {/* ACTIVITY TAB */}
      {activeTab === 'activity' && (
        <div>
          {activity.length === 0 ? (
            <p style={{ color: muted, fontSize: '13px' }}>No activity yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {activity.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: `0.5px solid ${border}` }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={muted} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: text, margin: '0 0 2px' }}>
                      <span style={{ fontWeight: 500 }}>{item.team?.name || 'Someone'}</span> {item.action.toLowerCase()}
                    </p>
                    {item.detail && <p style={{ fontSize: '12px', color: muted, margin: 0 }}>{item.detail}</p>}
                    <p style={{ fontSize: '11px', color: muted, margin: '3px 0 0' }}>
                      {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}