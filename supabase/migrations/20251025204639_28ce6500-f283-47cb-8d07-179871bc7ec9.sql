-- Update attendance_records status to support new absence types
-- The status field will now support: 'present', 'late', 'absent_with_reason', 'absent_without_reason'

-- Add a comment to document the status values
COMMENT ON COLUMN public.attendance_records.status IS 'Attendance status: present, late, absent_with_reason, absent_without_reason';

-- Update existing 'absent' records to 'absent_without_reason' as default
UPDATE public.attendance_records
SET status = 'absent_without_reason'
WHERE status = 'absent';
