import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { transactionService, attendanceService, activityService } from '@/services/dbServices'
import type { Transaction, Attendance, Activity } from '@/types'
import { Download, Calendar, PieChart, CheckCircle2, Eye } from 'lucide-react'
import { EXPENSE_CATEGORIES } from '@/types'
import { showToast } from '@/components/ui/Toast'
import { AttendanceHistoryModal } from '@/components/ui/AttendanceHistoryModal'

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [txData, attData, allAttData, actData] = await Promise.all([
        transactionService.getAllTransactions(),
        attendanceService.getTodayAttendance(),
        attendanceService.getAllAttendance(),
        activityService.getTodayActivities(),
      ])
      setTransactions(txData)
      setAttendance(attData)
      setAllAttendance(allAttData)
      setActivities(actData)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Category Expense Breakdown
  const expenses = transactions.filter((t) => t.type === 'expense')
  const totalExpenseAmount = expenses.reduce((acc, t) => acc + Number(t.amount), 0)

  const categoryBreakdown = EXPENSE_CATEGORIES.map((cat) => {
    const amount = expenses
      .filter((t) => t.category === cat)
      .reduce((acc, t) => acc + Number(t.amount), 0)

    const percentage =
      totalExpenseAmount > 0 ? Math.round((amount / totalExpenseAmount) * 100) : 0

    return {
      category: cat,
      amount,
      percentage,
    }
  }).filter((c) => c.amount > 0)

  // Attendance metrics
  const totalAttDays = allAttendance.length
  const presentDays = allAttendance.filter((a) => a.status === 'present').length
  const lateDays = allAttendance.filter((a) => a.status === 'late').length
  const attRate = totalAttDays > 0 ? Math.round(((presentDays + lateDays) / totalAttDays) * 100) : 0

  // Export to CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      showToast.error('No transactions to export')
      return
    }

    const headers = ['Date', 'Type', 'Category/Person', 'Amount', 'Payment Method', 'Description']
    const rows = transactions.map((t) => [
      t.transaction_date,
      t.type,
      t.person_name || t.category,
      t.amount,
      t.payment_method,
      `"${t.description || ''}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `hostel_report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast.success('Report exported as CSV! 📄')
  }

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Reports & Analytics</span>
              <span>📊</span>
            </h1>
            <p className="text-xs text-surface-500">Monthly spending, attendance logs & activity summaries</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Expense Category Breakdown */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-surface-900 dark:text-white flex items-center gap-2">
              <PieChart size={18} className="text-primary-500" />
              <span>Expense Breakdown by Category</span>
            </h3>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
              Total Spent: ₹{totalExpenseAmount}
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="text-center py-8 text-surface-400 text-xs">
              No expense transactions recorded to generate breakdown.
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-surface-800 dark:text-surface-200">{item.category}</span>
                    <span className="text-surface-500">
                      ₹{item.amount} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Attendance & Activity Summaries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Attendance Overview with View Option */}
          <div className="p-5 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2">
                  <Calendar size={16} className="text-amber-500" />
                  <span>Attendance & Biometric Report</span>
                </h4>
                <button
                  onClick={() => setIsAttendanceModalOpen(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 text-xs font-bold hover:bg-amber-100 transition-all border border-amber-200 dark:border-amber-900/40"
                >
                  <Eye size={13} />
                  <span>View Log</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-100 dark:border-surface-700/50">
                  <p className="text-[10px] text-surface-500 font-semibold">Attendance Rate</p>
                  <p className="text-lg font-black text-amber-600 dark:text-amber-400">{attRate}%</p>
                </div>
                <div className="p-3 rounded-2xl bg-surface-50 dark:bg-surface-800/60 border border-surface-100 dark:border-surface-700/50">
                  <p className="text-[10px] text-surface-500 font-semibold">Total Logged</p>
                  <p className="text-lg font-black text-surface-900 dark:text-white">{totalAttDays} Days</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                <p className="text-[11px] text-surface-500 font-semibold">Today's Status</p>
                <p className="text-sm font-black uppercase text-amber-700 dark:text-amber-300 mt-0.5">
                  {attendance ? (
                    <span className="flex items-center gap-1.5">
                      {attendance.status === 'present' ? '🖐️ PRESENT' : attendance.status === 'late' ? '⏰ LATE' : '❌ ABSENT'}
                    </span>
                  ) : (
                    '⏳ PENDING (WINDOW: 9:00 PM - 10:30 PM)'
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAttendanceModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20 transition-all"
            >
              <Eye size={14} />
              <span>Open Detailed Attendance Report</span>
            </button>
          </div>

          {/* Activity Overview */}
          <div className="p-5 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-3">
            <h4 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-500" />
              <span>Today's Activity Status</span>
            </h4>
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
              <p className="text-xs text-surface-500">Activities Logged Today</p>
              <p className="text-lg font-black text-blue-700 dark:text-blue-300 mt-0.5">
                {activities.filter((a) => a.status === 'completed').length} / {activities.length}{' '}
                Completed
              </p>
            </div>
          </div>
        </div>
      </div>

      <AttendanceHistoryModal
        isOpen={isAttendanceModalOpen}
        onClose={() => setIsAttendanceModalOpen(false)}
      />
    </AppLayout>
  )
}

