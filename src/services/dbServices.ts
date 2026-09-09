import { supabase } from './supabase'
import type {
  Attendance,
  AttendanceStatus,
  Reminder,
  Priority,
  RepeatType,
  Activity,
  ActivityStatus,
  ActivityCategory,
  Transaction,
  TransactionType,
  PaymentMethod,
  Goal,
  Habit,
  HabitLog,
  Note,
  Person,
} from '@/types'

// Helper for local storage backup when offline / initial demo
const STORAGE_KEYS = {
  attendance: 'ht_attendance',
  reminders: 'ht_reminders',
  activities: 'ht_activities',
  transactions: 'ht_transactions',
  goals: 'ht_goals',
  habits: 'ht_habits',
  habitLogs: 'ht_habit_logs',
  notes: 'ht_notes',
  appStartDate: 'ht_app_start_date',
}

function getLocal<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function setLocal<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch (e) {
    console.error('Failed to save to localStorage', e)
  }
}

const getTodayStr = () => new Date().toISOString().split('T')[0]

export function getAppStartDate(): string {
  try {
    let start = localStorage.getItem(STORAGE_KEYS.appStartDate)
    if (!start) {
      start = getTodayStr()
      localStorage.setItem(STORAGE_KEYS.appStartDate, start)
    }
    return start
  } catch {
    return getTodayStr()
  }
}

export interface AttendanceWindowInfo {
  isOpen: boolean
  isBeforeWindow: boolean
  isAfterWindow: boolean
  statusMessage: string
  serverTimeStr: string
}

export function checkAttendanceWindow(dateObj: Date = new Date()): AttendanceWindowInfo {
  const hours = dateObj.getHours()
  const minutes = dateObj.getMinutes()
  const currentTotalMinutes = hours * 60 + minutes

  const openMinutes = 21 * 60 // 9:00 PM
  const closeMinutes = 22 * 60 + 30 // 10:30 PM

  const serverTimeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (currentTotalMinutes < openMinutes) {
    return {
      isOpen: false,
      isBeforeWindow: true,
      isAfterWindow: false,
      statusMessage: 'Attendance opens at 9:00 PM',
      serverTimeStr,
    }
  }

  if (currentTotalMinutes >= closeMinutes) {
    return {
      isOpen: false,
      isBeforeWindow: false,
      isAfterWindow: true,
      statusMessage: "Today's attendance window closed at 10:30 PM",
      serverTimeStr,
    }
  }

  return {
    isOpen: true,
    isBeforeWindow: false,
    isAfterWindow: false,
    statusMessage: 'Attendance Window Open (9:00 PM → 10:30 PM)',
    serverTimeStr,
  }
}

// =====================================
// ATTENDANCE SERVICE
// =====================================
export const attendanceService = {
  async getTodayAttendance(): Promise<Attendance | null> {
    const today = getTodayStr()
    const windowInfo = checkAttendanceWindow()

    let record: Attendance | null = null

    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('attendance_date', today)
        .maybeSingle()

      if (!error && data) record = data as Attendance
    } catch {
      // Fallback
    }

    if (!record) {
      const local = getLocal<Attendance>(STORAGE_KEYS.attendance)
      record = local.find((a) => a.attendance_date === today) || null
    }

    // Auto-mark ABSENT after 10:30 PM if not marked yet
    if (!record && windowInfo.isAfterWindow) {
      record = await this.markAttendance('absent', 'Attendance window expired')
    }

    return record
  },

  async markAttendance(status: AttendanceStatus, reason?: string): Promise<Attendance> {
    const today = getTodayStr()
    const now = new Date().toISOString()
    const windowInfo = checkAttendanceWindow()

    // Enforce 9:00 PM - 10:30 PM rule for PRESENT and LATE
    if ((status === 'present' || status === 'late') && !windowInfo.isOpen) {
      if (windowInfo.isAfterWindow) {
        // Auto-mark absent when trying to mark present after 10:30 PM
        await this.markAttendance('absent', 'Attendance window expired')
        throw new Error(
          "❌ Attendance Closed\nToday's attendance window closed at 10:30 PM. You have been automatically marked ABSENT."
        )
      } else if (windowInfo.isBeforeWindow) {
        throw new Error("⏳ Attendance Closed\nAttendance window opens at 9:00 PM.")
      }
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('attendance')
          .upsert(
            {
              user_id: userData.user.id,
              attendance_date: today,
              check_in: now,
              status,
              source: 'manual',
              reason: reason || null,
            },
            { onConflict: 'user_id,attendance_date' }
          )
          .select()
          .single()

        if (!error && data) {
          return data as Attendance
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Attendance Closed')) {
        throw err
      }
    }

    // Local fallback
    const local = getLocal<Attendance>(STORAGE_KEYS.attendance)
    const existingIdx = local.findIndex((a) => a.attendance_date === today)
    const item: Attendance = {
      id: existingIdx >= 0 ? local[existingIdx].id : crypto.randomUUID(),
      user_id: 'local-user',
      attendance_date: today,
      check_in: now,
      check_out: existingIdx >= 0 ? local[existingIdx].check_out : null,
      status,
      source: 'manual',
      reason: reason || null,
      created_at: now,
    }

    if (existingIdx >= 0) local[existingIdx] = item
    else local.push(item)
    setLocal(STORAGE_KEYS.attendance, local)
    return item
  },

  async checkOut(): Promise<Attendance | null> {
    const today = getTodayStr()
    const now = new Date().toISOString()

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('attendance')
          .update({ check_out: now })
          .eq('attendance_date', today)
          .select()
          .single()

        if (!error && data) return data as Attendance
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Attendance>(STORAGE_KEYS.attendance)
    const existingIdx = local.findIndex((a) => a.attendance_date === today)
    if (existingIdx >= 0) {
      local[existingIdx].check_out = now
      setLocal(STORAGE_KEYS.attendance, local)
      return local[existingIdx]
    }
    return null
  },

  async resetAttendanceFresh(): Promise<void> {
    const today = getTodayStr()
    try {
      localStorage.setItem(STORAGE_KEYS.appStartDate, today)
      localStorage.removeItem(STORAGE_KEYS.attendance)
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        await supabase.from('attendance').delete().eq('user_id', userData.user.id)
      }
    } catch (e) {
      console.error('Failed to reset attendance', e)
    }
  },

  async getAllAttendance(daysCount: number = 30): Promise<Attendance[]> {
    let existingRecords: Attendance[] = []
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('attendance_date', { ascending: false })

      if (!error && data) {
        existingRecords = data as Attendance[]
      }
    } catch {
      // Fallback
    }

    if (existingRecords.length === 0) {
      existingRecords = getLocal<Attendance>(STORAGE_KEYS.attendance)
    }

    const recordMap = new Map<string, Attendance>()
    existingRecords.forEach((r) => recordMap.set(r.attendance_date, r))

    const todayObj = new Date()
    const todayStr = todayObj.toISOString().split('T')[0]
    const result: Attendance[] = []
    const windowInfo = checkAttendanceWindow()

    const appStartStr = getAppStartDate()
    let appStartDateObj = new Date(appStartStr)
    if (isNaN(appStartDateObj.getTime())) {
      appStartDateObj = new Date(todayStr)
    }

    // Determine earliest date based on appStartDate and daysCount filter
    let earliestDate = appStartDateObj
    const daysLimitObj = new Date(todayObj)
    daysLimitObj.setDate(todayObj.getDate() - (daysCount - 1))

    if (daysLimitObj > earliestDate) {
      earliestDate = daysLimitObj
    }

    // If explicit records exist prior to earliestDate, adjust to earliest recorded date
    if (existingRecords.length > 0) {
      const dates = existingRecords.map((r) => r.attendance_date).sort()
      if (dates[0]) {
        const firstRecorded = new Date(dates[0])
        if (!isNaN(firstRecorded.getTime()) && firstRecorded < earliestDate) {
          earliestDate = firstRecorded
        }
      }
    }

    const curr = new Date(todayObj)
    // Avoid infinite loop safeguard
    let safetyCounter = 0
    while (curr >= earliestDate && safetyCounter < 365) {
      safetyCounter++
      const dateStr = curr.toISOString().split('T')[0]
      const existing = recordMap.get(dateStr)

      if (existing) {
        // If an existing record was saved with status 'pending' but its date is BEFORE today, force it to 'absent'!
        const isPastDate = dateStr < todayStr
        if (isPastDate && (existing.status as string) === 'pending') {
          result.push({
            ...existing,
            status: 'absent',
            reason: existing.reason || 'Auto-Absent (No response in 9:00 PM - 10:30 PM window)',
          })
        } else {
          result.push(existing)
        }
      } else {
        const isToday = dateStr === todayStr
        let status: AttendanceStatus = 'absent'
        let reason: string | null = 'Auto-Absent (No response in 9:00 PM - 10:30 PM window)'

        if (isToday) {
          status = windowInfo.isAfterWindow ? 'absent' : 'pending'
          if (status === 'pending') reason = null
        }

        result.push({
          id: `synth-${dateStr}`,
          user_id: 'user',
          attendance_date: dateStr,
          check_in: null,
          check_out: null,
          status,
          source: 'manual',
          reason,
          created_at: dateStr,
        })
      }

      curr.setDate(curr.getDate() - 1)
    }

    return result
  },
}

// =====================================
// REMINDERS SERVICE
// =====================================
export const reminderService = {
  async getTodayReminders(): Promise<Reminder[]> {
    const today = getTodayStr()
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .or(`reminder_date.eq.${today},repeat_type.eq.daily`)
        .order('reminder_time', { ascending: true })

      if (!error && data && data.length > 0) return data as Reminder[]
    } catch {
      // Fallback
    }

    const local = getLocal<Reminder>(STORAGE_KEYS.reminders)
    return local.filter((r) => r.reminder_date === today || r.repeat_type === 'daily')
  },

  async getAllReminders(): Promise<Reminder[]> {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('reminder_date', { ascending: true })

      if (!error && data) return data as Reminder[]
    } catch {
      // Fallback
    }
    return getLocal<Reminder>(STORAGE_KEYS.reminders)
  },

  async createReminder(payload: {
    title: string
    description?: string
    reminder_date?: string
    reminder_time?: string
    repeat_type?: RepeatType
    priority?: Priority
  }): Promise<Reminder> {
    const today = getTodayStr()
    const itemData = {
      title: payload.title,
      description: payload.description || null,
      reminder_date: payload.reminder_date || today,
      reminder_time: payload.reminder_time || '09:00',
      repeat_type: payload.repeat_type || 'once',
      priority: payload.priority || 'medium',
      completed: false,
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('reminders')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) return data as Reminder
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Reminder>(STORAGE_KEYS.reminders)
    const item: Reminder = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(item)
    setLocal(STORAGE_KEYS.reminders, local)
    return item
  },

  async toggleReminder(id: string, completed: boolean): Promise<void> {
    try {
      await supabase.from('reminders').update({ completed }).eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Reminder>(STORAGE_KEYS.reminders)
    const idx = local.findIndex((r) => r.id === id)
    if (idx >= 0) {
      local[idx].completed = completed
      setLocal(STORAGE_KEYS.reminders, local)
    }
  },

  async deleteReminder(id: string): Promise<void> {
    try {
      await supabase.from('reminders').delete().eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Reminder>(STORAGE_KEYS.reminders)
    setLocal(
      STORAGE_KEYS.reminders,
      local.filter((r) => r.id !== id)
    )
  },
}

// =====================================
// ACTIVITIES SERVICE
// =====================================
export const activityService = {
  async getTodayActivities(): Promise<Activity[]> {
    const today = getTodayStr()
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('activity_date', today)
        .order('created_at', { ascending: false })

      if (!error && data) return data as Activity[]
    } catch {
      // Fallback
    }

    const local = getLocal<Activity>(STORAGE_KEYS.activities)
    return local.filter((a) => a.activity_date === today)
  },

  async createActivity(payload: {
    title: string
    description?: string
    category?: ActivityCategory
    start_time?: string
    end_time?: string
    status?: ActivityStatus
    activity_date?: string
  }): Promise<Activity> {
    const today = getTodayStr()
    const itemData = {
      title: payload.title,
      description: payload.description || null,
      category: payload.category || 'personal',
      activity_date: payload.activity_date || today,
      start_time: payload.start_time || null,
      end_time: payload.end_time || null,
      status: payload.status || 'pending',
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('activities')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) return data as Activity
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Activity>(STORAGE_KEYS.activities)
    const item: Activity = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(item)
    setLocal(STORAGE_KEYS.activities, local)
    return item
  },

  async updateActivityStatus(id: string, status: ActivityStatus): Promise<void> {
    try {
      await supabase.from('activities').update({ status }).eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Activity>(STORAGE_KEYS.activities)
    const idx = local.findIndex((a) => a.id === id)
    if (idx >= 0) {
      local[idx].status = status
      setLocal(STORAGE_KEYS.activities, local)
    }
  },

  async deleteActivity(id: string): Promise<void> {
    try {
      await supabase.from('activities').delete().eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Activity>(STORAGE_KEYS.activities)
    setLocal(
      STORAGE_KEYS.activities,
      local.filter((a) => a.id !== id)
    )
  },
}

// =====================================
// PEOPLE SERVICE (DEBT TRACKER)
// =====================================
export const peopleService = {
  async getPeople(): Promise<Person[]> {
    try {
      const { data, error } = await supabase.from('people').select('*').order('name', { ascending: true })
      if (!error && data && data.length > 0) return data as Person[]
    } catch {
      // Fallback
    }

    const local = getLocal<Person>('ht_people')
    if (local.length === 0) {
      const defaultPeople: Person[] = [
        { id: 'p1', user_id: 'local-user', name: 'Ravi', phone: '9876543210', notes: 'Hostel roommate', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'p2', user_id: 'local-user', name: 'Suresh', phone: '9876543211', notes: 'Classmate', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'p3', user_id: 'local-user', name: 'Rahul', phone: '9876543212', notes: 'Canteen / Mess', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]
      setLocal('ht_people', defaultPeople)
      return defaultPeople
    }
    return local
  },

  async createPerson(name: string, phone?: string, notes?: string): Promise<Person> {
    const itemData = {
      name,
      phone: phone || null,
      notes: notes || null,
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('people')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) return data as Person
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Person>('ht_people')
    const item: Person = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.push(item)
    setLocal('ht_people', local)
    return item
  },
}

// =====================================
// TRANSACTIONS SERVICE (MONEY)
// =====================================
export const transactionService = {
  async getTodayTransactions(): Promise<Transaction[]> {
    const today = getTodayStr()
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, person:people(*)')
        .eq('transaction_date', today)
        .order('created_at', { ascending: false })

      if (!error && data) return data as Transaction[]
    } catch {
      // Fallback
    }

    const local = getLocal<Transaction>(STORAGE_KEYS.transactions)
    return local.filter((t) => t.transaction_date === today)
  },

  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, person:people(*)')
        .order('transaction_date', { ascending: false })

      if (!error && data) return data as Transaction[]
    } catch {
      // Fallback
    }
    return getLocal<Transaction>(STORAGE_KEYS.transactions)
  },

  async createTransaction(payload: {
    type: TransactionType
    amount: number
    category?: string
    description?: string
    payment_method?: PaymentMethod
    person_id?: string
    person_name?: string
    expected_return_date?: string
    purpose?: string
    transaction_date?: string
  }): Promise<Transaction> {
    const today = getTodayStr()
    const itemData = {
      type: payload.type,
      amount: payload.amount,
      category: payload.category || (payload.type === 'expense' ? 'Other' : 'N/A'),
      description: payload.description || null,
      payment_method: payload.payment_method || 'upi',
      person_id: payload.person_id || null,
      person_name: payload.person_name || null,
      expected_return_date: payload.expected_return_date || null,
      purpose: payload.purpose || null,
      transaction_date: payload.transaction_date || today,
      status: 'completed' as const,
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('transactions')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select('*, person:people(*)')
          .single()

        if (!error && data) return data as Transaction
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Transaction>(STORAGE_KEYS.transactions)
    const item: Transaction = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(item)
    setLocal(STORAGE_KEYS.transactions, local)
    return item
  },

  async deleteTransaction(id: string): Promise<void> {
    try {
      await supabase.from('transactions').delete().eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Transaction>(STORAGE_KEYS.transactions)
    setLocal(
      STORAGE_KEYS.transactions,
      local.filter((t) => t.id !== id)
    )
  },
}

// =====================================
// GOALS SERVICE
// =====================================
export const goalService = {
  async getGoals(): Promise<Goal[]> {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) return data as Goal[]
    } catch {
      // Fallback
    }

    const local = getLocal<Goal>(STORAGE_KEYS.goals)
    if (local.length === 0) {
      // Provide default starting goal for nice initial UX
      const defaultGoal: Goal = {
        id: 'default-goal-1',
        user_id: 'local-user',
        title: 'Study 2 hours daily',
        description: 'Prepare for exams',
        target: 100,
        current_value: 65,
        deadline: null,
        priority: 'high',
        completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setLocal(STORAGE_KEYS.goals, [defaultGoal])
      return [defaultGoal]
    }
    return local
  },

  async createGoal(payload: {
    title: string
    description?: string
    target: number
    current_value?: number
    deadline?: string
    priority?: Priority
  }): Promise<Goal> {
    const itemData = {
      title: payload.title,
      description: payload.description || null,
      target: payload.target || 100,
      current_value: payload.current_value || 0,
      deadline: payload.deadline || null,
      priority: payload.priority || 'medium',
      completed: (payload.current_value || 0) >= (payload.target || 100),
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('goals')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) return data as Goal
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Goal>(STORAGE_KEYS.goals)
    const item: Goal = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(item)
    setLocal(STORAGE_KEYS.goals, local)
    return item
  },

  async updateProgress(id: string, currentValue: number): Promise<Goal | null> {
    try {
      const { data: existing } = await supabase.from('goals').select('target').eq('id', id).single()
      const target = existing?.target || 100
      const completed = currentValue >= target

      const { data, error } = await supabase
        .from('goals')
        .update({ current_value: currentValue, completed })
        .eq('id', id)
        .select()
        .single()

      if (!error && data) return data as Goal
    } catch {
      // Fallback
    }

    const local = getLocal<Goal>(STORAGE_KEYS.goals)
    const idx = local.findIndex((g) => g.id === id)
    if (idx >= 0) {
      local[idx].current_value = currentValue
      local[idx].completed = currentValue >= local[idx].target
      setLocal(STORAGE_KEYS.goals, local)
      return local[idx]
    }
    return null
  },

  async deleteGoal(id: string): Promise<void> {
    try {
      await supabase.from('goals').delete().eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Goal>(STORAGE_KEYS.goals)
    setLocal(
      STORAGE_KEYS.goals,
      local.filter((g) => g.id !== id)
    )
  },
}

// =====================================
// HABITS SERVICE
// =====================================
export const habitService = {
  async getHabitsWithTodayLog(): Promise<Array<Habit & { todayCompleted: boolean; logId?: string }>> {
    const today = getTodayStr()
    try {
      const { data: habits, error: habitsErr } = await supabase.from('habits').select('*')
      const { data: logs } = await supabase.from('habit_logs').select('*').eq('log_date', today)

      if (!habitsErr && habits) {
        return habits.map((h) => {
          const log = logs?.find((l) => l.habit_id === h.id)
          return {
            ...h,
            todayCompleted: log?.completed || false,
            logId: log?.id,
          }
        })
      }
    } catch {
      // Fallback
    }

    const localHabits = getLocal<Habit>(STORAGE_KEYS.habits)
    const localLogs = getLocal<HabitLog>(STORAGE_KEYS.habitLogs)

    if (localHabits.length === 0) {
      // Default starting habits
      const defaultHabits: Habit[] = [
        { id: 'habit-1', user_id: 'local-user', name: 'Drink 2L Water', description: 'Stay hydrated', frequency: 'daily', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'habit-2', user_id: 'local-user', name: 'Biometric Attendance', description: 'At hostel reception', frequency: 'daily', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
        { id: 'habit-3', user_id: 'local-user', name: 'Exercise 30 mins', description: 'Gym or jog', frequency: 'daily', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ]
      setLocal(STORAGE_KEYS.habits, defaultHabits)
      return defaultHabits.map((h) => ({ ...h, todayCompleted: false }))
    }

    return localHabits.map((h) => {
      const log = localLogs.find((l) => l.habit_id === h.id && l.log_date === today)
      return {
        ...h,
        todayCompleted: log?.completed || false,
        logId: log?.id,
      }
    })
  },

  async toggleHabitToday(habitId: string, completed: boolean): Promise<void> {
    const today = getTodayStr()
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        await supabase.from('habit_logs').upsert(
          {
            habit_id: habitId,
            user_id: userData.user.id,
            log_date: today,
            completed,
          },
          { onConflict: 'habit_id,log_date' }
        )
      }
    } catch {
      // Fallback
    }

    const localLogs = getLocal<HabitLog>(STORAGE_KEYS.habitLogs)
    const idx = localLogs.findIndex((l) => l.habit_id === habitId && l.log_date === today)
    if (idx >= 0) {
      localLogs[idx].completed = completed
    } else {
      localLogs.push({
        id: crypto.randomUUID(),
        habit_id: habitId,
        user_id: 'local-user',
        log_date: today,
        completed,
        created_at: new Date().toISOString(),
      })
    }
    setLocal(STORAGE_KEYS.habitLogs, localLogs)
  },

  async createHabit(name: string, description?: string): Promise<Habit> {
    const itemData = {
      name,
      description: description || null,
      frequency: 'daily' as const,
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('habits')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) return data as Habit
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Habit>(STORAGE_KEYS.habits)
    const item: Habit = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.push(item)
    setLocal(STORAGE_KEYS.habits, local)
    return item
  },
}

// =====================================
// NOTES SERVICE
// =====================================
export const noteService = {
  async getNotes(): Promise<Note[]> {
    try {
      const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
      if (!error && data) return data as Note[]
    } catch {
      // Fallback
    }
    return getLocal<Note>(STORAGE_KEYS.notes)
  },

  async createNote(title: string, content: string, tags?: string[]): Promise<Note> {
    const itemData = {
      title,
      content,
      tags: tags || [],
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('notes')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) return data as Note
      }
    } catch {
      // Fallback
    }

    const local = getLocal<Note>(STORAGE_KEYS.notes)
    const item: Note = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(item)
    setLocal(STORAGE_KEYS.notes, local)
    return item
  },

  async deleteNote(id: string): Promise<void> {
    try {
      await supabase.from('notes').delete().eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Note>(STORAGE_KEYS.notes)
    setLocal(
      STORAGE_KEYS.notes,
      local.filter((n) => n.id !== id)
    )
  },
}
