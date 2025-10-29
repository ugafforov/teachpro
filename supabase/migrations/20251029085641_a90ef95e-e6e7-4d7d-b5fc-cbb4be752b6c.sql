-- Add type column to reward_penalty_history table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reward_penalty_history' 
    AND column_name = 'type'
  ) THEN
    ALTER TABLE public.reward_penalty_history 
    ADD COLUMN type text DEFAULT 'reward';
  END IF;
END $$;

-- Update existing records to set type based on reason field
UPDATE public.reward_penalty_history
SET type = CASE
  WHEN reason = 'Baho' THEN 'Baho'
  WHEN reason = 'Mukofot' THEN 'Mukofot'
  WHEN reason = 'Jarima' THEN 'Jarima'
  WHEN points > 0 THEN 'Mukofot'
  WHEN points < 0 THEN 'Jarima'
  ELSE 'reward'
END
WHERE type IS NULL OR type = 'reward';