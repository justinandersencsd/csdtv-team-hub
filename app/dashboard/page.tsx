'use client'

import { createClient } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setLoading(false)
      }
    }
    checkSession()
  }, [supabase, router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-amber-500" style={{clipPath: 'polygon(0 0, 70% 0, 100% 50%, 70% 100%, 0 100%, 30% 50%)'}}></div>
        <span className="font-bold text-xl tracking-wider">CSDTV Team Hub</span>
      </div>
      <h1 className="text-2xl font-medium mb-2">Welcome back</h1>
      <p className="text-gray-400">Your dashboard is being built. Check back soon.</p>
    </div>
  )
}