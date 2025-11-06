-- Create deleted tables for full student data recovery
CREATE TABLE IF NOT EXISTS public.deleted_attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_record_id uuid,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deleted_reward_penalty_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_record_id uuid,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  points integer NOT NULL,
  reason text,
  type text,
  date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deleted_student_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_record_id uuid,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  subject text NOT NULL,
  score numeric NOT NULL,
  date date NOT NULL,
  notes text,
  reward_penalty_points integer DEFAULT 0,
  total_score numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deleted_exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_record_id uuid,
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  exam_id uuid NOT NULL,
  score numeric NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deleted_attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_reward_penalty_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_exam_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Teachers can view their deleted attendance records" ON public.deleted_attendance_records
  FOR SELECT USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can insert their deleted attendance records" ON public.deleted_attendance_records
  FOR INSERT WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their deleted attendance records" ON public.deleted_attendance_records
  FOR DELETE USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can view their deleted reward penalty history" ON public.deleted_reward_penalty_history
  FOR SELECT USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can insert their deleted reward penalty history" ON public.deleted_reward_penalty_history
  FOR INSERT WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their deleted reward penalty history" ON public.deleted_reward_penalty_history
  FOR DELETE USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can view their deleted student scores" ON public.deleted_student_scores
  FOR SELECT USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can insert their deleted student scores" ON public.deleted_student_scores
  FOR INSERT WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their deleted student scores" ON public.deleted_student_scores
  FOR DELETE USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can view their deleted exam results" ON public.deleted_exam_results
  FOR SELECT USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can insert their deleted exam results" ON public.deleted_exam_results
  FOR INSERT WITH CHECK (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their deleted exam results" ON public.deleted_exam_results
  FOR DELETE USING (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deleted_attendance_student ON public.deleted_attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_deleted_attendance_teacher ON public.deleted_attendance_records(teacher_id);
CREATE INDEX IF NOT EXISTS idx_deleted_rewards_student ON public.deleted_reward_penalty_history(student_id);
CREATE INDEX IF NOT EXISTS idx_deleted_rewards_teacher ON public.deleted_reward_penalty_history(teacher_id);
CREATE INDEX IF NOT EXISTS idx_deleted_scores_student ON public.deleted_student_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_deleted_scores_teacher ON public.deleted_student_scores(teacher_id);
CREATE INDEX IF NOT EXISTS idx_deleted_exam_results_student ON public.deleted_exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_deleted_exam_results_teacher ON public.deleted_exam_results(teacher_id);

-- Function to soft delete student with ALL related data
CREATE OR REPLACE FUNCTION public.soft_delete_student(
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_student_data record;
BEGIN
  -- Get student data
  SELECT * INTO v_student_data FROM students WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  v_teacher_id := v_student_data.teacher_id;
  
  -- Copy attendance records to deleted table
  INSERT INTO deleted_attendance_records (
    original_record_id, student_id, teacher_id, date, status, notes, created_at
  )
  SELECT id, student_id, teacher_id, date, status, notes, created_at
  FROM attendance_records
  WHERE student_id = p_student_id AND teacher_id = v_teacher_id;
  
  -- Copy reward/penalty history to deleted table
  INSERT INTO deleted_reward_penalty_history (
    original_record_id, student_id, teacher_id, points, reason, type, date, created_at
  )
  SELECT id, student_id, teacher_id, points, reason, type, date, created_at
  FROM reward_penalty_history
  WHERE student_id = p_student_id AND teacher_id = v_teacher_id;
  
  -- Copy student scores to deleted table
  INSERT INTO deleted_student_scores (
    original_record_id, student_id, teacher_id, subject, score, date, notes, 
    reward_penalty_points, total_score, created_at
  )
  SELECT id, student_id, teacher_id, subject, score, date, notes, 
    reward_penalty_points, total_score, created_at
  FROM student_scores
  WHERE student_id = p_student_id AND teacher_id = v_teacher_id;
  
  -- Copy exam results to deleted table
  INSERT INTO deleted_exam_results (
    original_record_id, student_id, teacher_id, exam_id, score, notes, created_at
  )
  SELECT id, student_id, teacher_id, exam_id, score, notes, created_at
  FROM exam_results
  WHERE student_id = p_student_id AND teacher_id = v_teacher_id;
  
  -- Copy student to deleted_students
  INSERT INTO deleted_students (
    original_student_id, teacher_id, name, student_id, email, phone, 
    group_name, age, parent_phone, reward_penalty_points
  )
  VALUES (
    v_student_data.id, v_student_data.teacher_id, v_student_data.name, 
    v_student_data.student_id, v_student_data.email, v_student_data.phone,
    v_student_data.group_name, v_student_data.age, v_student_data.parent_phone,
    v_student_data.reward_penalty_points
  );
  
  -- Delete all related records
  DELETE FROM attendance_records WHERE student_id = p_student_id;
  DELETE FROM reward_penalty_history WHERE student_id = p_student_id;
  DELETE FROM student_scores WHERE student_id = p_student_id;
  DELETE FROM exam_results WHERE student_id = p_student_id;
  DELETE FROM students WHERE id = p_student_id;
END;
$$;

-- Function to restore student with ALL data
CREATE OR REPLACE FUNCTION public.restore_student_full(
  p_deleted_student_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_student record;
  v_new_student_id uuid;
  v_old_student_id uuid;
BEGIN
  -- Get deleted student data
  SELECT * INTO v_deleted_student FROM deleted_students WHERE id = p_deleted_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted student not found';
  END IF;
  
  v_old_student_id := v_deleted_student.original_student_id;
  
  -- Restore student
  INSERT INTO students (
    teacher_id, name, student_id, email, phone, group_name, 
    age, parent_phone, reward_penalty_points, is_active
  )
  VALUES (
    v_deleted_student.teacher_id, v_deleted_student.name, v_deleted_student.student_id,
    v_deleted_student.email, v_deleted_student.phone, v_deleted_student.group_name,
    v_deleted_student.age, v_deleted_student.parent_phone, 
    v_deleted_student.reward_penalty_points, true
  )
  RETURNING id INTO v_new_student_id;
  
  -- Restore attendance records
  INSERT INTO attendance_records (student_id, teacher_id, date, status, notes, created_at)
  SELECT v_new_student_id, teacher_id, date, status, notes, created_at
  FROM deleted_attendance_records
  WHERE student_id = v_old_student_id;
  
  -- Restore reward/penalty history
  INSERT INTO reward_penalty_history (student_id, teacher_id, points, reason, type, date, created_at)
  SELECT v_new_student_id, teacher_id, points, reason, type, date, created_at
  FROM deleted_reward_penalty_history
  WHERE student_id = v_old_student_id;
  
  -- Restore student scores
  INSERT INTO student_scores (
    student_id, teacher_id, subject, score, date, notes, 
    reward_penalty_points, total_score, created_at
  )
  SELECT v_new_student_id, teacher_id, subject, score, date, notes,
    reward_penalty_points, total_score, created_at
  FROM deleted_student_scores
  WHERE student_id = v_old_student_id;
  
  -- Restore exam results
  INSERT INTO exam_results (student_id, teacher_id, exam_id, score, notes, created_at)
  SELECT v_new_student_id, teacher_id, exam_id, score, notes, created_at
  FROM deleted_exam_results
  WHERE student_id = v_old_student_id;
  
  -- Clean up deleted records
  DELETE FROM deleted_attendance_records WHERE student_id = v_old_student_id;
  DELETE FROM deleted_reward_penalty_history WHERE student_id = v_old_student_id;
  DELETE FROM deleted_student_scores WHERE student_id = v_old_student_id;
  DELETE FROM deleted_exam_results WHERE student_id = v_old_student_id;
  DELETE FROM deleted_students WHERE id = p_deleted_student_id;
  
  RETURN v_new_student_id;
END;
$$;