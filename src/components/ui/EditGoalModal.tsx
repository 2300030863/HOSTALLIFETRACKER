import { useState, useEffect } from 'react'
import { X, Calendar } from 'lucide-react'
import type { Goal, Priority } from '@/types'
import { goalService } from '@/services/dbServices'
import { showToast } from './Toast'

interface EditGoalModalProps {
  goal: Goal | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditGoalModal({ goal, isOpen, onClose, onSuccess }: EditGoalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('100')
  const [currentValue, setCurrentValue] = useState('0')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (goal) {
      setTitle(goal.title || '')
      setDescription(goal.description || '')
      setTarget(String(goal.target || 100))
      setCurrentValue(String(goal.current_value || 0))
      setDeadline(goal.deadline || '')
      setPriority(goal.priority || 'medium')
    }
  }, [goal])

  if (!isOpen || !goal) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast.error('Please enter a goal title')
      return
    }

    const numTarget = Number(target) || 100
    const numCurrent = Number(currentValue) || 0

    setSubmitting(true)
    try {
      await goalService.updateGoalDetails(goal.id, {
        title: title.trim(),
        description: description.trim() || null,
        target: numTarget,
        current_value: numCurrent,
        completed: numCurrent >= numTarget,
        deadline: deadline || null,
        priority: priority,
      })
      showToast.success('Goal updated successfully! 🎯')
      onSuccess()
      onClose()
    } catch (err: any) {
      showToast.error(err.message || 'Failed to update goal')
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 text-xl font-bold">
              ✏️
            </div>
            <div>
              <h2 className="text-base font-extrabold text-surface-900 dark:text-white">
                Edit Goal & Target
              </h2>
              <p className="text-xs text-surface-500">Update target, progress and deadline</p>
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
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
              Goal Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Study 2 hours daily"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Target details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
                Target Value *
              </label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="100"
                className="w-full px-3.5 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
                Current Progress *
              </label>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300 flex items-center gap-1">
                <Calendar size={13} />
                <span>Deadline</span>
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

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
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes ✏️'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
