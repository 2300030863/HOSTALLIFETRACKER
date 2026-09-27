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
  Menu,
  X,
  ChevronRight,
  User,
  PieChart,
  GraduationCap,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { QuickAddModal } from './QuickAddModal'
import { NotificationSettingsModal } from './NotificationSettingsModal'
import { UserProfileModal } from './UserProfileModal'
import { NotificationCenter } from './NotificationCenter'
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
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
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

  const desktopNavItems = [
    { path: '/today', label: 'Today', icon: <Home size={15} /> },
    { path: '/money', label: 'Money', icon: <Wallet size={15} /> },
    { path: '/people', label: 'People', icon: <Users size={15} /> },
    { path: '/activities', label: 'Activities', icon: <ClipboardList size={15} /> },
    { path: '/reminders', label: 'Reminders', icon: <Bell size={15} /> },
    { path: '/goals', label: 'Goals', icon: <Target size={15} /> },
    { path: '/reports', label: 'Reports', icon: <BarChart3 size={15} /> },
    { path: '/placements', label: '🎓 Placements', icon: <GraduationCap size={15} /> },
    { path: '/money-summary', label: 'Summary 📊', icon: <PieChart size={15} /> },
  ]

  const isMoreRoute = ['/money-summary', '/people', '/activities', '/goals', '/reports', '/placements'].includes(
    location.pathname
  )

  const handleOpenQuickAdd = (
    tab?: 'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note'
  ) => {
    if (tab) setQuickAddTab(tab)
    setIsQuickAddOpen(true)
  }

  return (
    <div className="min-h-dvh bg-surface-50 dark:bg-[#090d16] flex flex-col text-surface-900 dark:text-surface-100 font-sans transition-colors duration-200">
      {/* Top Header - Glassmorphic & Elevated */}
      <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-[#090d16]/85 backdrop-blur-2xl border-b border-surface-200/70 dark:border-white/[0.08] shadow-sm transition-colors">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-2.5">
          {/* Logo & Greeting */}
          <Link to="/today" className="flex items-center gap-3 group shrink-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-primary-500/25 group-hover:scale-105 transition-all">
              <Building2 className="h-5 w-5" />
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-tr from-primary-500 to-violet-500 opacity-0 group-hover:opacity-30 blur-sm transition-opacity" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight leading-none text-surface-900 dark:text-white flex items-center gap-1.5">
                <span>Hostel Life Tracker</span>
              </h1>
              <p className="text-[11px] text-surface-500 dark:text-surface-400 font-medium mt-0.5">
                {getGreeting()},{' '}
                <span className="font-semibold text-primary-600 dark:text-primary-400">
                  {displayName}
                </span>
              </p>
            </div>
          </Link>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Profile Badge */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 py-1 px-2.5 rounded-xl bg-surface-100/90 dark:bg-surface-800/60 hover:bg-surface-200/80 dark:hover:bg-surface-800 text-surface-800 dark:text-surface-200 transition-all cursor-pointer border border-surface-200/50 dark:border-white/[0.06] outline-none group"
              title="View Profile Details"
            >
              <div className="relative">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-black text-xs uppercase shadow-sm">
                  {displayName.charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#090d16]" />
              </div>
              <div className="text-left hidden sm:block max-w-[130px] truncate">
                <div className="text-xs font-bold truncate leading-tight group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {displayName}
                </div>
                <div className="text-[10px] text-surface-500 dark:text-surface-400 truncate leading-tight">
                  {user?.email}
                </div>
              </div>
            </button>

            <div className="hidden md:flex items-center gap-1">
              {/* Notification Center Bell (with badge) */}
              <NotificationCenter />

              {/* Notification Settings Toggle */}
              <button
                onClick={() => setIsNotificationModalOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800/80 dark:text-surface-400 dark:hover:text-surface-200 transition-all cursor-pointer border-0 outline-none"
                title="Notification Settings"
              >
                <Bell size={17} />
              </button>

              {/* Dark/Light mode toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800/80 dark:text-surface-400 dark:hover:text-amber-400 transition-all cursor-pointer border-0 outline-none"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun size={17} className="text-amber-400 animate-spin-slow" /> : <Moon size={17} />}
              </button>

              {/* Sign Out */}
              <button
                onClick={signOut}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-surface-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:text-surface-400 dark:hover:text-rose-400 transition-all cursor-pointer border-0 outline-none"
                title="Sign Out"
              >
                <LogOut size={17} />
              </button>
            </div>

            {/* Notification Center Bell (mobile header) */}
            <div className="md:hidden">
              <NotificationCenter />
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-3 sm:px-6 py-5 pb-28">
        {/* Full-Width Body Navigation Bar (Desktop/Tablet Only) */}
        <div className="hidden md:block mb-6 w-full overflow-x-auto no-scrollbar py-1">
          <nav className="w-full min-w-[640px] flex items-center justify-between bg-white/70 dark:bg-surface-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-surface-200/80 dark:border-white/[0.08] shadow-sm">
            {desktopNavItems.map((item) => {
              const isActive =
                location.pathname === item.path ||
                (item.path === '/today' && location.pathname === '/')
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md shadow-primary-600/30 font-bold scale-[1.02]'
                      : 'text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800/70'
                  )}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {children}
      </main>

      {/* Floating Quick Add (+) FAB Button - Desktop/Tablet only */}
      <div className="hidden sm:block fixed bottom-6 right-6 z-40">
        <button
          onClick={() => handleOpenQuickAdd('money')}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 via-indigo-600 to-violet-600 text-white shadow-xl shadow-primary-600/40 hover:scale-110 active:scale-95 transition-all group ring-4 ring-primary-500/20"
          title="Quick Add Anything"
        >
          <Plus size={26} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* Mobile Bottom Dock Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-2xl border-t border-surface-200/80 dark:border-white/[0.08] md:hidden pb-safe shadow-2xl">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5 relative">
          {/* Today */}
          <Link
            to="/today"
            onClick={() => setIsMoreMenuOpen(false)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all',
              location.pathname === '/today' || location.pathname === '/'
                ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 font-medium'
            )}
          >
            <Home size={19} />
            <span className="text-[10px]">Today</span>
          </Link>

          {/* Money */}
          <Link
            to="/money"
            onClick={() => setIsMoreMenuOpen(false)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all',
              location.pathname === '/money'
                ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 font-medium'
            )}
          >
            <Wallet size={19} />
            <span className="text-[10px]">Money</span>
          </Link>

          {/* Center Elevated Quick Add Button */}
          <button
            onClick={() => handleOpenQuickAdd('money')}
            className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-primary-600 to-indigo-600 text-white shadow-xl shadow-primary-600/40 hover:scale-110 active:scale-95 transition-all border-4 border-white dark:border-[#090d16] ring-2 ring-primary-500/30"
            title="Quick Add"
          >
            <Plus size={22} />
          </button>

          {/* Reminders */}
          <Link
            to="/reminders"
            onClick={() => setIsMoreMenuOpen(false)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all',
              location.pathname === '/reminders'
                ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 font-medium'
            )}
          >
            <Bell size={19} />
            <span className="text-[10px]">Reminders</span>
          </Link>

          {/* More Menu */}
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all relative',
              isMoreRoute || isMoreMenuOpen
                ? 'text-primary-600 dark:text-primary-400 font-bold scale-105'
                : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 font-medium'
            )}
          >
            <div className="relative">
              <Menu size={19} />
              {isMoreRoute && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary-600 dark:bg-primary-400 animate-pulse" />
              )}
            </div>
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Drawer / Bottom Sheet */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-surface-950/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMoreMenuOpen(false)}
          />

          {/* Sheet Panel */}
          <div className="relative z-10 w-full bg-white dark:bg-surface-900 rounded-t-3xl border-t border-surface-200 dark:border-white/[0.08] p-5 shadow-2xl animate-slide-up pb-8">
            {/* Drag Handle & Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-100 dark:border-surface-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-12 rounded-full bg-surface-300 dark:bg-surface-700 mx-auto absolute top-2.5 left-1/2 -translate-x-1/2" />
                <h3 className="text-base font-bold text-surface-900 dark:text-white mt-1">
                  All Features & Menu
                </h3>
              </div>
              <button
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid for More Pages */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                {
                  path: '/placements',
                  label: 'Placements 🎓',
                  desc: 'Jobs, Tests & Drives',
                  icon: <GraduationCap className="h-5 w-5 text-violet-500" />,
                  bg: 'bg-violet-50/80 dark:bg-violet-950/40 border-violet-200/50 dark:border-violet-800/40',
                },
                {
                  path: '/people',
                  label: 'People',
                  desc: 'Debts & Contacts',
                  icon: <Users className="h-5 w-5 text-indigo-500" />,
                  bg: 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200/50 dark:border-indigo-800/40',
                },
                {
                  path: '/activities',
                  label: 'Activities',
                  desc: 'Mess, Gym & Daily Logs',
                  icon: <ClipboardList className="h-5 w-5 text-emerald-500" />,
                  bg: 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/50 dark:border-emerald-800/40',
                },
                {
                  path: '/goals',
                  label: 'Goals',
                  desc: 'Targets & Progress',
                  icon: <Target className="h-5 w-5 text-amber-500" />,
                  bg: 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/50 dark:border-amber-800/40',
                },
                {
                  path: '/reports',
                  label: 'Reports',
                  desc: 'Analytics & Spending',
                  icon: <BarChart3 className="h-5 w-5 text-purple-500" />,
                  bg: 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-200/50 dark:border-purple-800/40',
                },
                {
                  path: '/money-summary',
                  label: 'Summary 📊',
                  desc: 'Monthly Finance Breakdown',
                  icon: <PieChart className="h-5 w-5 text-cyan-500" />,
                  bg: 'bg-cyan-50/80 dark:bg-cyan-950/40 border-cyan-200/50 dark:border-cyan-800/40',
                },
              ].map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMoreMenuOpen(false)}
                    className={cn(
                      'flex flex-col p-3.5 rounded-2xl border transition-all active:scale-95',
                      item.bg,
                      isActive ? 'ring-2 ring-primary-500 font-bold' : 'hover:shadow-md'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {item.icon}
                      <ChevronRight size={15} className="text-surface-400" />
                    </div>
                    <span className="text-sm font-bold text-surface-900 dark:text-white">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-surface-500 dark:text-surface-400 leading-tight mt-0.5">
                      {item.desc}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-around pt-3 border-t border-surface-100 dark:border-surface-800">
              <button
                onClick={() => {
                  setIsMoreMenuOpen(false)
                  setIsProfileModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40"
              >
                <User size={15} />
                <span>Profile</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false)
                  setIsNotificationModalOpen(true)
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                <Bell size={15} />
                <span>Alerts</span>
              </button>

              <button
                onClick={() => setIsDark(!isDark)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                {isDark ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
                <span>{isDark ? 'Light' : 'Dark'}</span>
              </button>

              <button
                onClick={() => {
                  setIsMoreMenuOpen(false)
                  signOut()
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  )
}
