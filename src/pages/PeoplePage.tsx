import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { peopleService, transactionService, subscribeToRealtime } from '@/services/dbServices'
import type { Person, Transaction } from '@/types'
import { Phone, UserPlus, X, Pencil, Trash2, Eye, Plus, MessageCircle } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'
import { EditPersonModal } from '@/components/ui/EditPersonModal'
import { PersonDetailsModal } from '@/components/ui/PersonDetailsModal'
import { QuickAddModal } from '@/components/ui/QuickAddModal'

interface PersonBalance {
  person: Person
  given: number
  received: number
  net: number // positive = person owes user; negative = user owes person
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Details Modal state
  const [selectedPersonDetails, setSelectedPersonDetails] = useState<Person | null>(null)
  const [quickAddPerson, setQuickAddPerson] = useState<Person | null>(null)

  // Add Person Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleWhatsAppReminder = (p: Person, netAmount: number) => {
    if (p.phone) {
      const cleanPhone = p.phone.replace(/[^0-9]/g, '')
      const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
      const msg = encodeURIComponent(
        `Hi ${p.name}! Gentle reminder regarding the outstanding balance of ₹${netAmount.toLocaleString()} on Hostel Life Tracker. Let me know when you can settle up! 🤝`
      )
      window.open(`https://wa.me/${phoneWithCountry}?text=${msg}`, '_blank')
    } else {
      const msg = `Hi ${p.name}! Gentle reminder regarding the outstanding balance of ₹${netAmount.toLocaleString()} on Hostel Life Tracker.`
      navigator.clipboard.writeText(msg)
      showToast.success('Reminder message copied to clipboard! (Add phone number to open WhatsApp directly)')
    }
  }

  const handleDeletePerson = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name}?`)) {
      try {
        await peopleService.deletePerson(id)
        showToast.success(`Removed ${name}`)
        loadData()
      } catch (err) {
        showToast.error('Failed to delete person')
      }
    }
  }

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
    const unsubscribe = subscribeToRealtime(() => {
      loadData()
    })
    return () => unsubscribe()
  }, [])

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
      const matchedPerson = people.find((p) => p.name.toLowerCase().trim() === personName.toLowerCase().trim())
      await transactionService.createTransaction({
        type: isOwesYou ? 'received' : 'given',
        amount: Math.abs(amount),
        category: 'Settlement',
        description: `Settlement with ${personName}`,
        person_id: matchedPerson?.id || undefined,
        person_name: personName,
      })
      showToast.success(`Settled up with ${personName}! 🤝`)
      loadData()
    } catch (err) {
      showToast.error('Failed to record settlement')
    }
  }

  // Calculate balances per person (check person_id, person_name, and description)
  const balances: PersonBalance[] = people.map((p) => {
    const targetName = p.name.toLowerCase().trim()
    const personTxs = transactions.filter(
      (t) =>
        t.person_id === p.id ||
        (t.person_name && t.person_name.toLowerCase().trim() === targetName) ||
        (t.description && t.description.toLowerCase().includes(targetName))
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="p-5 rounded-3xl bg-emerald-50/80 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800/60 shadow-sm relative overflow-hidden">
            <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🤝 People Owe You (To Collect)</span>
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
              ₹{totalOwedToUser.toLocaleString()}
            </p>
            <p className="text-[11px] text-surface-400 mt-0.5">Sum of all active loans to friends</p>
          </div>

          <div className="p-5 rounded-3xl bg-amber-50/80 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/60 shadow-sm relative overflow-hidden">
            <p className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>💰 You Owe Others (To Repay)</span>
            </p>
            <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
              ₹{totalUserOwes.toLocaleString()}
            </p>
            <p className="text-[11px] text-surface-400 mt-0.5">Money borrowed/taken from friends</p>
          </div>
        </div>

        {/* People List */}
        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-white/[0.08] p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-surface-100 dark:border-white/[0.06]">
            <h3 className="font-extrabold text-base text-surface-900 dark:text-white">
              Friends &amp; Debt Balances
            </h3>
            <span className="text-xs font-bold text-surface-400 bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded-full">
              {balances.length} contacts
            </span>
          </div>

          {balances.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-surface-200 dark:border-surface-800 rounded-2xl bg-surface-50/50 dark:bg-surface-950/30">
              <span className="text-3xl block mb-2">👥</span>
              <p className="text-xs text-surface-500 font-medium">No friends or roommates added yet.</p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/25 transition-all cursor-pointer"
              >
                + Add Roommate / Friend
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {balances.map(({ person, given, received, net }) => (
                <div
                  key={person.id}
                  className="p-4 sm:p-5 rounded-2xl bg-surface-50/70 dark:bg-surface-800/40 border border-surface-200/80 dark:border-white/[0.06] hover:border-surface-300 dark:hover:border-white/[0.12] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white text-lg font-black shadow-md shadow-primary-600/20 shrink-0">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black text-lg text-surface-900 dark:text-white flex items-center gap-2">
                        <span>{person.name}</span>
                        {person.notes && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-200/80 dark:bg-surface-700 text-surface-600 dark:text-surface-300">
                            {person.notes}
                          </span>
                        )}
                      </h4>

                      {/* Direction & Debt Status Display */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-surface-400 font-bold text-xs">↓</span>
                        {net === 0 ? (
                          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-surface-200/80 text-surface-700 dark:bg-surface-700 dark:text-surface-300">
                            Settled Up ✓
                          </span>
                        ) : net > 0 ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-xs">
                            <span className="text-emerald-600 dark:text-emerald-400">🟢</span>
                            <span>Owes you ₹{net.toLocaleString()}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-800 shadow-xs">
                            <span className="text-amber-600 dark:text-amber-400">🟠</span>
                            <span>You owe ₹{Math.abs(net).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500 dark:text-surface-400 mt-1.5">
                        <span>Lent: <strong className="text-surface-800 dark:text-surface-200">₹{given.toLocaleString()}</strong></span>
                        <span>•</span>
                        <span>Returned: <strong className="text-surface-800 dark:text-surface-200">₹{received.toLocaleString()}</strong></span>
                        {person.phone && (
                          <>
                            <span>•</span>
                            <a
                              href={`tel:${person.phone}`}
                              className="flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium hover:underline"
                            >
                              <Phone size={12} />
                              <span>{person.phone}</span>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-0 border-surface-200/60 dark:border-surface-700/60">
                    {/* Quick Add Transaction with this person */}
                    <button
                      onClick={() => setQuickAddPerson(person)}
                      className="px-3 py-1.5 rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Add money lent or borrowed with this person"
                    >
                      <Plus size={13} />
                      <span>Add Loan / Debt</span>
                    </button>

                    {/* WhatsApp reminder if they owe money */}
                    {net > 0 && (
                      <button
                        onClick={() => handleWhatsAppReminder(person, net)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                        title="Send WhatsApp payment reminder"
                      >
                        <MessageCircle size={13} />
                        <span>Remind</span>
                      </button>
                    )}

                    {/* 1-click Settle Up */}
                    {net !== 0 && (
                      <button
                        onClick={() => handleSettleUp(person.name, net)}
                        className="px-3 py-1.5 rounded-xl bg-surface-900 text-white dark:bg-surface-700 hover:bg-surface-800 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1"
                      >
                        <span>⚡ Settle Up</span>
                      </button>
                    )}

                    {/* View Details */}
                    <button
                      onClick={() => setSelectedPersonDetails(person)}
                      className="px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300 hover:bg-primary-100 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 border border-primary-200 dark:border-primary-900/40"
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>

                    <div className="flex items-center gap-1 ml-1">
                      <button
                        onClick={() => setEditingPerson(person)}
                        className="p-1.5 rounded-xl text-surface-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors cursor-pointer"
                        title="Edit Person"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeletePerson(person.id, person.name)}
                        className="p-1.5 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Delete Person"
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

      <PersonDetailsModal
        isOpen={Boolean(selectedPersonDetails)}
        person={selectedPersonDetails}
        transactions={transactions}
        onClose={() => setSelectedPersonDetails(null)}
        onSettleUp={handleSettleUp}
      />

      <EditPersonModal
        person={editingPerson}
        isOpen={Boolean(editingPerson)}
        onClose={() => setEditingPerson(null)}
        onSuccess={loadData}
      />

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

      {/* Quick Add Loan / Debt Modal for this person */}
      <QuickAddModal
        isOpen={Boolean(quickAddPerson)}
        initialTab="money"
        initialMoneyType="given"
        initialPersonId={quickAddPerson?.id}
        initialPersonName={quickAddPerson?.name}
        onClose={() => setQuickAddPerson(null)}
        onSuccess={() => {
          setQuickAddPerson(null)
          loadData()
        }}
      />
    </AppLayout>
  )
}
