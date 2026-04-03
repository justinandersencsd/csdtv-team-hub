'use client'

import { useTheme } from '@/lib/theme'

export default function DashboardPage() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div>
      <p style={{ color: 'red', fontSize: '20px' }}>Current theme: {theme}</p>
      <button onClick={toggleTheme} style={{ padding: '10px 20px', background: 'blue', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }}>
        Toggle theme (test)
      </button>
    </div>
  )
}