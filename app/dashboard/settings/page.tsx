'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  avatar_color: string
  supabase_user_id: string | null
}

interface NotificationPrefs {
  notify_assigned_email: boolean
  notify_assigned_inapp: boolean
  notify_completed_email: boolean
  notify_completed_inapp: boolean
  notify_new_production_email: boolean
  notify_new_production_inapp: boolean
}

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
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Staff')
  const [inviteSent, setInviteSent] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

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
      supabase.from('team').select('*').eq('active', true),
      supabase.from('notification_preferences').select('*').eq('user_id', session.user.id).single(),
    ])
    setCurrentUser(userRes.data)
    setTeam(teamRes.data || [])
    if (userRes.data) setProfileForm({ name: userRes.data.name, email: userRes.data.email })
    if (prefsRes.data) setNotifPrefs(prefsRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const saveProfile = async () => {
    if (!currentUser) return
    await supabase.from('team').update({ name: profileForm.name, email: profileForm.email }).eq('id', currentUser.id)
    setCurrentUser(prev => prev ? { ...prev, ...profileForm } : null)
    setEditingProfile(false)
    setSavedMsg('Profile saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const saveNotifPrefs = async () => {
    if (!currentUser) return
    const existing = await supabase.from('notification_preferences').select('id').eq('user_id', currentUser.id).single()
    if (existing.data) {
      await supabase.from('notification_preferences').update({ ...notifPrefs, updated_at: new Date().toISOString() }).eq('user_id', currentUser.id)
    } else {
      await supabase.from('notification_preferences').insert({ user_id: currentUser.id, ...notifPrefs })
    }
    setSavedMsg('Preferences saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const inviteUser = async () => {
    if (!inviteEmail || !currentUser) return
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail)
    if (!error && data?.user) {
      await supabase.from('team').insert({ name: inviteEmail.split('@')[0], email: inviteEmail, role: inviteRole, supabase_user_id: data.user.id, active: true, avatar_color: '#5ba3e0' })
      setInviteEmail('')
      setInviteSent(true)
      setTimeout(() => setInviteSent(false), 3000)
      loadData()
    }
  }

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!checked)} style={{ width: '36px', height: '20px', borderRadius: '10px', background: checked ? '#1e6cb5' : (dark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'), border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: checked ? '19px' : '3px', transition: 'left 0.2s' }} />
    </button>
  )

  const inputStyle = { background: inputBg, border: `0.5px solid ${border}`, borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: text, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const isManager = currentUser?.role === 'Manager'

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}><p style={{ color: muted }}>Loading settings...</p></div>

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: text, margin: 0 }}>Settings</h1>
        {savedMsg && <span style={{ fontSize: '12px', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 12px', borderRadius: '6px' }}>{savedMsg}</span>}
      </div>

      {/* Profile */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: 0 }}>Profile</h2>
          <button onClick={() => setEditingProfile(!editingProfile)} style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '8px', background: 'transparent', border: `0.5px solid ${border}`, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}>{editingProfile ? 'Cancel' : 'Edit'}</button>
        </div>
        {editingProfile ? (
          <div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Name</label>
              <input value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: muted, display: 'block', marginBottom: '4px' }}>Email</label>
              <input value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={saveProfile} style={{ fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save profile</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: currentUser?.avatar_color || '#e8a020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
              {currentUser?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 500, color: text, margin: 0 }}>{currentUser?.name}</p>
              <p style={{ fontSize: '13px', color: muted, margin: '2px 0 0' }}>{currentUser?.email}</p>
              <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0', textTransform: 'capitalize' }}>{currentUser?.role}</p>
            </div>
          </div>
        )}
      </div>

      {/* Appearance */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 16px' }}>Appearance</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', color: text, margin: 0 }}>Dark mode</p>
            <p style={{ fontSize: '11px', color: muted, margin: '2px 0 0' }}>Toggle between dark and light theme</p>
          </div>
          <Toggle checked={dark} onChange={toggleTheme} />
        </div>
      </div>

      {/* Notifications */}
      <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 16px' }}>Notifications</h2>
        {[
          { label: 'Task assigned to me', emailKey: 'notify_assigned_email', inappKey: 'notify_assigned_inapp' },
          { label: 'Task completed', emailKey: 'notify_completed_email', inappKey: 'notify_completed_inapp' },
          { label: 'New production synced', emailKey: 'notify_new_production_email', inappKey: 'notify_new_production_inapp' },
        ].map(({ label, emailKey, inappKey }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `0.5px solid ${border}` }}>
            <p style={{ fontSize: '13px', color: text, margin: 0 }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: muted }}>Email</span>
                <Toggle checked={(notifPrefs as Record<string, boolean>)[emailKey]} onChange={v => setNotifPrefs(p => ({ ...p, [emailKey]: v }))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: muted }}>In-app</span>
                <Toggle checked={(notifPrefs as Record<string, boolean>)[inappKey]} onChange={v => setNotifPrefs(p => ({ ...p, [inappKey]: v }))} />
              </div>
            </div>
          </div>
        ))}
        <button onClick={saveNotifPrefs} style={{ marginTop: '12px', fontSize: '13px', padding: '7px 16px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>Save preferences</button>
      </div>

      {/* Team management — manager only */}
      {isManager && (
        <div style={{ background: cardBg, border: `0.5px solid ${border}`, borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, color: text, margin: '0 0 16px' }}>Team</h2>
          <div style={{ marginBottom: '16px' }}>
            {team.map(member => (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `0.5px solid ${border}` }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: member.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#0a0f1e', flexShrink: 0 }}>
                  {member.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: text, margin: 0 }}>{member.name}</p>
                  <p style={{ fontSize: '11px', color: muted, margin: 0 }}>{member.email}</p>
                </div>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', color: muted }}>{member.role}</span>
              </div>
            ))}
          </div>
          <h3 style={{ fontSize: '13px', fontWeight: 500, color: text, margin: '0 0 10px' }}>Invite team member</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center' }}>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
            </select>
            <button onClick={inviteUser} style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '8px', background: '#1e6cb5', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {inviteSent ? '✓ Invited' : 'Send invite'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}