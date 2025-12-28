-- 1. Create function to auto-fill group_id from group_name
CREATE OR REPLACE FUNCTION public.auto_fill_student_group_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fill if group_id is NULL but group_name exists
  IF NEW.group_id IS NULL AND NEW.group_name IS NOT NULL AND NEW.group_name != '' THEN
    SELECT id INTO NEW.group_id
    FROM public.groups
    WHERE name = NEW.group_name
      AND teacher_id = NEW.teacher_id
      AND is_active = true
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Create trigger for INSERT
DROP TRIGGER IF EXISTS trigger_auto_fill_student_group_id_insert ON public.students;
CREATE TRIGGER trigger_auto_fill_student_group_id_insert
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.auto_fill_student_group_id();

-- 3. Create trigger for UPDATE
DROP TRIGGER IF EXISTS trigger_auto_fill_student_group_id_update ON public.students;
CREATE TRIGGER trigger_auto_fill_student_group_id_update
BEFORE UPDATE ON public.students
FOR EACH ROW
WHEN (NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.group_name IS DISTINCT FROM OLD.group_name)
EXECUTE FUNCTION public.auto_fill_student_group_id();

-- 4. BACKFILL: Fix all existing students with NULL group_id but valid group_name
UPDATE public.students s
SET group_id = g.id
FROM public.groups g
WHERE s.group_id IS NULL
  AND s.group_name IS NOT NULL
  AND s.group_name != ''
  AND g.name = s.group_name
  AND g.teacher_id = s.teacher_id
  AND g.is_active = true;

-- 5. Create audit function to check data integrity
CREATE OR REPLACE FUNCTION public.audit_student_group_links(p_teacher_id uuid)
RETURNS TABLE (
  total_students bigint,
  students_with_null_group_id bigint,
  students_fixed bigint,
  groups_affected text[]
) AS $$
DECLARE
  v_null_count bigint;
  v_fixed_count bigint;
  v_groups text[];
BEGIN
  -- Count students with NULL group_id
  SELECT COUNT(*) INTO v_null_count
  FROM public.students
  WHERE teacher_id = p_teacher_id
    AND group_id IS NULL
    AND group_name IS NOT NULL
    AND group_name != ''
    AND is_active = true;

  -- Get affected groups
  SELECT ARRAY_AGG(DISTINCT group_name) INTO v_groups
  FROM public.students
  WHERE teacher_id = p_teacher_id
    AND group_id IS NULL
    AND group_name IS NOT NULL
    AND group_name != ''
    AND is_active = true;

  -- Fix the records
  WITH fixed AS (
    UPDATE public.students s
    SET group_id = g.id
    FROM public.groups g
    WHERE s.teacher_id = p_teacher_id
      AND s.group_id IS NULL
      AND s.group_name IS NOT NULL
      AND s.group_name != ''
      AND g.name = s.group_name
      AND g.teacher_id = s.teacher_id
      AND g.is_active = true
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_fixed_count FROM fixed;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM public.students WHERE teacher_id = p_teacher_id AND is_active = true),
    v_null_count,
    v_fixed_count,
    COALESCE(v_groups, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;