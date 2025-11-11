-- Add UNIQUE constraint to prevent multiple teacher profiles per user
ALTER TABLE public.teachers 
ADD CONSTRAINT teachers_user_id_unique UNIQUE (user_id);

-- Drop and recreate soft_delete_student with authorization checks
DROP FUNCTION IF EXISTS public.soft_delete_student(uuid);

CREATE OR REPLACE FUNCTION public.soft_delete_student(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_calling_teacher_id uuid;
  v_student_data record;
BEGIN
  -- Get teacher_id of calling user
  SELECT id INTO v_calling_teacher_id 
  FROM teachers 
  WHERE user_id = auth.uid();
  
  IF v_calling_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized: no teacher profile';
  END IF;
  
  -- Get student data and verify ownership
  SELECT * INTO v_student_data FROM students WHERE id = p_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  
  -- Verify student belongs to this teacher
  IF v_student_data.teacher_id != v_calling_teacher_id THEN
    RAISE EXCEPTION 'Not authorized to access this student';
  END IF;
  
  -- Copy attendance records to deleted table
  INSERT INTO deleted_attendance_records (
    original_record_id, student_id, teacher_id, date, status, notes, created_at
  )
  SELECT id, student_id, teacher_id, date, status, notes, created_at
  FROM attendance_records
  WHERE student_id = p_student_id AND teacher_id = v_calling_teacher_id;
  
  -- Copy reward/penalty history to deleted table
  INSERT INTO deleted_reward_penalty_history (
    original_record_id, student_id, teacher_id, points, reason, type, date, created_at
  )
  SELECT id, student_id, teacher_id, points, reason, type, date, created_at
  FROM reward_penalty_history
  WHERE student_id = p_student_id AND teacher_id = v_calling_teacher_id;
  
  -- Copy student scores to deleted table
  INSERT INTO deleted_student_scores (
    original_record_id, student_id, teacher_id, subject, score, date, notes, 
    reward_penalty_points, total_score, created_at
  )
  SELECT id, student_id, teacher_id, subject, score, date, notes, 
    reward_penalty_points, total_score, created_at
  FROM student_scores
  WHERE student_id = p_student_id AND teacher_id = v_calling_teacher_id;
  
  -- Copy exam results to deleted table
  INSERT INTO deleted_exam_results (
    original_record_id, student_id, teacher_id, exam_id, score, notes, created_at
  )
  SELECT id, student_id, teacher_id, exam_id, score, notes, created_at
  FROM exam_results
  WHERE student_id = p_student_id AND teacher_id = v_calling_teacher_id;
  
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
$function$;

-- Drop and recreate restore_student_full with authorization checks
DROP FUNCTION IF EXISTS public.restore_student_full(uuid);

CREATE OR REPLACE FUNCTION public.restore_student_full(p_deleted_student_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_calling_teacher_id uuid;
  v_deleted_student record;
  v_new_student_id uuid;
  v_old_student_id uuid;
BEGIN
  -- Get teacher_id of calling user
  SELECT id INTO v_calling_teacher_id 
  FROM teachers 
  WHERE user_id = auth.uid();
  
  IF v_calling_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized: no teacher profile';
  END IF;
  
  -- Get deleted student data
  SELECT * INTO v_deleted_student FROM deleted_students WHERE id = p_deleted_student_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deleted student not found';
  END IF;
  
  -- Verify student belongs to this teacher
  IF v_deleted_student.teacher_id != v_calling_teacher_id THEN
    RAISE EXCEPTION 'Not authorized to restore this student';
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
$function$;