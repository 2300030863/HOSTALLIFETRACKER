import type { ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { cn } from '@/utils/cn'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* Left side - Branding (hidden on mobile, shown on desktop) */}
      <div
        className={cn(
          'hidden lg:flex lg:w-1/2 xl:w-[55%]',
          'relative overflow-hidden',
          'flex-col items-center justify-center p-12',
          'bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900'
        )}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/4 right-1/4 h-64 w-64 rounded-full bg-white/5" />

        <div className="relative z-10 max-w-md text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <Building2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
            Hostel Life Tracker
          </h1>
          <p className="text-lg text-primary-200">
            Your hostel life, organized.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            <div className="rounded-xl bg-white/10 px-4 py-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">💰</p>
              <p className="mt-1 text-xs text-primary-200">Money</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">📝</p>
              <p className="mt-1 text-xs text-primary-200">Activities</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-white">🖐️</p>
              <p className="mt-1 text-xs text-primary-200">Attendance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center',
          'px-5 py-10 sm:px-8',
          'bg-surface-50 dark:bg-surface-950'
        )}
      >
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-600 shadow-lg shadow-primary-500/25">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">Hostel Life Tracker</h2>
            <p className="text-xs text-surface-500">Your hostel life, organized.</p>
          </div>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">{title}</h2>
            {subtitle && (
              <p className="mt-2 text-sm text-surface-500 dark:text-surface-400">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
