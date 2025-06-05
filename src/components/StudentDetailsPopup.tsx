
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { User, Calendar, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StudentDetailsPopupProps {
  studentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
}

interface StudentDetails {
  id: string;
  name: string;
  student_id?: string;
  group_name: string;
  created_at: string;
  totalScore: number;
  attendancePoints: number;
  rewardPenaltyPoints: number;
  attendancePercentage: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalClasses: number;
}

const StudentDetailsPopup: React.FC<StudentDetailsPopupProps> = ({
  studentId,
  isOpen,
  onClose,
  teacherId
}) => {
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId && isOpen) {
      fetchStudentDetails();
    }
  }, [studentId, isOpen, teacherId]);

  const fetchStudentDetails = async () => {
    if (!studentId) return;

    try {
      setLoading(true);

      // Fetch basic student info
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (studentError) throw studentError;

      // Fetch student scores
      const { data: scoreData, error: scoreError } = await supabase
        .from('student_scores')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      // Fetch attendance stats
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (attendanceError) throw attendanceError;

      // Calculate attendance statistics
      const totalClasses = attendanceData?.length || 0;
      const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
      const lateCount = attendanceData?.filter(a => a.status === 'late').length || 0;
      const absentCount = attendanceData?.filter(a => a.status === 'absent').length || 0;
      const attendancePercentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

      setStudent({
        ...studentData,
        totalScore: scoreData?.total_score || 0,
        attendancePoints: scoreData?.attendance_points || 0,
        rewardPenaltyPoints: scoreData?.reward_penalty_points || 0,
        attendancePercentage: Math.round(attendancePercentage * 100) / 100,
        presentCount,
        lateCount,
        absentCount,
        totalClasses
      });
    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!studentId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            O'quvchi ma'lumotlari
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : student ? (
          <div className="space-y-4">
            {/* Basic Info */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Asosiy ma'lumotlar
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ism familiya:</span>
                  <span className="font-medium">{student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Guruh:</span>
                  <span className="font-medium">{student.group_name}</span>
                </div>
                {student.student_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID:</span>
                    <span className="font-medium">{student.student_id}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Academic Performance */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Akademik ko'rsatkichlar
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{student.totalScore}</div>
                  <div className="text-xs text-gray-600">Jami ball</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{student.attendancePoints}</div>
                  <div className="text-xs text-gray-600">Davomat ball</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${student.rewardPenaltyPoints >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {student.rewardPenaltyPoints > 0 ? '+' : ''}{student.rewardPenaltyPoints}
                  </div>
                  <div className="text-xs text-gray-600">Mukofot/Jarima</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">{student.attendancePercentage}%</div>
                  <div className="text-xs text-gray-600">Davomat %</div>
                </div>
              </div>
            </Card>

            {/* Attendance Summary */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Davomat xulosasi
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold">{student.totalClasses}</div>
                  <div className="text-xs text-gray-600">Jami darslar</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{student.presentCount}</div>
                  <div className="text-xs text-gray-600">Kelgan</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-600">{student.lateCount}</div>
                  <div className="text-xs text-gray-600">Kech kelgan</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{student.absentCount}</div>
                  <div className="text-xs text-gray-600">Kelmagan</div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <div className="text-center p-8">
            <p className="text-gray-500">O'quvchi ma'lumotlari topilmadi</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsPopup;
