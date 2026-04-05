'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function EquipmentScanPage() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const router = useRouter()
  const supabase = createClient()

  const text = dark ? '#f0f4ff' : '#1a1f36'
  const muted = dark ? '#8899bb' : '#6b7280'
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
  const cardBg = dark ? '#0d1525' : '#ffffff'
  const inputBg = dark ? '#0a0f1e' : '#f8f9fc'

  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)

  async function handleLookup() {
    if (!tagInput.trim()) return
    setSearching(true)
    setError('')
    const padded = tagInput.trim().padStart(4, '0')
    const { data } = await supabase.from('equipment').select('asset_tag').eq('asset_tag', padded).single()
    if (data) {
      router.push(`/dashboard/equipment/${data.asset_tag}`)
    } else {
      setError(`No item found with tag "${padded}"`)
    }
    setSearching(false)
  }

  const inputStyle: React.CSSProperties = {
    background: inputBg, border: `0.5px solid ${border}`, borderRadius: '10px',
    padding: '10px 14px', fontSize: '20px', color: text, fontFamily: 'monospace',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const, minHeight: '56px',
    textAlign: 'center' as const, letterSpacing: '4px', fontWeight: 700,
  }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      <button onClick={() => router.push('/dashboard/equipment')}
        style={{ background: 'none', border: 'none', color: '#5ba3e0', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', marginBottom: '16px', padding: 0 }}>
        ← Equipment
      </button>

      <div style={{ maxWidth: '440px', margin: '60px auto', textAlign: 'center' as const }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📷</div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: text, margin: '0 0 8px' }}>Equipment Lookup</h1>
        <p style={{ fontSize: '14px', color: muted, marginBottom: '28px' }}>
          Enter the asset tag number to find an item
        </p>

        <div style={{ background: cardBg, borderRadius: '16px', padding: '28px', border: `1px solid ${border}` }}>
          <input
            value={tagInput}
            onChange={e => { setTagInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            placeholder="0000"
            style={inputStyle}
            autoFocus
            inputMode="numeric"
          />

          {error && (
            <p style={{ fontSize: '13px', color: '#ef4444', marginTop: '10px' }}>{error}</p>
          )}

          <button
            onClick={handleLookup}
            disabled={!tagInput.trim() || searching}
            style={{
              background: tagInput.trim() ? '#1e6cb5' : '#333', border: 'none', borderRadius: '12px',
              color: '#fff', padding: '14px', fontSize: '15px', cursor: tagInput.trim() ? 'pointer' : 'default',
              fontWeight: 600, fontFamily: 'inherit', width: '100%', marginTop: '16px', minHeight: '50px',
            }}
          >
            {searching ? 'Searching...' : 'Look Up'}
          </button>

          <p style={{ fontSize: '12px', color: muted, marginTop: '16px' }}>
            Camera scanning coming soon — for now, type the 4-digit tag number from the label.
          </p>
        </div>
      </div>
    </div>
  )
}