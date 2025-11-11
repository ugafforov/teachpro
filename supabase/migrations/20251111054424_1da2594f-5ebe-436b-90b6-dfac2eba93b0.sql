-- ==========================================
-- TEACHER VERIFICATION & ADMIN APPROVAL SYSTEM
-- ==========================================

-- Step 1: Create enum for verification status
CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');

-- Step 2: Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'teacher');

-- Step 3: Add verification fields to teachers table
ALTER TABLE public.teachers 
  ADD COLUMN verification_status verification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN institution_name text,
  ADD COLUMN institution_address text,
  ADD COLUMN requested_at timestamp with time zone DEFAULT now(),
  ADD COLUMN approved_at timestamp with time zone,
  ADD COLUMN approved_by uuid REFERENCES public.teachers(id),
  ADD COLUMN rejection_reason text;

-- Step 4: Set all existing teachers to 'approved' status
UPDATE public.teachers 
SET verification_status = 'approved', 
    approved_at = now()
WHERE verification_status = 'pending';

-- Step 5: Create user_roles table (CRITICAL: separate from teachers)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Create SECURITY DEFINER function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 7: Create helper function to check if teacher is approved
CREATE OR REPLACE FUNCTION public.is_teacher_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers
    WHERE user_id = _user_id
      AND verification_status = 'approved'
  )
$$;

-- Step 8: RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Step 9: Update teachers table RLS to allow pending teachers to view their own profile
DROP POLICY IF EXISTS "Users can view their own teacher profile" ON public.teachers;
CREATE POLICY "Users can view their own teacher profile"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own teacher profile" ON public.teachers;
CREATE POLICY "Users can update their own teacher profile"
  ON public.teachers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND verification_status = 'approved');

-- Admins can view all teachers
CREATE POLICY "Admins can view all teachers"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update any teacher (for approval/rejection)
CREATE POLICY "Admins can update any teacher"
  ON public.teachers
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Step 10: Update ALL data table RLS policies to require approved status
-- Students table
DROP POLICY IF EXISTS "Teachers can create their own students" ON public.students;
CREATE POLICY "Teachers can create their own students"
  ON public.students
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can view their own students" ON public.students;
CREATE POLICY "Teachers can view their own students"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can update their own students" ON public.students;
CREATE POLICY "Teachers can update their own students"
  ON public.students
  FOR UPDATE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can delete their own students" ON public.students;
CREATE POLICY "Teachers can delete their own students"
  ON public.students
  FOR DELETE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

-- Groups table
DROP POLICY IF EXISTS "Teachers can create their own groups" ON public.groups;
CREATE POLICY "Teachers can create their own groups"
  ON public.groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can view their own groups" ON public.groups;
CREATE POLICY "Teachers can view their own groups"
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can update their own groups" ON public.groups;
CREATE POLICY "Teachers can update their own groups"
  ON public.groups
  FOR UPDATE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can delete their own groups" ON public.groups;
CREATE POLICY "Teachers can delete their own groups"
  ON public.groups
  FOR DELETE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

-- Exams table
DROP POLICY IF EXISTS "Teachers can create their own exams" ON public.exams;
CREATE POLICY "Teachers can create their own exams"
  ON public.exams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can view their own exams" ON public.exams;
CREATE POLICY "Teachers can view their own exams"
  ON public.exams
  FOR SELECT
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can update their own exams" ON public.exams;
CREATE POLICY "Teachers can update their own exams"
  ON public.exams
  FOR UPDATE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Teachers can delete their own exams" ON public.exams;
CREATE POLICY "Teachers can delete their own exams"
  ON public.exams
  FOR DELETE
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers 
      WHERE user_id = auth.uid() 
      AND verification_status = 'approved'
    )
  );

-- Continue with other tables (attendance_records, student_scores, etc.)
DROP POLICY IF EXISTS "Teachers can create their own attendance records" ON public.attendance_records;
CREATE POLICY "Teachers can create their own attendance records"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can view their own attendance records" ON public.attendance_records;
CREATE POLICY "Teachers can view their own attendance records"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can update their own attendance records" ON public.attendance_records;
CREATE POLICY "Teachers can update their own attendance records"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can delete their own attendance records" ON public.attendance_records;
CREATE POLICY "Teachers can delete their own attendance records"
  ON public.attendance_records FOR DELETE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

-- Student scores
DROP POLICY IF EXISTS "Teachers can create their own student scores" ON public.student_scores;
CREATE POLICY "Teachers can create their own student scores"
  ON public.student_scores FOR INSERT TO authenticated
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can view their own student scores" ON public.student_scores;
CREATE POLICY "Teachers can view their own student scores"
  ON public.student_scores FOR SELECT TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can update their own student scores" ON public.student_scores;
CREATE POLICY "Teachers can update their own student scores"
  ON public.student_scores FOR UPDATE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can delete their own student scores" ON public.student_scores;
CREATE POLICY "Teachers can delete their own student scores"
  ON public.student_scores FOR DELETE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

-- Exam results
DROP POLICY IF EXISTS "Teachers can create their own exam results" ON public.exam_results;
CREATE POLICY "Teachers can create their own exam results"
  ON public.exam_results FOR INSERT TO authenticated
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can view their own exam results" ON public.exam_results;
CREATE POLICY "Teachers can view their own exam results"
  ON public.exam_results FOR SELECT TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can update their own exam results" ON public.exam_results;
CREATE POLICY "Teachers can update their own exam results"
  ON public.exam_results FOR UPDATE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can delete their own exam results" ON public.exam_results;
CREATE POLICY "Teachers can delete their own exam results"
  ON public.exam_results FOR DELETE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

-- Reward penalty history
DROP POLICY IF EXISTS "Teachers can create their own reward penalty history" ON public.reward_penalty_history;
CREATE POLICY "Teachers can create their own reward penalty history"
  ON public.reward_penalty_history FOR INSERT TO authenticated
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can view their own reward penalty history" ON public.reward_penalty_history;
CREATE POLICY "Teachers can view their own reward penalty history"
  ON public.reward_penalty_history FOR SELECT TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can update their own reward penalty history" ON public.reward_penalty_history;
CREATE POLICY "Teachers can update their own reward penalty history"
  ON public.reward_penalty_history FOR UPDATE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can delete their own reward penalty history" ON public.reward_penalty_history;
CREATE POLICY "Teachers can delete their own reward penalty history"
  ON public.reward_penalty_history FOR DELETE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

-- Exam types
DROP POLICY IF EXISTS "Teachers can create their own exam types" ON public.exam_types;
CREATE POLICY "Teachers can create their own exam types"
  ON public.exam_types FOR INSERT TO authenticated
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can view their own exam types" ON public.exam_types;
CREATE POLICY "Teachers can view their own exam types"
  ON public.exam_types FOR SELECT TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can update their own exam types" ON public.exam_types;
CREATE POLICY "Teachers can update their own exam types"
  ON public.exam_types FOR UPDATE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

DROP POLICY IF EXISTS "Teachers can delete their own exam types" ON public.exam_types;
CREATE POLICY "Teachers can delete their own exam types"
  ON public.exam_types FOR DELETE TO authenticated
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid() AND verification_status = 'approved'));

-- Update handle_new_user trigger to include institution info
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.teachers (user_id, name, email, phone, school, institution_name, institution_address, verification_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'school', ''),
    COALESCE(NEW.raw_user_meta_data->>'institution_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'institution_address', ''),
    'pending'
  );
  RETURN NEW;
END;
$$;