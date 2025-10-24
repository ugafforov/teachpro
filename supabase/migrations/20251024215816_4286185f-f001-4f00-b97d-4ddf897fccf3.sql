-- Fix search_path for security in trigger functions
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;