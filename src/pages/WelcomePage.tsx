import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  Calendar,
  Wallet,
  Users,
  CheckSquare,
  Bell,
  BarChart3,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Download,
  Clock,
  ChevronRight,
  Star,
} from 'lucide-react'

export default function WelcomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'attendance' | 'money' | 'people' | 'reports'>('attendance')

  return (
    <div className="min-h-screen bg-surface-950 text-white selection:bg-primary-500 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Dynamic Background Glow Effect */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-600/30 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-20 border-b border-surface-800/60 bg-surface-950/70 backdrop-blur-xl sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(user ? '/today' : '/')}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-black text-xl shadow-lg shadow-primary-600/30">
              🚀
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                <span>HOSTEL LIFE</span>
                <span className="text-primary-400 font-extrabold text-xs px-2 py-0.5 rounded-full bg-primary-950 border border-primary-800/60">
                  TRACKER
                </span>
              </span>
              <p className="text-[10px] text-surface-400 font-semibold tracking-wide uppercase">
                Smart Hostel Management
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-xs font-bold text-surface-300">
            <a href="#features" className="hover:text-primary-400 transition-colors">
              Features
            </a>
            <a href="#attendance" className="hover:text-primary-400 transition-colors">
              Attendance Rule
            </a>
            <a href="#reports" className="hover:text-primary-400 transition-colors">
              PNG & PDF Reports
            </a>
            <a href="#stats" className="hover:text-primary-400 transition-colors">
              Why Us
            </a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate('/today')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-primary-600/30 transition-all transform hover:scale-105 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2.5 rounded-2xl bg-surface-900 hover:bg-surface-800 text-white text-xs font-bold transition-all border border-surface-800"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-lg shadow-primary-600/30 transition-all transform hover:scale-105"
                >
                  <span>Get Started</span>
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="relative z-10 pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center space-y-8">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-950/80 border border-primary-800/80 text-primary-300 text-xs font-bold backdrop-blur-md shadow-inner animate-pulse">
          <Sparkles size={14} className="text-amber-400" />
          <span>All-in-One Hostel Daily Companion & Debt Tracker</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none">
          Master Your Hostel Life <br />
          <span className="bg-gradient-to-r from-primary-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            With Zero Hassle 🎓
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-surface-400 font-medium leading-relaxed">
          Track daily biometric attendance, manage loans & debt balances with roommates, log expenses, schedule reminders, and download clean PNG Report Cards & PDF statements.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={() => navigate(user ? '/today' : '/register')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white font-extrabold text-sm shadow-xl shadow-primary-600/30 flex items-center justify-center gap-2 transition-all transform hover:scale-105 cursor-pointer"
          >
            <Zap size={18} />
            <span>{user ? 'Open Dashboard Now' : 'Create Free Account'}</span>
            <ArrowRight size={18} />
          </button>

          <a
            href="#features"
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-surface-900/90 hover:bg-surface-800 text-surface-200 font-extrabold text-sm border border-surface-800 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Explore App Features</span>
            <ChevronRight size={18} />
          </a>
        </div>

        {/* Feature Highlights Bar */}
        <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800/80 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <Clock size={16} />
              <span>9:00 PM → 10:30 PM</span>
            </div>
            <p className="text-xs font-bold text-white">Strict Attendance Window</p>
            <p className="text-[11px] text-surface-400">Auto-absent at 10:30 PM</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800/80 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <ShieldCheck size={16} />
              <span>Supabase Cloud</span>
            </div>
            <p className="text-xs font-bold text-white">Realtime Data Sync</p>
            <p className="text-[11px] text-surface-400">Cross-device consistency</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800/80 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
              <Download size={16} />
              <span>1-Click Exports</span>
            </div>
            <p className="text-xs font-bold text-white">PNG Image & PDF Statements</p>
            <p className="text-[11px] text-surface-400">Download report cards</p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-900/60 border border-surface-800/80 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
              <Users size={16} />
              <span>Roommates & Friends</span>
            </div>
            <p className="text-xs font-bold text-white">People Debt Tracker</p>
            <p className="text-[11px] text-surface-400">Who owes whom loans</p>
          </div>
        </div>
      </section>

      {/* Interactive Feature Demo Tabs Section */}
      <section id="features" className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Designed Specifically For Hostel Students 🏡
          </h2>
          <p className="text-xs sm:text-sm text-surface-400 max-w-xl mx-auto font-medium">
            Everything you need to manage your hostel room, mess, loans, biometric punch, and academics in one place.
          </p>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto p-1.5 rounded-2xl bg-surface-900/80 border border-surface-800 max-w-2xl mx-auto">
          {[
            { id: 'attendance', label: 'Attendance Window 🖐️', icon: <Calendar size={15} /> },
            { id: 'money', label: 'Expenses & Money 💰', icon: <Wallet size={15} /> },
            { id: 'people', label: 'People Debt Tracker 👥', icon: <Users size={15} /> },
            { id: 'reports', label: 'PNG/PDF Statements 📊', icon: <BarChart3 size={15} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Showcase Cards */}
        <div className="max-w-4xl mx-auto p-6 sm:p-8 rounded-3xl bg-surface-900/90 border border-surface-800 shadow-2xl space-y-6 animate-fade-in">
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🖐️ Biometric & Daily Attendance Logic</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800">
                    9:00 PM → 10:30 PM
                  </span>
                </h3>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed">
                Attendance window opens at 9:00 PM every evening. The moment attendance is submitted and confirmed by Supabase, all notifications stop automatically. If unsubmitted by 10:30 PM, the system automatically marks you <strong>ABSENT</strong>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300">
                  <p className="text-xs font-bold">Present 🖐️</p>
                  <p className="text-xs text-surface-400 mt-1">Confirmed with check-in timestamp</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300">
                  <p className="text-xs font-bold">Late ⏰</p>
                  <p className="text-xs text-surface-400 mt-1">Marked after gate curfew</p>
                </div>
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300">
                  <p className="text-xs font-bold">Absent ❌</p>
                  <p className="text-xs text-surface-400 mt-1">Auto-marked at 10:30 PM</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'money' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💰 Expenses, Money Given & Money Received</span>
              </h3>
              <p className="text-xs text-surface-400 leading-relaxed">
                Record your daily food, auto, recharge, and hostel expenses. Track money given to roommates or received from friends with UPI/Cash logs, return dates, and payment categories.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60">
                  <p className="text-xs font-bold text-rose-400">Total Spent 💸</p>
                  <p className="text-lg font-black text-white mt-1">Food & Hostel</p>
                </div>
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60">
                  <p className="text-xs font-bold text-amber-400">Money Given 🤝</p>
                  <p className="text-lg font-black text-white mt-1">Lent to Friends</p>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-800/60">
                  <p className="text-xs font-bold text-emerald-400">Received 💰</p>
                  <p className="text-lg font-black text-white mt-1">Borrowed / Returns</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'people' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👥 Friends & Roommate Debt Balances</span>
              </h3>
              <p className="text-xs text-surface-400 leading-relaxed">
                Who owes whom? Keep accurate track of individual roommate balances (e.g. Rahul, Tanishq, Suresh). Perform 1-click full balance settlements and export dedicated single-person statements.
              </p>
              <div className="p-4 rounded-2xl bg-surface-800/60 border border-surface-700/60 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Tanishq (Roommate)</p>
                  <p className="text-xs text-emerald-400 font-semibold mt-0.5">Given: ₹240 • Received: ₹0</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-950 text-rose-300 border border-rose-800">
                  Owes You ₹240
                </span>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📊 High-Resolution PNG & PDF Statements</span>
              </h3>
              <p className="text-xs text-surface-400 leading-relaxed">
                Generate 1-click shareable report card PNG images for your person statements or attendance history logs, export official PDF print templates, and download CSV spreadsheets.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 p-3 rounded-2xl bg-primary-950/60 border border-primary-800 text-center">
                  <Download size={18} className="mx-auto text-primary-400 mb-1" />
                  <p className="text-xs font-bold text-white">PNG Image Card</p>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-surface-800 border border-surface-700 text-center">
                  <BarChart3 size={18} className="mx-auto text-indigo-400 mb-1" />
                  <p className="text-xs font-bold text-white">PDF Document</p>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-center">
                  <CheckSquare size={18} className="mx-auto text-emerald-400 mb-1" />
                  <p className="text-xs font-bold text-white">CSV Spreadsheet</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature Grid Details Section */}
      <section id="attendance" className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-surface-800/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-surface-900/60 border border-surface-800 space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-950/80 text-amber-400 flex items-center justify-center font-bold">
              <Bell size={20} />
            </div>
            <h3 className="text-base font-bold text-white">Smart Reminders & Alarms</h3>
            <p className="text-xs text-surface-400 leading-relaxed">
              Never miss your hostel attendance punch or mess times. Scheduled notifications remind you at 9:00 PM, 9:20 PM, and 9:40 PM until confirmed.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-surface-900/60 border border-surface-800 space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-950/80 text-indigo-400 flex items-center justify-center font-bold">
              <CheckSquare size={20} />
            </div>
            <h3 className="text-base font-bold text-white">Activities & Goals Tracker</h3>
            <p className="text-xs text-surface-400 leading-relaxed">
              Track college lectures, DBMS classes, study hours, exercise routines, and daily personal goals with interactive progress sliders.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-surface-900/60 border border-surface-800 space-y-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-950/80 text-emerald-400 flex items-center justify-center font-bold">
              <Star size={20} />
            </div>
            <h3 className="text-base font-bold text-white">Instant Data Persistence</h3>
            <p className="text-xs text-surface-400 leading-relaxed">
              Seamlessly backed up to Supabase Cloud with offline local storage fallbacks so you never lose your records.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="relative z-10 border-t border-surface-800/80 bg-surface-950 py-12 px-4 text-center space-y-6">
        <div className="max-w-3xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Ready to Take Control of Your Hostel Life? 🚀
          </h2>
          <p className="text-xs text-surface-400">
            Join now and start tracking your daily attendance, money, and hostel activities.
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => navigate(user ? '/' : '/register')}
              className="px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-lg shadow-primary-600/30 transition-all cursor-pointer"
            >
              {user ? 'Enter App Dashboard' : 'Get Started Free'}
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-surface-900 text-[11px] text-surface-500">
          © {new Date().getFullYear()} Hostel Life Tracker • Built for Hostel Students & Roommates
        </div>
      </footer>
    </div>
  )
}
