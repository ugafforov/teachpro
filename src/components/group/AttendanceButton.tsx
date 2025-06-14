
import React from 'react';
import { Button } from '@/components/ui/button';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'absent_with_reason';

export interface AttendanceButtonProps {
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  type: AttendanceStatus;
}

const getButtonClass = (isActive: boolean, type: AttendanceStatus) => {
  const base = 'w-10 h-10 p-0 border border-gray-300';
  if (!isActive) return `${base} bg-white hover:bg-gray-50 text-gray-600`;
  switch (type) {
    case 'present':
      return `${base} bg-green-500 hover:bg-green-600 text-white border-green-500`;
    case 'late':
      return `${base} bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500`;
    case 'absent':
      return `${base} bg-red-500 hover:bg-red-600 text-white border-red-500`;
    default:
      return `${base} bg-white hover:bg-gray-50 text-gray-600`;
  }
};

const AttendanceButton: React.FC<AttendanceButtonProps> = ({
  isActive,
  onClick,
  icon,
  type,
}) => (
  <Button
    size="sm"
    onClick={onClick}
    className={getButtonClass(isActive, type)}
  >
    {icon}
  </Button>
);

export default AttendanceButton;
