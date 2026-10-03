import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Wallet,
  Bell,
  Target,
  Flame,
  ClipboardList,
  Check,
  GraduationCap,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { showToast } from '@/components/ui/Toast'
import {
  attendanceService,
  checkAttendanceWindow,
  reminderService,
  activityService,
  transactionService,
  goalService,
  habitService,
  placementService,
  subscribeToRealtime,
} from '@/services/dbServices'
import type {
  Attendance,
  AttendanceStatus,
  Reminder,
  Activity,
  Transaction,
  Goal,
  Habit,
} from '@/types'

import { AttendanceHistoryModal } from '@/components/ui/AttendanceHistoryModal'
import { AbsentReasonModal } from '@/components/ui/AbsentReasonModal'

export default function Today() {
  const [loading, setLoading] = useState(true)
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(null)
  const [isEditingAttendance, setIsEditingAttendance] = useState(false)
  const [isSubmittingAttendance, setIsSubmittingAttendance] = useState(false)
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [habits, setHabits] = useState<Array<Habit & { todayCompleted: boolean }>>([])

  // Placement stats & upcoming assessments
  const [placementStats, setPlacementStats] = useState({
    total: 0,
    applied: 0,
    test: 0,
    interview: 0,
    selected: 0,
  })
  const [upcomingPlacementEvents, setUpcomingPlacementEvents] = useState<
    Array<{
      id: string
      company: string
      role: string
      type: 'test' | 'interview' | 'deadline' | 'follow_up'
      title: string
      dateStr: string
      dateObj: Date
      time?: string
    }>
  >([])

  // Modal control
  const [quickAddTab, setQuickAddTab] = useState<'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note'>('money')
  const [quickAddMoneyType, setQuickAddMoneyType] = useState<'expense' | 'given' | 'received'>('expense')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const [attData, remData, actData, txData, goalData, habData, plcStats, plcEvents] = await Promise.all([
        attendanceService.getTodayAttendance(),
        reminderService.getTodayReminders(),
        activityService.getTodayActivities(),
        transactionService.getTodayTransactions(),
        goalService.getGoals(),
        habitService.getHabitsWithTodayLog(),
        placementService.getPlacementStats(),
        placementService.getUpcomingEvents(),
      ])

      setAttendance(attData)
      if (attData) {
        setSelectedStatus(attData.status)
      } else {
        setSelectedStatus(null)
      }
      setReminders(remData)
      setActivities(actData)
      setTransactions(txData)
      setGoals(goalData)
      setHabits(habData)
      setPlacementStats(plcStats)
      setUpcomingPlacementEvents(plcEvents.slice(0, 3))
    } catch (err) {
      console.error('Error loading today data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(true)
    const unsubscribe = subscribeToRealtime(() => {
      loadData(false)
    })
    return () => unsubscribe()
  }, [loadData])

  const handleOpenQuickAdd = (
    tab: 'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note',
    moneyType: 'expense' | 'given' | 'received' = 'expense'
  ) => {
    setQuickAddTab(tab)
    setQuickAddMoneyType(moneyType)
    setIsQuickAddOpen(true)
  }

  // Attendance handlers
  const handleSelectOption = (status: AttendanceStatus) => {
    if (attendance && !isEditingAttendance) {
      showToast.info('Click "Edit Attendance ✏️" to modify your submitted attendance.')
      return
    }
    setSelectedStatus(status)
  }

  const handleSubmitAttendance = async (statusOverride?: AttendanceStatus, reason?: string) => {
    const targetStatus = statusOverride || selectedStatus
    if (!targetStatus) {
      showToast.error('Please select Present, Late, or Absent before submitting!')
      return
    }

    setIsSubmittingAttendance(true)
    try {
      const updated = await attendanceService.markAttendance(targetStatus, reason)
      setAttendance(updated)
      setSelectedStatus(updated.status)
      setIsEditingAttendance(false)
      showToast.success(
        `Attendance saved to Supabase as ${updated.status.toUpperCase()}! 🖐️ Notifications stopped.`
      )
    } catch (err: any) {
      showToast.error(err.message || 'Database error: Could not save attendance to Supabase.')
    } finally {
      setIsSubmittingAttendance(false)
    }
  }

  const handleConfirmAbsent = async (reason: string) => {
    await handleSubmitAttendance('absent', reason)
  }

  const handleEnableEdit = () => {
    setIsEditingAttendance(true)
  }

  const handleCheckOut = async () => {
    const updated = await attendanceService.checkOut()
    if (updated) {
      setAttendance(updated)
      showToast.success('Checked out successfully 🚪')
    }
  }

  // Reminder toggle
  const handleToggleReminder = async (id: string, currentVal: boolean) => {
    const newVal = !currentVal
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: newVal } : r)))
    await reminderService.toggleReminder(id, newVal)
  }

  // Activity status toggle
  const handleToggleActivity = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus as any } : a))
    )
    await activityService.updateActivityStatus(id, newStatus as any)
  }

  // Goal progress update
  const handleGoalProgress = async (goal: Goal, delta: number) => {
    const newVal = Math.min(goal.target, Math.max(0, goal.current_value + delta))
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id
          ? { ...g, current_value: newVal, completed: newVal >= g.target }
          : g
      )
    )
    await goalService.updateProgress(goal.id, newVal)
  }

  // Habit toggle
  const handleToggleHabit = async (habitId: string, currentCompleted: boolean) => {
    const newVal = !currentCompleted
    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? { ...h, todayCompleted: newVal } : h))
    )
    await habitService.toggleHabitToday(habitId, newVal)
  }

  // Calculations for Today's Money
  const todaySpent = transactions
    .filter((t) => t.type === 'expense' || t.type === 'given')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const todayReceived = transactions
    .filter((t) => t.type === 'received')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const pendingRemindersCount = reminders.filter((r) => !r.completed).length
  const completedHabitsCount = habits.filter((h) => h.todayCompleted).length

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Today Hero Banner with Live Ambient Glow */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 via-indigo-600 to-violet-700 p-6 sm:p-7 text-white shadow-xl shadow-primary-600/20 border border-white/15">
          {/* Subtle Ambient Shapes */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-400/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-md mb-2.5 border border-white/20">
                <Calendar size={13} className="text-white" />
                <span>TODAY — {format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                <span>Daily Overview</span>
                <span className="text-xl">⚡</span>
              </h2>
              <p className="text-xs sm:text-sm text-primary-100/90 mt-1 max-w-lg">
                Your hostel command center: attendance status, daily spend, alerts & habits in real time.
              </p>
            </div>

            <button
              onClick={() => loadData(true)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold backdrop-blur-md transition-all self-start sm:self-auto border border-white/20 shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              <span>{loading ? 'Updating...' : 'Sync Data'}</span>
            </button>
          </div>

          {/* Quick Stats KPI Bar inside banner */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/15">
            {/* Attendance Status */}
            <div className="rounded-2xl bg-black/20 backdrop-blur-md p-2.5 px-3 border border-white/10 flex items-center gap-2.5">
              <span className="text-lg">🖐️</span>
              <div className="min-w-0">
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Attendance</div>
                <div className="text-xs font-bold truncate">
                  {attendance ? attendance.status.toUpperCase() : 'Not Marked'}
                </div>
              </div>
            </div>

            {/* Spent Today */}
            <div className="rounded-2xl bg-black/20 backdrop-blur-md p-2.5 px-3 border border-white/10 flex items-center gap-2.5">
              <Wallet size={16} className="text-rose-300" />
              <div className="min-w-0">
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Spent Today</div>
                <div className="text-xs font-bold truncate">₹{todaySpent.toLocaleString()}</div>
              </div>
            </div>

            {/* Pending Reminders */}
            <div className="rounded-2xl bg-black/20 backdrop-blur-md p-2.5 px-3 border border-white/10 flex items-center gap-2.5">
              <Bell size={16} className="text-amber-300" />
              <div className="min-w-0">
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Reminders</div>
                <div className="text-xs font-bold truncate">{pendingRemindersCount} Pending</div>
              </div>
            </div>

            {/* Habits Completed */}
            <div className="rounded-2xl bg-black/20 backdrop-blur-md p-2.5 px-3 border border-white/10 flex items-center gap-2.5">
              <Flame size={16} className="text-orange-300" />
              <div className="min-w-0">
                <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Habits Done</div>
                <div className="text-xs font-bold truncate">{completedHabitsCount}/{habits.length} Completed</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Speed-Dial Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-bold text-surface-400 uppercase tracking-wider shrink-0 pl-1">
            Quick Add:
          </span>
          <button
            onClick={() => handleOpenQuickAdd('money', 'expense')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200/60 dark:border-rose-800/40 text-xs font-bold shrink-0 transition-all active:scale-95"
          >
            <span>💸 Expense</span>
          </button>
          <button
            onClick={() => handleOpenQuickAdd('money', 'given')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 border border-amber-200/60 dark:border-amber-800/40 text-xs font-bold shrink-0 transition-all active:scale-95"
          >
            <span>🤝 Lent Money</span>
          </button>
          <button
            onClick={() => handleOpenQuickAdd('money', 'received')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-bold shrink-0 transition-all active:scale-95"
          >
            <span>📥 Borrowed Money</span>
          </button>
          <button
            onClick={() => handleOpenQuickAdd('reminder')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200/60 dark:border-indigo-800/40 text-xs font-bold shrink-0 transition-all active:scale-95"
          >
            <Bell size={13} />
            <span>Reminder</span>
          </button>
          <button
            onClick={() => handleOpenQuickAdd('activity')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 border border-blue-200/60 dark:border-blue-800/40 text-xs font-bold shrink-0 transition-all active:scale-95"
          >
            <ClipboardList size={13} />
            <span>Activity</span>
          </button>
          <button
            onClick={() => handleOpenQuickAdd('goal')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200/60 dark:border-purple-800/40 text-xs font-bold shrink-0 transition-all active:scale-95"
          >
            <Target size={13} />
            <span>Goal</span>
          </button>
        </div>

        {/* 1. ATTENDANCE CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex flex-col gap-3 mb-4">
            {/* Row 1: icon + title + status badge */}
            <div className="flex items-start gap-3.5">
              <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 text-2xl font-bold shadow-inner">
                🖐️
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-surface-900 dark:text-white leading-tight">
                    Attendance &amp; Biometric
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300">
                    Hostel Rule
                  </span>
                </div>
                <p className="text-xs text-surface-500 leading-snug mt-1">
                  {attendance
                    ? `Marked as ${attendance.status.toUpperCase()}${attendance.reason ? ` • Reason: ${attendance.reason}` : attendance.check_in ? ` • Checked in at ${format(new Date(attendance.check_in), 'hh:mm a')}` : ''}`
                    : `${checkAttendanceWindow().statusMessage} • Window: 9:00 PM – 10:00 PM`}
                </p>
              </div>
              <div className="flex-shrink-0">
                {attendance ? (
                  <span
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shadow-sm',
                      attendance.status === 'present'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : attendance.status === 'late'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    )}
                  >
                    ● {attendance.status}
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    ● Pending
                  </span>
                )}
              </div>
            </div>

            {/* Row 2: action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {attendance && !isEditingAttendance && (
                <button
                  onClick={handleEnableEdit}
                  className="flex-1 min-w-[120px] px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800 text-center cursor-pointer"
                  title="Edit submitted attendance"
                >
                  ✏️ Edit Attendance
                </button>
              )}

              {attendance && !attendance.check_out && (
                <button
                  onClick={handleCheckOut}
                  className="flex-1 min-w-[100px] px-3.5 py-2 rounded-xl bg-surface-800 text-white dark:bg-surface-700 hover:bg-surface-900 text-xs font-bold transition-all text-center cursor-pointer shadow-sm"
                >
                  🚪 Check Out
                </button>
              )}

              <button
                onClick={() => setIsAttendanceModalOpen(true)}
                className="flex-1 min-w-[90px] px-3.5 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white text-xs font-bold transition-all border border-surface-200/80 dark:border-surface-700 text-center cursor-pointer"
                title="View Attendance Report"
              >
                📊 View Log
              </button>
            </div>
          </div>

          {/* Attendance Options Selection Buttons */}
          <div className="space-y-3 pt-3 border-t border-surface-100 dark:border-surface-800/80">
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectOption('present')}
                disabled={attendance !== null && !isEditingAttendance || (!isEditingAttendance && !attendance && !checkAttendanceWindow().isOpen)}
                className={cn(
                  'py-3 px-3 rounded-2xl text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border cursor-pointer',
                  selectedStatus === 'present'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30 scale-[1.02]'
                    : 'bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40',
                  (attendance !== null && !isEditingAttendance || (!isEditingAttendance && !attendance && !checkAttendanceWindow().isOpen)) && 'opacity-40 cursor-not-allowed scale-100'
                )}
              >
                <span className="text-base sm:text-sm">🖐️</span>
                <span>Present</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectOption('late')}
                disabled={attendance !== null && !isEditingAttendance || (!isEditingAttendance && !attendance && !checkAttendanceWindow().isOpen)}
                className={cn(
                  'py-3 px-3 rounded-2xl text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border cursor-pointer',
                  selectedStatus === 'late'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-600/30 scale-[1.02]'
                    : 'bg-amber-50/70 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/40',
                  (attendance !== null && !isEditingAttendance || (!isEditingAttendance && !attendance && !checkAttendanceWindow().isOpen)) && 'opacity-40 cursor-not-allowed scale-100'
                )}
              >
                <span className="text-base sm:text-sm">⏰</span>
                <span>Late</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (attendance && !isEditingAttendance) {
                    handleSelectOption('absent')
                  } else {
                    setIsAbsentModalOpen(true)
                  }
                }}
                disabled={attendance !== null && !isEditingAttendance || (!isEditingAttendance && !attendance && !checkAttendanceWindow().isOpen)}
                className={cn(
                  'py-3 px-3 rounded-2xl text-xs font-black flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all border cursor-pointer',
                  selectedStatus === 'absent'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/30 scale-[1.02]'
                    : 'bg-rose-50/70 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-300 border-rose-200/60 dark:border-rose-900/40',
                  (attendance !== null && !isEditingAttendance || (!isEditingAttendance && !attendance && !checkAttendanceWindow().isOpen)) && 'opacity-40 cursor-not-allowed scale-100'
                )}
              >
                <span className="text-base sm:text-sm">❌</span>
                <span>Absent</span>
              </button>
            </div>

            {/* Explicit Submit Button for Attendance */}
            {(!attendance || isEditingAttendance) && selectedStatus && (
              <div className="flex items-center gap-2 pt-2 animate-in fade-in">
                <button
                  type="button"
                  onClick={() => handleSubmitAttendance()}
                  disabled={isSubmittingAttendance}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-primary-600 via-indigo-600 to-violet-600 hover:from-primary-700 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-primary-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw size={14} className={cn(isSubmittingAttendance && 'animate-spin')} />
                  <span>
                    {isEditingAttendance ? 'Save Attendance Update 💾' : 'Submit Attendance 🖐️'}
                  </span>
                </button>
                {isEditingAttendance && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingAttendance(false)
                      if (attendance) setSelectedStatus(attendance.status)
                    }}
                    className="py-3 px-4 rounded-2xl bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 text-xs font-bold hover:bg-surface-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. REMINDERS CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xl font-bold shadow-inner">
                🔔
              </div>
              <div>
                <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                  Reminders ({pendingRemindersCount} pending)
                </h3>
                <p className="text-xs text-surface-500">Scheduled alarms & study alerts</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenQuickAdd('reminder')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {reminders.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/30">
              <span className="text-2xl mb-1 block">✨</span>
              <p className="text-xs text-surface-500 font-medium">All clear! No reminders due for today</p>
              <button
                onClick={() => handleOpenQuickAdd('reminder')}
                className="mt-2 text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline cursor-pointer"
              >
                + Add your first reminder
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  onClick={() => handleToggleReminder(reminder.id, reminder.completed)}
                  className={cn(
                    'flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer',
                    reminder.completed
                      ? 'bg-surface-50/60 dark:bg-surface-950/40 border-surface-200/50 dark:border-surface-800/40 opacity-60'
                      : 'bg-surface-50/80 dark:bg-surface-800/50 border-surface-200 dark:border-white/[0.06] hover:border-indigo-300 dark:hover:border-indigo-700'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-lg border transition-all',
                        reminder.completed
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900'
                      )}
                    >
                      {reminder.completed && <Check size={14} />}
                    </div>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold text-surface-900 dark:text-white',
                          reminder.completed && 'line-through text-surface-400 dark:text-surface-500'
                        )}
                      >
                        {reminder.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock size={11} />
                          {reminder.reminder_time}
                        </span>
                        {reminder.priority === 'high' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            HIGH
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. TODAY'S MONEY CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 text-xl font-bold shadow-inner">
                💰
              </div>
              <div>
                <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                  Today's Money
                </h3>
                <p className="text-xs text-surface-500">
                  Spent: <span className="font-bold text-rose-600 dark:text-rose-400">₹{todaySpent.toLocaleString()}</span>
                  {todayReceived > 0 && (
                    <span className="ml-2">
                      • Taken: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{todayReceived.toLocaleString()}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleOpenQuickAdd('money', 'expense')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
              >
                <Plus size={13} />
                <span>Expense</span>
              </button>
              <button
                onClick={() => handleOpenQuickAdd('money', 'received')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition-all cursor-pointer"
              >
                <Plus size={13} />
                <span>Taken</span>
              </button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/30">
              <span className="text-2xl mb-1 block">💸</span>
              <p className="text-xs text-surface-500 font-medium">No transactions recorded today</p>
              <button
                onClick={() => handleOpenQuickAdd('money', 'expense')}
                className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
              >
                + Record Spent / Lent / Borrowed
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-surface-50/70 dark:bg-surface-800/50 border border-surface-200/80 dark:border-white/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs shadow-inner',
                        tx.type === 'expense'
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400'
                          : tx.type === 'given'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400'
                      )}
                    >
                      {tx.type === 'expense' ? (
                        <ArrowUpRight size={16} />
                      ) : (
                        <ArrowDownLeft size={16} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-surface-900 dark:text-white">
                        {tx.type === 'expense'
                          ? tx.description || tx.category
                          : tx.category === 'Settlement'
                          ? `Settled with ${tx.person_name || 'Friend'}`
                          : tx.type === 'given'
                          ? `Lent to ${tx.person_name || 'Friend'}`
                          : `Borrowed from ${tx.person_name || 'Friend'}`}
                      </p>
                      <p className="text-[11px] text-surface-500 uppercase font-medium">
                        {tx.type === 'expense'
                          ? 'Spent'
                          : tx.category === 'Settlement'
                          ? 'Settlement'
                          : tx.type === 'given'
                          ? 'Lent (Owes you)'
                          : 'Borrowed (You owe)'}{' '}
                        • {tx.payment_method}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'font-black text-sm',
                      tx.type === 'expense' || tx.type === 'given'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {tx.type === 'expense' || tx.type === 'given' ? '-' : '+'}₹{Number(tx.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 🎓 PLACEMENT DASHBOARD CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400 text-xl font-bold shadow-inner">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-surface-900 dark:text-white flex items-center gap-2">
                  <span>Placement Tracker</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    {placementStats.total} Applications
                  </span>
                </h3>
                <p className="text-xs text-surface-500">Campus drives, tests &amp; interviews</p>
              </div>
            </div>

            <Link
              to="/placements"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400 text-xs font-bold hover:bg-violet-100 dark:hover:bg-violet-900/60 transition-all cursor-pointer"
            >
              <span>View Placements</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60 text-center">
              <p className="text-[10px] font-bold text-surface-500 uppercase">Applied</p>
              <p className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {placementStats.applied}
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60 text-center">
              <p className="text-[10px] font-bold text-surface-500 uppercase">Online Tests</p>
              <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {placementStats.test}
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60 text-center">
              <p className="text-[10px] font-bold text-surface-500 uppercase">Interviews</p>
              <p className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5">
                {placementStats.interview}
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-surface-50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60 text-center">
              <p className="text-[10px] font-bold text-surface-500 uppercase">Selected</p>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {placementStats.selected}
              </p>
            </div>
          </div>

          {/* ⚠️ Upcoming Schedule */}
          <div>
            <p className="text-xs font-bold text-surface-700 dark:text-surface-300 mb-2 flex items-center gap-1.5">
              <span>⚠️ Upcoming</span>
            </p>

            {upcomingPlacementEvents.length === 0 ? (
              <div className="p-3.5 text-center rounded-2xl bg-surface-50/60 dark:bg-surface-800/30 border border-surface-100 dark:border-surface-800 text-xs text-surface-500">
                No assessments or interviews scheduled for the next 7 days.
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingPlacementEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-surface-50/80 dark:bg-surface-800/50 border border-surface-200/70 dark:border-white/[0.06] text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl font-bold text-sm shadow-sm',
                          evt.type === 'test'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : evt.type === 'interview'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        )}
                      >
                        {evt.type === 'test' ? '💻' : evt.type === 'interview' ? '🎯' : '📅'}
                      </div>
                      <div>
                        <p className="font-extrabold text-surface-900 dark:text-white">
                          {evt.company}
                        </p>
                        <p className="text-[11px] text-surface-500">
                          {evt.title} {evt.time ? `— ${evt.time}` : ''}
                        </p>
                      </div>
                    </div>

                    <span className="font-bold text-surface-700 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded-lg text-[11px]">
                      {evt.dateStr}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
            <span className="text-[11px] text-surface-400">
              🔔 Alarms automatically configured for upcoming rounds
            </span>
            <Link
              to="/placements"
              className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <span>View Placements →</span>
            </Link>
          </div>
        </div>

        {/* 4. ACTIVITIES CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 text-xl font-bold shadow-inner">
                📝
              </div>
              <div>
                <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                  Today's Activities ({activities.length})
                </h3>
                <p className="text-xs text-surface-500">Lectures, mess, workouts & study</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenQuickAdd('activity')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/30">
              <span className="text-2xl mb-1 block">📚</span>
              <p className="text-xs text-surface-500 font-medium">No activities logged for today</p>
              <button
                onClick={() => handleOpenQuickAdd('activity')}
                className="mt-2 text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline cursor-pointer"
              >
                + Add activity
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-surface-50/70 dark:bg-surface-800/50 border border-surface-200/80 dark:border-white/[0.06]"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleActivity(act.id, act.status)}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-lg border transition-all cursor-pointer',
                        act.status === 'completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-surface-300 dark:border-surface-600 text-transparent bg-white dark:bg-surface-900'
                      )}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold text-surface-900 dark:text-white',
                          act.status === 'completed' && 'line-through text-surface-400 dark:text-surface-500'
                        )}
                      >
                        {act.title}
                      </p>
                      <span className="text-xs text-surface-500 capitalize font-medium">
                        {act.category} {act.start_time ? `• ${act.start_time}` : ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider',
                      act.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300'
                    )}
                  >
                    {act.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. GOALS CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 text-xl font-bold shadow-inner">
                🎯
              </div>
              <div>
                <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                  Goals &amp; Progress
                </h3>
                <p className="text-xs text-surface-500">Track milestones and daily progress</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenQuickAdd('goal')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 text-xs font-bold hover:bg-purple-100 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Goal</span>
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="text-center py-7 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/30">
              <span className="text-2xl mb-1 block">🎯</span>
              <p className="text-xs text-surface-500 font-medium">No active goals found</p>
              <button
                onClick={() => handleOpenQuickAdd('goal')}
                className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline cursor-pointer"
              >
                + Create your first goal
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {goals.map((goal) => {
                const percent = Math.min(
                  100,
                  Math.round((goal.current_value / goal.target) * 100)
                )
                return (
                  <div
                    key={goal.id}
                    className="p-4 rounded-2xl bg-surface-50/80 dark:bg-surface-800/50 border border-surface-200/80 dark:border-white/[0.06] space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-surface-900 dark:text-white">
                        {goal.title}
                      </h4>
                      <span className="text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-md">
                        {percent}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2.5 w-full bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-surface-500 font-medium">
                        {goal.current_value} / {goal.target} completed
                      </span>

                      {/* Increment buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleGoalProgress(goal, 10)}
                          className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 transition-all cursor-pointer"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleGoalProgress(goal, 25)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all cursor-pointer shadow-sm"
                        >
                          +25
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 6. HABITS CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 text-xl font-bold shadow-inner">
                🔥
              </div>
              <div>
                <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
                  Daily Habits &amp; Routine
                </h3>
                <p className="text-xs text-surface-500">Build unstoppable daily streaks</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => handleToggleHabit(h.id, h.todayCompleted)}
                className={cn(
                  'flex items-center justify-between p-4 rounded-2xl border transition-all text-left cursor-pointer active:scale-98',
                  h.todayCompleted
                    ? 'bg-orange-50/80 border-orange-300 text-orange-950 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-100 shadow-sm'
                    : 'bg-surface-50/70 border-surface-200/80 dark:bg-surface-800/50 dark:border-white/[0.06] text-surface-700 dark:text-surface-300 hover:border-orange-300'
                )}
              >
                <div>
                  <p className="font-bold text-xs sm:text-sm">{h.name}</p>
                  <p className="text-[11px] text-surface-400 mt-0.5">{h.description}</p>
                </div>
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-xl font-black text-xs transition-all shadow-sm',
                    h.todayCompleted ? 'bg-orange-500 text-white' : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
                  )}
                >
                  {h.todayCompleted ? '✓' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab={quickAddTab}
        initialMoneyType={quickAddMoneyType}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={loadData}
      />
      {/* Attendance History Modal */}
      <AttendanceHistoryModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
      />
      {/* Absent Reason Modal */}
      <AbsentReasonModal
        isOpen={isAbsentModalOpen}
        onClose={() => setIsAbsentModalOpen(false)}
        onConfirm={handleConfirmAbsent}
      />
    </AppLayout>
  )
}
