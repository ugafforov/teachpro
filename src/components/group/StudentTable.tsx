
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import StudentAvatar from './StudentAvatar';
import AttendanceButton from './AttendanceButton';
import ReasonButton from './ReasonButton';
import RewardPenaltyButton from './RewardPenaltyButton';
import GradeInput from './GradeInput';

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
  hasRewardToday?: boolean;
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'absent_with_reason';

interface StudentTableProps {
  students: Student[];
  attendance: Record<string, { status: AttendanceStatus; reason?: string | null }>;
  onStudentClick: (studentId: string) => void;
  onMarkAttendance: (studentId: string, status: AttendanceStatus, reason?: string | null) => void;
  onShowReward: (studentId: string) => void;
  onShowReason: (student: Student) => void;
  onAddStudentClick: () => void;
  selectedDate: string;
  teacherId: string;
  onGradeChange?: () => void;
}

const StudentTable: React.FC<StudentTableProps> = ({
  students,
  attendance,
  onStudentClick,
  onMarkAttendance,
  onShowReward,
  onShowReason,
  onAddStudentClick,
  selectedDate,
  teacherId,
  onGradeChange
}) => {
  if (students.length === 0) {
    return (
      <Card className="p-12 text-center bg-white border border-gray-200 rounded-lg">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-2.025" />
          </svg>
        </div>
        <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
        <p className="text-gray-600 mb-4">
          Ushbu guruhga birinchi o'quvchingizni qo'shing
        </p>
        <Button onClick={onAddStudentClick} className="bg-black text-white hover:bg-gray-800">
          <Plus className="w-4 h-4 mr-2" />
          O'quvchi qo'shish
        </Button>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden bg-white border border-gray-200 rounded-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-700">O'quvchi</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Davomat</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Baho</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Sabab</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Ball</th>
              <th className="text-center py-3 px-4 font-medium text-gray-700">Mukofot</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {students.map((student) => {
              const studentAttendance = attendance[student.id];
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <StudentAvatar name={student.name} />
                      <div className="cursor-pointer" onClick={() => onStudentClick(student.id)}>
                        <div className="font-medium text-gray-900">{student.name}</div>
                        {student.student_id && (
                          <div className="text-sm text-gray-500">ID: {student.student_id}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center gap-1">
                      <AttendanceButton
                        status="present"
                        isActive={studentAttendance?.status === 'present'}
                        onClick={() => onMarkAttendance(student.id, 'present')}
                      />
                      <AttendanceButton
                        status="late"
                        isActive={studentAttendance?.status === 'late'}
                        onClick={() => onMarkAttendance(student.id, 'late')}
                      />
                      <AttendanceButton
                        status="absent"
                        isActive={studentAttendance?.status === 'absent'}
                        onClick={() => onMarkAttendance(student.id, 'absent')}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <GradeInput
                        studentId={student.id}
                        teacherId={teacherId}
                        selectedDate={selectedDate}
                        onGradeChange={onGradeChange}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <ReasonButton
                        student={student}
                        attendanceStatus={studentAttendance?.status}
                        reason={studentAttendance?.reason}
                        onClick={() => onShowReason(student)}
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      (student.rewardPenaltyPoints || 0) >= 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.rewardPenaltyPoints || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <RewardPenaltyButton
                        points={student.rewardPenaltyPoints}
                        hasRewardToday={student.hasRewardToday}
                        onClick={() => onShowReward(student.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default StudentTable;
