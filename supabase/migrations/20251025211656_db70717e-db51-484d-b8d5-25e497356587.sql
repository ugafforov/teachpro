-- Update attendance status check to allow reason-specific statuses
ALTER TABLE public.attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_status_check;

ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_status_check
  CHECK (status IN (
    'present',
    'late',
    'absent',
    'absent_with_reason',
    'absent_without_reason'
  ));
