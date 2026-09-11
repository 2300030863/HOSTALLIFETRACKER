import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'
import { EditTransactionModal } from '@/components/ui/EditTransactionModal'

type MoneyFilter = 'all' | 'expense' | 'given' | 'received'

export default function MoneyPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<MoneyFilter>('all')
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [modalMoneyType, setModalMoneyType] = useState<'expense' | 'given' | 'received'>('expense')
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

  const handleOpenAddModal = (type: 'expense' | 'given' | 'received') => {
    setModalMoneyType(type)
    setIsQuickAddOpen(true)
  }

  // Totals calculations
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const totalGiven = transactions
    .filter((t) => t.type === 'given')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const totalReceived = transactions
    .filter((t) => t.type === 'received')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  // Filtered transactions
  const filteredTransactions = transactions.filter((t) => {
    if (activeFilter === 'all') return true
    return t.type === activeFilter
  })

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Money Tracker</span>
              <span>💰</span>
            </h1>
            <p className="text-xs text-surface-500">Expenses, money given/lent & received/borrowed</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenAddModal('expense')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all"
            >
              <Plus size={15} />
              <span>💸 Add Expense</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('given')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all"
            >
              <Plus size={15} />
              <span>🤝 Money Given</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('received')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
            >
              <Plus size={15} />
              <span>💰 Money Received</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div
            onClick={() => setActiveFilter('expense')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              activeFilter === 'expense'
                ? 'bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800'
            )}
          >
            <p className="text-xs font-medium text-surface-500">Total Spent 💸</p>
            <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              ₹{totalExpenses}
            </p>
          </div>

          <div
            onClick={() => setActiveFilter('given')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              activeFilter === 'given'
                ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800'
                : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800'
            )}
          >
            <p className="text-xs font-medium text-surface-500">Money Given 🤝</p>
            <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              ₹{totalGiven}
            </p>
          </div>

          <div
            onClick={() => setActiveFilter('received')}
            className={cn(
              'p-4 rounded-2xl border transition-all cursor-pointer',
              activeFilter === 'received'
                ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
                : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800'
            )}
          >
            <p className="text-xs font-medium text-surface-500">Money Received 💰</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{totalReceived}
            </p>
          </div>
        </div>

        {/* 3 Main Form Type Navigation Tabs */}
        <div className="grid grid-cols-4 rounded-2xl p-1.5 bg-surface-100 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700/60">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'expense', label: '💸 Expense' },
            { id: 'given', label: '🤝 Money Given' },
            { id: 'received', label: '💰 Money Received' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as MoneyFilter)}
              className={cn(
                'py-2 px-2 text-xs font-bold rounded-xl transition-all text-center truncate',
                activeFilter === tab.id
                  ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions List */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-surface-900 dark:text-white capitalize">
              {activeFilter === 'all'
                ? 'All Financial Records'
                : activeFilter === 'expense'
                ? '💸 Expense Log'
                : activeFilter === 'given'
                ? '🤝 Money Given / Lent Log'
                : '💰 Money Received / Borrowed Log'}
            </h3>
            <span className="text-xs font-semibold text-surface-400">
              {filteredTransactions.length} item(s)
            </span>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-surface-400 text-xs border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl">
              No {activeFilter === 'all' ? '' : activeFilter} transactions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 rounded-2xl bg-surface-50/60 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl font-bold text-xs shrink-0',
                          tx.type === 'expense'
                            ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                            : tx.type === 'given'
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                        )}
                      >
                        {tx.type === 'expense' ? (
                          <ArrowUpRight size={18} />
                        ) : (
                          <ArrowDownLeft size={18} />
                        )}
                      </div>

                      <div>
                        {/* Title & Person */}
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-surface-900 dark:text-white">
                            {tx.type === 'expense'
                              ? tx.description || tx.category
                              : `${tx.type === 'given' ? 'Given to' : 'Received from'} ${
                                  tx.person_name || 'Person'
                                }`}
                          </h4>
                          {tx.purpose && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
                              {tx.purpose}
                            </span>
                          )}
                        </div>

                        {/* Subtitle fields */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {tx.transaction_date}
                          </span>

                          {tx.type === 'expense' && (
                            <span className="flex items-center gap-1 font-semibold text-surface-600 dark:text-surface-300">
                              <Tag size={12} />
                              {tx.category}
                            </span>
                          )}

                          <span className="flex items-center gap-1 uppercase">
                            <CreditCard size={12} />
                            {tx.payment_method}
                          </span>

                          {tx.expected_return_date && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Expected: {tx.expected_return_date}
                            </span>
                          )}
                        </div>

                        {tx.description && tx.type !== 'expense' && (
                          <p className="text-xs text-surface-400 mt-1 italic">
                            "{tx.description}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p
                          className={cn(
                            'font-black text-lg leading-tight',
                            tx.type === 'expense' || tx.type === 'given'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {tx.type === 'expense' || tx.type === 'given' ? '-' : '+'}₹{tx.amount}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingTransaction(tx)}
                          className="p-1.5 rounded-xl text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                          title="Edit transaction"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
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
