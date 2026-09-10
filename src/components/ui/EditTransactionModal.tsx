import { useState, useEffect } from 'react'
import type { Transaction, TransactionType, PaymentMethod } from '@/types'
import { transactionService } from '@/services/dbServices'
import { X, Save, DollarSign, Calendar, Tag, CreditCard, User, AlignLeft } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

interface EditTransactionModalProps {
  transaction: Transaction | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditTransactionModal({ transaction, isOpen, onClose, onSuccess }: EditTransactionModalProps) {
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi')
  const [personName, setPersonName] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense')
      setAmount(transaction.amount ? String(transaction.amount) : '')
      setCategory(transaction.category || 'Other')
      setDescription(transaction.description || '')
      setPaymentMethod(transaction.payment_method || 'upi')
      setPersonName(transaction.person_name || '')
      setTransactionDate(transaction.transaction_date || '')
    }
  }, [transaction])

  if (!isOpen || !transaction) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast.error('Please enter a valid positive amount')
      return
    }

    setLoading(true)
    try {
      await transactionService.updateTransaction(transaction.id, {
        type,
        amount: numAmount,
        category: category || (type === 'expense' ? 'Other' : 'N/A'),
        description: description.trim() || null,
        payment_method: paymentMethod,
        person_name: personName.trim() || null,
        transaction_date: transactionDate || undefined,
      })
      showToast.success('Transaction updated! 💳')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      showToast.error('Failed to update transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="text-emerald-600" size={20} />
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">Edit Transaction</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="expense">🔴 Expense</option>
                <option value="income">🟢 Income</option>
                <option value="given">🤝 Money Given (Lent)</option>
                <option value="received">💰 Money Received</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300">Amount (₹) *</label>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 250"
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <Tag size={13} /> Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Food, Canteen, Rent"
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <CreditCard size={13} /> Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="upi">📲 UPI</option>
                <option value="cash">💵 Cash</option>
                <option value="card">💳 Card</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
              </select>
            </div>
          </div>

          {(type === 'given' || type === 'received') && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <User size={13} /> Person Name
              </label>
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="e.g. Rahul, Ravi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
              <Calendar size={13} /> Date
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
              <AlignLeft size={13} /> Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner with friends, Books purchase"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-xs font-bold text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Save size={16} />
              <span>{loading ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
