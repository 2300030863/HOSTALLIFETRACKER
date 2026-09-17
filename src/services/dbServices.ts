import { supabase, isSupabaseConfigured } from './supabase'
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
  TransactionStatus,
  PaymentMethod,
  Goal,
  Habit,
  HabitLog,
  Note,
  Person,
  AppNotification,
  NotificationType,
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

export const getTodayStr = (d = new Date()) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function getAppStartDate(): Promise<string> {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.created_at) {
      const createdDateStr = userData.user.created_at.split('T')[0]
      localStorage.setItem(STORAGE_KEYS.appStartDate, createdDateStr)
      return createdDateStr
    }
  } catch {
    // Fallback if offline
  }

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
  const closeMinutes = 23 * 60 // 11:00 PM

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
      statusMessage: "Today's attendance window closed at 11:00 PM",
      serverTimeStr,
    }
  }

  return {
    isOpen: true,
    isBeforeWindow: false,
    isAfterWindow: false,
    statusMessage: 'Attendance Window Open (9:00 PM ? 11:00 PM)',
    serverTimeStr,
  }
}

// =====================================
// ATTENDANCE SERVICE
// =====================================
export const attendanceService = {
  async hasTodayAttendanceInDb(): Promise<boolean> {
    const today = getTodayStr()
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        const { data, error } = await supabase
          .from('attendance')
          .select('id, status')
          .eq('user_id', userData.user.id)
          .eq('attendance_date', today)
          .maybeSingle()

        if (!error && data) {
          return true
        }
        return false
      }
    } catch {
      // Fallback if offline
    }

    const local = getLocal<Attendance>(STORAGE_KEYS.attendance)
    return local.some((a) => a.attendance_date === today)
  },

  async getTodayAttendance(): Promise<Attendance | null> {
    const today = getTodayStr()
    const windowInfo = checkAttendanceWindow()

    let record: Attendance | null = null

    try {
      const { data: userData } = await supabase.auth.getUser()
      let query = supabase.from('attendance').select('*').eq('attendance_date', today)
      if (userData?.user) {
        query = query.eq('user_id', userData.user.id)
      }
      const { data, error } = await query.maybeSingle()

      if (!error && data) record = data as Attendance
    } catch {
      // Fallback
    }

    const local = getLocal<Attendance>(STORAGE_KEYS.attendance)
    const localRecord = local.find((a) => a.attendance_date === today) || null

    if (localRecord) {
      // If no DB record exists OR if local status differs from DB (e.g. user edited to Present but DB trigger rejected it), prefer localRecord
      if (!record || localRecord.status !== record.status) {
        record = localRecord
      }
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

    // Clear old absent reason if changing status to present or late without an explicit new reason
    const finalReason = (status === 'present' || status === 'late') ? (reason || null) : (reason || null)

    // Window info check (logs notice if outside 9:00 PM - 10:30 PM window, but allows manual submission)
    let autoReason = finalReason
    if (!windowInfo.isOpen && !autoReason) {
      if (windowInfo.isBeforeWindow) {
        autoReason = 'Submitted before window (Manual Present)'
      } else if (windowInfo.isAfterWindow) {
        autoReason = 'Submitted after window (Manual Present)'
      }
    }

    let savedDbRecord: Attendance | null = null

    if (isSupabaseConfigured) {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        const userId = userData.user.id

        // Check if attendance row already exists for today
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('user_id', userId)
          .eq('attendance_date', today)
          .maybeSingle()

        let dbData: any = null
        let dbError: any = null

        if (existing?.id) {
          const res = await supabase
            .from('attendance')
            .update({
              check_in: now,
              status,
              source: 'manual',
              reason: autoReason,
            })
            .eq('id', existing.id)
            .select()
            .single()

          dbData = res.data
          dbError = res.error
        } else {
          const res = await supabase
            .from('attendance')
            .insert({
              user_id: userId,
              attendance_date: today,
              check_in: now,
              status,
              source: 'manual',
              reason: autoReason,
            })
            .select()
            .single()

          dbData = res.data
          dbError = res.error
        }

        if (dbError) {
          console.error('Supabase markAttendance DB Error:', dbError)
          throw new Error(`Database error: ${dbError.message || 'Failed to save attendance in Supabase.'}`)
        }

        if (dbData) {
          savedDbRecord = dbData as Attendance
        }
      }
    }

    // Always keep local storage updated as well
    const local = getLocal<Attendance>(STORAGE_KEYS.attendance)
    const existingIdx = local.findIndex((a) => a.attendance_date === today)
    const item: Attendance = savedDbRecord || {
      id: existingIdx >= 0 ? local[existingIdx].id : crypto.randomUUID(),
      user_id: 'local-user',
      attendance_date: today,
      check_in: now,
      check_out: existingIdx >= 0 ? local[existingIdx].check_out : null,
      status,
      source: 'manual',
      reason: autoReason,
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
      if (userData?.user) {
        const { data, error } = await supabase
          .from('attendance')
          .update({ check_out: now })
          .eq('user_id', userData.user.id)
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
      if (userData?.user) {
        await supabase.from('attendance').delete().eq('user_id', userData.user.id)
      }
    } catch (e) {
      console.error('Failed to reset attendance', e)
    }
  },

  async getAllAttendance(daysCount: number = 30): Promise<Attendance[]> {
    let existingRecords: Attendance[] = []
    try {
      const { data: userData } = await supabase.auth.getUser()
      let query = supabase.from('attendance').select('*')
      if (userData?.user) {
        query = query.eq('user_id', userData.user.id)
      }
      const { data, error } = await query.order('attendance_date', { ascending: false })

      if (!error && data !== null) {
        existingRecords = data as Attendance[]
      }
    } catch (err) {
      console.error('Failed to query Supabase attendance:', err)
      existingRecords = getLocal<Attendance>(STORAGE_KEYS.attendance)
    }

    const recordMap = new Map<string, Attendance>()
    existingRecords.forEach((r) => recordMap.set(r.attendance_date, r))

    // Merge local storage attendance (gives priority to local user edits)
    const localRecords = getLocal<Attendance>(STORAGE_KEYS.attendance)
    localRecords.forEach((lr) => {
      const dbRec = recordMap.get(lr.attendance_date)
      if (!dbRec || lr.status !== dbRec.status) {
        recordMap.set(lr.attendance_date, lr)
      }
    })

    const todayObj = new Date()
    const todayStr = getTodayStr(todayObj)
    const windowInfo = checkAttendanceWindow()
    const result: Attendance[] = []

    // Calculate earliest date for the requested daysCount timeframe
    const earliestDate = new Date(todayObj)
    earliestDate.setDate(todayObj.getDate() - (daysCount - 1))

    // If explicit database records exist prior to earliestDate, adjust to include them
    if (existingRecords.length > 0) {
      const dates = existingRecords.map((r) => r.attendance_date).sort()
      if (dates[0]) {
        const firstRecorded = new Date(dates[0])
        if (!isNaN(firstRecorded.getTime()) && firstRecorded < earliestDate) {
          earliestDate.setTime(firstRecorded.getTime())
        }
      }
    }

    const curr = new Date(todayObj)
    let safetyCounter = 0
    while (curr >= earliestDate && safetyCounter < 366) {
      safetyCounter++
      const dateStr = getTodayStr(curr)
      const existing = recordMap.get(dateStr)

      if (existing) {
        // If past date was stored as pending, update status to present
        const isPastDate = dateStr < todayStr
        if (isPastDate && (existing.status as string) === 'pending') {
          result.push({
            ...existing,
            status: 'present',
            reason: null,
          })
        } else {
          result.push(existing)
        }
      } else {
        const isToday = dateStr === todayStr
        if (isToday) {
          const status: AttendanceStatus = windowInfo.isAfterWindow ? 'absent' : 'pending'
          const reason = windowInfo.isAfterWindow ? 'Attendance window expired' : null
          result.push({
            id: `today-${dateStr}`,
            user_id: 'user',
            attendance_date: dateStr,
            check_in: null,
            check_out: null,
            status,
            source: 'manual',
            reason,
            created_at: dateStr,
          })
        } else {
          // Past unsubmitted day -> Default to Present
          result.push({
            id: `synth-${dateStr}`,
            user_id: 'user',
            attendance_date: dateStr,
            check_in: null,
            check_out: null,
            status: 'present',
            source: 'manual',
            reason: null,
            created_at: dateStr,
          })
        }
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

      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.reminders, data as Reminder[])
        return data as Reminder[]
      }
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

      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.reminders, data as Reminder[])
        return data as Reminder[]
      }
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

    // Always save to localStorage first to guarantee instant persistence
    const local = getLocal<Reminder>(STORAGE_KEYS.reminders)
    const localItem: Reminder = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(localItem)
    setLocal(STORAGE_KEYS.reminders, local)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('reminders')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) {
          const updatedLocal = local.map((r) => (r.id === localItem.id ? (data as Reminder) : r))
          setLocal(STORAGE_KEYS.reminders, updatedLocal)
          return data as Reminder
        }
      }
    } catch (err) {
      console.warn('Supabase createReminder exception:', err)
    }

    return localItem
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

  async updateReminder(id: string, payload: Partial<Reminder>): Promise<void> {
    try {
      await supabase.from('reminders').update(payload).eq('id', id)
    } catch (e) {
      console.warn('Supabase updateReminder error:', e)
    }
    const local = getLocal<Reminder>(STORAGE_KEYS.reminders)
    const idx = local.findIndex((r) => r.id === id)
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_at: new Date().toISOString() }
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

      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.activities, data as Activity[])
        return data as Activity[]
      }
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

    // Save locally first
    const local = getLocal<Activity>(STORAGE_KEYS.activities)
    const localItem: Activity = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(localItem)
    setLocal(STORAGE_KEYS.activities, local)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('activities')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) {
          const updatedLocal = local.map((a) => (a.id === localItem.id ? (data as Activity) : a))
          setLocal(STORAGE_KEYS.activities, updatedLocal)
          return data as Activity
        }
      }
    } catch (err) {
      console.warn('Supabase createActivity exception:', err)
    }

    return localItem
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

  async updateActivity(id: string, payload: Partial<Activity>): Promise<void> {
    try {
      await supabase.from('activities').update(payload).eq('id', id)
    } catch (e) {
      console.warn('Supabase updateActivity error:', e)
    }
    const local = getLocal<Activity>(STORAGE_KEYS.activities)
    const idx = local.findIndex((a) => a.id === id)
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_at: new Date().toISOString() }
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
      if (!error && data !== null) {
        setLocal('ht_people', data as Person[])
        return data as Person[]
      }
    } catch {
      // Fallback
    }

    if (isSupabaseConfigured) return []

    const local = getLocal<Person>('ht_people')
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

  async updatePerson(id: string, payload: Partial<Person>): Promise<void> {
    try {
      await supabase.from('people').update(payload).eq('id', id)
    } catch (e) {
      console.warn('Supabase updatePerson error:', e)
    }
    const local = getLocal<Person>('ht_people')
    const idx = local.findIndex((p) => p.id === id)
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_at: new Date().toISOString() }
      setLocal('ht_people', local)
    }
  },

  async deletePerson(id: string): Promise<void> {
    try {
      await supabase.from('people').delete().eq('id', id)
    } catch {
      // Fallback
    }
    const local = getLocal<Person>('ht_people')
    setLocal(
      'ht_people',
      local.filter((p) => p.id !== id)
    )
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

      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.transactions, data as Transaction[])
        return data as Transaction[]
      }
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

      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.transactions, data as Transaction[])
        return data as Transaction[]
      }
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
    status?: TransactionStatus
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
      status: payload.status || 'completed',
    }

    // Always save locally first
    const local = getLocal<Transaction>(STORAGE_KEYS.transactions)
    const localItem: Transaction = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(localItem)
    setLocal(STORAGE_KEYS.transactions, local)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('transactions')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select('*, person:people(*)')
          .single()

        if (!error && data) {
          const updatedLocal = local.map((t) => (t.id === localItem.id ? (data as Transaction) : t))
          setLocal(STORAGE_KEYS.transactions, updatedLocal)
          return data as Transaction
        }
      }
    } catch (err) {
      console.warn('Supabase createTransaction exception:', err)
    }

    return localItem
  },

  async updateTransaction(id: string, payload: Partial<Transaction>): Promise<void> {
    try {
      await supabase.from('transactions').update(payload).eq('id', id)
    } catch (e) {
      console.warn('Supabase updateTransaction error:', e)
    }
    const local = getLocal<Transaction>(STORAGE_KEYS.transactions)
    const idx = local.findIndex((t) => t.id === id)
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_at: new Date().toISOString() }
      setLocal(STORAGE_KEYS.transactions, local)
    }
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

      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.goals, data as Goal[])
        return data as Goal[]
      }
    } catch {
      // Fallback
    }

    if (isSupabaseConfigured) return []

    const local = getLocal<Goal>(STORAGE_KEYS.goals)
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

  async updateGoalDetails(id: string, payload: Partial<Goal>): Promise<void> {
    try {
      await supabase.from('goals').update(payload).eq('id', id)
    } catch (e) {
      console.warn('Supabase updateGoal error:', e)
    }
    const local = getLocal<Goal>(STORAGE_KEYS.goals)
    const idx = local.findIndex((g) => g.id === id)
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...payload, updated_at: new Date().toISOString() }
      setLocal(STORAGE_KEYS.goals, local)
    }
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

      if (!habitsErr && habits !== null) {
        setLocal(STORAGE_KEYS.habits, habits as Habit[])
        if (logs) setLocal(STORAGE_KEYS.habitLogs, logs as HabitLog[])
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

    if (isSupabaseConfigured) return []

    const localHabits = getLocal<Habit>(STORAGE_KEYS.habits)
    const localLogs = getLocal<HabitLog>(STORAGE_KEYS.habitLogs)
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
      if (!error && data !== null) {
        setLocal(STORAGE_KEYS.notes, data as Note[])
        return data as Note[]
      }
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

    // Save locally first
    const local = getLocal<Note>(STORAGE_KEYS.notes)
    const localItem: Note = {
      id: crypto.randomUUID(),
      user_id: 'local-user',
      ...itemData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    local.unshift(localItem)
    setLocal(STORAGE_KEYS.notes, local)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data, error } = await supabase
          .from('notes')
          .insert([{ ...itemData, user_id: userData.user.id }])
          .select()
          .single()

        if (!error && data) {
          const updatedLocal = local.map((n) => (n.id === localItem.id ? (data as Note) : n))
          setLocal(STORAGE_KEYS.notes, updatedLocal)
          return data as Note
        }
      }
    } catch (err) {
      console.warn('Supabase createNote exception:', err)
    }

    return localItem
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

// =====================================
// LOCAL DATA SYNC & CLEANUP HELPERS
// =====================================
export async function syncLocalDataToCloud(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !userId) return

  try {
    // 1. Sync People
    const localPeople = getLocal<Person>('ht_people').filter((p) => p.user_id === 'local-user' && !p.id.startsWith('p'))
    for (const p of localPeople) {
      await supabase.from('people').insert({
        user_id: userId,
        name: p.name,
        phone: p.phone || null,
        notes: p.notes || null,
      })
    }

    // 2. Sync Reminders
    const localReminders = getLocal<Reminder>(STORAGE_KEYS.reminders).filter((r) => r.user_id === 'local-user')
    for (const r of localReminders) {
      await supabase.from('reminders').insert({
        user_id: userId,
        title: r.title,
        description: r.description || null,
        reminder_date: r.reminder_date,
        reminder_time: r.reminder_time,
        repeat_type: r.repeat_type,
        priority: r.priority,
        completed: r.completed,
      })
    }

    // 3. Sync Activities
    const localActivities = getLocal<Activity>(STORAGE_KEYS.activities).filter((a) => a.user_id === 'local-user')
    for (const a of localActivities) {
      await supabase.from('activities').insert({
        user_id: userId,
        title: a.title,
        description: a.description || null,
        category: a.category,
        activity_date: a.activity_date,
        start_time: a.start_time || null,
        end_time: a.end_time || null,
        status: a.status,
      })
    }

    // 4. Sync Transactions
    const localTransactions = getLocal<Transaction>(STORAGE_KEYS.transactions).filter((t) => t.user_id === 'local-user')
    for (const t of localTransactions) {
      await supabase.from('transactions').insert({
        user_id: userId,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description || null,
        payment_method: t.payment_method,
        person_name: t.person_name || null,
        expected_return_date: t.expected_return_date || null,
        purpose: t.purpose || null,
        transaction_date: t.transaction_date,
        status: t.status,
      })
    }

    // 5. Sync Goals
    const localGoals = getLocal<Goal>(STORAGE_KEYS.goals).filter((g) => g.user_id === 'local-user' && g.id !== 'default-goal-1')
    for (const g of localGoals) {
      await supabase.from('goals').insert({
        user_id: userId,
        title: g.title,
        description: g.description || null,
        target: g.target,
        current_value: g.current_value,
        deadline: g.deadline || null,
        priority: g.priority,
        completed: g.completed,
      })
    }

    // 6. Sync Habits
    const localHabits = getLocal<Habit>(STORAGE_KEYS.habits).filter((h) => h.user_id === 'local-user' && !h.id.startsWith('habit-'))
    for (const h of localHabits) {
      await supabase.from('habits').insert({
        user_id: userId,
        name: h.name,
        description: h.description || null,
        frequency: h.frequency,
      })
    }

    // 7. Sync Notes
    const localNotes = getLocal<Note>(STORAGE_KEYS.notes).filter((n) => n.user_id === 'local-user')
    for (const n of localNotes) {
      await supabase.from('notes').insert({
        user_id: userId,
        title: n.title,
        content: n.content,
        tags: n.tags || [],
      })
    }

    // Clear un-synced local user items so local state stays clean
    clearLocalUserStorage()
  } catch (err) {
    console.warn('syncLocalDataToCloud error:', err)
  }
}

export function clearLocalUserStorage(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
    localStorage.removeItem('ht_people')
  } catch {
    // Ignore
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeToRealtime(onDataChange: (table?: string) => void): () => void {
  if (!isSupabaseConfigured) return () => {}

  try {
    const channelId = `realtime-db-${Math.random().toString(36).substring(2, 7)}`
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          // Ignore updates to profiles table to prevent Auth loop
          if (payload.table === 'profiles') return

          if (debounceTimer) clearTimeout(debounceTimer)
          debounceTimer = setTimeout(() => {
            onDataChange(payload.table)
          }, 1000)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime subscription error:', err)
    return () => {}
  }
}

// =====================================
// NOTIFICATION SERVICE
// =====================================
const OFFLINE_NOTIFICATION_QUEUE_KEY = 'ht_notification_queue'

interface OfflineNotification {
  type: NotificationType
  title: string
  message: string
  scheduled_at: string
  notification_key: string
}

function getOfflineQueue(): OfflineNotification[] {
  try {
    const data = localStorage.getItem(OFFLINE_NOTIFICATION_QUEUE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function setOfflineQueue(items: OfflineNotification[]): void {
  try {
    localStorage.setItem(OFFLINE_NOTIFICATION_QUEUE_KEY, JSON.stringify(items))
  } catch (e) {
    console.error('Failed to save notification queue to localStorage', e)
  }
}

export const notificationService = {
  /**
   * Create a notification record.
   * Online: inserts directly into Supabase (uses notification_key for dedup).
   * Offline: queues to localStorage for later sync.
   * Returns the created notification or null if duplicate/offline.
   */
  async createNotification(
    type: NotificationType,
    title: string,
    message: string,
    scheduledAt: string,
    notificationKey: string
  ): Promise<AppNotification | null> {
    // If offline, queue locally
    if (!navigator.onLine) {
      const queue = getOfflineQueue()
      // Prevent local duplicates
      if (!queue.some((n) => n.notification_key === notificationKey)) {
        queue.push({ type, title, message, scheduled_at: scheduledAt, notification_key: notificationKey })
        setOfflineQueue(queue)
      }
      return null
    }

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return null

      const { data, error } = await supabase
        .from('notifications')
        .upsert(
          {
            user_id: userData.user.id,
            type,
            title,
            message,
            scheduled_at: scheduledAt,
            notification_key: notificationKey,
            read: false,
          },
          { onConflict: 'user_id,notification_key', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle()

      if (error) {
        console.error('Failed to create notification:', error)
        // Queue offline as fallback
        const queue = getOfflineQueue()
        if (!queue.some((n) => n.notification_key === notificationKey)) {
          queue.push({ type, title, message, scheduled_at: scheduledAt, notification_key: notificationKey })
          setOfflineQueue(queue)
        }
        return null
      }

      return data as AppNotification | null
    } catch {
      // Network error — queue locally
      const queue = getOfflineQueue()
      if (!queue.some((n) => n.notification_key === notificationKey)) {
        queue.push({ type, title, message, scheduled_at: scheduledAt, notification_key: notificationKey })
        setOfflineQueue(queue)
      }
      return null
    }
  },

  /**
   * Fetch all unread notifications for the current user, ordered by scheduled_at desc.
   */
  async getUnreadNotifications(): Promise<AppNotification[]> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('read', false)
        .order('scheduled_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch unread notifications:', error)
        return []
      }

      return (data || []) as AppNotification[]
    } catch {
      return []
    }
  },

  /**
   * Fetch all notifications (read + unread) for the current user, limited to recent.
   */
  async getAllNotifications(limit = 50): Promise<AppNotification[]> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('scheduled_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to fetch notifications:', error)
        return []
      }

      return (data || []) as AppNotification[]
    } catch {
      return []
    }
  },

  /**
   * Get count of unread notifications.
   */
  async getUnreadCount(): Promise<number> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return 0

      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userData.user.id)
        .eq('read', false)

      if (error) {
        console.error('Failed to count unread notifications:', error)
        return 0
      }

      return count || 0
    } catch {
      return 0
    }
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

      if (error) console.error('Failed to mark notification as read:', error)
    } catch (e) {
      console.error('Failed to mark notification as read:', e)
    }
  },

  /**
   * Mark all unread notifications as read for the current user.
   */
  async markAllAsRead(): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userData.user.id)
        .eq('read', false)

      if (error) console.error('Failed to mark all notifications as read:', error)
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e)
    }
  },

  /**
   * Sync offline-queued notifications to Supabase.
   * Returns the number of successfully synced notifications.
   */
  async syncOfflineNotifications(): Promise<number> {
    const queue = getOfflineQueue()
    if (queue.length === 0) return 0

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return 0

      const remaining: OfflineNotification[] = []
      let syncedCount = 0

      for (const item of queue) {
        try {
          const { error } = await supabase
            .from('notifications')
            .upsert(
              {
                user_id: userData.user.id,
                type: item.type,
                title: item.title,
                message: item.message,
                scheduled_at: item.scheduled_at,
                notification_key: item.notification_key,
                read: false,
              },
              { onConflict: 'user_id,notification_key', ignoreDuplicates: true }
            )

          if (error) {
            console.error('Failed to sync notification:', error)
            remaining.push(item)
          } else {
            syncedCount++
          }
        } catch {
          remaining.push(item)
        }
      }

      setOfflineQueue(remaining)
      return syncedCount
    } catch {
      return 0
    }
  },

  /**
   * Delete read notifications older than 30 days.
   * Called periodically to keep the database clean.
   */
  async cleanOldNotifications(): Promise<void> {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userData.user.id)
        .eq('read', true)
        .lt('created_at', thirtyDaysAgo.toISOString())

      if (error) console.error('Failed to clean old notifications:', error)
    } catch (e) {
      console.error('Failed to clean old notifications:', e)
    }
  },
}
