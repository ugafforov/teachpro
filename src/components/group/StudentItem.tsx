
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CheckCircle, Clock, XCircle, Gift, Star, AlertTriangle, ShieldQuestion } from 'lucide-react';

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
  const getButtonStyle = (targetStatus: AttendanceStatus) => {
    const currentStatus = attendance?.status;
    const isActive = currentStatus === targetStatus;
    
    const baseStyle = 'w-10 h-10 p-0 border border-gray-300';
    
    if (!isActive) {
      return `${baseStyle} bg-white hover:bg-gray-50 text-gray-600`;
    }
    
    switch (targetStatus) {
      case 'present':
        return `${baseStyle} bg-green-500 hover:bg-green-600 text-white border-green-500`;
      case 'late':
        return `${baseStyle} bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500`;
      case 'absent':
        return `${baseStyle} bg-red-500 hover:bg-red-600 text-white border-red-500`;
      case 'absent_with_reason':
        return `${baseStyle} bg-blue-500 hover:bg-blue-600 text-white border-blue-500`;
      default:
        return `${baseStyle} bg-white hover:bg-gray-50 text-gray-600`;
    }
  };

  const getReasonButtonStyle = () => {
    const currentStatus = attendance?.status;
    const isActive = currentStatus === 'absent_with_reason';
    const baseStyle = 'w-10 h-10 p-0 border border-gray-300';
    
    if (isActive) {
      return `${baseStyle} bg-blue-500 hover:bg-blue-600 text-white border-blue-500`;
    }
    return `${baseStyle} bg-white hover:bg-gray-50 text-gray-600`;
  };

  const getRewardButtonStyle = () => {
    const baseStyle = 'w-10 h-10 p-0 border border-gray-300 bg-white hover:bg-gray-50 text-gray-600';
    return baseStyle;
  };

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

  const getRewardIcon = (points: number) => {
    if (points === 0) return null;
    if (points > 0) return <Star className="w-4 h-4 text-yellow-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => onStudentClick(student.id)}
          className="flex items-center space-x-4 hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
        >
          <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center relative">
            <span className="text-sm font-medium">
              {student.name.split(' ').map(n => n[0]).join('')}
            </span>
            {student.rewardPenaltyPoints !== undefined && student.rewardPenaltyPoints !== 0 && (
              <div className="absolute -top-1 -right-1">
                {getRewardIcon(student.rewardPenaltyPoints)}
              </div>
            )}
          </div>
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
            <Button
              size="sm"
              onClick={() => onMarkAttendance(student.id, 'present')}
              className={getButtonStyle('present')}
            >
              <CheckCircle className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Keldi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={() => onMarkAttendance(student.id, 'late')}
              className={getButtonStyle('late')}
            >
              <Clock className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kechikdi</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={() => onMarkAttendance(student.id, 'absent')}
              className={getButtonStyle('absent')}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kelmagan</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={() => onShowReason(student)}
              className={getReasonButtonStyle()}
            >
              <ShieldQuestion className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Sababli kelmagan</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onShowReward(student.id)}
              className={getRewardButtonStyle()}
            >
              <Gift className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mukofot/Jarima berish</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export default StudentItem;
