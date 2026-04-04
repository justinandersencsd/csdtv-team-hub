'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface TeamMember { id: string; name: string; email: string; role: string; avatar_color: string; supabase_user_id: string | null }
interface NotificationPrefs {
  notify_assigned_email: boolean; notify_assigned_inapp: boolean
  notify_completed_email: boolean; notify_completed_inapp: boolean
  notify_new_production_email: boolean; notify_new_production_inapp: boolean
}

const NOTIF_SETTINGS: { label: string; desc: string; emailKey: keyof NotificationPrefs; inappKey: keyof NotificationPrefs }[] = [
  { label: 'Task assigned to me', desc: 'When someone assigns you a task', emailKey: 'notify_assigned_email', inappKey: 'notify_assigned_inapp' },
  { label: 'Task completed', desc: 'When a task you created is completed', emailKey: 'notify_completed_email', inappKey: 'notify_completed_inapp' },
  { label: 'New production synced', desc: 'When productions sync from the site', emailKey: 'notify_new_production_email', inappKey: 'notify_new_production_inapp' },
]

const AVATAR_COLORS = ['#e8a020', '#5ba3e0', '#22c55e', '#9b85e0', '#ef4444', '#f97316', '#06b6d4', '#ec4899']

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const supabase = createClient()

  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null)
  const [team, setTeam] = useState<TeamMember[]>([])
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    notify_assigned_email: true, notify_assigned_inapp: true,
    notify_completed_email: true, notify_completed_inapp: true,
    notify_new_production_email: false, notify_new_production_inapp: true,
  })
  const [loading, setLoading] = useState(true)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [selectedColor, setSelectedColor] = useState('#e8a020')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Staff')
  const [inviteColor, setInviteColor] = useState('#5ba3e0')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ success: boolean; message: string } | null>(null)
  const [savedMsg, setSavedMsg] = useState('')
  const [editingTeamMember, setEditingTeamMember] = useState<string | null>(null)

  const text    = dark ? '#f0f4ff' : '#1a1f36'
  const muted   = dark ? '#8899bb' : '#6b7280'
  const border  = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg  = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const [userRes, teamRes, prefsRes] = await Promise.all([
      supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single(),
      supabase.from('team').select('*').eq('active', true).order('name'),
      supabase.from('notification_preferences').select('*').eq('user_id', session.user.id).single(),
    ])
    setCurrentUser(userRes.data)
    setTeam(teamRes.data || [])
    if (userRes.data) { setProfileForm({ name: userRes.data.name, email: userRes.data.email }); setSelectedColor(userRes.data.avatar_color || '#e8a020') }
    if (prefsRes.data) setNotifPrefs(prefsRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const saveProfile = async () => {
    if (!currentUser) return
    await supabase.from('team').update({ name: profileForm.name, email: profileForm.email, avatar_color: selectedColor }).eq('id', currentUser.id)
    setCurrentUser(prev => prev ? { ...prev, name: profileForm.name, email: profileForm.email, avatar_color: selectedColor } : null)
    setEditingProfile(false)
    setSavedMsg('Profile saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const saveNotifPrefs = async () => {
    if (!currentUser) return
    const existing = await supabase.from('notification_preferences').select('id').eq('user_id', currentUser.id).single()
    if (existing.data) {
      await supabase.from('notification_preferences').update({ ...notifPrefs }).eq('user_id', currentUser.id)
    } else {
      await supabase.from('notification_preferences').insert({ user_id: currentUser.id, ...notifPrefs })
    }
    setSavedMsg('Preferences saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const inviteUser = async () => {
    if (!inviteEmail || !currentUser) return
    setInviting(true)
    setInviteResult(null)

    // Check if email already in team
    const existing = team.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase())
    if (existing) {
      setInviteResult({ success: false, message: `${inviteEmail} is already on the team` })
      setInviting(false)
      return
    }

    // Add to team table
    const name = inviteEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    const { error } = await supabase.from('team').insert({ name, email: inviteEmail, role: inviteRole, active: true, avatar_color: inviteColor })

    if (error) {
      setInviteResult({ success: false, message: 'Failed to add team member. Please try again.' })
      setInviting(false)
      return
    }

    // Send invite email via edge function
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: inviteEmail, name, role: inviteRole, invitedBy: currentUser.name }),
      })
    } catch {
      // Email failed but team member was added - not critical
    }

    setInviteResult({ success: true, message: `${name} added to the team. They can now log in at csdtvstaff.org using their email.` })
    setInviteEmail('')
    setInviting(false)
    loadData()
  }

  const deactivateMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return
    await supabase.from('team').update({ active: false }).eq('id', memberId)
    setTeam(prev => prev.filter(m => m.id !== memberId))
    setSavedMsg(`${memberName} removed`)
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!checked)} style={{ width: '40px', height: '22px', borderRadius: '11px', background: checked ? '#1e6cb5' : (dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'), border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: checked ? '21px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )

  const inputStyle: React.CSSProperties = { background: inputBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '10px 14px', fontSize: '14px', color: text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', minHeight: '44px' }
  const isManager = currentUser?.role === 'Manager'

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading settings...</p></div>

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Settings</h1>
        {savedMsg && <span style={{ fontSize: '12px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '6px 14px', borderRadius: '8px' }}>{savedMsg}</span>}
      </div>

      {/* Profile */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', padding: '20px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: 0 }}>Profile</h2>
          <button onClick={() => setEditingProfile(!editingProfile)} style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '8px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit', minHeight: '40px' }}>{editingProfile ? 'Cancel' : 'Edit'}</button>
        </div>
        {editingProfile ? (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '4px' }}>Name</label>
              <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '4px' }}>Email</label>
              <input value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: muted, display: 'block', marginBottom: '8px' }}>Avatar color</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setSelectedColor(c)} style={{ width: '32px', height: '32px', borderRadius: '50%', background: c, border: selectedColor === c ? `3px solid ${text}` : '3px solid transparent', cursor: 'pointer', boxShadow: selectedColor === c ? `0 0 0 2px ${c}40` : 'none' }} />
                ))}
              </div>
            </div>
            <button onClick={saveProfile} style={{ fontSize: '14px', padding: '10px 20px', borderRadius: '10px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, minHeight: '44px' }}>Save profile</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: currentUser?.avatar_color || '#e8a020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
              {currentUser?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '16px', fontWeight: 500, color: text, margin: 0 }}>{currentUser?.name}</p>
              <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>{currentUser?.email}</p>
              <p style={{ fontSize: '12px', color: muted, margin: '2px 0 0', textTransform: 'capitalize' as const }}>{currentUser?.role}</p>
            </div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', padding: '20px', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 16px' }}>Appearance</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '44px' }}>
          <div>
            <p style={{ fontSize: '14px', color: text, margin: 0 }}>Dark mode</p>
            <p style={{ fontSize: '12px', color: muted, margin: '2px 0 0' }}>Toggle between dark and light theme</p>
          </div>
          <Toggle checked={dark} onChange={toggleTheme} />
        </div>
      </div>

      {/* Notifications */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', padding: '20px', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 16px' }}>Notifications</h2>
        {NOTIF_SETTINGS.map(({ label, desc, emailKey, inappKey }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `0.5px solid ${border}` }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', color: text, margin: 0 }}>{label}</p>
              <p style={{ fontSize: '12px', color: muted, margin: '2px 0 0' }}>{desc}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ fontSize: '11px', color: muted }}>Email</span>
                <Toggle checked={notifPrefs[emailKey]} onChange={v => setNotifPrefs(p => ({ ...p, [emailKey]: v }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ fontSize: '11px', color: muted }}>In-app</span>
                <Toggle checked={notifPrefs[inappKey]} onChange={v => setNotifPrefs(p => ({ ...p, [inappKey]: v }))} />
              </div>
            </div>
          </div>
        ))}
        <button onClick={saveNotifPrefs} style={{ marginTop: '14px', fontSize: '14px', padding: '10px 20px', borderRadius: '10px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, minHeight: '44px' }}>Save preferences</button>
      </div>

      {/* Team management — manager only */}
      {isManager && (
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '14px', padding: '20px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 16px' }}>Team</h2>

          {team.map(member => (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `0.5px solid ${border}` }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>
                {member.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: text, margin: 0 }}>{member.name}</p>
                <p style={{ fontSize: '12px', color: muted, margin: 0 }}>
                  {member.email}
                  {!member.supabase_user_id && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Pending login</span>}
                </p>
              </div>
              <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: muted }}>{member.role}</span>
              {member.id !== currentUser?.id && (
                <button onClick={() => deactivateMember(member.id, member.name)} style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '8px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit', minHeight: '36px' }}>Remove</button>
              )}
            </div>
          ))}

          <div style={{ marginTop: '20px', padding: '16px', background: dark ? 'rgba(255,255,255,0.02)' : '#f8f9fc', borderRadius: '12px', border: `0.5px solid ${border}` }}>
            <h3 style={{ fontSize: '14px', fontWeight: 500, color: text, margin: '0 0 4px' }}>Invite team member</h3>
            <p style={{ fontSize: '12px', color: muted, margin: '0 0 14px', lineHeight: 1.5 }}>
              They'll be added to the team and can log in at <strong>csdtvstaff.org</strong> using their district email — no password needed, just a magic link sent to their inbox.
            </p>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="District email address" type="email" style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={inputStyle}>
                  <option value="Staff">Staff</option>
                  <option value="Manager">Manager</option>
                  <option value="Intern">Intern</option>
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: inputBg, border: `0.5px solid ${border}`, borderRadius: '10px', padding: '8px 12px' }}>
                  <span style={{ fontSize: '12px', color: muted, flexShrink: 0 }}>Color:</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {AVATAR_COLORS.slice(0, 5).map(c => (
                      <button key={c} onClick={() => setInviteColor(c)} style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: inviteColor === c ? `2px solid ${text}` : '2px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={inviteUser} disabled={inviting || !inviteEmail} style={{ fontSize: '14px', padding: '10px 20px', borderRadius: '10px', background: inviteEmail ? '#1e6cb5' : (dark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'), color: inviteEmail ? '#fff' : muted, border: 'none', cursor: inviteEmail ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 500, minHeight: '44px' }}>
              {inviting ? 'Adding...' : 'Add to team'}
            </button>
            {inviteResult && (
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: inviteResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `0.5px solid ${inviteResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <p style={{ fontSize: '13px', color: inviteResult.success ? '#22c55e' : '#ef4444', margin: 0, lineHeight: 1.5 }}>{inviteResult.message}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}