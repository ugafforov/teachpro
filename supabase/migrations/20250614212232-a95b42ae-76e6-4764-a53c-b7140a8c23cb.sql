
-- Avval date_given ustunini qo'shamiz
ALTER TABLE reward_penalty_history 
ADD COLUMN IF NOT EXISTS date_given DATE DEFAULT CURRENT_DATE;

-- Mavjud ma'lumotlarda date_given ni to'ldiramiz
UPDATE reward_penalty_history 
SET date_given = created_at::date 
WHERE date_given IS NULL;

-- Avval dublikat yozuvlarni aniqlaymiz va eng oxirgi yozuvdan tashqari barchasini o'chiramiz
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, teacher_id, date_given 
      ORDER BY created_at DESC
    ) as rn
  FROM reward_penalty_history
)
DELETE FROM reward_penalty_history 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Endi unique constraint qo'shamiz
ALTER TABLE reward_penalty_history 
ADD CONSTRAINT unique_daily_reward_penalty 
UNIQUE (student_id, teacher_id, date_given);

-- daily_reward_penalty_summary jadvali yaratamiz
CREATE TABLE IF NOT EXISTS daily_reward_penalty_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  date_given DATE NOT NULL DEFAULT CURRENT_DATE,
  total_points NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, teacher_id, date_given)
);

-- RLS ni yoqamiz
ALTER TABLE daily_reward_penalty_summary ENABLE ROW LEVEL SECURITY;

-- O'qituvchilar faqat o'z ma'lumotlarini ko'rishlari uchun policy
CREATE POLICY "Teachers can view their own daily summaries" 
  ON daily_reward_penalty_summary 
  FOR SELECT 
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert their own daily summaries" 
  ON daily_reward_penalty_summary 
  FOR INSERT 
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update their own daily summaries" 
  ON daily_reward_penalty_summary 
  FOR UPDATE 
  USING (teacher_id = auth.uid());

-- Mavjud ma'lumotlar asosida daily summary ni to'ldiramiz
INSERT INTO daily_reward_penalty_summary (student_id, teacher_id, date_given, total_points)
SELECT 
  student_id,
  teacher_id,
  date_given,
  SUM(points) as total_points
FROM reward_penalty_history
GROUP BY student_id, teacher_id, date_given
ON CONFLICT (student_id, teacher_id, date_given) DO NOTHING;

-- Mukofot/jarima berilganda daily summary ni yangilovchi function
CREATE OR REPLACE FUNCTION update_daily_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO daily_reward_penalty_summary (
    student_id, 
    teacher_id, 
    date_given, 
    total_points
  )
  VALUES (
    NEW.student_id,
    NEW.teacher_id,
    NEW.date_given,
    NEW.points
  )
  ON CONFLICT (student_id, teacher_id, date_given)
  DO UPDATE SET
    total_points = daily_reward_penalty_summary.total_points + NEW.points,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger yaratamiz
CREATE TRIGGER update_daily_summary_trigger
  AFTER INSERT ON reward_penalty_history
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_summary();
