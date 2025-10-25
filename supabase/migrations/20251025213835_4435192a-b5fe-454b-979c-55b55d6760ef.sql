-- Create exam_types table for storing different types of exams
CREATE TABLE public.exam_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exams table for storing exam instances
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id),
  group_id UUID NOT NULL REFERENCES public.groups(id),
  exam_type_id UUID REFERENCES public.exam_types(id),
  exam_name TEXT NOT NULL,
  exam_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exam_results table for storing student exam results
CREATE TABLE public.exam_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id),
  exam_id UUID NOT NULL REFERENCES public.exams(id),
  student_id UUID NOT NULL REFERENCES public.students(id),
  score NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.exam_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for exam_types
CREATE POLICY "Teachers can view their own exam types"
  ON public.exam_types FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own exam types"
  ON public.exam_types FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own exam types"
  ON public.exam_types FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own exam types"
  ON public.exam_types FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create RLS policies for exams
CREATE POLICY "Teachers can view their own exams"
  ON public.exams FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own exams"
  ON public.exams FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own exams"
  ON public.exams FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own exams"
  ON public.exams FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create RLS policies for exam_results
CREATE POLICY "Teachers can view their own exam results"
  ON public.exam_results FOR SELECT
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can create their own exam results"
  ON public.exam_results FOR INSERT
  WITH CHECK (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can update their own exam results"
  ON public.exam_results FOR UPDATE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

CREATE POLICY "Teachers can delete their own exam results"
  ON public.exam_results FOR DELETE
  USING (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()));

-- Create indexes for better performance
CREATE INDEX idx_exam_types_teacher ON public.exam_types(teacher_id);
CREATE INDEX idx_exams_teacher ON public.exams(teacher_id);
CREATE INDEX idx_exams_group ON public.exams(group_id);
CREATE INDEX idx_exam_results_teacher ON public.exam_results(teacher_id);
CREATE INDEX idx_exam_results_exam ON public.exam_results(exam_id);
CREATE INDEX idx_exam_results_student ON public.exam_results(student_id);