-- Ensure reward_penalty_history has student_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reward_penalty_history' 
        AND column_name = 'student_id'
    ) THEN
        ALTER TABLE public.reward_penalty_history 
        ADD COLUMN student_id UUID REFERENCES public.students(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for student_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_reward_penalty_student_id ON public.reward_penalty_history(student_id);