
-- Sababli qoldirilgan darslar uchun izoh saqlashga mo'ljallangan 'reason' ustunini qo'shish
ALTER TABLE public.attendance_records ADD COLUMN reason TEXT;

-- Davomat ballarini hisoblash funksiyasini yangilash
-- 'absent_with_reason' (sababli kelmagan) statusi uchun endi 0 ball beriladi.
CREATE OR REPLACE FUNCTION public.calculate_attendance_points(p_student_id uuid, p_teacher_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
  attendance_points DECIMAL(5,2) := 0;
BEGIN
  SELECT
    COALESCE(
      SUM(
        CASE
          WHEN status = 'present' THEN 1
          WHEN status = 'late' THEN -0.5
          WHEN status = 'absent' THEN -1
          WHEN status = 'absent_with_reason' THEN 0
          ELSE 0
        END
      ), 0
    )
  INTO attendance_points
  FROM attendance_records
  WHERE student_id = p_student_id AND teacher_id = p_teacher_id;

  RETURN attendance_points;
END;
$function$
