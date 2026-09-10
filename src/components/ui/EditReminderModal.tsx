import { useState, useEffect } from 'react'
import { X, Clock, Calendar } from 'lucide-react'
import type { Reminder, Priority, RepeatType } from '@/types'
import { reminderService } from '@/services/dbServices'
import { showToast } from './Toast'

interface EditReminderModalProps {
  reminder: Reminder | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditReminderModal({
  reminder,
  isOpen,
  onClose,
  onSuccess,
}: EditReminderModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [reminderDate, setReminderDate] = useState('')
  const [repeatType, setRepeatType] = useState<RepeatType>('once')
  const [priority, setPriority] = useState<Priority>('medium')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (reminder) {
      setTitle(reminder.title || '')
      setDescription(reminder.description || '')
      setReminderTime(reminder.reminder_time || '09:00')
      setReminderDate(reminder.reminder_date || new Date().toISOString().split('T')[0])
      setRepeatType(reminder.repeat_type || 'once')
      setPriority(reminder.priority || 'medium')
    }
  }, [reminder])

  if (!isOpen || !reminder) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast.error('Please enter a title')
      return
    }

    setSubmitting(true)
    try {
      await reminderService.updateReminder(reminder.id, {
        title: title.trim(),
        description: description.trim() || null,
        reminder_time: reminderTime,
        reminder_date: reminderDate,
        repeat_type: repeatType,
        priority: priority,
      })
      showToast.success('Reminder updated successfully! 🔔')
      onSuccess()
      onClose()
    } catch (err: any) {
      showToast.error(err.message || 'Failed to update reminder')
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 text-xl font-bold">
              ✏️
            </div>
            <div>
              <h2 className="text-base font-extrabold text-surface-900 dark:text-white">
                Edit Reminder
              </h2>
              <p className="text-xs text-surface-500">Update alert schedule and priority</p>
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
              Reminder Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Biometric Attendance Alert"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              placeholder="Additional details..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300 flex items-center gap-1">
                <Clock size={13} />
                <span>Time *</span>
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300 flex items-center gap-1">
                <Calendar size={13} />
                <span>Date *</span>
              </label>
              <input
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
                Repeat Frequency
              </label>
              <select
                value={repeatType}
                onChange={(e) => setRepeatType(e.target.value as RepeatType)}
                className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-surface-700 dark:text-surface-300">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 rounded-xl border border-surface-300 dark:border-surface-700 bg-white dark:bg-surface-800 text-xs text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes ✏️'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
