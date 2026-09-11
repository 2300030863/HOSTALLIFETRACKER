import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { activityService, subscribeToRealtime } from '@/services/dbServices'
import type { Activity } from '@/types'
import { Plus, CheckCircle2, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/utils/cn'
import { showToast } from '@/components/ui/Toast'
import { EditActivityModal } from '@/components/ui/EditActivityModal'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await activityService.getTodayActivities()
      setActivities(data)
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

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus as any } : a))
    )
    await activityService.updateActivityStatus(id, newStatus as any)
  }

  const handleDelete = async (id: string) => {
    await activityService.deleteActivity(id)
    setActivities((prev) => prev.filter((a) => a.id !== id))
    showToast.success('Activity removed')
  }

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Daily Activities</span>
              <span>📝</span>
            </h1>
            <p className="text-xs text-surface-500">Track classes, study hours & daily tasks</p>
          </div>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all"
          >
            <Plus size={16} />
            <span>Add Activity</span>
          </button>
        </div>

        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-10 text-surface-400 text-xs">
              No activities added today. Tap "+ Add Activity" above!
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-50/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(act.id, act.status)}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-lg border transition-all',
                        act.status === 'completed'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-surface-300 dark:border-surface-600 text-transparent'
                      )}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <div>
                      <p
                        className={cn(
                          'text-sm font-bold text-surface-900 dark:text-white',
                          act.status === 'completed' && 'line-through text-surface-400'
                        )}
                      >
                        {act.title}
                      </p>
                      <p className="text-xs text-surface-400 capitalize">
                        {act.category} {act.start_time ? `• ${act.start_time}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingActivity(act)}
                      className="p-1.5 rounded-xl text-surface-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                      title="Edit Activity"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(act.id)}
                      className="p-1.5 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Delete Activity"
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
        initialTab="activity"
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={loadData}
      />

      <EditActivityModal
        activity={editingActivity}
        isOpen={Boolean(editingActivity)}
        onClose={() => setEditingActivity(null)}
        onSuccess={loadData}
      />
    </AppLayout>
  )
}
