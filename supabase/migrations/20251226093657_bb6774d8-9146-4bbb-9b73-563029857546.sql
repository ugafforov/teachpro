-- 1) Normalize reward_penalty_history.type and points
UPDATE public.reward_penalty_history
SET type = COALESCE(
  NULLIF(type, ''),
  CASE
    WHEN reason IN ('Baho','Mukofot','Jarima') THEN reason
    WHEN points < 0 THEN 'Jarima'
    WHEN points > 0 THEN 'Mukofot'
    ELSE 'Mukofot'
  END
)
WHERE type IS NULL OR type = '' OR type = 'reward';

-- Ensure points are stored as positive values (direction comes from type)
UPDATE public.reward_penalty_history
SET points = abs(points)
WHERE points IS NOT NULL AND points < 0;

-- 2) Normalize attendance status legacy value
UPDATE public.attendance_records
SET status = 'absent_without_reason'
WHERE status = 'absent';

-- 3) Deduplicate attendance_records by (student_id, date) keeping the newest created_at
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, date
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.attendance_records
)
DELETE FROM public.attendance_records ar
USING ranked r
WHERE ar.id = r.id
  AND r.rn > 1;

-- 4) Deduplicate reward_penalty_history by (student_id, date, type) keeping the newest created_at
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, date, type
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.reward_penalty_history
)
DELETE FROM public.reward_penalty_history rph
USING ranked r
WHERE rph.id = r.id
  AND r.rn > 1;

-- 5) Add uniqueness constraints to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'attendance_records_student_date_unique'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_student_date_unique
      UNIQUE (student_id, date);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reward_penalty_history_student_date_type_unique'
  ) THEN
    ALTER TABLE public.reward_penalty_history
      ADD CONSTRAINT reward_penalty_history_student_date_type_unique
      UNIQUE (student_id, date, type);
  END IF;
END $$;
