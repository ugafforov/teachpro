-- Create teachers table
CREATE TABLE public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  school TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on teachers
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Teachers policies
CREATE POLICY "Users can view their own teacher profile"
  ON public.teachers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own teacher profile"
  ON public.teachers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teacher profile"
  ON public.teachers FOR UPDATE
  USING (auth.uid() = user_id);

-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Teachers can view their own groups"
  ON public.groups FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own groups"
  ON public.groups FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own groups"
  ON public.groups FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own groups"
  ON public.groups FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  parent_phone TEXT,
  reward_penalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Students policies
CREATE POLICY "Teachers can view their own students"
  ON public.students FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own students"
  ON public.students FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own students"
  ON public.students FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own students"
  ON public.students FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Enable RLS on attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Attendance records policies
CREATE POLICY "Teachers can view their own attendance records"
  ON public.attendance_records FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own attendance records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own attendance records"
  ON public.attendance_records FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own attendance records"
  ON public.attendance_records FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create student_scores table
CREATE TABLE public.student_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  score NUMERIC NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on student_scores
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;

-- Student scores policies
CREATE POLICY "Teachers can view their own student scores"
  ON public.student_scores FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own student scores"
  ON public.student_scores FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own student scores"
  ON public.student_scores FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own student scores"
  ON public.student_scores FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create reward_penalty_history table
CREATE TABLE public.reward_penalty_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on reward_penalty_history
ALTER TABLE public.reward_penalty_history ENABLE ROW LEVEL SECURITY;

-- Reward penalty history policies
CREATE POLICY "Teachers can view their own reward penalty history"
  ON public.reward_penalty_history FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own reward penalty history"
  ON public.reward_penalty_history FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own reward penalty history"
  ON public.reward_penalty_history FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own reward penalty history"
  ON public.reward_penalty_history FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create archived_students table
CREATE TABLE public.archived_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  original_student_id UUID,
  name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  parent_phone TEXT,
  reward_penalty_points INTEGER DEFAULT 0,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on archived_students
ALTER TABLE public.archived_students ENABLE ROW LEVEL SECURITY;

-- Archived students policies
CREATE POLICY "Teachers can view their own archived students"
  ON public.archived_students FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own archived students"
  ON public.archived_students FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own archived students"
  ON public.archived_students FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create archived_groups table
CREATE TABLE public.archived_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  original_group_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on archived_groups
ALTER TABLE public.archived_groups ENABLE ROW LEVEL SECURITY;

-- Archived groups policies
CREATE POLICY "Teachers can view their own archived groups"
  ON public.archived_groups FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own archived groups"
  ON public.archived_groups FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own archived groups"
  ON public.archived_groups FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create deleted_students table
CREATE TABLE public.deleted_students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  original_student_id UUID,
  name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  parent_phone TEXT,
  reward_penalty_points INTEGER DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on deleted_students
ALTER TABLE public.deleted_students ENABLE ROW LEVEL SECURITY;

-- Deleted students policies
CREATE POLICY "Teachers can view their own deleted students"
  ON public.deleted_students FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own deleted students"
  ON public.deleted_students FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own deleted students"
  ON public.deleted_students FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create deleted_groups table
CREATE TABLE public.deleted_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  original_group_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on deleted_groups
ALTER TABLE public.deleted_groups ENABLE ROW LEVEL SECURITY;

-- Deleted groups policies
CREATE POLICY "Teachers can view their own deleted groups"
  ON public.deleted_groups FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own deleted groups"
  ON public.deleted_groups FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own deleted groups"
  ON public.deleted_groups FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create function to automatically create teacher profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.teachers (user_id, name, email, phone, school)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'school', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create teacher profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();