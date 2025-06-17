
-- Baholar uchun jadval yaratish
CREATE TABLE public.grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  grade DECIMAL(2,1) NOT NULL CHECK (grade IN (2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)),
  date_given DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, teacher_id, date_given)
);

-- Guruh dars kunlari uchun jadval
CREATE TABLE public.group_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name TEXT NOT NULL,
  teacher_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Yakshanba, 1=Dushanba, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_name, teacher_id, day_of_week)
);

-- Bayram va dam olish kunlari uchun jadval
CREATE TABLE public.schedule_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name TEXT NOT NULL,
  teacher_id UUID NOT NULL,
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('holiday', 'break', 'no_class')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_name, teacher_id, exception_date)
);

-- Baholar jadvaliga RLS qo'shish
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their students' grades" 
ON public.grades 
FOR ALL 
USING (teacher_id = auth.uid());

-- Guruh jadvaliga RLS qo'shish  
ALTER TABLE public.group_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their group schedules" 
ON public.group_schedule 
FOR ALL 
USING (teacher_id = auth.uid());

-- Istisno jadvaliga RLS qo'shish
ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their schedule exceptions" 
ON public.schedule_exceptions 
FOR ALL 
USING (teacher_id = auth.uid());
