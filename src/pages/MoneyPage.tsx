import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { transactionService, subscribeToRealtime } from '@/services/dbServices'
import type { Transaction } from '@/types'
import {
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  Pencil,
  PieChart,
  Search,
  TrendingDown,
  HandCoins,
  ArrowDownToDot,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'
import { EditTransactionModal } from '@/components/ui/EditTransactionModal'

type MoneyFilter = 'all' | 'expense' | 'given' | 'received'

export default function MoneyPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<MoneyFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [modalMoneyType, setModalMoneyType] = useState<'expense' | 'given' | 'received' | 'settlement'>('expense')
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await transactionService.getAllTransactions()
      setTransactions(data)
    } catch (err) {
      console.error(err)
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
  }, [])

  const handleDelete = async (id: string) => {
    await transactionService.deleteTransaction(id)
    setTransactions((prev) => prev.filter((t) => t.id !== id))
    showToast.success('Transaction removed')
  }

  const handleOpenAddModal = (type: 'expense' | 'given' | 'received' | 'settlement' = 'expense') => {
    setModalMoneyType(type)
    setIsQuickAddOpen(true)
  }

  // Totals calculations
  const totalExpenses = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount), 0)
  }, [transactions])

  const totalGiven = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'given')
      .reduce((acc, t) => acc + Number(t.amount), 0)
  }, [transactions])

  const totalReceived = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'received')
      .reduce((acc, t) => acc + Number(t.amount), 0)
  }, [transactions])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesFilter = activeFilter === 'all' || t.type === activeFilter
      if (!matchesFilter) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.category && t.category.toLowerCase().includes(q)) ||
        (t.person_name && t.person_name.toLowerCase().includes(q)) ||
        (t.purpose && t.purpose.toLowerCase().includes(q)) ||
        String(t.amount).includes(q)
      )
    })
  }, [transactions, activeFilter, searchQuery])

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-surface-900 dark:text-white flex items-center gap-2.5">
              <span>Money Tracker</span>
              <span className="text-2xl">💰</span>
            </h1>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
              Track daily expenses, loans given to friends &amp; money borrowed/taken.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleOpenAddModal('expense')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-black shadow-md shadow-primary-600/25 transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>+ Add Transaction</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('given')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/25 transition-all cursor-pointer"
            >
              <span>🤝 Lent Money</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('received')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <span>📥 Borrowed Money</span>
            </button>
            <Link
              to="/money-summary"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 text-xs font-bold transition-all border border-surface-200 dark:border-white/[0.08]"
            >
              <PieChart size={15} />
              <span>📊 Summary</span>
            </Link>
          </div>
        </div>

        {/* 3 High-Impact KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Total Spent */}
          <div
            onClick={() => setActiveFilter(activeFilter === 'expense' ? 'all' : 'expense')}
            className={cn(
              'p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden',
              activeFilter === 'expense'
                ? 'bg-rose-50/90 border-rose-400 dark:bg-rose-950/40 dark:border-rose-700 shadow-md ring-2 ring-rose-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.08] hover:border-rose-300 dark:hover:border-rose-800'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown size={14} />
                <span>Expenses Spent</span>
              </span>
              <span className="text-lg">💸</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-2">
              ₹{totalExpenses.toLocaleString()}
            </p>
            <p className="text-[11px] text-surface-400 mt-1">Direct hostel & personal spending</p>
          </div>

          {/* Money Lent (They Owe You) */}
          <div
            onClick={() => setActiveFilter(activeFilter === 'given' ? 'all' : 'given')}
            className={cn(
              'p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden',
              activeFilter === 'given'
                ? 'bg-amber-50/90 border-amber-400 dark:bg-amber-950/40 dark:border-amber-700 shadow-md ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.08] hover:border-amber-300 dark:hover:border-amber-800'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <HandCoins size={14} />
                <span>Lent (They Owe You)</span>
              </span>
              <span className="text-lg">🤝</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
              ₹{totalGiven.toLocaleString()}
            </p>
            <p className="text-[11px] text-surface-400 mt-1">Lent to friends / to collect back</p>
          </div>

          {/* Money Borrowed (You Owe) */}
          <div
            onClick={() => setActiveFilter(activeFilter === 'received' ? 'all' : 'received')}
            className={cn(
              'p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden',
              activeFilter === 'received'
                ? 'bg-emerald-50/90 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.08] hover:border-emerald-300 dark:hover:border-emerald-800'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowDownToDot size={14} />
                <span>Borrowed (You Owe)</span>
              </span>
              <span className="text-lg">📥</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              ₹{totalReceived.toLocaleString()}
            </p>
            <p className="text-[11px] text-surface-400 mt-1">Borrowed from friends / to return</p>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Segmented Filter Pills */}
          <div className="grid grid-cols-4 p-1 rounded-2xl bg-surface-100 dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08]">
            {[
              { id: 'all', label: 'All' },
              { id: 'expense', label: '💸 Spent' },
              { id: 'given', label: '🤝 Lent (They Owe)' },
              { id: 'received', label: '📥 Borrowed (You Owe)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as MoneyFilter)}
                className={cn(
                  'py-2 px-2 text-xs font-bold rounded-xl transition-all text-center truncate cursor-pointer',
                  activeFilter === tab.id
                    ? 'bg-white dark:bg-surface-800 text-primary-600 dark:text-primary-300 shadow-sm font-extrabold'
                    : 'text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search by note, person, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {/* Transactions List */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100 dark:border-white/[0.06]">
            <h3 className="font-extrabold text-base text-surface-900 dark:text-white capitalize flex items-center gap-2">
              <span>
                {activeFilter === 'all'
                  ? 'All Transactions'
                  : activeFilter === 'expense'
                  ? '💸 Expense Log'
                  : activeFilter === 'given'
                  ? '🤝 Money Given Log'
                  : '💰 Money Taken Log'}
              </span>
            </h3>
            <span className="text-xs font-bold text-surface-400 bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded-full">
              {filteredTransactions.length} records
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-surface-400 text-xs">
              Loading financial records...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/20">
              <span className="text-3xl block mb-2">📋</span>
              <p className="text-xs text-surface-500 font-medium">
                No {activeFilter === 'all' ? '' : activeFilter} transactions found.
              </p>
              <button
                onClick={() => handleOpenAddModal(activeFilter === 'all' ? 'expense' : activeFilter)}
                className="mt-3 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/25 transition-all cursor-pointer"
              >
                + Add New Entry
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-surface-50/70 dark:bg-surface-800/40 border border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300 dark:hover:border-white/[0.12] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-2xl font-black text-xs shrink-0 shadow-sm',
                        tx.type === 'expense'
                          ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300'
                          : tx.type === 'given'
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300'
                      )}
                    >
                      {tx.type === 'expense' ? (
                        <ArrowUpRight size={20} />
                      ) : (
                        <ArrowDownLeft size={20} />
                      )}
                    </div>

                    <div className="min-w-0">
                      {/* Title & Person */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-sm text-surface-900 dark:text-white truncate">
                          {tx.type === 'expense'
                            ? tx.description || tx.category
                            : tx.category === 'Settlement'
                            ? `Debt Settled with ${tx.person_name || 'Friend'}`
                            : tx.type === 'given'
                            ? `Lent to ${tx.person_name || 'Friend'}`
                            : `Borrowed from ${tx.person_name || 'Friend'}`}
                        </h4>
                        {tx.purpose && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-950/80 dark:text-primary-300">
                            {tx.purpose}
                          </span>
                        )}
                      </div>

                      {/* Subtitle fields */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={12} />
                          {tx.transaction_date}
                        </span>

                        {tx.type === 'expense' && (
                          <span className="flex items-center gap-1 font-semibold text-surface-700 dark:text-surface-300">
                            <Tag size={12} />
                            {tx.category}
                          </span>
                        )}

                        <span className="flex items-center gap-1 uppercase font-bold text-[10px] bg-surface-200/80 dark:bg-surface-700 px-1.5 py-0.5 rounded">
                          <CreditCard size={11} />
                          {tx.payment_method}
                        </span>

                        {tx.expected_return_date && (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
                            Due: {tx.expected_return_date}
                          </span>
                        )}
                      </div>

                      {tx.description && tx.type !== 'expense' && (
                        <p className="text-xs text-surface-400 mt-1 italic line-clamp-1">
                          "{tx.description}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-surface-100 dark:border-white/[0.04]">
                    <div className="text-left sm:text-right">
                      <p
                        className={cn(
                          'font-black text-lg sm:text-xl leading-tight',
                          tx.type === 'expense' || tx.type === 'given'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {tx.type === 'expense' || tx.type === 'given' ? '-' : '+'}₹{Number(tx.amount).toLocaleString()}
                      </p>
                      <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">
                        {tx.type === 'expense'
                          ? 'Spent Expense'
                          : tx.category === 'Settlement'
                          ? 'Debt Settled'
                          : tx.type === 'given'
                          ? 'Lent (Owes you)'
                          : 'Borrowed (You owe)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingTransaction(tx)}
                        className="p-2 rounded-xl text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Edit entry"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="p-2 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab="money"
        initialMoneyType={modalMoneyType}
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={loadData}
      />

      <EditTransactionModal
        transaction={editingTransaction}
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        onSuccess={loadData}
      />
    </AppLayout>
  )
}
