-- ============================================================
-- Supabase Database Fix: Attendance Timezone & RLS Policy Fix
-- Run this script in Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Drop restrictive window trigger on Supabase if present
-- (Allows client application to handle attendance window without UTC timezone mismatch)
DROP TRIGGER IF EXISTS check_attendance_time_trigger ON public.attendance;
DROP TRIGGER IF EXISTS attendance_window_check ON public.attendance;
DROP TRIGGER IF EXISTS check_attendance_window_trigger ON public.attendance;
DROP FUNCTION IF EXISTS public.check_attendance_window();
DROP FUNCTION IF EXISTS public.validate_attendance_time();
DROP FUNCTION IF EXISTS public.check_attendance_window_ist();

-- 2. Ensure RLS Policy allows full INSERT, UPDATE, and DELETE for users
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can CRUD own attendance" ON public.attendance;
CREATE POLICY "Users can CRUD own attendance" ON public.attendance
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
