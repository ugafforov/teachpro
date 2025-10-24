-- Add missing columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS student_id TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add missing columns to student_scores table  
ALTER TABLE public.student_scores 
ADD COLUMN IF NOT EXISTS reward_penalty_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_score NUMERIC DEFAULT 0;

-- Add type column to reward_penalty_history
ALTER TABLE public.reward_penalty_history
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'reward';

-- Add group_name to archived_students
ALTER TABLE public.archived_students
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS student_id TEXT;

-- Add group_name to deleted_students  
ALTER TABLE public.deleted_students
ADD COLUMN IF NOT EXISTS group_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS student_id TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);