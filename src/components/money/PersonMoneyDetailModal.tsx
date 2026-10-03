import { useState } from 'react'
import { format } from 'date-fns'
import type { Transaction } from '@/types'
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Pencil,
  Trash2,
  HandCoins,
  ArrowDownToDot,
  Scale,
  Wallet,
  Clock,
  Tag,
  Phone,
} from 'lucide-react'
import { cn } from '@/utils/cn'

export interface PersonMoneyGroup {
  key: string
  personName: string
  personId?: string | null
  phone?: string | null
  totalGave: number
  totalTook: number
  totalSettled: number
  netBalance: number // positive = they owe you; negative = you owe them; 0 = settled
  transactionCount: number
  transactions: Transaction[]
}

interface PersonMoneyDetailModalProps {
  isOpen: boolean
  personGroup: PersonMoneyGroup | null
  onClose: () => void
  onEditTransaction: (tx: Transaction) => void
  onDeleteTransaction: (txId: string) => Promise<void>
  onAddTransactionForPerson?: (type: 'given' | 'received' | 'settlement', personName: string, personId?: string | null) => void
  onSettleUp?: (personName: string, netAmount: number, personId?: string | null) => Promise<void>
}

export function PersonMoneyDetailModal({
  isOpen,
  personGroup,
  onClose,
  onEditTransaction,
  onDeleteTransaction,
  onAddTransactionForPerson,
  onSettleUp,
}: PersonMoneyDetailModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSettling, setIsSettling] = useState(false)

  if (!isOpen || !personGroup) return null

  const {
    personName,
    personId,
    phone,
    totalGave,
    totalTook,
    totalSettled,
    netBalance,
    transactions,
  } = personGroup

  const isTheyOweYou = netBalance > 0
  const isSettled = netBalance === 0

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction record?')) {
      setDeletingId(id)
      try {
        await onDeleteTransaction(id)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleSettleClick = async () => {
    if (!onSettleUp || netBalance === 0) return
    setIsSettling(true)
    try {
      await onSettleUp(personName, netBalance, personId)
    } finally {
      setIsSettling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200/80 dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header bar */}
        <div className="px-5 py-4 border-b border-surface-100 dark:border-white/[0.06] bg-surface-50/80 dark:bg-surface-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-surface-800 border border-surface-200/80 dark:border-white/[0.08] text-surface-700 dark:text-surface-200 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-surface-100 dark:hover:bg-surface-700/60 transition-all text-xs font-bold shadow-sm cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">👤</span>
                <h2 className="text-lg sm:text-xl font-black text-surface-900 dark:text-white capitalize">
                  {personName}
                </h2>
                {phone && (
                  <span className="text-[11px] text-surface-400 flex items-center gap-1 font-medium bg-surface-200/60 dark:bg-surface-800 px-2 py-0.5 rounded-full">
                    <Phone size={10} />
                    {phone}
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 font-medium">
                Money Relationship
              </p>
            </div>
          </div>

          {/* Quick Action Buttons for this person */}
          <div className="flex items-center gap-2 flex-wrap">
            {onAddTransactionForPerson && (
              <>
                <button
                  onClick={() => onAddTransactionForPerson('given', personName, personId)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                  title={`Lend money to ${personName}`}
                >
                  <HandCoins size={13} />
                  <span>+ Lent</span>
                </button>
                <button
                  onClick={() => onAddTransactionForPerson('received', personName, personId)}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                  title={`Borrow money from ${personName}`}
                >
                  <ArrowDownToDot size={13} />
                  <span>+ Borrowed</span>
                </button>
              </>
            )}

            {!isSettled && onSettleUp && (
              <button
                onClick={handleSettleClick}
                disabled={isSettling}
                className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title={`Record full settlement with ${personName}`}
              >
                <Scale size={13} />
                <span>{isSettling ? 'Settling...' : '⚖️ Settle Up'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* You Gave */}
            <div className="p-4 rounded-2xl border border-surface-200/80 dark:border-white/[0.08] bg-amber-50/60 dark:bg-amber-950/20">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                <span className="text-[11px] font-black uppercase tracking-wider">You Gave</span>
                <HandCoins size={16} />
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
                ₹{totalGave.toLocaleString()}
              </p>
              <p className="text-[10px] text-surface-500 dark:text-surface-400 mt-0.5">
                Total lent / given
              </p>
            </div>

            {/* You Took */}
            <div className="p-4 rounded-2xl border border-surface-200/80 dark:border-white/[0.08] bg-emerald-50/60 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                <span className="text-[11px] font-black uppercase tracking-wider">You Took</span>
                <ArrowDownToDot size={16} />
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                ₹{totalTook.toLocaleString()}
              </p>
              <p className="text-[10px] text-surface-500 dark:text-surface-400 mt-0.5">
                Total taken / received
              </p>
            </div>

            {/* Settled / Returned */}
            <div className="p-4 rounded-2xl border border-surface-200/80 dark:border-white/[0.08] bg-purple-50/60 dark:bg-purple-950/20">
              <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
                <span className="text-[11px] font-black uppercase tracking-wider">Settled / Returned</span>
                <Scale size={16} />
              </div>
              <p className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
                ₹{totalSettled.toLocaleString()}
              </p>
              <p className="text-[10px] text-surface-500 dark:text-surface-400 mt-0.5">
                Debt settled / repaid
              </p>
            </div>

            {/* Current Balance */}
            <div
              className={cn(
                'p-4 rounded-2xl border',
                isSettled
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : isTheyOweYou
                  ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30'
                  : 'border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-between',
                  isSettled
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : isTheyOweYou
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-blue-700 dark:text-blue-400'
                )}
              >
                <span className="text-[11px] font-black uppercase tracking-wider">Current Balance</span>
                <Wallet size={16} />
              </div>
              <p
                className={cn(
                  'text-xl sm:text-2xl font-black mt-2',
                  isSettled
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isTheyOweYou
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-blue-600 dark:text-blue-400'
                )}
              >
                ₹{Math.abs(netBalance).toLocaleString()}
              </p>
              <p className="text-[10px] font-bold mt-0.5">
                {isSettled ? (
                  <span className="text-emerald-600 dark:text-emerald-400">🟢 Settled</span>
                ) : isTheyOweYou ? (
                  <span className="text-amber-600 dark:text-amber-400">🟠 They owe you</span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400">🔵 You owe them</span>
                )}
              </p>
            </div>
          </div>

          {/* Transaction History Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-100 dark:border-white/[0.06]">
              <h3 className="font-extrabold text-sm sm:text-base text-surface-900 dark:text-white flex items-center gap-2">
                <span>Transaction History</span>
              </h3>
              <span className="text-xs font-bold text-surface-400 bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded-full">
                {transactions.length} records
              </span>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/20 text-xs text-surface-400">
                No transaction records found for this person.
              </div>
            ) : (
              <div className="space-y-2.5">
                {transactions.map((tx) => {
                  const isSettlement = tx.category === 'Settlement' || tx.type === 'settlement'
                  const isGiven = tx.type === 'given'
                  const isReceived = tx.type === 'received'
                  const isExpense = tx.type === 'expense'

                  // Format title
                  let displayTitle = ''
                  if (isSettlement) {
                    displayTitle = tx.description || `Debt Settled with ${personName}`
                  } else if (isGiven) {
                    displayTitle = tx.description || `Lent to ${personName}`
                  } else if (isReceived) {
                    displayTitle = tx.description || `Borrowed from ${personName}`
                  } else {
                    displayTitle = tx.description || tx.category || 'Transaction'
                  }

                  // Determine display date
                  let dateDisplay = tx.transaction_date || 'N/A'
                  try {
                    if (tx.transaction_date) {
                      dateDisplay = format(new Date(tx.transaction_date), 'dd MMM yyyy')
                    }
                  } catch {
                    dateDisplay = tx.transaction_date
                  }

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-surface-50/70 dark:bg-surface-800/40 border border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300 dark:hover:border-white/[0.12] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        {/* Transaction Icon */}
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-2xl font-black text-xs shrink-0 shadow-sm mt-0.5 sm:mt-0',
                            isSettlement
                              ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/70 dark:text-purple-300'
                              : isGiven
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/70 dark:text-amber-300'
                              : isReceived
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-300'
                          )}
                        >
                          {isSettlement ? (
                            <Scale size={18} />
                          ) : isGiven ? (
                            <HandCoins size={18} />
                          ) : isReceived ? (
                            <ArrowDownToDot size={18} />
                          ) : (
                            <Tag size={18} />
                          )}
                        </div>

                        {/* Title, Date, Badges */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-sm text-surface-900 dark:text-white truncate">
                              {displayTitle}
                            </h4>
                            {tx.purpose && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary-100 text-primary-700 dark:bg-primary-950/80 dark:text-primary-300">
                                {tx.purpose}
                              </span>
                            )}
                            {isSettlement && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300">
                                ⚖️ Settlement
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500 dark:text-surface-400 mt-1">
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar size={12} />
                              {dateDisplay}
                            </span>

                            <span className="flex items-center gap-1 uppercase font-bold text-[10px] bg-surface-200/80 dark:bg-surface-700 px-1.5 py-0.5 rounded">
                              <CreditCard size={11} />
                              {tx.payment_method}
                            </span>

                            {tx.category && tx.category !== 'Settlement' && tx.category !== 'Lent / Loan' && tx.category !== 'Borrowed / Loan' && (
                              <span className="flex items-center gap-1 text-[11px] text-surface-600 dark:text-surface-300 font-medium">
                                <Tag size={11} />
                                {tx.category}
                              </span>
                            )}

                            {tx.expected_return_date && (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px] flex items-center gap-1">
                                <Clock size={11} />
                                Due: {tx.expected_return_date}
                              </span>
                            )}
                          </div>

                          {tx.description && tx.description !== displayTitle && (
                            <p className="text-xs text-surface-400 mt-1 italic line-clamp-1">
                              "{tx.description}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right side: Amount and Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-surface-100 dark:border-white/[0.04]">
                        <div className="text-left sm:text-right">
                          <p
                            className={cn(
                              'font-black text-lg sm:text-xl leading-tight',
                              isGiven || isExpense
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            )}
                          >
                            {isGiven || isExpense ? '-' : '+'}₹{Number(tx.amount).toLocaleString()}
                          </p>
                          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider block">
                            {isSettlement
                              ? 'Debt Settled'
                              : isGiven
                              ? 'You Lent'
                              : isReceived
                              ? 'You Borrowed'
                              : 'Expense'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onEditTransaction(tx)}
                            className="p-2 rounded-xl text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Edit entry"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={deletingId === tx.id}
                            className="p-2 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                            title="Delete entry"
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

          {/* Money Summary Footer Section */}
          <div className="rounded-2xl p-4 sm:p-5 bg-surface-50 dark:bg-surface-800/60 border border-surface-200/80 dark:border-white/[0.08] space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
              <span>📊 Money Summary</span>
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-surface-600 dark:text-surface-300">
                <span>You gave to them:</span>
                <span className="font-bold text-surface-900 dark:text-white">
                  ₹{totalGave.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-surface-600 dark:text-surface-300">
                <span>You took from them:</span>
                <span className="font-bold text-surface-900 dark:text-white">
                  ₹{totalTook.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-surface-600 dark:text-surface-300">
                <span>Money returned/settled:</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">
                  ₹{totalSettled.toLocaleString()}
                </span>
              </div>

              <div className="pt-2 border-t border-surface-200 dark:border-surface-700/80 flex items-center justify-between font-extrabold text-sm text-surface-900 dark:text-white">
                <span>Current outstanding balance:</span>
                <span
                  className={cn(
                    isSettled
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isTheyOweYou
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-blue-600 dark:text-blue-400'
                  )}
                >
                  ₹{Math.abs(netBalance).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-surface-500">Status:</span>
                <div>
                  {isSettled ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      🟢 Settled
                    </span>
                  ) : isTheyOweYou ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      🟠 They owe you ₹{netBalance.toLocaleString()}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                      🔵 You owe them ₹{Math.abs(netBalance).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
