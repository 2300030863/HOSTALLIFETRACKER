import { useState, useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Building2,
  LogOut,
  Wallet,
  ClipboardList,
  Bell,
  Target,
  Plus,
  Home,
  Sun,
  Moon,
  Users,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { QuickAddModal } from './QuickAddModal'
import { NotificationSettingsModal } from './NotificationSettingsModal'
import { useReminderScheduler } from '@/hooks/useReminderScheduler'

interface AppLayoutProps {
  children: ReactNode
  onRefreshData?: () => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good Morning'
  if (hour < 17) return 'Good Afternoon'
  return 'Good Evening'
}

export function AppLayout({ children, onRefreshData }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const [quickAddTab, setQuickAddTab] = useState<
    'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note'
  >('money')

  // Run real-time background reminder scheduler
  useReminderScheduler()

  // Dark mode toggle state (defaults to dark mode for rich aesthetics)
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('ht_theme')
    return saved ? saved === 'dark' : true
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('ht_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('ht_theme', 'light')
    }
  }, [isDark])

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'

  const navItems = [
    { path: '/', label: 'Today', icon: <Home size={16} /> },
    { path: '/money', label: 'Money', icon: <Wallet size={16} /> },
    { path: '/people', label: 'People', icon: <Users size={16} /> },
    { path: '/activities', label: 'Activities', icon: <ClipboardList size={16} /> },
    { path: '/reminders', label: 'Reminders', icon: <Bell size={16} /> },
    { path: '/goals', label: 'Goals', icon: <Target size={16} /> },
    { path: '/reports', label: 'Reports', icon: <BarChart3 size={16} /> },
  ]

  const handleOpenQuickAdd = (
    tab?: 'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note'
  ) => {
    if (tab) setQuickAddTab(tab)
    setIsQuickAddOpen(true)
  }

  return (
    <div className="min-h-dvh bg-surface-50 dark:bg-surface-950 flex flex-col text-surface-900 dark:text-surface-50 font-sans transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl border-b border-surface-200/80 dark:border-surface-800/80 shadow-sm transition-colors">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-3">
          {/* Logo & Greeting */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white shadow-lg shadow-primary-500/30 group-hover:scale-105 transition-transform">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none text-surface-900 dark:text-white">
                Hostel Life Tracker
              </h1>
              <p className="text-xs text-surface-500 dark:text-surface-400 font-medium mt-0.5">
                {getGreeting()},{' '}
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {displayName}
                </span>
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-surface-100 dark:bg-surface-800/90 p-1.5 rounded-2xl border border-surface-200 dark:border-surface-700/60 shadow-inner">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
                    isActive
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30 font-bold'
                      : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200/60 dark:hover:bg-surface-700/50'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenQuickAdd('money')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-500/25 transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>Add New</span>
            </button>

            {/* Notification Settings Toggle */}
            <button
              onClick={() => setIsNotificationModalOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 dark:text-surface-400 transition-all"
              title="Notification Settings"
            >
              <Bell size={18} />
            </button>

            {/* Dark/Light mode toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 dark:text-surface-400 transition-all"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:text-surface-400 dark:hover:text-rose-400 transition-all"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 pb-28">
        {children}
      </main>

      {/* Floating Quick Add (+) FAB Button */}
      <div className="fixed bottom-20 sm:bottom-6 right-5 z-40">
        <button
          onClick={() => handleOpenQuickAdd('money')}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-xl shadow-primary-600/40 hover:scale-110 active:scale-95 transition-all group"
          title="Quick Add"
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Bottom Navigation - Mobile View */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl border-t border-surface-200/80 dark:border-surface-800/80 md:hidden pb-safe shadow-lg">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-all',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                    : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 font-medium'
                )}
              >
                {item.icon}
                <span className="text-[10px]">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab={quickAddTab}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={() => {
          if (onRefreshData) onRefreshData()
        }}
      />
      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
      />
    </div>
  )
}
