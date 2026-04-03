'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicEmail, setMagicEmail] = useState('')
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.push('/dashboard')
    })
    return () => subscription.unsubscribe()
  }, [supabase, router])

  const handlePasswordLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleMagicLink = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    })
    if (error) setError(error.message)
    else setMessage('Check your email for a login link.')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#0f1829',
        border: '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '2.5rem 2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Image
            src="/images/CSDtv Logo - New Logo Outlined.png"
            alt="CSDtv"
            width={180}
            height={80}
            style={{ objectFit: 'contain' }}
          />
        </div>

        <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 500, color: '#f0f4ff', marginBottom: '4px' }}>
          Team Hub
        </div>
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#8899bb', marginBottom: '1.5rem' }}>
          Internal staff portal
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(232,160,32,0.08)',
          border: '0.5px solid rgba(232,160,32,0.25)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            width: '16px', height: '16px', background: '#e8a020',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '10px', fontWeight: 700,
            color: '#0a0f1e', flexShrink: 0
          }}>!</div>
          <div style={{ fontSize: '12px', color: '#e8a020' }}>
            This system is for CSDtv employees only. Unauthorized access is prohibited.
          </div>
        </div>

        {mode === 'password' ? (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#8899bb', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="you@canyonsdistrict.org"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', background: '#1a2540', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#f0f4ff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#8899bb', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()}
                style={{ width: '100%', background: '#1a2540', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#f0f4ff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {error && <div style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '1rem' }}>{error}</div>}
            <button
              onClick={handlePasswordLogin}
              disabled={loading}
              style={{ width: '100%', background: '#1e6cb5', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }}></div>
              <div style={{ fontSize: '11px', color: '#4a5a7a' }}>or</div>
              <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.08)' }}></div>
            </div>
            <button
              onClick={() => setMode('magic')}
              style={{ width: '100%', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', fontSize: '14px', color: '#8899bb', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Send me a magic link instead
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#8899bb', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                placeholder="you@canyonsdistrict.org"
                value={magicEmail}
                onChange={e => setMagicEmail(e.target.value)}
                style={{ width: '100%', background: '#1a2540', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#f0f4ff', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {error && <div style={{ fontSize: '12px', color: '#e74c3c', marginBottom: '1rem' }}>{error}</div>}
            {message && <div style={{ fontSize: '12px', color: '#2ecc71', marginBottom: '1rem' }}>{message}</div>}
            <button
              onClick={handleMagicLink}
              disabled={loading}
              style={{ width: '100%', background: '#1e6cb5', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '1rem', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
            <button
              onClick={() => setMode('password')}
              style={{ width: '100%', background: 'transparent', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px', fontSize: '14px', color: '#8899bb', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Back to password login
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '11px', color: '#4a5a7a' }}>
          Having trouble? Contact your administrator.
        </div>
      </div>
    </div>
  )
}