-- Create archived_exams table
CREATE TABLE IF NOT EXISTS public.archived_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  original_exam_id UUID,
  exam_name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  group_name TEXT,
  group_id UUID,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  results_data JSONB
);

-- Enable RLS
ALTER TABLE public.archived_exams ENABLE ROW LEVEL SECURITY;

-- RLS policies for archived_exams
CREATE POLICY "Teachers can view their own archived exams"
ON public.archived_exams
FOR SELECT
USING (teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
));

CREATE POLICY "Teachers can create their own archived exams"
ON public.archived_exams
FOR INSERT
WITH CHECK (teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
));

CREATE POLICY "Teachers can delete their own archived exams"
ON public.archived_exams
FOR DELETE
USING (teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
));

-- Create deleted_exams table
CREATE TABLE IF NOT EXISTS public.deleted_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL,
  original_exam_id UUID,
  exam_name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  group_name TEXT,
  group_id UUID,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  results_data JSONB
);

-- Enable RLS
ALTER TABLE public.deleted_exams ENABLE ROW LEVEL SECURITY;

-- RLS policies for deleted_exams
CREATE POLICY "Teachers can view their own deleted exams"
ON public.deleted_exams
FOR SELECT
USING (teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
));

CREATE POLICY "Teachers can create their own deleted exams"
ON public.deleted_exams
FOR INSERT
WITH CHECK (teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
));

CREATE POLICY "Teachers can delete their own deleted exams"
ON public.deleted_exams
FOR DELETE
USING (teacher_id IN (
  SELECT id FROM teachers WHERE user_id = auth.uid()
));