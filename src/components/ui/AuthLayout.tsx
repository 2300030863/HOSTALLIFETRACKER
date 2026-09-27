import type { ReactNode } from 'react'
import { Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/utils/cn'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-surface-50 dark:bg-[#090d16] text-surface-900 dark:text-surface-100 font-sans selection:bg-primary-500 selection:text-white">
      {/* Left side - Branding (hidden on mobile, shown on desktop) */}
      <div
        className={cn(
          'hidden lg:flex lg:w-1/2 xl:w-[52%]',
          'relative overflow-hidden',
          'flex-col items-center justify-center p-12 lg:p-16',
          'bg-gradient-to-br from-primary-600 via-indigo-700 to-[#1e1b4b]'
        )}
      >
        {/* Decorative ambient glowing orbs */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-72 w-72 rounded-full bg-purple-500/15 blur-2xl" />

        <div className="relative z-10 max-w-md text-center">
          <Link to="/" className="inline-block group mb-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl group-hover:scale-105 transition-all">
              <Building2 className="h-10 w-10 text-white" />
            </div>
          </Link>
          <h1 className="mb-3 text-4xl xl:text-5xl font-black tracking-tight text-white leading-tight">
            Hostel Life Tracker
          </h1>
          <p className="text-base text-primary-200 font-medium">
            Your entire hostel routine, expenses, biometric attendance &amp; roommate debts organized.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-2xl bg-white/10 px-4 py-5 backdrop-blur-md border border-white/10 shadow-lg">
              <p className="text-2xl font-bold">💰</p>
              <p className="mt-1.5 text-xs font-bold text-white">Money &amp; Loans</p>
              <p className="text-[10px] text-primary-200 mt-0.5">Taken &amp; Given</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-5 backdrop-blur-md border border-white/10 shadow-lg">
              <p className="text-2xl font-bold">🖐️</p>
              <p className="mt-1.5 text-xs font-bold text-white">Attendance</p>
              <p className="text-[10px] text-primary-200 mt-0.5">Curfew Alert</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-5 backdrop-blur-md border border-white/10 shadow-lg">
              <p className="text-2xl font-bold">📊</p>
              <p className="mt-1.5 text-xs font-bold text-white">PNG Reports</p>
              <p className="text-[10px] text-primary-200 mt-0.5">1-Click Share</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form Card */}
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center',
          'px-4 py-10 sm:px-8',
          'bg-surface-50 dark:bg-[#090d16]'
        )}
      >
        {/* Mobile top logo */}
        <Link to="/" className="mb-6 flex items-center gap-3 lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-500/25">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-surface-900 dark:text-white leading-tight">Hostel Life Tracker</h2>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">Your hostel life, organized.</p>
          </div>
        </Link>

        <div className="w-full max-w-[420px] rounded-3xl bg-white dark:bg-surface-900/90 p-6 sm:p-8 border border-surface-200/80 dark:border-white/[0.08] shadow-xl dark:shadow-2xl">
          <div className="mb-7">
            <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">{title}</h2>
            {subtitle && (
              <p className="mt-1.5 text-xs sm:text-sm text-surface-500 dark:text-surface-400 font-medium">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
