import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { peopleService, transactionService } from '@/services/dbServices'
import type { Person, Transaction } from '@/types'
import { Phone, UserPlus, X } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

interface PersonBalance {
  person: Person
  given: number
  received: number
  net: number // positive = person owes user; negative = user owes person
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Add Person Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [peopleData, txData] = await Promise.all([
        peopleService.getPeople(),
        transactionService.getAllTransactions(),
      ])
      setPeople(peopleData)
      setTransactions(txData)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast.error('Please enter person name')
      return
    }

    setSubmitting(true)
    try {
      const created = await peopleService.createPerson(name, phone, notes)
      setPeople((prev) => [...prev, created])
      showToast.success(`Added ${name} to your friends list! 👥`)
      setName('')
      setPhone('')
      setNotes('')
      setIsAddModalOpen(false)
    } catch (err) {
      showToast.error('Failed to add person')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSettleUp = async (personName: string, amount: number) => {
    try {
      const isOwesYou = amount > 0
      await transactionService.createTransaction({
        type: isOwesYou ? 'received' : 'given',
        amount: Math.abs(amount),
        category: 'Settlement',
        description: `Settlement with ${personName}`,
        person_name: personName,
      })
      showToast.success(`Settled up with ${personName}! 🤝`)
      loadData()
    } catch (err) {
      showToast.error('Failed to record settlement')
    }
  }

  // Calculate balances per person
  const balances: PersonBalance[] = people.map((p) => {
    const personTxs = transactions.filter(
      (t) =>
        t.person_id === p.id ||
        (t.person_name && t.person_name.toLowerCase() === p.name.toLowerCase())
    )

    const given = personTxs
      .filter((t) => t.type === 'given')
      .reduce((acc, t) => acc + Number(t.amount), 0)

    const received = personTxs
      .filter((t) => t.type === 'received')
      .reduce((acc, t) => acc + Number(t.amount), 0)

    const net = given - received

    return {
      person: p,
      given,
      received,
      net,
    }
  })

  // Calculate totals
  const totalOwedToUser = balances
    .filter((b) => b.net > 0)
    .reduce((acc, b) => acc + b.net, 0)

  const totalUserOwes = balances
    .filter((b) => b.net < 0)
    .reduce((acc, b) => acc + Math.abs(b.net), 0)

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>People & Debt Tracker</span>
              <span>👥</span>
            </h1>
            <p className="text-xs text-surface-500">Who owes whom? Manage loans and settlements</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all"
          >
            <UserPlus size={16} />
            <span>Add Person</span>
          </button>
        </div>

        {/* Debt Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 shadow-sm">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              People Owe You (Collect) 🤝
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{totalOwedToUser}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/60 shadow-sm">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              You Owe Others (Repay) 💰
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              ₹{totalUserOwes}
            </p>
          </div>
        </div>

        {/* People List */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-surface-900 dark:text-white">
            Friends & Debt Balances
          </h3>

          {balances.length === 0 ? (
            <div className="text-center py-10 text-surface-400 text-xs">
              No people added yet. Tap "+ Add Person" above!
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map(({ person, given, received, net }) => (
                <div
                  key={person.id}
                  className="p-4 rounded-2xl bg-surface-50/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 dark:bg-primary-950 dark:text-primary-400 text-lg font-bold">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-surface-900 dark:text-white">
                        {person.name}
                      </h4>
                      <div className="flex items-center gap-3 text-xs text-surface-500 mt-0.5">
                        <span>Given: ₹{given}</span>
                        <span>•</span>
                        <span>Received: ₹{received}</span>
                        {person.phone && (
                          <a
                            href={`tel:${person.phone}`}
                            className="flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium hover:underline"
                          >
                            <Phone size={12} />
                            <span>{person.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-surface-200/60 dark:border-surface-700/60">
                    <div className="text-left sm:text-right">
                      {net === 0 ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300">
                          Settled Up ✓
                        </span>
                      ) : net > 0 ? (
                        <div>
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Owes You ₹{net}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            You Owe ₹{Math.abs(net)}
                          </span>
                        </div>
                      )}
                    </div>

                    {net !== 0 && (
                      <button
                        onClick={() => handleSettleUp(person.name, net)}
                        className="px-3 py-1.5 rounded-xl bg-surface-900 text-white dark:bg-surface-700 hover:bg-surface-800 text-xs font-bold transition-all shrink-0"
                      >
                        Settle Up 🤝
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Person Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-3">
              <h3 className="font-bold text-base text-surface-900 dark:text-white">
                Add Friend / Person
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-surface-400 hover:text-surface-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPerson} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g., Ravi, Suresh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g., 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Roommate, Mess manager"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/30 transition-all mt-2"
              >
                {submitting ? 'Adding...' : 'Save Person'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
