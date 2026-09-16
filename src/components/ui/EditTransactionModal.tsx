import { useState, useEffect } from 'react'
import type { Transaction, TransactionType, PaymentMethod, Person } from '@/types'
import { transactionService, peopleService } from '@/services/dbServices'
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
  const [personId, setPersonId] = useState<string>('')
  const [personName, setPersonName] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (transaction && isOpen) {
      setType(transaction.type || 'expense')
      setAmount(transaction.amount ? String(transaction.amount) : '')
      setCategory(transaction.category || 'Other')
      setDescription(transaction.description || '')
      setPaymentMethod(transaction.payment_method || 'upi')
      setPersonId(transaction.person_id || '')
      setPersonName(transaction.person_name || '')
      setTransactionDate(transaction.transaction_date || '')

      const loadPeopleAndTxs = async () => {
        try {
          const [peopleData, txData] = await Promise.all([
            peopleService.getPeople(),
            transactionService.getAllTransactions(),
          ])
          setPeople(peopleData)
          setAllTransactions(txData)

          // Match person_id if not present
          if (!transaction.person_id && transaction.person_name) {
            const matched = peopleData.find(
              (p) => p.name.toLowerCase().trim() === transaction.person_name?.toLowerCase().trim()
            )
            if (matched) setPersonId(matched.id)
          }
        } catch (e) {
          console.error('Failed loading people in EditTransactionModal', e)
        }
      }
      loadPeopleAndTxs()
    }
  }, [transaction, isOpen])

  if (!isOpen || !transaction) return null

  // Aggregate all unique person names from People table AND Money Given/Taken transactions
  const personOptionsMap = new Map<string, { id?: string; name: string; phone?: string | null }>()

  for (const p of people) {
    const key = p.name.trim().toLowerCase()
    if (key) {
      personOptionsMap.set(key, { id: p.id, name: p.name.trim(), phone: p.phone })
    }
  }

  for (const t of allTransactions) {
    if (t.person_name && t.person_name.trim()) {
      const key = t.person_name.trim().toLowerCase()
      if (!personOptionsMap.has(key)) {
        personOptionsMap.set(key, { id: t.person_id || undefined, name: t.person_name.trim() })
      } else if (t.person_id && !personOptionsMap.get(key)!.id) {
        personOptionsMap.get(key)!.id = t.person_id
      }
    }
  }

  const allPersonOptions = Array.from(personOptionsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  )

  // Calculate person balance for live preview
  const selectedPerson = people.find(
    (p) => p.id === personId || p.name.toLowerCase().trim() === personName.toLowerCase().trim()
  )
  const targetPersonName = (selectedPerson ? selectedPerson.name : personName).toLowerCase().trim()

  const personTransactions = allTransactions.filter((t) => {
    if (t.id === transaction.id) return false // exclude current tx being edited
    if (personId && t.person_id === personId) return true
    if (targetPersonName && t.person_name && t.person_name.toLowerCase().trim() === targetPersonName) return true
    return false
  })

  const originalAmountTaken = personTransactions
    .filter((t) => t.type === 'given')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const alreadyReceived = personTransactions
    .filter((t) => t.type === 'received')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const currentBalanceBefore = originalAmountTaken - alreadyReceived
  const amountBeingReceivedNum = parseFloat(amount) || 0
  const remainingAmount = currentBalanceBefore - amountBeingReceivedNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast.error('Please enter a valid positive amount')
      return
    }

    setLoading(true)
    try {
      let finalId = personId || undefined
      let finalName = personName.trim()

      if (type === 'given' || type === 'received') {
        const existingPerson = people.find(
          (p) =>
            (finalId && p.id === finalId) ||
            p.name.toLowerCase().trim() === finalName.toLowerCase()
        )

        if (existingPerson) {
          finalId = existingPerson.id
          finalName = existingPerson.name
        } else if (finalName) {
          try {
            const created = await peopleService.createPerson(finalName)
            finalId = created.id
            finalName = created.name
          } catch (err) {
            console.warn('Auto-create person exception', err)
          }
        }
      }

      await transactionService.updateTransaction(transaction.id, {
        type,
        amount: numAmount,
        category: category || (type === 'expense' ? 'Other' : 'N/A'),
        description: description.trim() || null,
        payment_method: paymentMethod,
        person_id: (type === 'given' || type === 'received') ? (finalId || null) : null,
        person_name: (type === 'given' || type === 'received') ? (finalName || null) : null,
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
      <div className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
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
                <option value="bank">🏦 Bank Transfer</option>
              </select>
            </div>
          </div>

          {(type === 'given' || type === 'received') && (
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <User size={13} /> Person Name *
              </label>
              <select
                value={personId || personName}
                onChange={(e) => {
                  const val = e.target.value
                  const opt = allPersonOptions.find((x) => x.id === val || x.name === val)
                  if (opt) {
                    if (opt.id) setPersonId(opt.id)
                    else setPersonId('')
                    setPersonName(opt.name)
                  } else {
                    setPersonId(val)
                    setPersonName(val)
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">[ Select Person ▼ ]</option>
                {allPersonOptions.map((opt) => (
                  <option key={opt.id || opt.name} value={opt.id || opt.name}>
                    👤 {opt.name} {opt.phone ? `(${opt.phone})` : ''}
                  </option>
                ))}
              </select>
              {!personId && (
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Or type person name..."
                  className="w-full mt-1 px-3.5 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs"
                />
              )}

              {/* Balance Summary for Edit Modal */}
              {type === 'received' && (personId || personName) && (
                <div className="rounded-2xl p-3 bg-surface-50 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 space-y-1.5 text-xs mt-2">
                  <div className="flex justify-between text-surface-600 dark:text-surface-300">
                    <span>Original Taken:</span>
                    <span className="font-semibold text-surface-900 dark:text-white">₹{originalAmountTaken.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-surface-600 dark:text-surface-300">
                    <span>Received Earlier:</span>
                    <span className="font-semibold text-surface-900 dark:text-white">₹{alreadyReceived.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-surface-900 dark:text-white pt-1 border-t border-surface-200 dark:border-surface-700">
                    <span>Remaining Balance:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ₹{Math.max(0, remainingAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
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
