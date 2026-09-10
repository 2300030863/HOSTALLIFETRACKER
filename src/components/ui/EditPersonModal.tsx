import { useState, useEffect } from 'react'
import type { Person } from '@/types'
import { peopleService } from '@/services/dbServices'
import { X, Save, User, Phone, FileText } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

interface EditPersonModalProps {
  person: Person | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditPersonModal({ person, isOpen, onClose, onSuccess }: EditPersonModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (person) {
      setName(person.name || '')
      setPhone(person.phone || '')
      setNotes(person.notes || '')
    }
  }, [person])

  if (!isOpen || !person) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast.error('Please enter a name')
      return
    }

    setLoading(true)
    try {
      await peopleService.updatePerson(person.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      showToast.success('Person updated successfully!')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      showToast.error('Failed to update person')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-4">
          <div className="flex items-center gap-2">
            <User className="text-primary-600" size={20} />
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">Edit Person</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
              <User size={14} /> Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
              <Phone size={14} /> Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1.5">
              <FileText size={14} /> Notes / Details
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Hostel roommate, mess fee split..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
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
              className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
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
