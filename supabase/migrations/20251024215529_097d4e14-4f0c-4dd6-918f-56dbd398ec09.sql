-- Add is_active column to groups table
ALTER TABLE public.groups 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Add is_active column to students table
ALTER TABLE public.students 
ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Add group_name column to students table for easier querying
ALTER TABLE public.students 
ADD COLUMN group_name TEXT;

-- Update existing students to have group_name from groups table
UPDATE public.students s
SET group_name = g.name
FROM public.groups g
WHERE s.group_id = g.id;

-- Create index for better performance
CREATE INDEX idx_students_is_active ON public.students(is_active);
CREATE INDEX idx_groups_is_active ON public.groups(is_active);
CREATE INDEX idx_students_group_name ON public.students(group_name);

-- Create function to auto-update student group_name when group name changes
CREATE OR REPLACE FUNCTION public.update_student_group_names()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name != OLD.name THEN
    UPDATE public.students
    SET group_name = NEW.name
    WHERE group_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to keep group names in sync
CREATE TRIGGER on_group_name_update
AFTER UPDATE ON public.groups
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.update_student_group_names();

-- Create function to auto-set group_name when student is inserted/updated
CREATE OR REPLACE FUNCTION public.set_student_group_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    SELECT name INTO NEW.group_name
    FROM public.groups
    WHERE id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-set group_name
CREATE TRIGGER on_student_group_set
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW
WHEN (NEW.group_id IS NOT NULL)
EXECUTE FUNCTION public.set_student_group_name();