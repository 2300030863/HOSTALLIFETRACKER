import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { showToast } from '@/components/ui/Toast'
import {
  attendanceService,
  reminderService,
  activityService,
  transactionService,
  goalService,
  habitService,
} from '@/services/dbServices'
import type {
  Attendance,
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
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)
  const [isAbsentModalOpen, setIsAbsentModalOpen] = useState(false)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [habits, setHabits] = useState<Array<Habit & { todayCompleted: boolean }>>([])

  // Modal control
  const [quickAddTab, setQuickAddTab] = useState<'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note'>('money')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [attData, remData, actData, txData, goalData, habData] = await Promise.all([
        attendanceService.getTodayAttendance(),
        reminderService.getTodayReminders(),
        activityService.getTodayActivities(),
        transactionService.getTodayTransactions(),
        goalService.getGoals(),
        habitService.getHabitsWithTodayLog(),
      ])

      setAttendance(attData)
      setReminders(remData)
      setActivities(actData)
      setTransactions(txData)
      setGoals(goalData)
      setHabits(habData)
    } catch (err) {
      console.error('Error loading today data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleOpenQuickAdd = (tab: 'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note') => {
    setQuickAddTab(tab)
    setIsQuickAddOpen(true)
  }

  // Attendance handlers
  const handleMarkAttendance = async (status: 'present' | 'late' | 'absent') => {
    try {
      const updated = await attendanceService.markAttendance(status)
      setAttendance(updated)
      showToast.success(`Attendance marked as ${status.toUpperCase()} 🖐️`)
    } catch (err: any) {
      showToast.error(err.message || 'Failed to mark attendance')
      // Refresh today's attendance to pick up auto-ABSENT status if window closed
      const updated = await attendanceService.getTodayAttendance()
      setAttendance(updated)
    }
  }

  const handleConfirmAbsent = async (reason: string) => {
    try {
      const updated = await attendanceService.markAttendance('absent', reason)
      setAttendance(updated)
      showToast.success(`Attendance marked as ABSENT: ${reason} ❌`)
    } catch (err: any) {
      showToast.error(err.message || 'Failed to mark attendance')
    }
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

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Today Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 p-6 text-white shadow-xl shadow-primary-600/20">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur-md mb-2">
                <Calendar size={13} />
                <span>TODAY — {format(new Date(), 'EEEE, MMMM d')}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Daily Summary 🚀
              </h2>
              <p className="text-sm text-primary-100 mt-1">
                Stay on top of your hostel attendance, money, activities, and goals.
              </p>
            </div>

            <button
              onClick={loadData}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold backdrop-blur-md transition-all self-start sm:self-auto"
            >
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 1. ATTENDANCE CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 text-xl font-bold">
                🖐️
              </div>
              <div>
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Attendance & Biometric
                </h3>
                <p className="text-xs text-surface-500">
                  {attendance
                    ? `Marked as ${attendance.status.toUpperCase()}${attendance.reason ? ` (${attendance.reason})` : attendance.check_in ? ` (${format(new Date(attendance.check_in), 'hh:mm a')})` : ''}`
                    : 'Not marked today • Window: 9:00 PM → 10:30 PM'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {attendance ? (
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide',
                    attendance.status === 'present'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : attendance.status === 'late'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                  )}
                >
                  {attendance.status}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  ⏳ Pending
                </span>
              )}

              <button
                onClick={() => setIsAttendanceModalOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:text-surface-900 dark:hover:text-white text-xs font-bold transition-all border border-surface-200 dark:border-surface-700"
                title="View Attendance Report & History"
              >
                View Log 👁️
              </button>
            </div>
          </div>

          {/* Attendance Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-100 dark:border-surface-800/80">
            <button
              onClick={() => handleMarkAttendance('present')}
              className={cn(
                'flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                attendance?.status === 'present'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
              )}
            >
              <span>Mark Present 🖐️</span>
            </button>

            <button
              onClick={() => handleMarkAttendance('late')}
              className={cn(
                'flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                attendance?.status === 'late'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
              )}
            >
              <span>Mark Late ⏰</span>
            </button>

            <button
              onClick={() => setIsAbsentModalOpen(true)}
              className={cn(
                'flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all',
                attendance?.status === 'absent'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
              )}
            >
              <span>Mark Absent ❌</span>
            </button>

            {attendance && !attendance.check_out && (
              <button
                onClick={handleCheckOut}
                className="py-2.5 px-4 rounded-xl text-xs font-bold bg-surface-800 text-white dark:bg-surface-700 hover:bg-surface-900 transition-all flex items-center gap-1"
              >
                <span>Check Out 🚪</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. REMINDERS CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xl font-bold">
                🔔
              </div>
              <div>
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Reminders ({reminders.filter((r) => !r.completed).length} pending)
                </h3>
                <p className="text-xs text-surface-500">Scheduled alerts for today</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenQuickAdd('reminder')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 transition-all"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {reminders.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl">
              <p className="text-xs text-surface-400">No reminders scheduled for today</p>
              <button
                onClick={() => handleOpenQuickAdd('reminder')}
                className="mt-2 text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline"
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
                    'flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer',
                    reminder.completed
                      ? 'bg-surface-50 dark:bg-surface-950/40 border-surface-200/50 dark:border-surface-800/50 opacity-60'
                      : 'bg-surface-50/50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700/60 hover:border-indigo-300'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={reminder.completed}
                      onChange={() => {}}
                      className="h-5 w-5 rounded-lg text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold text-surface-900 dark:text-white',
                          reminder.completed && 'line-through text-surface-400'
                        )}
                      >
                        {reminder.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {reminder.reminder_time}
                        </span>
                        {reminder.priority === 'high' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
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

        {/* 3. ACTIVITIES CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 text-xl font-bold">
                📝
              </div>
              <div>
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Today's Activities ({activities.length})
                </h3>
                <p className="text-xs text-surface-500">Lectures, study & tasks</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenQuickAdd('activity')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 transition-all"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl">
              <p className="text-xs text-surface-400">No activities logged today</p>
              <button
                onClick={() => handleOpenQuickAdd('activity')}
                className="mt-2 text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline"
              >
                + Add activity
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-surface-50/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleActivity(act.id, act.status)}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-lg border transition-all',
                        act.status === 'completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-surface-300 dark:border-surface-600 text-transparent'
                      )}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-semibold text-surface-900 dark:text-white',
                          act.status === 'completed' && 'line-through text-surface-400'
                        )}
                      >
                        {act.title}
                      </p>
                      <span className="text-xs text-surface-400 capitalize">
                        {act.category} {act.start_time ? `• ${act.start_time}` : ''}
                      </span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
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

        {/* 4. TODAY'S MONEY CARD */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 text-xl font-bold">
                💰
              </div>
              <div>
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Today's Money
                </h3>
                <p className="text-xs text-surface-500">
                  Spent: <span className="font-bold text-rose-600 dark:text-rose-400">₹{todaySpent}</span>
                  {todayReceived > 0 && (
                    <span className="ml-2">
                      Received: <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{todayReceived}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleOpenQuickAdd('money')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition-all"
              >
                <Plus size={14} />
                <span>Add Expense</span>
              </button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl">
              <p className="text-xs text-surface-400">No transactions logged today</p>
              <button
                onClick={() => handleOpenQuickAdd('money')}
                className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
              >
                + Record spent / given money
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-surface-50/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs',
                        tx.type === 'expense'
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                          : tx.type === 'given'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
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
                        {tx.description || tx.category}
                      </p>
                      <p className="text-xs text-surface-400 uppercase">
                        {tx.type} • {tx.payment_method}
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      'font-extrabold text-sm',
                      tx.type === 'expense' || tx.type === 'given'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    )}
                  >
                    {tx.type === 'expense' || tx.type === 'given' ? '-' : '+'}₹{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. GOALS CARD (NOW FULLY WORKING!) */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 text-xl font-bold">
                🎯
              </div>
              <div>
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Goals & Progress (Interactive)
                </h3>
                <p className="text-xs text-surface-500">Track and update active goals</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenQuickAdd('goal')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 text-xs font-bold hover:bg-purple-100 transition-all"
            >
              <Plus size={14} />
              <span>Add Goal</span>
            </button>
          </div>

          {goals.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl">
              <p className="text-xs text-surface-400">No active goals found</p>
              <button
                onClick={() => handleOpenQuickAdd('goal')}
                className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-bold hover:underline"
              >
                + Create your first goal
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const percent = Math.min(
                  100,
                  Math.round((goal.current_value / goal.target) * 100)
                )
                return (
                  <div
                    key={goal.id}
                    className="p-4 rounded-2xl bg-surface-50/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-surface-900 dark:text-white">
                        {goal.title}
                      </h4>
                      <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400">
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
                      <span className="text-xs text-surface-500">
                        {goal.current_value} / {goal.target} completed
                      </span>

                      {/* Increment buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleGoalProgress(goal, 10)}
                          className="px-2 py-1 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold hover:bg-purple-200 transition-all"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleGoalProgress(goal, 25)}
                          className="px-2 py-1 rounded-lg bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-700 transition-all"
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
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400 text-xl font-bold">
                🔥
              </div>
              <div>
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Daily Habits & Routine
                </h3>
                <p className="text-xs text-surface-500">Build consistency every day</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {habits.map((h) => (
              <button
                key={h.id}
                onClick={() => handleToggleHabit(h.id, h.todayCompleted)}
                className={cn(
                  'flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left',
                  h.todayCompleted
                    ? 'bg-orange-50/70 border-orange-300 text-orange-900 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200'
                    : 'bg-surface-50/50 border-surface-200 dark:bg-surface-800/50 dark:border-surface-700/60 text-surface-700 dark:text-surface-300'
                )}
              >
                <div>
                  <p className="font-bold text-xs">{h.name}</p>
                  <p className="text-[10px] text-surface-400">{h.description}</p>
                </div>
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-lg font-bold text-xs',
                    h.todayCompleted ? 'bg-orange-500 text-white' : 'bg-surface-200 dark:bg-surface-700'
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
