import { useState, useEffect, type FormEvent } from 'react'
import {
  X,
  Plus,
  Wallet,
  Calendar,
  CheckSquare,
  Bell,
  Target,
  FileText,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  transactionService,
  attendanceService,
  activityService,
  reminderService,
  goalService,
  noteService,
  peopleService,
} from '@/services/dbServices'
import { showToast } from './Toast'
import { EXPENSE_CATEGORIES } from '@/types'
import type { Person, Transaction } from '@/types'

type QuickAddTab = 'money' | 'attendance' | 'activity' | 'reminder' | 'goal' | 'note'

interface QuickAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialTab?: QuickAddTab
  initialMoneyType?: 'expense' | 'given' | 'received'
  initialPersonId?: string
  initialPersonName?: string
}

export function QuickAddModal({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'money',
  initialMoneyType = 'expense',
  initialPersonId,
  initialPersonName,
}: QuickAddModalProps) {
  const [activeTab, setActiveTab] = useState<QuickAddTab>(initialTab)
  const [loading, setLoading] = useState(false)

  // Money shared state
  const [moneyType, setMoneyType] = useState<'expense' | 'given' | 'received'>(initialMoneyType)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>('Food')
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'cash' | 'card'>('upi')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  // Money Given / Received specific fields & People integration
  const [people, setPeople] = useState<Person[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string>(initialPersonId || '')
  const [personName, setPersonName] = useState(initialPersonName || '')
  const [isAddingNewPerson, setIsAddingNewPerson] = useState<boolean>(false)
  const [newPersonName, setNewPersonName] = useState<string>('')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')
  const [purpose, setPurpose] = useState('')

  // Attendance state
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'late' | 'absent'>('present')

  // Activity state
  const [activityTitle, setActivityTitle] = useState('')
  const [activityCategory, setActivityCategory] = useState<
    'college' | 'study' | 'exercise' | 'food' | 'personal'
  >('college')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  // Reminder state
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderTime, setReminderTime] = useState('21:00')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [repeatType, setRepeatType] = useState<'once' | 'daily' | 'weekly'>('once')

  // Goal state
  const [goalTitle, setGoalTitle] = useState('')
  const [goalTarget, setGoalTarget] = useState('100')
  const [goalCurrent, setGoalCurrent] = useState('0')

  // Note state
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')

  // Load People and Transactions when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadPeopleAndTxs = async () => {
        try {
          const [peopleData, txData] = await Promise.all([
            peopleService.getPeople(),
            transactionService.getAllTransactions(),
          ])
          setPeople(peopleData)
          setTransactions(txData)

          if (initialPersonId) {
            setSelectedPersonId(initialPersonId)
            const matched = peopleData.find((p) => p.id === initialPersonId)
            if (matched) setPersonName(matched.name)
          } else if (initialPersonName) {
            const matched = peopleData.find(
              (p) => p.name.toLowerCase().trim() === initialPersonName.toLowerCase().trim()
            )
            if (matched) {
              setSelectedPersonId(matched.id)
              setPersonName(matched.name)
            } else {
              setPersonName(initialPersonName)
            }
          }
        } catch (err) {
          console.error('Failed to load people/transactions for QuickAddModal', err)
        }
      }
      loadPeopleAndTxs()
    }
  }, [isOpen, initialPersonId, initialPersonName])

  // Aggregate all unique person names from People table AND Money Given/Taken transactions
  const personOptionsMap = new Map<string, { id?: string; name: string; phone?: string | null }>()

  for (const p of people) {
    const key = p.name.trim().toLowerCase()
    if (key) {
      personOptionsMap.set(key, { id: p.id, name: p.name.trim(), phone: p.phone })
    }
  }

  for (const t of transactions) {
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

  // Derive selected person details and calculate live balance metrics
  const selectedPerson = people.find(
    (p) => p.id === selectedPersonId || p.name.toLowerCase().trim() === personName.toLowerCase().trim()
  )
  const targetPersonName = (selectedPerson ? selectedPerson.name : personName).toLowerCase().trim()

  const personTransactions = transactions.filter((t) => {
    if (selectedPersonId && t.person_id === selectedPersonId) return true
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

  const handlePersonSelectChange = (val: string) => {
    if (val === '__new__') {
      setSelectedPersonId('')
      setPersonName('')
      setIsAddingNewPerson(true)
    } else if (val === '') {
      setSelectedPersonId('')
      setPersonName('')
      setIsAddingNewPerson(false)
    } else {
      const opt = allPersonOptions.find((o) => o.id === val || o.name === val)
      if (opt) {
        if (opt.id) {
          setSelectedPersonId(opt.id)
        } else {
          const matched = people.find((p) => p.name.toLowerCase().trim() === opt.name.toLowerCase())
          if (matched) setSelectedPersonId(matched.id)
          else setSelectedPersonId('')
        }
        setPersonName(opt.name)
      } else {
        setSelectedPersonId(val)
        setPersonName(val)
      }
      setIsAddingNewPerson(false)
    }
  }

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (activeTab === 'money') {
        if (!amount || parseFloat(amount) <= 0) {
          showToast.error('Please enter a valid amount')
          setLoading(false)
          return
        }

        let finalPersonId: string | undefined = selectedPersonId || undefined
        let finalPersonName: string = personName.trim()

        if (moneyType === 'given' || moneyType === 'received') {
          if (isAddingNewPerson) {
            if (!newPersonName.trim()) {
              showToast.error('Please enter person name')
              setLoading(false)
              return
            }
            finalPersonName = newPersonName.trim()
          } else if (!finalPersonName) {
            showToast.error('Please select a person')
            setLoading(false)
            return
          }

          // Look up existing person in people table to reuse person_id and prevent duplicates
          const existingPerson = people.find(
            (p) =>
              (finalPersonId && p.id === finalPersonId) ||
              p.name.toLowerCase().trim() === finalPersonName.toLowerCase()
          )

          if (existingPerson) {
            finalPersonId = existingPerson.id
            finalPersonName = existingPerson.name
          } else {
            // Auto-create person in People table so they are permanently saved & linked
            try {
              const created = await peopleService.createPerson(finalPersonName)
              finalPersonId = created.id
              finalPersonName = created.name
            } catch (err) {
              console.warn('Auto-create person exception', err)
            }
          }
        }

        await transactionService.createTransaction({
          type: moneyType,
          amount: parseFloat(amount),
          category: moneyType === 'expense' ? category : 'N/A',
          description: description.trim() || undefined,
          payment_method: paymentMethod,
          person_id: moneyType !== 'expense' ? finalPersonId : undefined,
          person_name: moneyType !== 'expense' ? finalPersonName : undefined,
          expected_return_date: moneyType !== 'expense' ? expectedReturnDate : undefined,
          purpose: moneyType !== 'expense' ? purpose : undefined,
          transaction_date: date,
        })

        const successMsg =
          moneyType === 'expense'
            ? 'Expense saved! 💸'
            : moneyType === 'given'
            ? 'Money Given recorded! 🤝'
            : 'Money Received recorded! 💰'
        showToast.success(successMsg)
      } else if (activeTab === 'attendance') {
        await attendanceService.markAttendance(attendanceStatus)
        showToast.success(`Attendance marked as ${attendanceStatus.toUpperCase()} 🖐️`)
      } else if (activeTab === 'activity') {
        if (!activityTitle.trim()) {
          showToast.error('Please enter activity title')
          setLoading(false)
          return
        }
        await activityService.createActivity({
          title: activityTitle,
          category: activityCategory,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
        })
        showToast.success('Activity created! 📝')
      } else if (activeTab === 'reminder') {
        if (!reminderTitle.trim()) {
          showToast.error('Please enter reminder title')
          setLoading(false)
          return
        }
        await reminderService.createReminder({
          title: reminderTitle,
          reminder_time: reminderTime,
          priority,
          repeat_type: repeatType,
        })
        showToast.success('Reminder scheduled! 🔔')
      } else if (activeTab === 'goal') {
        if (!goalTitle.trim()) {
          showToast.error('Please enter goal title')
          setLoading(false)
          return
        }
        await goalService.createGoal({
          title: goalTitle,
          target: parseFloat(goalTarget) || 100,
          current_value: parseFloat(goalCurrent) || 0,
          priority,
        })
        showToast.success('Goal created! 🎯')
      } else if (activeTab === 'note') {
        if (!noteTitle.trim()) {
          showToast.error('Please enter note title')
          setLoading(false)
          return
        }
        await noteService.createNote(noteTitle, noteContent)
        showToast.success('Note saved! 📔')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      showToast.error(err.message || 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface-950/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100 dark:border-surface-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400">
              <Sparkles size={18} />
            </div>
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">Quick Add</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-2 overflow-x-auto border-b border-surface-100 dark:border-surface-800 no-scrollbar bg-surface-50/50 dark:bg-surface-950/30">
          {[
            { id: 'money', label: 'Money', icon: <Wallet size={16} />, emoji: '💰' },
            { id: 'attendance', label: 'Attendance', icon: <Calendar size={16} />, emoji: '🖐️' },
            { id: 'activity', label: 'Activity', icon: <CheckSquare size={16} />, emoji: '📝' },
            { id: 'reminder', label: 'Reminder', icon: <Bell size={16} />, emoji: '🔔' },
            { id: 'goal', label: 'Goal', icon: <Target size={16} />, emoji: '🎯' },
            { id: 'note', label: 'Note', icon: <FileText size={16} />, emoji: '📔' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as QuickAddTab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all',
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200/50 dark:hover:bg-surface-800/50'
              )}
            >
              <span>{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: MONEY (DYNAMIC 3 FORMS) */}
          {activeTab === 'money' && (
            <div className="space-y-4">
              {/* Money Sub-tabs */}
              <div className="grid grid-cols-3 rounded-xl p-1 bg-surface-100 dark:bg-surface-800 gap-1 border border-surface-200/60 dark:border-surface-700/60">
                {[
                  { id: 'expense', label: '💸 Expense' },
                  { id: 'given', label: '🤝 Money Given' },
                  { id: 'received', label: '💰 Received' },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setMoneyType(type.id as any)}
                    className={cn(
                      'py-2 px-1 text-xs font-bold rounded-lg transition-all text-center truncate',
                      moneyType === type.id
                        ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-300 shadow-sm'
                        : 'text-surface-500 hover:text-surface-900 dark:hover:text-white'
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* FORM 1: EXPENSE */}
              {moneyType === 'expense' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-2xl font-bold rounded-2xl px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Category *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      >
                        <option value="upi">UPI (GPay/PhonePe)</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Description / Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Dinner, Auto fare, Books"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* FORM 2: MONEY GIVEN / LENT */}
              {moneyType === 'given' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">
                      Person Name *
                    </label>
                    <div className="space-y-2">
                      <select
                        value={isAddingNewPerson ? '__new__' : (selectedPersonId || personName)}
                        onChange={(e) => handlePersonSelectChange(e.target.value)}
                        className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                      >
                        <option value="">[ Select Person ▼ ]</option>
                        {allPersonOptions.map((opt) => (
                          <option key={opt.id || opt.name} value={opt.id || opt.name}>
                            👤 {opt.name} {opt.phone ? `(${opt.phone})` : ''}
                          </option>
                        ))}
                        <option value="__new__">➕ Add New Person...</option>
                      </select>

                      {isAddingNewPerson && (
                        <input
                          type="text"
                          placeholder="Enter new person name..."
                          value={newPersonName}
                          onChange={(e) => {
                            setNewPersonName(e.target.value)
                            setPersonName(e.target.value)
                          }}
                          className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-amber-400 dark:border-amber-600 text-surface-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none animate-in fade-in duration-150"
                          autoFocus
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Amount Given (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-2xl font-bold rounded-2xl px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Date Given *
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Expected Return Date
                      </label>
                      <input
                        type="date"
                        value={expectedReturnDate}
                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Purpose / Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Personal, Emergency"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      >
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Description / Note
                    </label>
                    <input
                      type="text"
                      placeholder="Optional notes..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* FORM 3: MONEY RECEIVED / BORROWED */}
              {moneyType === 'received' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-semibold text-surface-600 dark:text-surface-400 mb-1">
                      Person Name *
                    </label>
                    <div className="space-y-2">
                      <select
                        value={isAddingNewPerson ? '__new__' : (selectedPersonId || personName)}
                        onChange={(e) => handlePersonSelectChange(e.target.value)}
                        className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="">[ Select Person ▼ ]</option>
                        {allPersonOptions.map((opt) => (
                          <option key={opt.id || opt.name} value={opt.id || opt.name}>
                            👤 {opt.name} {opt.phone ? `(${opt.phone})` : ''}
                          </option>
                        ))}
                        <option value="__new__">➕ Add New Person...</option>
                      </select>

                      {isAddingNewPerson && (
                        <input
                          type="text"
                          placeholder="Enter new person name..."
                          value={newPersonName}
                          onChange={(e) => {
                            setNewPersonName(e.target.value)
                            setPersonName(e.target.value)
                          }}
                          className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-emerald-400 dark:border-emerald-600 text-surface-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none animate-in fade-in duration-150"
                          autoFocus
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Amount Received (₹) *
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full text-2xl font-bold rounded-2xl px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Date Received *
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Expected Repayment Date
                      </label>
                      <input
                        type="date"
                        value={expectedReturnDate}
                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Purpose / Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Food, College fees, Mess"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                      >
                        <option value="upi">UPI</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                      Description / Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Paid back partially"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                    />
                  </div>

                  {/* Live Person Balance Breakdown Card */}
                  {(selectedPersonId || (isAddingNewPerson && newPersonName.trim()) || personName) && (
                    <div className="rounded-2xl p-3.5 bg-surface-50 dark:bg-surface-800/90 border border-surface-200 dark:border-surface-700 space-y-2 text-xs animate-in fade-in duration-200">
                      <p className="font-bold text-surface-900 dark:text-white flex items-center justify-between border-b border-surface-200 dark:border-surface-700 pb-1.5">
                        <span>Selected Person:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                          {selectedPerson ? selectedPerson.name : (newPersonName || personName || 'Selected Person')}
                        </span>
                      </p>
                      <div className="space-y-1.5 pt-0.5 text-surface-600 dark:text-surface-300">
                        <div className="flex justify-between">
                          <span>Original Amount Taken:</span>
                          <span className="font-semibold text-surface-900 dark:text-white">₹{originalAmountTaken.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Already Received:</span>
                          <span className="font-semibold text-surface-900 dark:text-white">₹{alreadyReceived.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-surface-700 dark:text-surface-200 pt-1 border-t border-dashed border-surface-200 dark:border-surface-700">
                          <span>Current Balance:</span>
                          <span>₹{currentBalanceBefore.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                          <span>Amount Being Received:</span>
                          <span>₹{amountBeingReceivedNum.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
                        <span className="font-bold text-surface-900 dark:text-white">Remaining Amount:</span>
                        <span className={cn(
                          "px-3 py-1 rounded-xl text-sm font-extrabold shadow-xs",
                          remainingAmount <= 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                        )}>
                          ₹{Math.max(0, remainingAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Remaining Amount Box */}
                  <div className="rounded-2xl p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Remaining Amount
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        Total Taken − Total Received
                      </p>
                    </div>
                    <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                      ₹{(selectedPersonId || personName) ? Math.max(0, remainingAmount).toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4 text-center py-4">
              <p className="text-sm text-surface-600 dark:text-surface-400">
                Submit today's attendance to Supabase (Window: 9:00 PM → 10:30 PM). Notifications stop once confirmed by database.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'present', label: 'Present', icon: '🖐️', color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
                  { id: 'late', label: 'Late', icon: '⏰', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
                  { id: 'absent', label: 'Absent', icon: '❌', color: 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAttendanceStatus(item.id as any)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all',
                      attendanceStatus === item.id
                        ? `${item.color} ring-2 ring-offset-2 ring-primary-500 scale-105`
                        : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                    )}
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <span className="font-bold text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Attend DBMS Lecture, Gym Workout"
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Category
                </label>
                <select
                  value={activityCategory}
                  onChange={(e) => setActivityCategory(e.target.value as any)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                >
                  <option value="college">College / Classes 🎓</option>
                  <option value="study">Self Study 📚</option>
                  <option value="exercise">Exercise / Workout 🏋️‍♂️</option>
                  <option value="food">Mess / Food 🍜</option>
                  <option value="personal">Personal 👤</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REMINDER */}
          {activeTab === 'reminder' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Biometric Punch, Submit Assignment"
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Time ⏰
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  >
                    <option value="low">Low 🟢</option>
                    <option value="medium">Medium 🟡</option>
                    <option value="high">High 🔴</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Repeat
                </label>
                <select
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value as any)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                >
                  <option value="once">One-time only</option>
                  <option value="daily">Every Day</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 5: GOAL */}
          {activeTab === 'goal' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Goal Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Study 2 hours daily, Save ₹2000"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Target Goal Value
                  </label>
                  <input
                    type="number"
                    placeholder="100"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    Current Progress
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={goalCurrent}
                    onChange={(e) => setGoalCurrent(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: NOTE */}
          {activeTab === 'note' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Note Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. WiFi Password, Room rules"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Content
                </label>
                <textarea
                  placeholder="Write your note content here..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white resize-none"
                />
              </div>
            </div>
          )}

          {/* Dynamic Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-lg shadow-primary-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Plus size={18} />
              <span>
                {loading
                  ? 'Saving...'
                  : activeTab === 'money'
                  ? moneyType === 'expense'
                    ? 'Save Expense'
                    : moneyType === 'given'
                    ? 'Save Money Given'
                    : 'Save Money Received'
                  : 'Save Item'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
