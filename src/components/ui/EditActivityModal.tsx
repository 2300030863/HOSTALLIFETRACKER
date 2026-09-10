import { useState, useEffect } from 'react'
import type { Activity, ActivityCategory, ActivityStatus } from '@/types'
import { activityService } from '@/services/dbServices'
import { X, Save, Calendar, Clock, Tag, AlignLeft } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

interface EditActivityModalProps {
  activity: Activity | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function EditActivityModal({ activity, isOpen, onClose, onSuccess }: EditActivityModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ActivityCategory>('personal')
  const [activityDate, setActivityDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [status, setStatus] = useState<ActivityStatus>('pending')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (activity) {
      setTitle(activity.title || '')
      setDescription(activity.description || '')
      setCategory(activity.category || 'personal')
      setActivityDate(activity.activity_date || '')
      setStartTime(activity.start_time || '')
      setEndTime(activity.end_time || '')
      setStatus(activity.status || 'pending')
    }
  }, [activity])

  if (!isOpen || !activity) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      showToast.error('Please enter activity title')
      return
    }

    setLoading(true)
    try {
      await activityService.updateActivity(activity.id, {
        title: title.trim(),
        description: description.trim() || null,
        category,
        activity_date: activityDate || undefined,
        start_time: startTime || null,
        end_time: endTime || null,
        status,
      })
      showToast.success('Activity updated successfully! ⚡')
      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      showToast.error('Failed to update activity')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-surface-900 rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-800 p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-surface-100 dark:border-surface-800 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-emerald-600" size={20} />
            <h2 className="text-lg font-bold text-surface-900 dark:text-white">Edit Activity</h2>
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
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics Lecture, Gym Session"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <Tag size={13} /> Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ActivityCategory)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="study">📚 Study</option>
                <option value="college">🎓 College</option>
                <option value="mess">🍛 Mess / Dining</option>
                <option value="fitness">🏋️ Fitness</option>
                <option value="personal">⚡ Personal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="pending">⏳ Pending</option>
                <option value="completed">✅ Completed</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
              <Calendar size={13} /> Date
            </label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <Clock size={13} /> Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
                <Clock size={13} /> End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-surface-600 dark:text-surface-300 flex items-center gap-1">
              <AlignLeft size={13} /> Notes / Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
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
