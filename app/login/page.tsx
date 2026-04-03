'use client'

import { createClient } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/dashboard')
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md p-8 rounded-2xl bg-gray-900 border border-gray-800">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-amber-500" style={{clipPath: 'polygon(0 0, 70% 0, 100% 50%, 70% 100%, 0 100%, 30% 50%)'}}></div>
          <span className="text-white font-bold text-xl tracking-wider">CSDTV Team Hub</span>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={[]}
          magicLink={true}
        />
      </div>
    </div>
  )
}