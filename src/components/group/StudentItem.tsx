
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CheckCircle, Clock, XCircle, Gift, Star, AlertTriangle } from 'lucide-react';
import StudentAvatar from './StudentAvatar';
import AttendanceButton from './AttendanceButton';
import RewardPenaltyButton from './RewardPenaltyButton';

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  rewardPenaltyPoints?: number;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'absent_with_reason';

interface StudentItemProps {
  student: Student;
  attendance: { status: AttendanceStatus; reason?: string | null } | undefined;
  onStudentClick: (studentId: string) => void;
  onMarkAttendance: (studentId: string, status: AttendanceStatus) => void;
  onShowReward: (studentId: string) => void;
  onShowReason: (student: Student) => void;
}

const StudentItem: React.FC<StudentItemProps> = ({
  student,
  attendance,
  onStudentClick,
  onMarkAttendance,
  onShowReward,
  onShowReason
}) => {
  // Helper for displaying reward points as a badge
  const getRewardDisplay = (points: number) => {
    if (points === 0) return null;
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        points > 0 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {points > 0 ? '+' : ''}{points}
      </span>
    );
  };

  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => onStudentClick(student.id)}
          className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
        >
          <StudentAvatar name={student.name} rewardPenaltyPoints={student.rewardPenaltyPoints} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{student.name}</h3>
              {student.rewardPenaltyPoints !== undefined && getRewardDisplay(student.rewardPenaltyPoints)}
            </div>
            {student.student_id && (
              <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
            )}
          </div>
        </button>
      </div>
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AttendanceButton
                isActive={attendance?.status === 'present'}
                type="present"
                onClick={() => onMarkAttendance(student.id, 'present')}
                icon={<CheckCircle className="w-4 h-4" />}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Keldi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AttendanceButton
                isActive={attendance?.status === 'late'}
                type="late"
                onClick={() => onMarkAttendance(student.id, 'late')}
                icon={<Clock className="w-4 h-4" />}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Kechikdi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <AttendanceButton
                isActive={attendance?.status === 'absent'}
                type="absent"
                onClick={() => onMarkAttendance(student.id, 'absent')}
                icon={<XCircle className="w-4 h-4" />}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Kelmagan</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <RewardPenaltyButton
                points={student.rewardPenaltyPoints}
                onClick={() => onShowReward(student.id)}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>Mukofot/Jarima berish</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default StudentItem;
