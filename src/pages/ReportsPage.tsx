import { useEffect, useState, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { AppLayout } from '@/components/ui/AppLayout'
import {
  transactionService,
  attendanceService,
  activityService,
  peopleService,
} from '@/services/dbServices'
import type { Transaction, Attendance, Activity, Person } from '@/types'
import { Download, Calendar, PieChart, CheckCircle2, Eye, FileText, Table, Filter } from 'lucide-react'
import { EXPENSE_CATEGORIES } from '@/types'
import { showToast } from '@/components/ui/Toast'
import { AttendanceHistoryModal } from '@/components/ui/AttendanceHistoryModal'
import {
  downloadReportImage,
  downloadReportPDF,
  downloadReportCSV,
} from '@/services/reportExportService'

export default function ReportsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false)

  // Interactive Report Filters
  // Interactive Report Filters
  const [selectedPersonNameFilter, setSelectedPersonNameFilter] = useState<string>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | '30days' | 'all'>('month')
  const [selectedReportType, setSelectedReportType] = useState<'money' | 'attendance'>('money')

  const loadData = useCallback(async () => {
    try {
      const [txData, attData, allAttData, actData, peopleData] = await Promise.all([
        transactionService.getAllTransactions(),
        attendanceService.getTodayAttendance(),
        attendanceService.getAllAttendance(),
        activityService.getTodayActivities(),
        peopleService.getPeople(),
      ])
      setTransactions(txData)
      setAttendance(attData)
      setAllAttendance(allAttData)
      setActivities(actData)
      setPeople(peopleData)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Extract all unique person names from people table, transactions.person_name, and description titles
  const allPersonNames = Array.from(
    new Set([
      ...people.map((p) => p.name.trim()),
      ...transactions
        .map((t) => t.person_name)
        .filter((name): name is string => Boolean(name && name.trim())),
      ...transactions
        .map((t) => {
          if (t.description) {
            const match = t.description.match(/(?:Given to|Received from)\s+(.+)/i)
            if (match) return match[1].trim()
          }
          return ''
        })
        .filter(Boolean),
    ])
  )
    .filter(Boolean)
    .sort()

  const selectedPersonDisplayName =
    selectedPersonNameFilter === 'all' ? 'All People' : selectedPersonNameFilter

  // Robust Person Matcher
  const isPersonMatch = (t: Transaction, personName: string) => {
    if (personName === 'all') return true
    const target = personName.toLowerCase().trim()

    // 1. Check person_name field
    if (t.person_name && t.person_name.toLowerCase().trim() === target) return true

    // 2. Check person_id field via people table
    if (t.person_id) {
      const pObj = people.find((p) => p.id === t.person_id)
      if (pObj && pObj.name.toLowerCase().trim() === target) return true
    }

    // 3. Check description / title (e.g. "Given to Tanishq")
    if (t.description && t.description.toLowerCase().includes(target)) return true

    return false
  }

  // Filter transactions by Person first
  const personTransactions = transactions.filter((t) =>
    isPersonMatch(t, selectedPersonNameFilter)
  )

  // Filter by Period
  let filteredTransactions = personTransactions.filter((t) => {
    if (selectedPeriod === 'month') {
      const currentMonth = format(new Date(), 'yyyy-MM')
      return t.transaction_date.startsWith(currentMonth)
    } else if (selectedPeriod === '30days') {
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      return t.transaction_date >= thirtyDaysAgo
    }
    return true
  })

  // Smart Fallback: If specific person selected, and 0 transactions found for "This Month", fallback to all-time for that person so older transactions (e.g. July/June) display instead of showing ₹0
  const isUsingPeriodFallback =
    selectedPersonNameFilter !== 'all' &&
    selectedPeriod !== 'all' &&
    filteredTransactions.length === 0 &&
    personTransactions.length > 0

  if (isUsingPeriodFallback) {
    filteredTransactions = personTransactions
  }

  const periodLabel = isUsingPeriodFallback
    ? `All Time (No records in ${selectedPeriod === 'month' ? format(new Date(), 'MMMM yyyy') : 'selected period'})`
    : selectedPeriod === 'month'
    ? format(new Date(), 'MMMM yyyy')
    : selectedPeriod === '30days'
    ? 'Last 30 Days'
    : 'All Time'

  // Category Expense Breakdown (Filtered)
  const expenses = filteredTransactions.filter((t) => t.type === 'expense')
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

  // Person / Money Metrics (Filtered)
  const givenAmount = filteredTransactions
    .filter((t) => t.type === 'given')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const receivedAmount = filteredTransactions
    .filter((t) => t.type === 'received')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const netBalance = givenAmount - receivedAmount

  // Attendance metrics (Calculated identically to AttendanceHistoryModal)
  const totalAttDays = allAttendance.length
  const presentDays = allAttendance.filter((a) => a.status === 'present').length
  const lateDays = allAttendance.filter((a) => a.status === 'late').length
  const absentDays = allAttendance.filter((a) => a.status === 'absent').length
  const pendingDays = allAttendance.filter((a) => a.status === 'pending').length

  const activePastDays = totalAttDays - pendingDays
  const attRate = activePastDays > 0 ? Math.round(((presentDays + lateDays) / activePastDays) * 100) : 0

// EXPORT HANDLERS
  const handleDownloadImage = async () => {
    try {
      if (selectedReportType === 'attendance') {
        const kpis = [
          { label: 'Attendance Rate', value: `${attRate}%`, color: '#f59e0b' },
          { label: 'Total Days', value: `${totalAttDays} Days`, color: '#38bdf8' },
          { label: 'Present / Late', value: `${presentDays + lateDays}`, color: '#4ade80' },
          { label: 'Absent', value: `${absentDays}`, color: '#f43f5e' },
        ]

        const items = allAttendance.slice(0, 10).map((a) => ({
          col1: a.attendance_date,
          col2: `Status: ${a.status.toUpperCase()}`,
          col3: a.status === 'present' ? '🖐️ PRESENT' : a.status === 'late' ? '⏰ LATE' : '❌ ABSENT',
          badgeColor: a.status === 'present' ? '#4ade80' : a.status === 'late' ? '#f59e0b' : '#f43f5e',
        }))

        await downloadReportImage(
          'ATTENDANCE REPORT',
          'Hostel Daily Attendance Summary Log',
          'User Attendance',
          periodLabel,
          kpis,
          items,
          {
            text: `Overall Attendance Consistency Rate: ${attRate}%`,
            isPositive: attRate >= 80,
            isNegative: attRate < 75,
          },
          `Attendance_Report_${periodLabel.replaceAll(' ', '_')}.png`
        )
      } else {
        // Money / Person Report Image
        const kpis = [
          { label: 'Total Given', value: `₹${givenAmount.toLocaleString()}`, color: '#38bdf8' },
          { label: 'Total Received', value: `₹${receivedAmount.toLocaleString()}`, color: '#4ade80' },
          {
            label: 'Net Balance',
            value: `₹${Math.abs(netBalance).toLocaleString()}`,
            color: netBalance > 0 ? '#f43f5e' : netBalance < 0 ? '#4ade80' : '#94a3b8',
          },
        ]

        const items = filteredTransactions.slice(0, 12).map((t) => ({
          col1: t.transaction_date,
          col2: `${t.person_name || t.category}${t.description ? ` (${t.description})` : ''}`,
          col3: `${t.type === 'given' ? '+' : t.type === 'received' ? '-' : ''}₹${Number(t.amount).toLocaleString()}`,
          badgeColor: t.type === 'given' ? '#38bdf8' : t.type === 'received' ? '#4ade80' : '#f43f5e',
        }))

        const footerText =
          selectedPersonNameFilter !== 'all'
            ? netBalance > 0
              ? `🔴 ${selectedPersonDisplayName} owes you ₹${Math.abs(netBalance).toLocaleString()}`
              : netBalance < 0
              ? `🟢 You owe ${selectedPersonDisplayName} ₹${Math.abs(netBalance).toLocaleString()}`
              : `✅ Account with ${selectedPersonDisplayName} is fully settled up!`
            : `📊 Overall Net Balance: ${netBalance >= 0 ? `+₹${netBalance}` : `-₹${Math.abs(netBalance)}`}`

        await downloadReportImage(
          'MONEY & DEBT REPORT',
          `Statement for ${selectedPersonDisplayName}`,
          selectedPersonDisplayName,
          periodLabel,
          kpis,
          items,
          {
            text: footerText,
            isNegative: netBalance > 0,
            isPositive: netBalance < 0,
          },
          `${selectedPersonDisplayName.replaceAll(' ', '_')}_Report.png`
        )
      }

      showToast.success(`Generated Report Image for ${selectedPersonDisplayName}! 📥`)
    } catch (err) {
      console.error(err)
      showToast.error('Failed to generate report image')
    }
  }

  const handleDownloadPDF = () => {
    try {
      const kpis = [
        { label: 'Total Given', value: `₹${givenAmount.toLocaleString()}` },
        { label: 'Total Received', value: `₹${receivedAmount.toLocaleString()}` },
        { label: 'Net Balance', value: `₹${Math.abs(netBalance).toLocaleString()}` },
      ]

      const headers = ['Date', 'Type', 'Person / Category', 'Amount', 'Method']
      const rows = filteredTransactions.map((t) => [
        t.transaction_date,
        t.type.toUpperCase(),
        t.person_name || t.category,
        `₹${Number(t.amount).toLocaleString()}`,
        t.payment_method.toUpperCase(),
      ])

      downloadReportPDF(
        `REPORT STATEMENT - ${selectedPersonDisplayName}`,
        selectedPersonDisplayName,
        periodLabel,
        kpis,
        headers,
        rows,
        `Generated statement for ${selectedPersonDisplayName}`,
        `${selectedPersonDisplayName.replaceAll(' ', '_')}_Statement.pdf`
      )
    } catch (err) {
      showToast.error('Failed to generate PDF statement')
    }
  }

  const handleDownloadCSV = () => {
    if (filteredTransactions.length === 0) {
      showToast.error('No transactions to export for this filter')
      return
    }

    const headers = ['Date', 'Type', 'Category/Person', 'Amount', 'Payment Method', 'Description']
    const rows = filteredTransactions.map((t) => [
      t.transaction_date,
      t.type,
      t.person_name || t.category,
      t.amount,
      t.payment_method,
      t.description || '',
    ])

    downloadReportCSV(
      headers,
      rows,
      `hostel_report_${selectedPersonDisplayName.replaceAll(' ', '_')}.csv`
    )
    showToast.success('Report exported as CSV! 📊')
  }

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Reports & Analytics</span>
              <span>📊</span>
            </h1>
            <p className="text-xs text-surface-500">
              Download clean PNG report cards, PDF statements & CSV spreadsheets
            </p>
          </div>

          {/* Quick Download Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadImage}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all cursor-pointer"
              title="Download selected report as a PNG image card"
            >
              <Download size={15} />
              <span>Download Image (PNG)</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-800 hover:bg-surface-900 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              title="Download PDF"
            >
              <FileText size={15} />
              <span>PDF</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              title="Download CSV"
            >
              <Table size={15} />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* INTERACTIVE REPORT FILTER CONTROL PANEL */}
        <div className="p-5 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-surface-900 dark:text-white flex items-center gap-2">
              <Filter size={16} className="text-primary-500" />
              <span>Custom Report Generator Filters</span>
            </h3>
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400">
              Target: {selectedPersonDisplayName} ({periodLabel})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Person Filter */}
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">
                👤 Select Person:
              </label>
              <select
                value={selectedPersonNameFilter}
                onChange={(e) => setSelectedPersonNameFilter(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-xs bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white font-medium"
              >
                <option value="all">👥 All People (Overall Summary)</option>
                {allPersonNames.map((name) => (
                  <option key={name} value={name}>
                    👤 {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Period Filter */}
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">
                📅 Select Period:
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value as any)}
                className="w-full rounded-xl px-3 py-2 text-xs bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white font-medium"
              >
                <option value="month">This Month ({format(new Date(), 'MMMM yyyy')})</option>
                <option value="30days">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Report Type Filter */}
            <div>
              <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">
                📊 Report Type:
              </label>
              <select
                value={selectedReportType}
                onChange={(e) => setSelectedReportType(e.target.value as any)}
                className="w-full rounded-xl px-3 py-2 text-xs bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white font-medium"
              >
                <option value="money">💰 Money & Person Statement</option>
                <option value="attendance">🖐️ Attendance Summary Log</option>
              </select>
            </div>
          </div>
        </div>

        {/* Period Fallback Alert Banner */}
        {isUsingPeriodFallback && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-between shadow-sm animate-fade-in">
            <span>
              ℹ️ Showing <strong>All-Time</strong> transactions for <strong>{selectedPersonDisplayName}</strong> because there were no transactions recorded in {format(new Date(), 'MMMM yyyy')}.
            </span>
            <button
              onClick={() => setSelectedPeriod('all')}
              className="px-3 py-1 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-all shrink-0 cursor-pointer shadow-sm ml-2"
            >
              Switch Period to All Time
            </button>
          </div>
        )}

        {/* Selected Filter Summary Stats Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/40">
            <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase">Total Given</p>
            <p className="text-xl font-black text-sky-700 dark:text-sky-300 mt-1">₹{givenAmount.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Total Received</p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">₹{receivedAmount.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40">
            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
              {selectedPersonNameFilter === 'all' ? 'Net Balance' : `${selectedPersonDisplayName}'s Balance`}
            </p>
            <p
              className={`text-xl font-black mt-1 ${
                netBalance > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : netBalance < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-surface-700 dark:text-surface-300'
              }`}
            >
              ₹{Math.abs(netBalance).toLocaleString()}{' '}
              <span className="text-xs font-normal">
                {netBalance > 0 ? '(Owes You)' : netBalance < 0 ? '(You Owe)' : '(Settled)'}
              </span>
            </p>
          </div>
        </div>

        {/* Expense Category Breakdown */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-surface-900 dark:text-white flex items-center gap-2">
              <PieChart size={18} className="text-primary-500" />
              <span>Expense Breakdown by Category ({selectedPersonDisplayName})</span>
            </h3>
            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
              Total Spent: ₹{totalExpenseAmount.toLocaleString()}
            </span>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="text-center py-8 text-surface-400 text-xs">
              No expense transactions recorded for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-surface-800 dark:text-surface-200">{item.category}</span>
                    <span className="text-surface-500">
                      ₹{item.amount.toLocaleString()} ({item.percentage}%)
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
          {/* Attendance Overview */}
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
