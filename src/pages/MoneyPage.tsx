import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { EditTransactionModal } from '@/components/ui/EditTransactionModal'
import {
  PersonMoneyDetailModal,
  type PersonMoneyGroup,
} from '@/components/money/PersonMoneyDetailModal'
import {
  transactionService,
  peopleService,
  subscribeToRealtime,
} from '@/services/dbServices'
import type { Transaction, Person } from '@/types'
import {
  Plus,
  ArrowRight,
  PieChart,
  Search,
  TrendingDown,
  HandCoins,
  ArrowDownToDot,
  Users,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'

type PersonFilter = 'all' | 'they_owe_me' | 'i_owe_them' | 'settled'

export default function MoneyPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  // Filters and Search for People & Money
  const [activeFilter, setActiveFilter] = useState<PersonFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Selected person for Detail Modal / View
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(null)

  // Modals state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [modalMoneyType, setModalMoneyType] = useState<
    'expense' | 'given' | 'received' | 'settlement'
  >('expense')
  const [quickAddPersonId, setQuickAddPersonId] = useState<string | undefined>()
  const [quickAddPersonName, setQuickAddPersonName] = useState<string | undefined>()
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Optional collapsible for direct non-person expenses
  const [showDirectExpenses, setShowDirectExpenses] = useState(false)

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
      showToast.error('Failed to load money records')
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

  const handleDeleteTransaction = async (id: string) => {
    try {
      await transactionService.deleteTransaction(id)
      setTransactions((prev) => {
        const next = prev.filter((t) => t.id !== id)
        return next
      })
      showToast.success('Transaction removed')

      // Check if current person has no more transactions after delete
      if (selectedPersonKey) {
        const remainingForPerson = transactions.filter((t) => {
          if (t.id === id) return false
          const pName = (t.person_name || '').toLowerCase().trim()
          return pName === selectedPersonKey
        })
        if (remainingForPerson.length === 0) {
          setSelectedPersonKey(null)
          showToast.info('All transactions removed for this person.')
        }
      }
    } catch (err) {
      console.error(err)
      showToast.error('Failed to delete transaction')
    }
  }

  const handleOpenAddModal = (
    type: 'expense' | 'given' | 'received' | 'settlement' = 'expense',
    personName?: string,
    personId?: string | null
  ) => {
    setModalMoneyType(type)
    setQuickAddPersonName(personName || undefined)
    setQuickAddPersonId(personId || undefined)
    setIsQuickAddOpen(true)
  }

  const handleSettleUp = async (
    personName: string,
    netAmount: number,
    personId?: string | null
  ) => {
    if (netAmount === 0) return
    const isOwedToUser = netAmount > 0
    try {
      await transactionService.createTransaction({
        type: isOwedToUser ? 'received' : 'given',
        amount: Math.abs(netAmount),
        category: 'Settlement',
        description: `Debt Settled with ${personName}`,
        person_id: personId || undefined,
        person_name: personName,
        status: 'settled',
      })
      showToast.success(`Full settlement of ₹${Math.abs(netAmount)} recorded with ${personName}! 🤝`)
      await loadData()
    } catch (err) {
      console.error(err)
      showToast.error('Failed to record settlement')
    }
  }

  // Top Section Overall Totals Calculations
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

  // Direct non-person expenses
  const directExpenses = useMemo(() => {
    return transactions.filter(
      (t) => t.type === 'expense' && !t.person_name && !t.person_id
    )
  }, [transactions])

  // ==================================================
  // Dynamic Person-wise Grouping and Balance Calculation
  // ==================================================
  const personGroups = useMemo(() => {
    const map = new Map<string, PersonMoneyGroup>()

    transactions.forEach((tx) => {
      // 1. Identify person name
      let pName = (tx.person_name || '').trim()
      if (!pName && tx.person_id) {
        const pObj = people.find((p) => p.id === tx.person_id)
        if (pObj) pName = pObj.name.trim()
      }
      if (!pName && tx.description) {
        const match = tx.description.match(
          /(?:Given to|Received from|Settlement with|Lent money to|Borrowed money from|Lent to|Borrowed from)\s+([^,.(]+)/i
        )
        if (match && match[1]?.trim()) {
          pName = match[1].trim()
        }
      }

      // If no person associated and it's a pure expense, skip from person grouping
      if (!pName) return

      // Normalized key: case-insensitive deduplication ("Tanishq", "tanishq", "TANISHQ")
      const key = pName.toLowerCase().trim()
      if (!key) return

      if (!map.has(key)) {
        // Resolve display name: prefer canonical entry from people table
        const matchedPerson = people.find((p) => p.name.toLowerCase().trim() === key)
        const canonicalName =
          matchedPerson?.name ||
          pName.charAt(0).toUpperCase() + pName.slice(1)

        map.set(key, {
          key,
          personName: canonicalName,
          personId: matchedPerson?.id || tx.person_id || null,
          phone: matchedPerson?.phone || null,
          totalGave: 0,
          totalTook: 0,
          totalSettled: 0,
          netBalance: 0,
          transactionCount: 0,
          transactions: [],
        })
      }

      const group = map.get(key)!
      group.transactions.push(tx)
      group.transactionCount += 1

      const amt = Number(tx.amount) || 0
      const isSettlement =
        tx.category === 'Settlement' ||
        tx.type === 'settlement' ||
        tx.status === 'settled' ||
        (tx.description && /settle|repaid|paid back|returned/i.test(tx.description))

      if (isSettlement) {
        group.totalSettled += amt
      }

      // Determine money flow direction:
      // You gave: user gave money (lent, or user paid back settlement to person)
      if (tx.type === 'given' || tx.type === 'expense') {
        group.totalGave += amt
      } else if (tx.type === 'received') {
        // They gave / You took: user received money (borrowed, or person repaid settlement to user)
        group.totalTook += amt
      } else if (tx.type === 'settlement') {
        if (tx.description && /received|they paid|from/i.test(tx.description)) {
          group.totalTook += amt
        } else {
          group.totalGave += amt
        }
      }

      // Calculate net balance: totalGave - totalTook
      // netBalance > 0: they owe user
      // netBalance < 0: user owes them
      // netBalance === 0: settled
      group.netBalance = group.totalGave - group.totalTook
    })

    // Sort each person's transactions by date (newest first)
    map.forEach((group) => {
      group.transactions.sort((a, b) => {
        const dateA = a.transaction_date || ''
        const dateB = b.transaction_date || ''
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
    })

    // Return list sorted: unsettled (highest debt first), then settled, then alphabetically
    const list = Array.from(map.values())
    list.sort((a, b) => {
      const aSettled = a.netBalance === 0
      const bSettled = b.netBalance === 0
      if (aSettled !== bSettled) return aSettled ? 1 : -1
      if (Math.abs(b.netBalance) !== Math.abs(a.netBalance)) {
        return Math.abs(b.netBalance) - Math.abs(a.netBalance)
      }
      return a.personName.localeCompare(b.personName)
    })

    return list
  }, [transactions, people])

  // Filtered person groups based on Search & Filters
  const filteredPersonGroups = useMemo(() => {
    return personGroups.filter((person) => {
      // 1. Status Filter
      if (activeFilter === 'they_owe_me' && person.netBalance <= 0) return false
      if (activeFilter === 'i_owe_them' && person.netBalance >= 0) return false
      if (activeFilter === 'settled' && person.netBalance !== 0) return false

      // 2. Search Query (person name, note, tag, payment method, amount)
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()

      if (person.personName.toLowerCase().includes(q)) return true
      if (person.phone && person.phone.toLowerCase().includes(q)) return true

      return person.transactions.some((t) => {
        return (
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.payment_method && t.payment_method.toLowerCase().includes(q)) ||
          (t.purpose && t.purpose.toLowerCase().includes(q)) ||
          String(t.amount).includes(q)
        )
      })
    })
  }, [personGroups, activeFilter, searchQuery])

  // Selected person group for Detail View
  const selectedPersonGroup = useMemo(() => {
    if (!selectedPersonKey) return null
    return personGroups.find((p) => p.key === selectedPersonKey) || null
  }, [personGroups, selectedPersonKey])

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* ==================================================
            1. TOP SECTION: Header Banner & Action Buttons
        ================================================== */}
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
              <span>🤝 Lend Money</span>
            </button>
            <button
              onClick={() => handleOpenAddModal('received')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <span>💼 Borrowed Money</span>
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

        {/* ==================================================
            Summary Cards: Expenses Spent, Lent, Borrowed
        ================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Expenses Spent */}
          <div
            onClick={() => setShowDirectExpenses((prev) => !prev)}
            className="p-5 rounded-3xl border border-surface-200/80 dark:border-white/[0.08] bg-white dark:bg-surface-900 hover:border-rose-300 dark:hover:border-rose-800/80 transition-all cursor-pointer relative overflow-hidden group shadow-sm"
            title="Click to view/toggle direct expenses log"
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
            <div className="flex items-center justify-between mt-1 text-[11px] text-surface-400">
              <span>Direct hostel &amp; personal spending</span>
              {directExpenses.length > 0 && (
                <span className="text-rose-500 font-bold group-hover:underline flex items-center gap-0.5">
                  {showDirectExpenses ? 'Hide logs' : `${directExpenses.length} entries`}
                  {showDirectExpenses ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
              )}
            </div>
          </div>

          {/* Lent (They Owe You) */}
          <div
            onClick={() => setActiveFilter('they_owe_me')}
            className={cn(
              'p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden shadow-sm',
              activeFilter === 'they_owe_me'
                ? 'bg-amber-50/90 border-amber-400 dark:bg-amber-950/40 dark:border-amber-700 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.08] hover:border-amber-300 dark:hover:border-amber-800'
            )}
            title="Filter people who owe you"
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

          {/* Borrowed (You Owe) */}
          <div
            onClick={() => setActiveFilter('i_owe_them')}
            className={cn(
              'p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden shadow-sm',
              activeFilter === 'i_owe_them'
                ? 'bg-emerald-50/90 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-surface-900 border-surface-200/80 dark:border-white/[0.08] hover:border-emerald-300 dark:hover:border-emerald-800'
            )}
            title="Filter people you owe"
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

        {/* Collapsible Direct Expenses Log (Preserves access to non-person spending) */}
        {showDirectExpenses && directExpenses.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200/80 dark:border-rose-900/30 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <TrendingDown size={14} />
                <span>Direct Expenses Log ({directExpenses.length})</span>
              </h3>
              <button
                onClick={() => setShowDirectExpenses(false)}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {directExpenses.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-surface-900 dark:text-white truncate">
                      {tx.description || tx.category}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-surface-400 mt-0.5">
                      <span>{tx.transaction_date}</span>
                      <span>•</span>
                      <span className="font-semibold">{tx.category}</span>
                      <span>•</span>
                      <span className="uppercase">{tx.payment_method}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                      -₹{Number(tx.amount).toLocaleString()}
                    </span>
                    <button
                      onClick={() => setEditingTransaction(tx)}
                      className="p-1.5 text-surface-400 hover:text-emerald-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTransaction(tx.id)}
                      className="p-1.5 text-surface-400 hover:text-rose-600 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================
            "PEOPLE & MONEY" SECTION: Search & Filters
        ================================================== */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-surface-900 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-primary-600 dark:text-primary-400" />
                <span>People &amp; Money</span>
              </h2>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                Grouped balances with roommates and friends. Click [ View ] for detailed history.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative sm:w-72">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400"
              />
              <input
                type="text"
                placeholder="🔍 Search person..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-xs bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 shadow-sm"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All', count: personGroups.length },
              {
                id: 'they_owe_me',
                label: 'They Owe Me',
                count: personGroups.filter((p) => p.netBalance > 0).length,
              },
              {
                id: 'i_owe_them',
                label: 'I Owe Them',
                count: personGroups.filter((p) => p.netBalance < 0).length,
              },
              {
                id: 'settled',
                label: 'Settled',
                count: personGroups.filter((p) => p.netBalance === 0).length,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as PersonFilter)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm',
                  activeFilter === tab.id
                    ? 'bg-primary-600 text-white font-extrabold shadow-md shadow-primary-600/25'
                    : 'bg-white dark:bg-surface-900 text-surface-600 dark:text-surface-300 border border-surface-200/80 dark:border-white/[0.08] hover:bg-surface-50 dark:hover:bg-surface-800'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-black',
                    activeFilter === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ==================================================
            Person-Wise Cards Grid
        ================================================== */}
        {loading ? (
          <div className="text-center py-16 text-surface-400 text-xs">
            Loading people and balances...
          </div>
        ) : filteredPersonGroups.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-surface-200 dark:border-surface-800 rounded-3xl bg-surface-50/50 dark:bg-surface-900/30 p-6 space-y-3">
            <span className="text-4xl block">👥</span>
            <h3 className="font-bold text-sm text-surface-800 dark:text-surface-200">
              {personGroups.length === 0
                ? 'No financial relationships recorded yet'
                : 'No people match your current filter'}
            </h3>
            <p className="text-xs text-surface-400 max-w-sm mx-auto">
              {personGroups.length === 0
                ? 'Lend money to roommates or record borrowed funds to automatically group and balance them here.'
                : 'Try adjusting your search query or reset the filter to view all people.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              {personGroups.length > 0 && (
                <button
                  onClick={() => {
                    setActiveFilter('all')
                    setSearchQuery('')
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-700 transition-colors cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
              <button
                onClick={() => handleOpenAddModal('given')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
              >
                + Lend Money
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPersonGroups.map((person) => {
              const isTheyOweYou = person.netBalance > 0
              const isSettled = person.netBalance === 0

              return (
                <div
                  key={person.key}
                  className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 shadow-sm hover:border-surface-300 dark:hover:border-white/[0.14] transition-all flex flex-col justify-between space-y-4 group"
                >
                  {/* Card Header: Person Name & [ View → ] */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-sm font-bold text-surface-700 dark:text-surface-200 shrink-0 border border-surface-200/60 dark:border-white/[0.04]">
                        👤
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm sm:text-base text-surface-900 dark:text-white truncate">
                          {person.personName}
                        </h3>
                        {person.phone && (
                          <p className="text-[10px] text-surface-400 truncate">{person.phone}</p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedPersonKey(person.key)}
                      className="px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-primary-50 dark:bg-surface-800 dark:hover:bg-primary-950/40 text-surface-700 dark:text-surface-300 hover:text-primary-600 dark:hover:text-primary-300 text-xs font-bold border border-surface-200/80 dark:border-white/[0.06] hover:border-primary-300 dark:hover:border-primary-700 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-sm"
                    >
                      <span>View</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>

                  {/* Key Metrics: You gave & They gave / You took */}
                  <div className="space-y-1.5 py-1 text-xs border-y border-surface-100 dark:border-white/[0.04]">
                    <div className="flex items-center justify-between text-surface-600 dark:text-surface-400">
                      <span>You gave</span>
                      <span className="font-bold text-surface-900 dark:text-white">
                        ₹{person.totalGave.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-surface-600 dark:text-surface-400">
                      <span>
                        {person.netBalance < 0 ? 'You took' : 'They gave'}
                      </span>
                      <span className="font-bold text-surface-900 dark:text-white">
                        ₹{person.totalTook.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer: Status Badge and Transaction Count */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div>
                      {isSettled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800">
                          🟢 Settled
                        </span>
                      ) : isTheyOweYou ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                          🟠 They owe you ₹{person.netBalance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800">
                          🔵 You owe them ₹{Math.abs(person.netBalance).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-bold text-surface-400 shrink-0">
                      {person.transactionCount}{' '}
                      {person.transactionCount === 1 ? 'transaction' : 'transactions'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ==================================================
          Detailed Person Money Drawer / Modal
      ================================================== */}
      <PersonMoneyDetailModal
        isOpen={Boolean(selectedPersonKey && selectedPersonGroup)}
        personGroup={selectedPersonGroup}
        onClose={() => setSelectedPersonKey(null)}
        onEditTransaction={(tx) => setEditingTransaction(tx)}
        onDeleteTransaction={handleDeleteTransaction}
        onAddTransactionForPerson={(type, pName, pId) => handleOpenAddModal(type, pName, pId)}
        onSettleUp={handleSettleUp}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab="money"
        initialMoneyType={modalMoneyType}
        initialPersonName={quickAddPersonName}
        initialPersonId={quickAddPersonId}
        onClose={() => {
          setIsQuickAddOpen(false)
          setQuickAddPersonName(undefined)
          setQuickAddPersonId(undefined)
        }}
        onSuccess={loadData}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        transaction={editingTransaction}
        isOpen={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        onSuccess={loadData}
      />
    </AppLayout>
  )
}
