import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface AbsentReasonModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}

const PRESET_REASONS = [
  { id: 'sick', label: 'Sick / Unwell', icon: '🤒' },
  { id: 'home', label: 'Home Visit / Out of Town', icon: '🏠' },
  { id: 'exam', label: 'Exam / Academic Leave', icon: '📚' },
  { id: 'personal', label: 'Personal / Event', icon: '🎉' },
  { id: 'other', label: 'Other Reason', icon: '✏️' },
]

export function AbsentReasonModal({ isOpen, onClose, onConfirm }: AbsentReasonModalProps) {
  const [selectedPreset, setSelectedPreset] = useState('home')
  const [customReason, setCustomReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let finalReason = PRESET_REASONS.find((r) => r.id === selectedPreset)?.label || 'Absent'
      if (selectedPreset === 'other') {
        finalReason = customReason.trim() ? `Other: ${customReason.trim()}` : 'Other Reason'
      }
      await onConfirm(finalReason)
      onClose()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-surface-900 shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 text-xl font-bold">
              ❌
            </div>
            <div>
              <h2 className="text-base font-extrabold text-surface-900 dark:text-white">
                Reason for Absence
              </h2>
              <p className="text-xs text-surface-500">
                Marking Absent (Home Visit / Sick) is available 24/7 at any time of day
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-500 hover:text-surface-900 dark:hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
              Select Reason *
            </label>
            <div className="space-y-2">
              {PRESET_REASONS.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedPreset(r.id)}
                  className={cn(
                    'w-full p-3 rounded-2xl text-xs font-bold text-left flex items-center gap-3 border transition-all',
                    selectedPreset === r.id
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 shadow-sm'
                      : 'bg-surface-50 dark:bg-surface-800/60 border-surface-200/60 dark:border-surface-700/60 text-surface-700 dark:text-surface-300 hover:bg-surface-100'
                  )}
                >
                  <span className="text-base">{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedPreset === 'other' && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
                Specify Reason *
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter specific reason..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-surface-100 dark:border-surface-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Mark Absent ❌'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
