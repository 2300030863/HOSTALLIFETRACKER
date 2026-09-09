import type { Session, User } from '@supabase/supabase-js'

// ===== Auth Types =====
export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  hostel_name: string | null
  room_number: string | null
  college_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
}

// ===== Transaction Types =====
export type TransactionType = 'expense' | 'given' | 'received' | 'settlement'
export type PaymentMethod = 'cash' | 'upi' | 'bank' | 'card' | 'other'
export type TransactionStatus = 'pending' | 'settled' | 'completed'

export interface Transaction {
  id: string
  user_id: string
  person_id: string | null
  person_name?: string | null
  type: TransactionType
  amount: number
  category: string
  description: string | null
  transaction_date: string
  expected_return_date?: string | null
  purpose?: string | null
  payment_method: PaymentMethod
  status: TransactionStatus
  created_at: string
  updated_at: string
  person?: Person
}

// ===== People Types =====
export interface Person {
  id: string
  user_id: string
  name: string
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ===== Activity Types =====
export type ActivityStatus = 'pending' | 'in_progress' | 'completed'
export type ActivityCategory = 'college' | 'study' | 'exercise' | 'food' | 'hostel' | 'personal' | 'work' | 'other'

export interface Activity {
  id: string
  user_id: string
  title: string
  description: string | null
  category: ActivityCategory
  activity_date: string
  start_time: string | null
  end_time: string | null
  status: ActivityStatus
  created_at: string
  updated_at: string
}

// ===== Reminder Types =====
export type RepeatType = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
export type Priority = 'low' | 'medium' | 'high'

export interface Reminder {
  id: string
  user_id: string
  title: string
  description: string | null
  reminder_date: string
  reminder_time: string
  repeat_type: RepeatType
  priority: Priority
  completed: boolean
  created_at: string
  updated_at: string
}

// ===== Attendance Types =====
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'pending'
export type AttendanceSource = 'manual' | 'biometric'

export interface Attendance {
  id: string
  user_id: string
  attendance_date: string
  check_in: string | null
  check_out: string | null
  status: AttendanceStatus
  source: AttendanceSource
  reason?: string | null
  created_at: string
}

// ===== Habit Types =====
export type HabitFrequency = 'daily' | 'weekly' | 'custom'

export interface Habit {
  id: string
  user_id: string
  name: string
  description: string | null
  frequency: HabitFrequency
  created_at: string
  updated_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  user_id: string
  log_date: string
  completed: boolean
  created_at: string
}

// ===== Goal Types =====
export interface Goal {
  id: string
  user_id: string
  title: string
  description: string | null
  target: number
  current_value: number
  deadline: string | null
  priority: Priority
  completed: boolean
  created_at: string
  updated_at: string
}

// ===== Note Types =====
export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[] | null
  created_at: string
  updated_at: string
}

// ===== Important Item Types =====
export interface ImportantItem {
  id: string
  user_id: string
  name: string
  category: string
  location: string | null
  description: string | null
  image_url: string | null
  created_at: string
  updated_at: string
}

// ===== Expense Category =====
export const EXPENSE_CATEGORIES = [
  'Food',
  'Travel',
  'Education',
  'Shopping',
  'Entertainment',
  'Hostel',
  'Bills',
  'Health',
  'Recharge',
  'Other',
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]
