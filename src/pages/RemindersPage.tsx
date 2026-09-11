import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { EditReminderModal } from '@/components/ui/EditReminderModal'
import { reminderService, subscribeToRealtime } from '@/services/dbServices'
import type { Reminder } from '@/types'
import { Plus, Clock, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await reminderService.getAllReminders()
      setReminders(data)
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

  const handleToggle = async (id: string, currentVal: boolean) => {
    const newVal = !currentVal
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, completed: newVal } : r)))
    await reminderService.toggleReminder(id, newVal)
  }

  const handleDelete = async (id: string) => {
    await reminderService.deleteReminder(id)
    setReminders((prev) => prev.filter((r) => r.id !== id))
    showToast.success('Reminder deleted')
  }

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Reminders & Notifications</span>
              <span>🔔</span>
            </h1>
            <p className="text-xs text-surface-500">Biometric reminders, study alerts & tasks</p>
          </div>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Reminder</span>
          </button>
        </div>

        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-3">
          {reminders.length === 0 ? (
            <div className="text-center py-10 text-surface-400 text-xs">
              No reminders set. Tap "+ Add Reminder" above!
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={cn(
                    'flex items-center justify-between p-3.5 rounded-2xl border transition-all',
                    reminder.completed
                      ? 'bg-surface-50 dark:bg-surface-950/40 border-surface-200/50 dark:border-surface-800/50 opacity-60'
                      : 'bg-surface-50/50 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700/60'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={reminder.completed}
                      onChange={() => handleToggle(reminder.id, reminder.completed)}
                      className="h-5 w-5 rounded-lg text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <p
                        className={cn(
                          'text-sm font-bold text-surface-900 dark:text-white',
                          reminder.completed && 'line-through text-surface-400'
                        )}
                      >
                        {reminder.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {reminder.reminder_time}
                        </span>
                        <span>• {reminder.repeat_type}</span>
                        {reminder.priority === 'high' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            HIGH
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingReminder(reminder)}
                      className="p-2 rounded-xl text-surface-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      title="Edit Reminder"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="p-2 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Reminder"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab="reminder"
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={loadData}
      />

      <EditReminderModal
        reminder={editingReminder}
        isOpen={Boolean(editingReminder)}
        onClose={() => setEditingReminder(null)}
        onSuccess={loadData}
      />
    </AppLayout>
  )
}
