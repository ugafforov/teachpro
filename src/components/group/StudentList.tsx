
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Users, Plus } from 'lucide-react';
import StudentItem from './StudentItem';

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

interface StudentListProps {
  students: Student[];
  attendance: Record<string, { status: AttendanceStatus; reason?: string | null }>;
  onStudentClick: (studentId: string) => void;
  onMarkAttendance: (studentId: string, status: AttendanceStatus) => void;
  onShowReward: (studentId: string) => void;
  onShowReason: (student: Student) => void;
  onAddStudentClick: () => void;
}

const StudentList: React.FC<StudentListProps> = ({
  students,
  attendance,
  onStudentClick,
  onMarkAttendance,
  onShowReward,
  onShowReason,
  onAddStudentClick
}) => {
  if (students.length === 0) {
    return (
      <div className="p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
        <p className="text-muted-foreground mb-4">
          Guruhga o'quvchilarni qo'shing
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={onAddStudentClick} className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              Birinchi o'quvchini qo'shish
            </Button>
          </TooltipTrigger>
          <TooltipContent>Guruhga yangi o'quvchi qo'shish</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {students.map(student => (
        <StudentItem
          key={student.id}
          student={student}
          attendance={attendance[student.id]}
          onStudentClick={onStudentClick}
          onMarkAttendance={onMarkAttendance}
          onShowReward={onShowReward}
          onShowReason={onShowReason}
        />
      ))}
    </div>
  );
};

export default StudentList;
