'use client'

import { ThemeProvider } from '@/lib/theme'
import AppLayout from './components/AppLayout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppLayout>
        {children}
      </AppLayout>
    </ThemeProvider>
  )
}