-- Change points column to support decimal values
ALTER TABLE reward_penalty_history 
ALTER COLUMN points TYPE numeric USING points::numeric;