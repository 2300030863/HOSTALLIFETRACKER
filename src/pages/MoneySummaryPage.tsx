import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { EditTransactionModal } from '@/components/ui/EditTransactionModal'
import { transactionService, peopleService, subscribeToRealtime } from '@/services/dbServices'
import type { Transaction, Person } from '@/types'
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  User,
  Clock,
  Trash2,
  Pencil,
  Wallet,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'

type PeriodFilter = 'month' | '30days' | 'quarter' | 'all'
type StatusFilter = 'all' | 'pending' | 'settled'

interface PersonSummary {
  personName: string
  personId?: string
  phone?: string | null
  totalGiven: number
  totalReceived: number
  netBalance: number // positive = owes user; negative = user owes person
  pendingGiven: number
  pendingReceived: number
  transactionCount: number
}

export default function MoneySummaryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [, setLoading] = useState(true)

  // Filters state - Default period to 'all' so users immediately see all historical records
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('all')
  const [selectedPerson, setSelectedPerson] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modal states
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [quickAddType, setQuickAddType] = useState<'expense' | 'given' | 'received'>('given')
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [txData, peopleData] = await Promise.all([
        transactionService.getAllTransactions(),
        peopleService.getPeople(),
      ])
      setTransactions(txData)
      setPeople(peopleData)
    } catch (err) {
      console.error(err)
      showToast.error('Failed to load transaction summary')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const unsubscribe = subscribeToRealtime(() => {
      loadData()
    })
    return () => unsubscribe()
  }, [loadData])

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction record?')) {
      try {
        await transactionService.deleteTransaction(id)
        setTransactions((prev) => prev.filter((t) => t.id !== id))
        showToast.success('Transaction removed')
      } catch {
        showToast.error('Failed to delete transaction')
      }
    }
  }

  const handleSettleUp = async (personName: string, netAmount: number) => {
    if (netAmount === 0) return
    const isOwedToUser = netAmount > 0
    const matchedPerson = people.find(
      (p) => p.name.toLowerCase().trim() === personName.toLowerCase().trim()
    )

    try {
      await transactionService.createTransaction({
        type: isOwedToUser ? 'received' : 'given',
        amount: Math.abs(netAmount),
        category: 'Settlement',
        description: `Full Settlement with ${personName}`,
        person_id: matchedPerson?.id || undefined,
        person_name: personName,
        status: 'settled',
      })
      showToast.success(`Settlement of ₹${Math.abs(netAmount)} recorded for ${personName}! 🤝`)
      loadData()
    } catch {
      showToast.error('Failed to record settlement')
    }
  }

  // Filter transactions to only Given and Received (Money Taken & Receiving Money)
  const moneyTakenAndGivenTxs = useMemo(() => {
    return transactions.filter((t) => t.type === 'given' || t.type === 'received')
  }, [transactions])

  // Extract all unique person names from friends list and transactions
  const allPersonNames = useMemo(() => {
    const namesSet = new Set<string>()
    people.forEach((p) => {
      if (p.name && p.name.trim()) namesSet.add(p.name.trim())
    })
    moneyTakenAndGivenTxs.forEach((t) => {
      if (t.person_name && t.person_name.trim()) {
        namesSet.add(t.person_name.trim())
      }
      if (t.description) {
        const match = t.description.match(/(?:Given to|Received from|Settlement with)\s+(.+)/i)
        if (match && match[1].trim()) namesSet.add(match[1].trim())
      }
    })
    return Array.from(namesSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [people, moneyTakenAndGivenTxs])

  // Helper matcher for person
  const isPersonMatch = useCallback(
    (t: Transaction, targetPerson: string) => {
      if (targetPerson === 'all') return true
      const target = targetPerson.toLowerCase().trim()

      if (t.person_name && t.person_name.toLowerCase().trim() === target) return true

      if (t.person_id) {
        const pObj = people.find((p) => p.id === t.person_id)
        if (pObj && pObj.name.toLowerCase().trim() === target) return true
      }

      if (t.description && t.description.toLowerCase().includes(target)) return true

      return false
    },
    [people]
  )

  // Apply Period, Person, Status, & Search Filters
  const filteredTransactions = useMemo(() => {
    let list = moneyTakenAndGivenTxs.filter((t) => {
      // 1. Period filter
      if (selectedPeriod === 'month') {
        const currentMonth = format(new Date(), 'yyyy-MM')
        if (!t.transaction_date.startsWith(currentMonth)) return false
      } else if (selectedPeriod === '30days') {
        const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')
        if (t.transaction_date < thirtyDaysAgo) return false
      } else if (selectedPeriod === 'quarter') {
        const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd')
        if (t.transaction_date < ninetyDaysAgo) return false
      }

      // 2. Person filter
      if (!isPersonMatch(t, selectedPerson)) return false

      // 3. Status filter
      if (selectedStatus !== 'all') {
        if (t.status !== selectedStatus) return false
      }

      // 4. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = (t.person_name || '').toLowerCase().includes(q)
        const matchDesc = (t.description || '').toLowerCase().includes(q)
        const matchCat = (t.category || '').toLowerCase().includes(q)
        const matchAmt = t.amount.toString().includes(q)
        if (!matchName && !matchDesc && !matchCat && !matchAmt) return false
      }

      return true
    })

    // Smart Fallback: If user picked a specific person and period is restricted, but 0 records returned, include all-time for that person
    if (selectedPerson !== 'all' && list.length === 0 && selectedPeriod !== 'all') {
      const allTimeForPerson = moneyTakenAndGivenTxs.filter((t) => {
        if (!isPersonMatch(t, selectedPerson)) return false
        if (selectedStatus !== 'all' && t.status !== selectedStatus) return false
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim()
          const matchName = (t.person_name || '').toLowerCase().includes(q)
          const matchDesc = (t.description || '').toLowerCase().includes(q)
          const matchCat = (t.category || '').toLowerCase().includes(q)
          const matchAmt = t.amount.toString().includes(q)
          if (!matchName && !matchDesc && !matchCat && !matchAmt) return false
        }
        return true
      })
      if (allTimeForPerson.length > 0) {
        list = allTimeForPerson
      }
    }

    return list
  }, [moneyTakenAndGivenTxs, selectedPeriod, selectedPerson, selectedStatus, searchQuery, isPersonMatch])

  // Compute Overall Totals based on active filters
  const totals = useMemo(() => {
    let totalGiven = 0
    let totalReceived = 0
    let pendingGiven = 0
    let pendingReceived = 0

    filteredTransactions.forEach((t) => {
      const amt = Number(t.amount) || 0
      if (t.type === 'given') {
        totalGiven += amt
        if (t.status === 'pending') pendingGiven += amt
      } else if (t.type === 'received') {
        totalReceived += amt
        if (t.status === 'pending') pendingReceived += amt
      }
    })

    const netBalance = totalGiven - totalReceived
    const netPending = pendingGiven - pendingReceived

    return {
      totalGiven,
      totalReceived,
      pendingGiven,
      pendingReceived,
      netBalance,
      netPending,
    }
  }, [filteredTransactions])

  // Compute Person-by-Person Summaries dynamically according to selected filters
  const personSummaries = useMemo(() => {
    const map = new Map<string, PersonSummary>()

    // Use filteredTransactions if a person/status/period/search filter is applied,
    // otherwise use all moneyTakenAndGivenTxs
    const sourceTxs =
      selectedPerson !== 'all' || selectedStatus !== 'all' || searchQuery.trim() || selectedPeriod !== 'all'
        ? filteredTransactions
        : moneyTakenAndGivenTxs

    // Populate from people list
    people.forEach((p) => {
      const pName = p.name.trim()
      if (selectedPerson === 'all' || pName.toLowerCase() === selectedPerson.toLowerCase().trim()) {
        map.set(pName.toLowerCase(), {
          personName: pName,
          personId: p.id,
          phone: p.phone,
          totalGiven: 0,
          totalReceived: 0,
          netBalance: 0,
          pendingGiven: 0,
          pendingReceived: 0,
          transactionCount: 0,
        })
      }
    })

    // Process source transactions
    sourceTxs.forEach((t) => {
      let pName = (t.person_name || '').trim()
      if (!pName && t.person_id) {
        const pObj = people.find((p) => p.id === t.person_id)
        if (pObj) pName = pObj.name.trim()
      }
      if (!pName && t.description) {
        const match = t.description.match(/(?:Given to|Received from|Settlement with)\s+(.+)/i)
        if (match) pName = match[1].trim()
      }
      if (!pName) pName = 'Uncategorized'

      const key = pName.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          personName: pName,
          totalGiven: 0,
          totalReceived: 0,
          netBalance: 0,
          pendingGiven: 0,
          pendingReceived: 0,
          transactionCount: 0,
        })
      }

      const summary = map.get(key)!
      const amt = Number(t.amount) || 0
      summary.transactionCount += 1

      if (t.type === 'given') {
        summary.totalGiven += amt
        if (t.status === 'pending') summary.pendingGiven += amt
      } else if (t.type === 'received') {
        summary.totalReceived += amt
        if (t.status === 'pending') summary.pendingReceived += amt
      }

      summary.netBalance = summary.totalGiven - summary.totalReceived
    })

    // Filter out zero-transaction people if specific status filter is 'pending' or 'settled'
    let list = Array.from(map.values())
    if (selectedStatus === 'pending') {
      list = list.filter((item) => item.pendingGiven > 0 || item.pendingReceived > 0 || item.netBalance !== 0)
    } else if (selectedStatus === 'settled') {
      list = list.filter((item) => item.transactionCount > 0 && item.netBalance === 0)
    } else {
      list = list.filter((item) => item.transactionCount > 0 || item.personId)
    }

    list.sort((a, b) => {
      if (Math.abs(b.netBalance) !== Math.abs(a.netBalance)) {
        return Math.abs(b.netBalance) - Math.abs(a.netBalance)
      }
      return a.personName.localeCompare(b.personName)
    })

    return list
  }, [moneyTakenAndGivenTxs, filteredTransactions, people, selectedPerson, selectedStatus, searchQuery, selectedPeriod])

  // Overdue / Upcoming Expected Return Date Transactions
  const upcomingReturnTxs = useMemo(() => {
    return moneyTakenAndGivenTxs
      .filter((t) => t.status === 'pending' && t.expected_return_date)
      .sort((a, b) => (a.expected_return_date || '').localeCompare(b.expected_return_date || ''))
  }, [moneyTakenAndGivenTxs])

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      showToast.error('No transactions available to export')
      return
    }

    const headers = [
      'ID',
      'Date',
      'Type',
      'Person Name',
      'Amount (INR)',
      'Category',
      'Status',
      'Expected Return Date',
      'Payment Method',
      'Description',
    ]

    const rows = filteredTransactions.map((t) => [
      t.id,
      t.transaction_date,
      t.type === 'given' ? 'Given (Lent)' : 'Received (Borrowed)',
      t.person_name || 'N/A',
      t.amount,
      t.category,
      t.status,
      t.expected_return_date || 'N/A',
      t.payment_method,
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `money_taken_and_receiving_summary_${format(new Date(), 'yyyy_MM_dd')}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    showToast.success('Downloaded summary CSV file! 📄')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleOpenAddModal = (type: 'given' | 'received') => {
    setQuickAddType(type)
    setIsQuickAddOpen(true)
  }

  const handleResetFilters = () => {
    setSelectedPerson('all')
    setSelectedStatus('all')
    setSearchQuery('')
    setSelectedPeriod('all')
    showToast.success('Reset all filters to show full history! 🔄')
  }

  const isFilterActive =
    selectedPerson !== 'all' || selectedStatus !== 'all' || searchQuery.trim() !== '' || selectedPeriod !== 'all'

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary-900/10 via-surface-900/5 to-emerald-900/10 dark:from-primary-950/40 dark:via-surface-900/40 dark:to-emerald-950/40 p-5 rounded-3xl border border-surface-200/80 dark:border-surface-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📊</span>
              <h1 className="text-2xl font-black text-surface-900 dark:text-white">
                Money Summary & Ledger
              </h1>
            </div>
            <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
              Complete financial summary of Money Taken (Borrowed/Received) & Receiving Money (Lent/Owed to You).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenAddModal('given')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all cursor-pointer border-0"
            >
              <Plus size={15} />
              <span>🤝 Record Money Given</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('received')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer border-0"
            >
              <Plus size={15} />
              <span>💰 Record Money Taken</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 text-xs font-semibold transition-all cursor-pointer border border-surface-200 dark:border-surface-700"
              title="Export CSV"
            >
              <Download size={15} />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 text-xs font-semibold transition-all cursor-pointer border border-surface-200 dark:border-surface-700"
              title="Print Summary"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Money Given (Receivables) */}
          <div className="p-4 rounded-3xl bg-white dark:bg-surface-900 border border-amber-200/80 dark:border-amber-900/50 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-amber-500/10 dark:text-amber-400/10 group-hover:scale-110 transition-transform">
              <ArrowUpRight size={64} />
            </div>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
              <ArrowUpRight size={16} />
              <span>Receiving Money (Given)</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white mt-2">
              ₹{totals.totalGiven.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center justify-between text-xs text-surface-500 mt-2 pt-2 border-t border-surface-100 dark:border-surface-800">
              <span>Pending Collection:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                ₹{totals.pendingGiven.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Card 2: Money Taken (Payables) */}
          <div className="p-4 rounded-3xl bg-white dark:bg-surface-900 border border-emerald-200/80 dark:border-emerald-900/50 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-emerald-500/10 dark:text-emerald-400/10 group-hover:scale-110 transition-transform">
              <ArrowDownLeft size={64} />
            </div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
              <ArrowDownLeft size={16} />
              <span>Money Taken (Received)</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white mt-2">
              ₹{totals.totalReceived.toLocaleString('en-IN')}
            </div>
            <div className="flex items-center justify-between text-xs text-surface-500 mt-2 pt-2 border-t border-surface-100 dark:border-surface-800">
              <span>Pending Repayment:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                ₹{totals.pendingReceived.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Card 3: Net Financial Balance */}
          <div className="p-4 rounded-3xl bg-white dark:bg-surface-900 border border-primary-200/80 dark:border-primary-900/50 shadow-sm relative overflow-hidden group">
            <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold text-xs">
              <Wallet size={16} />
              <span>Net Position</span>
            </div>
            <div
              className={cn(
                'text-2xl sm:text-3xl font-black mt-2',
                totals.netBalance > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : totals.netBalance < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-surface-700 dark:text-surface-300'
              )}
            >
              {totals.netBalance > 0
                ? `+₹${totals.netBalance.toLocaleString('en-IN')}`
                : totals.netBalance < 0
                ? `-₹${Math.abs(totals.netBalance).toLocaleString('en-IN')}`
                : '₹0'}
            </div>
            <div className="text-xs text-surface-500 mt-2 pt-2 border-t border-surface-100 dark:border-surface-800 font-medium">
              {totals.netBalance > 0
                ? '🟢 Friends owe you more than you owe'
                : totals.netBalance < 0
                ? '🔴 You owe more than friends owe you'
                : '⚖️ Perfectly balanced accounts'}
            </div>
          </div>

          {/* Card 4: Action Count & Overdue Alerts */}
          <div className="p-4 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-surface-500">Active Records</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400">
                {filteredTransactions.length} Txs
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <span>{upcomingReturnTxs.length}</span>
                <span className="text-xs font-normal text-surface-500">Scheduled Returns</span>
              </div>
              <p className="text-[11px] text-surface-400 mt-0.5">
                Expected return date set for pending logs
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-surface-100 dark:border-surface-800">
              <Link
                to="/people"
                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <span>View Friends Directory</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>

        {/* Expected Return Date Reminders Alert Banner */}
        {upcomingReturnTxs.length > 0 && (
          <div className="rounded-3xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                <Clock size={18} />
                <span>Upcoming & Pending Return Reminders</span>
              </div>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {upcomingReturnTxs.length} Item(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {upcomingReturnTxs.slice(0, 3).map((tx) => {
                const isOverdue =
                  tx.expected_return_date && tx.expected_return_date < format(new Date(), 'yyyy-MM-dd')
                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-white dark:bg-surface-900 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-surface-900 dark:text-white truncate">
                        {tx.person_name || 'Friend'} ({tx.type === 'given' ? 'Given' : 'Taken'})
                      </p>
                      <p className="text-[11px] text-surface-500">
                        Amount:{' '}
                        <span className="font-bold text-surface-900 dark:text-white">
                          ₹{tx.amount}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-lg text-[10px] font-extrabold block',
                          isOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        )}
                      >
                        {isOverdue ? 'Overdue' : 'Due'}: {tx.expected_return_date}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by person name, note, or amount..."
                className="w-full pl-10 pr-4 py-2 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all"
              />
            </div>

            {/* Time Period Filter Pills */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 overflow-x-auto">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'month', label: 'This Month' },
                { id: '30days', label: '30 Days' },
                { id: 'quarter', label: '90 Days' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedPeriod(tab.id as PeriodFilter)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border-0',
                    selectedPeriod === tab.id
                      ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 shadow-sm'
                      : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-surface-100 dark:border-surface-800">
            {/* Person Filter Dropdown */}
            <div className="flex items-center gap-2">
              <User size={14} className="text-surface-400" />
              <span className="text-xs font-semibold text-surface-500">Person:</span>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs font-bold text-surface-900 dark:text-white focus:outline-none"
              >
                <option value="all">All People ({allPersonNames.length})</option>
                {allPersonNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-surface-400" />
              <span className="text-xs font-semibold text-surface-500">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
                className="px-3 py-1.5 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-xs font-bold text-surface-900 dark:text-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">⏳ Pending Only</option>
                <option value="settled">✅ Settled Only</option>
              </select>
            </div>

            {/* Reset Filters Button */}
            {isFilterActive && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 cursor-pointer transition-all"
              >
                <RefreshCw size={13} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Person-by-Person Summary Matrix */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Friend Balances & Settlements</span>
              <span className="text-xs font-semibold text-surface-400">
                ({personSummaries.length} Contacts)
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {personSummaries.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white dark:bg-surface-900 rounded-3xl border border-surface-200 dark:border-surface-800">
                <p className="text-sm font-bold text-surface-600 dark:text-surface-400">
                  No friend balances match the selected filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-3 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                >
                  Clear Filters to View All Records
                </button>
              </div>
            ) : (
              personSummaries.map((ps) => {
                const owesUser = ps.netBalance > 0
                const userOwes = ps.netBalance < 0
                const isSettled = ps.netBalance === 0

                return (
                  <div
                    key={ps.personName}
                    className="p-4 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 shadow-sm flex flex-col justify-between space-y-3 hover:border-primary-500/40 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm text-surface-900 dark:text-white">
                          {ps.personName}
                        </h3>
                        {ps.phone && (
                          <p className="text-[11px] text-surface-400 font-medium">{ps.phone}</p>
                        )}
                      </div>
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase',
                          owesUser
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : userOwes
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        )}
                      >
                        {owesUser
                          ? 'Owes You'
                          : userOwes
                          ? 'You Owe'
                          : 'Settled'}
                      </span>
                    </div>

                    {/* Given / Received stats */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-surface-50 dark:bg-surface-800/60 text-xs">
                      <div>
                        <p className="text-[10px] text-surface-400 font-medium">Money Given</p>
                        <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                          ₹{ps.totalGiven}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-surface-400 font-medium">Money Taken</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          ₹{ps.totalReceived}
                        </p>
                      </div>
                    </div>

                    {/* Net status & settle action */}
                    <div className="flex items-center justify-between pt-1 border-t border-surface-100 dark:border-surface-800">
                      <div>
                        <p className="text-[10px] text-surface-400">Net Outstanding:</p>
                        <p
                          className={cn(
                            'text-base font-black',
                            owesUser
                              ? 'text-amber-600 dark:text-amber-400'
                              : userOwes
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          ₹{Math.abs(ps.netBalance).toLocaleString('en-IN')}
                        </p>
                      </div>

                      {!isSettled && (
                        <button
                          onClick={() => handleSettleUp(ps.personName, ps.netBalance)}
                          className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all cursor-pointer border-0"
                        >
                          🤝 Settle Up
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Section 2: Detailed Transaction Ledger */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Itemized Money Ledger</span>
              <span className="text-xs font-semibold text-surface-400">
                ({filteredTransactions.length} Logged Transactions)
              </span>
            </h2>
          </div>

          <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-4 shadow-sm overflow-hidden">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-base font-bold text-surface-700 dark:text-surface-300">
                  No money transactions found 💸
                </p>
                <p className="text-xs text-surface-400 mt-1 max-w-sm mx-auto">
                  Try adjusting your search filters or record a new transaction for Money Given or Money Taken.
                </p>
                <div className="flex justify-center gap-2 mt-4">
                  <button
                    onClick={handleResetFilters}
                    className="px-3.5 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-bold border-0 cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                  <button
                    onClick={() => handleOpenAddModal('given')}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold border-0 cursor-pointer"
                  >
                    + Record Money Given
                  </button>
                  <button
                    onClick={() => handleOpenAddModal('received')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold border-0 cursor-pointer"
                  >
                    + Record Money Taken
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-surface-100 dark:divide-surface-800">
                {filteredTransactions.map((tx) => {
                  const isGiven = tx.type === 'given'
                  return (
                    <div
                      key={tx.id}
                      className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 rounded-2xl transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'p-2.5 rounded-2xl shrink-0 mt-0.5',
                            isGiven
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {isGiven ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-surface-900 dark:text-white">
                              {tx.person_name || 'General Record'}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase',
                                isGiven
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              )}
                            >
                              {isGiven ? 'Given (Lent)' : 'Taken (Received)'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-300">
                              {tx.category}
                            </span>
                          </div>

                          {tx.description && (
                            <p className="text-xs text-surface-500 mt-0.5">{tx.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-surface-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {tx.transaction_date}
                            </span>
                            {tx.expected_return_date && (
                              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                <Clock size={12} />
                                Expected Return: {tx.expected_return_date}
                              </span>
                            )}
                            <span className="capitalize">Method: {tx.payment_method}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-surface-100 dark:border-surface-800">
                        <div className="text-right">
                          <p
                            className={cn(
                              'text-base font-black',
                              isGiven
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {isGiven ? '+' : '-'}₹{tx.amount}
                          </p>
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mt-0.5',
                              tx.status === 'settled'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            )}
                          >
                            {tx.status === 'settled' ? '✅ Settled' : '⏳ Pending'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1.5 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500 hover:text-surface-900 dark:hover:text-white transition-all cursor-pointer border-0 bg-transparent"
                            title="Edit Record"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 text-surface-400 hover:text-rose-600 transition-all cursor-pointer border-0 bg-transparent"
                            title="Delete Record"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isQuickAddOpen && (
        <QuickAddModal
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          initialTab="money"
          initialMoneyType={quickAddType}
          onSuccess={loadData}
        />
      )}

      {editingTransaction && (
        <EditTransactionModal
          isOpen={Boolean(editingTransaction)}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={loadData}
        />
      )}
    </AppLayout>
  )
}
