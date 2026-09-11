import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from '@/components/ui/AppLayout'
import { QuickAddModal } from '@/components/ui/QuickAddModal'
import { EditGoalModal } from '@/components/ui/EditGoalModal'
import { goalService, subscribeToRealtime } from '@/services/dbServices'
import type { Goal } from '@/types'
import { Plus, Target, Trash2, CheckCircle2, Pencil } from 'lucide-react'
import { showToast } from '@/components/ui/Toast'

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const loadData = useCallback(async () => {
    try {
      const data = await goalService.getGoals()
      setGoals(data)
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

  const handleGoalProgress = async (goal: Goal, delta: number) => {
    const newVal = Math.min(goal.target, Math.max(0, goal.current_value + delta))
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goal.id
          ? { ...g, current_value: newVal, completed: newVal >= g.target }
          : g
      )
    )
    await goalService.updateProgress(goal.id, newVal)
  }

  const handleDelete = async (id: string) => {
    await goalService.deleteGoal(id)
    setGoals((prev) => prev.filter((g) => g.id !== id))
    showToast.success('Goal deleted')
  }

  return (
    <AppLayout onRefreshData={loadData}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
              <span>Goals & Targets</span>
              <span>🎯</span>
            </h1>
            <p className="text-xs text-surface-500">Track and achieve academic & personal goals</p>
          </div>
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Add Goal</span>
          </button>
        </div>

        <div className="rounded-3xl bg-white dark:bg-surface-900 border border-surface-200/80 dark:border-surface-800 p-5 shadow-sm space-y-4">
          {goals.length === 0 ? (
            <div className="text-center py-10 text-surface-400 text-xs">
              No goals set yet. Tap "+ Add Goal" above!
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const percent = Math.min(
                  100,
                  Math.round((goal.current_value / goal.target) * 100)
                )
                return (
                  <div
                    key={goal.id}
                    className="p-4 rounded-2xl bg-surface-50/50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {goal.completed ? (
                          <CheckCircle2 className="text-emerald-500" size={18} />
                        ) : (
                          <Target className="text-purple-500" size={18} />
                        )}
                        <h4 className="font-bold text-base text-surface-900 dark:text-white">
                          {goal.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-purple-600 dark:text-purple-400 mr-1">
                          {percent}%
                        </span>
                        <button
                          onClick={() => setEditingGoal(goal)}
                          className="p-1.5 rounded-xl text-surface-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                          title="Edit Goal"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(goal.id)}
                          className="p-1.5 rounded-xl text-surface-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Goal"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-3 w-full bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-surface-500 font-medium">
                        Progress: {goal.current_value} / {goal.target}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleGoalProgress(goal, 10)}
                          className="px-2.5 py-1 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 transition-all cursor-pointer"
                        >
                          +10
                        </button>
                        <button
                          onClick={() => handleGoalProgress(goal, 25)}
                          className="px-2.5 py-1 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-all cursor-pointer"
                        >
                          +25
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        initialTab="goal"
        onClose={() => setIsQuickAddOpen(false)}
        onSuccess={loadData}
      />

      <EditGoalModal
        goal={editingGoal}
        isOpen={Boolean(editingGoal)}
        onClose={() => setEditingGoal(null)}
        onSuccess={loadData}
      />
    </AppLayout>
  )
}
