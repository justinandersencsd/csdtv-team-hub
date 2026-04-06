'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTheme } from '@/lib/theme'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Category = { id: string; name: string; parent_id: string | null }
type Equipment = {
  id: string; asset_tag: string; name: string; category_id: string | null; subcategory_id: string | null
  brand: string | null; model: string | null; serial_number: string | null; status: string; site: string
  condition: string; notes: string | null; photo_url: string | null; purchase_date: string | null
  cost: number | null; created_at: string; updated_at: string
}
type Loan = {
  id: string; equipment_id: string | null; borrower_name: string; borrower_info: string | null
  checked_out_by: string; checked_out_at: string; due_date: string | null
  checked_in_at: string | null; checked_in_by: string | null; condition_on_return: string | null; notes: string | null
  checked_out_by_user?: { name: string } | null; checked_in_by_user?: { name: string } | null
}
type Activity = {
  id: string; equipment_id: string | null; action: string; detail: string | null
  user_id: string | null; created_at: string; user?: { name: string } | null
}
type Kit = { id: string; name: string }
type TeamMember = { id: string; name: string; role: string }

export default function EquipmentDetailPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const router = useRouter()
  const params = useParams()
  const tag = params.tag as string
  const supabase = createClient()

  const text = dark ? '#f0f4ff' : '#1a1f36'
  const muted = dark ? '#8899bb' : '#6b7280'
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const [item, setItem] = useState<Equipment | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [allKits, setAllKits] = useState<Kit[]>([])
  const [user, setUser] = useState<TeamMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'history' | 'activity'>('info')

  const [showCheckout, setShowCheckout] = useState(false)
  const [borrowerName, setBorrowerName] = useState('')
  const [borrowerInfo, setBorrowerInfo] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editSerial, setEditSerial] = useState('')
  const [editSite, setEditSite] = useState('')
  const [editCondition, setEditCondition] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')

  const [showKitAdd, setShowKitAdd] = useState(false)
  const [selectedKit, setSelectedKit] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: userData } = await supabase.from('team').select('*').eq('supabase_user_id', session.user.id).single()
    if (userData) setUser(userData)

    const { data: eqData } = await supabase.from('equipment').select('*').eq('asset_tag', tag).single()
    if (eqData) {
      setItem(eqData)
      setEditName(eqData.name); setEditBrand(eqData.brand || ''); setEditModel(eqData.model || '')
      setEditSerial(eqData.serial_number || ''); setEditSite(eqData.site || 'District Office')
      setEditCondition(eqData.condition || 'good'); setEditNotes(eqData.notes || ''); setEditStatus(eqData.status)

      const [loanRes, actRes, kitItemRes, allKitRes] = await Promise.all([
        supabase.from('equipment_loans').select('*, checked_out_by_user:team!equipment_loans_checked_out_by_fkey(name), checked_in_by_user:team!equipment_loans_checked_in_by_fkey(name)').eq('equipment_id', eqData.id).order('checked_out_at', { ascending: false }),
        supabase.from('equipment_activity').select('*, user:team!equipment_activity_user_id_fkey(name)').eq('equipment_id', eqData.id).order('created_at', { ascending: false }),
        supabase.from('equipment_kit_items').select('kit_id, kit:equipment_kits(id, name)').eq('equipment_id', eqData.id),
        supabase.from('equipment_kits').select('id, name').order('name'),
      ])
      setLoans(loanRes.data as any || [])
      setActivity(actRes.data as any || [])
      setKits((kitItemRes.data as any || []).map((ki: any) => ki.kit).filter(Boolean))
      setAllKits(allKitRes.data || [])
    }

    const { data: catData } = await supabase.from('equipment_categories').select('id, name, parent_id')
    if (catData) setCategories(catData)
    setLoading(false)
  }, [supabase, tag])

  useEffect(() => { loadData() }, [loadData])

  const getCategoryName = (id: string | null) => categories.find((c: Category) => c.id === id)?.name || '—'
  const isManager = user?.role === 'Manager'

  const statusColor = (s: string) => {
    switch (s) {
      case 'available': return { bg: dark ? '#16382a' : '#dcfce7', text: '#22c55e' }
      case 'checked_out': return { bg: dark ? '#3b2a15' : '#fef3c7', text: '#f59e0b' }
      case 'broken': return { bg: dark ? '#3b1515' : '#fee2e2', text: '#ef4444' }
      case 'maintenance': return { bg: dark ? '#1e2a4a' : '#dbeafe', text: '#3b82f6' }
      case 'retired': return { bg: dark ? '#1f1f2e' : '#f3f4f6', text: '#6b7280' }
      default: return { bg: dark ? '#1f1f2e' : '#f3f4f6', text: '#6b7280' }
    }
  }

  const conditionColor = (c: string) => {
    switch (c) {
      case 'good': return '#22c55e'; case 'fair': return '#f59e0b'
      case 'damaged': return '#ef4444'; case 'needs_repair': return '#f97316'
      default: return muted
    }
  }

  async function handleCheckout() {
    if (!item || !borrowerName.trim() || !user) return
    await supabase.from('equipment_loans').insert({ equipment_id: item.id, borrower_name: borrowerName.trim(), borrower_info: borrowerInfo.trim() || null, checked_out_by: user.id, due_date: dueDate || null })
    await supabase.from('equipment').update({ status: 'checked_out' }).eq('id', item.id)
    await supabase.from('equipment_activity').insert({ equipment_id: item.id, action: 'checked_out', detail: `Checked out to ${borrowerName.trim()}${dueDate ? ` — due ${dueDate}` : ''}`, user_id: user.id })
    setShowCheckout(false); setBorrowerName(''); setBorrowerInfo(''); setDueDate('')
    loadData()
  }

  async function handleCheckin() {
    if (!item || !user) return
    const activeLoan = loans.find((l: Loan) => !l.checked_in_at)
    if (!activeLoan) return
    if (!confirm(`Check in "${item.name}" from ${activeLoan.borrower_name}?`)) return
    await supabase.from('equipment_loans').update({ checked_in_at: new Date().toISOString(), checked_in_by: user.id }).eq('id', activeLoan.id)
    await supabase.from('equipment').update({ status: 'available' }).eq('id', item.id)
    await supabase.from('equipment_activity').insert({ equipment_id: item.id, action: 'checked_in', detail: `Returned by ${activeLoan.borrower_name}`, user_id: user.id })
    loadData()
  }

  async function handleSaveEdit() {
    if (!item || !user) return
    const updates: any = { name: editName, brand: editBrand || null, model: editModel || null, serial_number: editSerial || null, site: editSite, condition: editCondition, notes: editNotes || null, status: editStatus, updated_at: new Date().toISOString() }
    await supabase.from('equipment').update(updates).eq('id', item.id)
    if (editStatus !== item.status) {
      await supabase.from('equipment_activity').insert({ equipment_id: item.id, action: 'status_changed', detail: `Status changed from ${item.status} to ${editStatus}`, user_id: user.id })
    }
    await supabase.from('equipment_activity').insert({ equipment_id: item.id, action: 'edited', detail: 'Item details updated', user_id: user.id })
    setEditing(false)
    loadData()
  }

  async function handleAddToKit() {
    if (!item || !selectedKit || !user) return
    const { error } = await supabase.from('equipment_kit_items').insert({ kit_id: selectedKit, equipment_id: item.id })
    if (error) { alert(error.message.includes('duplicate') ? 'Already in this kit' : error.message); return }
    await supabase.from('equipment_activity').insert({ equipment_id: item.id, action: 'added_to_kit', detail: `Added to kit: ${allKits.find((k: Kit) => k.id === selectedKit)?.name}`, user_id: user.id })
    setShowKitAdd(false); setSelectedKit('')
    loadData()
  }

  async function handleRemoveFromKit(kitId: string, kitName: string) {
    if (!item || !user) return
    if (!confirm(`Remove from "${kitName}"?`)) return
    await supabase.from('equipment_kit_items').delete().eq('kit_id', kitId).eq('equipment_id', item.id)
    await supabase.from('equipment_activity').insert({ equipment_id: item.id, action: 'removed_from_kit', detail: `Removed from kit: ${kitName}`, user_id: user.id })
    loadData()
  }

  const inputStyle: React.CSSProperties = {
    background: inputBg, border: `0.5px solid ${border}`, borderRadius: '10px',
    padding: '10px 14px', fontSize: '14px', color: text, fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const, minHeight: '44px',
  }

  if (loading) {
    return (<div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px', color: muted }}>Loading...</div>)
  }
  if (!item) {
    return (
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px', color: muted }}>
        Equipment not found.
        <button onClick={() => router.push('/dashboard/equipment')} style={{ background: 'none', border: 'none', color: '#5ba3e0', cursor: 'pointer', marginLeft: '8px', fontFamily: 'inherit' }}>Back to list</button>
      </div>
    )
  }

  const sc = statusColor(item.status)
  const activeLoan = loans.find((l: Loan) => !l.checked_in_at)

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      <button onClick={() => router.push('/dashboard/equipment')} style={{ background: 'none', border: 'none', color: '#5ba3e0', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', marginBottom: '16px', padding: 0 }}>← Equipment</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {item.photo_url && <img src={item.photo_url} alt={item.name} style={{ width: '96px', height: '96px', borderRadius: '12px', objectFit: 'cover', border: `1px solid ${border}`, flexShrink: 0 }} />}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: 700, color: '#5ba3e0' }}>{item.asset_tag}</span>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: text, margin: 0 }}>{item.name}</h1>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: sc.bg, color: sc.text }}>{item.status.replace('_', ' ')}</span>
              <span style={{ fontSize: '13px', color: muted }}>{item.site}</span>
              <span style={{ fontSize: '13px', color: conditionColor(item.condition) }}>Condition: {item.condition.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {item.status === 'available' && <button onClick={() => setShowCheckout(true)} style={{ background: '#1e6cb5', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', minHeight: '44px' }}>Check Out</button>}
          {item.status === 'checked_out' && activeLoan && <button onClick={handleCheckin} style={{ background: '#22c55e', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', minHeight: '44px' }}>Check In</button>}
          {isManager && !editing && <button onClick={() => setEditing(true)} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: '10px', color: muted, padding: '10px 20px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px' }}>Edit</button>}
        </div>
      </div>

      {activeLoan && (
        <div style={{ background: dark ? '#3b2a15' : '#fef3c7', borderRadius: '12px', padding: '14px 20px', marginBottom: '16px', border: `1px solid ${dark ? '#5a3a10' : '#fcd34d'}` }}>
          <div style={{ fontSize: '14px', color: dark ? '#fbbf24' : '#92400e' }}>
            Currently with <strong>{activeLoan.borrower_name}</strong>
            {activeLoan.borrower_info && ` (${activeLoan.borrower_info})`}
            {' · '}Checked out {new Date(activeLoan.checked_out_at).toLocaleDateString()}
            {activeLoan.due_date && <span style={{ color: new Date(activeLoan.due_date) < new Date() ? '#ef4444' : 'inherit' }}>{' · '}Due {new Date(activeLoan.due_date).toLocaleDateString()}{new Date(activeLoan.due_date) < new Date() && ' (OVERDUE)'}</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${border}` }}>
        {(['info', 'history', 'activity'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #5ba3e0' : '2px solid transparent', padding: '10px 18px', fontSize: '14px', fontWeight: tab === t ? 600 : 400, color: tab === t ? '#5ba3e0' : muted, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
            {t === 'info' ? 'Details' : t === 'history' ? `Loan History (${loans.length})` : `Activity (${activity.length})`}
          </button>
        ))}
      </div>

      {tab === 'info' && !editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ background: cardBg, borderRadius: '14px', padding: '20px', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: text, marginBottom: '16px' }}>Item Details</div>
            {[{ label: 'Asset Tag', value: item.asset_tag }, { label: 'Name', value: item.name }, { label: 'Brand', value: item.brand || '—' }, { label: 'Model', value: item.model || '—' }, { label: 'Serial Number', value: item.serial_number || '—' }, { label: 'Category', value: getCategoryName(item.category_id) }, { label: 'Subcategory', value: getCategoryName(item.subcategory_id) }, { label: 'Status', value: item.status.replace('_', ' ') }, { label: 'Condition', value: item.condition.replace('_', ' ') }, { label: 'Site', value: item.site }].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${border}`, fontSize: '14px' }}>
                <span style={{ color: muted }}>{row.label}</span>
                <span style={{ color: text, fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
            {item.notes && <div style={{ marginTop: '12px' }}><div style={{ fontSize: '13px', color: muted, marginBottom: '4px' }}>Notes</div><div style={{ fontSize: '14px', color: text }}>{item.notes}</div></div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: cardBg, borderRadius: '14px', padding: '20px', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: text }}>Kits ({kits.length})</div>
                {isManager && <button onClick={() => setShowKitAdd(!showKitAdd)} style={{ background: 'none', border: 'none', color: '#5ba3e0', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>{showKitAdd ? 'Cancel' : '+ Add to Kit'}</button>}
              </div>
              {showKitAdd && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <select value={selectedKit} onChange={(e) => setSelectedKit(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                    <option value="">Select a kit...</option>
                    {allKits.filter((k) => !kits.find((mk) => mk.id === k.id)).map((k) => (<option key={k.id} value={k.id}>{k.name}</option>))}
                  </select>
                  <button onClick={handleAddToKit} disabled={!selectedKit} style={{ background: selectedKit ? '#1e6cb5' : '#333', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 16px', fontSize: '13px', cursor: selectedKit ? 'pointer' : 'default', fontWeight: 600, fontFamily: 'inherit', minHeight: '44px', whiteSpace: 'nowrap' }}>Add</button>
                </div>
              )}
              {kits.length === 0 && !showKitAdd && <div style={{ fontSize: '13px', color: muted }}>Not in any kit</div>}
              {kits.map((kit) => (
                <div key={kit.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${border}` }}>
                  <span style={{ fontSize: '14px', color: text }}>{kit.name}</span>
                  {isManager && <button onClick={() => handleRemoveFromKit(kit.id, kit.name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Remove</button>}
                </div>
              ))}
            </div>
            <div style={{ background: cardBg, borderRadius: '14px', padding: '20px', border: `1px solid ${border}` }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: text, marginBottom: '12px' }}>History</div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '22px', fontWeight: 700, color: '#5ba3e0' }}>{loans.length}</div><div style={{ fontSize: '12px', color: muted }}>Total Loans</div></div>
                <div><div style={{ fontSize: '22px', fontWeight: 700, color: '#f59e0b' }}>{loans.filter((l) => !l.checked_in_at).length}</div><div style={{ fontSize: '12px', color: muted }}>Active</div></div>
                <div><div style={{ fontSize: '22px', fontWeight: 700, color: text }}>{activity.length}</div><div style={{ fontSize: '12px', color: muted }}>Activities</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'info' && editing && (
        <div style={{ background: cardBg, borderRadius: '14px', padding: '24px', border: `1px solid ${border}`, maxWidth: '600px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: text, marginBottom: '16px' }}>Edit Item</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Name</label><input value={editName} onChange={(e) => setEditName(e.target.value)} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Brand</label><input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} style={inputStyle} /></div>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Model</label><input value={editModel} onChange={(e) => setEditModel(e.target.value)} style={inputStyle} /></div>
            </div>
            <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Serial Number</label><input value={editSerial} onChange={(e) => setEditSerial(e.target.value)} style={inputStyle} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Status</label><select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={inputStyle}><option value="available">Available</option><option value="checked_out">Checked Out</option><option value="broken">Broken</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option></select></div>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Site</label><select value={editSite} onChange={(e) => setEditSite(e.target.value)} style={inputStyle}><option value="District Office">District Office</option><option value="Trailer">Trailer</option><option value="Van">Van</option><option value="Other">Other</option></select></div>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Condition</label><select value={editCondition} onChange={(e) => setEditCondition(e.target.value)} style={inputStyle}><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option><option value="needs_repair">Needs Repair</option></select></div>
            </div>
            <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Notes</label><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' as const }} /></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={handleSaveEdit} style={{ background: '#1e6cb5', border: 'none', borderRadius: '10px', color: '#fff', padding: '10px 24px', fontSize: '14px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', minHeight: '44px' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: '10px', color: muted, padding: '10px 24px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px' }}>Cancel</button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, overflow: 'hidden' }}>
          {loans.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: muted, fontSize: '14px' }}>No loan history</div>}
          {loans.map((loan, i) => {
            const isActive = !loan.checked_in_at
            const isOverdue = isActive && loan.due_date && new Date(loan.due_date) < new Date()
            return (
              <div key={loan.id} style={{ padding: '14px 20px', borderBottom: i < loans.length - 1 ? `1px solid ${border}` : 'none', borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: text }}>{loan.borrower_name}{loan.borrower_info && <span style={{ color: muted, fontWeight: 400 }}> ({loan.borrower_info})</span>}</div>
                  <div>
                    {isActive && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: isOverdue ? (dark ? '#3b1515' : '#fee2e2') : (dark ? '#3b2a15' : '#fef3c7'), color: isOverdue ? '#ef4444' : '#f59e0b', textTransform: 'uppercase' }}>{isOverdue ? 'Overdue' : 'Active'}</span>}
                    {!isActive && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: dark ? '#16382a' : '#dcfce7', color: '#22c55e' }}>Returned</span>}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: muted }}>
                  Out: {new Date(loan.checked_out_at).toLocaleDateString()} by {(loan.checked_out_by_user as any)?.name || '?'}
                  {loan.due_date && ` · Due: ${new Date(loan.due_date).toLocaleDateString()}`}
                  {loan.checked_in_at && ` · In: ${new Date(loan.checked_in_at).toLocaleDateString()} by ${(loan.checked_in_by_user as any)?.name || '?'}`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'activity' && (
        <div style={{ background: cardBg, borderRadius: '14px', border: `1px solid ${border}`, overflow: 'hidden' }}>
          {activity.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: muted, fontSize: '14px' }}>No activity yet</div>}
          {activity.map((a, i) => (
            <div key={a.id} style={{ padding: '12px 20px', borderBottom: i < activity.length - 1 ? `1px solid ${border}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#5ba3e0', marginRight: '8px' }}>{a.action.replace('_', ' ')}</span>
                <span style={{ fontSize: '13px', color: text }}>{a.detail || ''}</span>
              </div>
              <div style={{ fontSize: '11px', color: muted, whiteSpace: 'nowrap', marginLeft: '12px' }}>{(a.user as any)?.name || ''} · {new Date(a.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}

      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: dark ? '#111827' : '#fff', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', border: `1px solid ${border}` }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: text, marginBottom: '4px' }}>Check Out</div>
            <div style={{ fontSize: '13px', color: muted, marginBottom: '20px' }}>{item.asset_tag} — {item.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Student / Borrower Name *</label><input value={borrowerName} onChange={(e) => setBorrowerName(e.target.value)} placeholder="Enter name" style={inputStyle} autoFocus /></div>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Additional Info</label><input value={borrowerInfo} onChange={(e) => setBorrowerInfo(e.target.value)} placeholder="Class, teacher, phone (optional)" style={inputStyle} /></div>
              <div><label style={{ fontSize: '13px', color: muted, display: 'block', marginBottom: '4px' }}>Due Date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={handleCheckout} disabled={!borrowerName.trim()} style={{ background: borrowerName.trim() ? '#1e6cb5' : '#333', border: 'none', borderRadius: '10px', color: '#fff', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: borrowerName.trim() ? 'pointer' : 'default', fontFamily: 'inherit', flex: 1, minHeight: '44px' }}>Confirm</button>
              <button onClick={() => { setShowCheckout(false); setBorrowerName(''); setBorrowerInfo(''); setDueDate('') }} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: '10px', color: muted, padding: '12px 24px', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}