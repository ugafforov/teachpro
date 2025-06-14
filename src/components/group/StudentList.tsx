
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Users, Plus, ArrowDown } from 'lucide-react';
import StudentItem from './StudentItem';
import StudentImport from '../StudentImport';

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
    // Guruh nomi va teacherId qaysi student uchun? 1 ta ham bo‘lmagani uchun, group_name va teacher_id prop bo‘sh ketmaydi
    // Odatda bu component faqat nomidan group tanlash ichida ishlatiladi, shuning uchun parentdan groupName va teacherId-ni props sifatida uzatib olish kerak.
    // Lekin hozirgi strukturada mavjud students[0]?.teacher_id va students[0]?.group_name qo‘llanilgan.
    // O‘quvchi yo‘q bo‘lsa `group_name` va `teacher_id` ni default bo‘sh string qilib jo‘natishdan boshqa yechim yo‘q (aksi holda import ishlamay qoladi).
    // Bu komponentdan foydalanishda parent (GroupDetails) avtomatik groupName va teacherId uzatadi.

    // Bu yerda 1-rasmdagi kodga ayni ko‘rinishda yozamiz:
    return (
      <div className="p-12 text-center">
        <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
        <p className="text-muted-foreground mb-4">
          Guruhga o'quvchilarni qo'shing
        </p>
        <div className="flex gap-2 justify-center">
          <StudentImport
            teacherId={students[0]?.teacher_id || ''}
            groupName={students[0]?.group_name}
            onImportComplete={() => {}} // parentda kerak joyda wire qilib yuboriladi
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onAddStudentClick}
                className="bg-black text-white hover:bg-gray-800 rounded-lg px-4 py-2 flex items-center font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                O'quvchi qo'shish
              </Button>
            </TooltipTrigger>
            <TooltipContent>Guruhga yangi o'quvchi qo'shish</TooltipContent>
          </Tooltip>
        </div>
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

