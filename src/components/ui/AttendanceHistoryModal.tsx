import { useEffect, useState } from 'react'
import { X, Calendar } from 'lucide-react'
import { attendanceService, checkAttendanceWindow } from '@/services/dbServices'
import type { Attendance } from '@/types'
import { cn } from '@/utils/cn'

interface AttendanceHistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AttendanceHistoryModal({ isOpen, onClose }: AttendanceHistoryModalProps) {
  const [history, setHistory] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [daysRange, setDaysRange] = useState<number>(30)
  const [filter, setFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'pending'>('all')

  useEffect(() => {
    if (isOpen) {
      loadHistory(daysRange)
    }
  }, [isOpen, daysRange])

  const loadHistory = async (days: number) => {
    setLoading(true)
    try {
      const records = await attendanceService.getAllAttendance(days)
      setHistory(records)
    } catch (err) {
      console.error('Failed to load attendance history', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Calculate statistics (considering recorded days)
  const totalDays = history.length
  const presentCount = history.filter((a) => a.status === 'present').length
  const lateCount = history.filter((a) => a.status === 'late').length
  const absentCount = history.filter((a) => a.status === 'absent').length
  const pendingCount = history.filter((a) => a.status === 'pending').length

  const activePastDays = totalDays - pendingCount
  const attendancePercentage =
    activePastDays > 0 ? Math.round(((presentCount + lateCount) / activePastDays) * 100) : 0

  const filteredHistory = history.filter((a) => {
    if (filter === 'all') return true
    return a.status === filter
  })

  const windowInfo = checkAttendanceWindow()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white dark:bg-surface-900 shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 text-xl font-bold">
              🖐️
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-surface-900 dark:text-white flex items-center gap-2">
                <span>Complete Attendance History</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                  9:00 PM → 10:30 PM
                </span>
              </h2>
              <p className="text-xs text-surface-500">
                Full daily log of all days since tracking started
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Controls Bar: Time Range Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/60 dark:border-surface-700/60">
            <div className="flex items-center gap-2 text-xs font-bold text-surface-700 dark:text-surface-300">
              <Calendar size={15} className="text-amber-500" />
              <span>Timeframe:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { label: '30 Days', value: 30 },
                { label: '60 Days', value: 60 },
                { label: '90 Days', value: 90 },
                { label: 'All Time (1 Year)', value: 365 },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDaysRange(range.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0',
                    daysRange === range.value
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white dark:bg-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Status Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-primary-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                Today's Rule & Current Window
              </p>
              <p className="text-xs font-extrabold text-surface-900 dark:text-white mt-0.5">
                {windowInfo.statusMessage}
              </p>
            </div>
            <div className="text-xs font-medium text-surface-600 dark:text-surface-300 bg-white/80 dark:bg-surface-800/80 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 self-start sm:self-auto">
              Server Time: <span className="font-bold text-amber-600 dark:text-amber-400">{windowInfo.serverTimeStr}</span>
            </div>
          </div>

          {/* Attendance Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-100 dark:border-surface-700/50">
              <p className="text-[11px] font-semibold text-surface-500">Overall Rate</p>
              <p className="text-xl font-black text-primary-600 dark:text-primary-400 mt-1">
                {attendancePercentage}%
              </p>
              <div className="w-full bg-surface-200 dark:bg-surface-700 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className="bg-primary-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${attendancePercentage}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Present 🖐️
              </p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {presentCount} <span className="text-xs font-normal">days</span>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Late ⏰</p>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {lateCount} <span className="text-xs font-normal">days</span>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
              <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Absent ❌</p>
              <p className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {absentCount} <span className="text-xs font-normal">days</span>
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 border-b border-surface-100 dark:border-surface-800 pb-3 overflow-x-auto">
            {(['all', 'present', 'late', 'absent', 'pending'] as const).map((st) => {
              const count = history.filter((h) => (st === 'all' ? true : h.status === st)).length
              return (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize transition-all shrink-0',
                    filter === st
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  )}
                >
                  {st} ({count})
                </button>
              )
            })}
          </div>

          {/* Complete History List */}
          {loading ? (
            <div className="text-center py-10 text-xs text-surface-400">Loading daily attendance records...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-10 text-xs text-surface-400">
              No attendance records found for this filter.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((item) => {
                const checkInTime = item.check_in
                  ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--'
                const checkOutTime = item.check_out
                  ? new Date(item.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--'

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-100 dark:border-surface-700/50 hover:bg-surface-100/70 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold',
                          item.status === 'present'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : item.status === 'late'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : item.status === 'pending'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        )}
                      >
                        {item.status === 'present'
                          ? '🖐️'
                          : item.status === 'late'
                          ? '⏰'
                          : item.status === 'pending'
                          ? '⏳'
                          : '❌'}
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-surface-900 dark:text-white">
                          {item.attendance_date}
                        </p>
                        <p className="text-[11px] text-surface-500 font-medium">
                          In: <span className="font-semibold text-surface-700 dark:text-surface-300">{checkInTime}</span> | Out:{' '}
                          <span className="font-semibold text-surface-700 dark:text-surface-300">{checkOutTime}</span>
                        </p>
                        {item.reason && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                            Reason: {item.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                          item.status === 'present'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : item.status === 'late'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : item.status === 'pending'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
