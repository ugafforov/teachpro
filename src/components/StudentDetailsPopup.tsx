
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Calendar, Gift, AlertTriangle, TrendingUp, Users, Clock, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface StudentDetailsPopupProps {
  studentId: string;
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
}

interface StudentDetails {
  id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  created_at: string;
}

interface StudentStats {
  totalScore: number;
  attendancePoints: number;
  rewardPenaltyPoints: number;
  attendancePercentage: number;
  rank: number;
  totalClasses: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  recentRewards: Array<{
    points: number;
    reason: string;
    created_at: string;
    type: string;
  }>;
}

const StudentDetailsPopup: React.FC<StudentDetailsPopupProps> = ({
  studentId,
  isOpen,
  onClose,
  teacherId
}) => {
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentDetails();
    }
  }, [isOpen, studentId, teacherId]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);

      // O'quvchi ma'lumotlarini olish
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .eq('is_active', true)
        .single();

      if (studentError) throw studentError;
      setStudent(studentData);

      // Statistikalar
      await Promise.all([
        fetchAttendanceStats(studentData),
        fetchScoreStats(studentData),
        fetchRecentRewards(studentData)
      ]);

    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceStats = async (studentData: StudentDetails) => {
    try {
      // Umumiy davomat hisobi (faqat faol o'quvchi uchun)
      const { data: attendanceData, error } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', studentData.id)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      const totalClasses = attendanceData?.length || 0;
      const presentCount = attendanceData?.filter(a => a.status === 'present').length || 0;
      const lateCount = attendanceData?.filter(a => a.status === 'late').length || 0;
      const absentCount = attendanceData?.filter(a => a.status === 'absent').length || 0;
      const attendancePercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      // Davomat ballari
      const attendancePoints = presentCount * 1 + lateCount * 0.5 - absentCount * 1;

      setStats(prev => ({
        ...prev!,
        totalClasses,
        presentCount,
        lateCount,
        absentCount,
        attendancePercentage,
        attendancePoints
      }));

    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    }
  };

  const fetchScoreStats = async (studentData: StudentDetails) => {
    try {
      // O'quvchi ballari
      const { data: scoreData, error } = await supabase
        .from('student_scores')
        .select('*')
        .eq('student_id', studentData.id)
        .eq('teacher_id', teacherId)
        .single();

      let totalScore = 0;
      let rank = 0;
      let rewardPenaltyPoints = 0;

      if (scoreData) {
        totalScore = scoreData.total_score || 0;
        rank = scoreData.class_rank || 0;
        rewardPenaltyPoints = scoreData.reward_penalty_points || 0;
      }

      setStats(prev => ({
        ...prev!,
        totalScore,
        rank,
        rewardPenaltyPoints
      }));

    } catch (error) {
      console.error('Error fetching score stats:', error);
      // Xatolik bo'lsa ham, nol qiymatlar bilan davom etish
      setStats(prev => ({
        ...prev!,
        totalScore: 0,
        rank: 0,
        rewardPenaltyPoints: 0
      }));
    }
  };

  const fetchRecentRewards = async (studentData: StudentDetails) => {
    try {
      const { data: rewardsData, error } = await supabase
        .from('reward_penalty_history')
        .select('points, reason, created_at, type')
        .eq('student_id', studentData.id)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      setStats(prev => ({
        ...prev!,
        recentRewards: rewardsData || []
      }));

    } catch (error) {
      console.error('Error fetching rewards:', error);
      setStats(prev => ({
        ...prev!,
        recentRewards: []
      }));
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!student || !stats) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="text-center p-8">
            <p className="text-muted-foreground">O'quvchi ma'lumotlari topilmadi</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{student.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asosiy ma'lumotlar */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">O'quvchi ID:</span>
                <p className="font-medium">{student.student_id || 'Belgilanmagan'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Guruh:</span>
                <p className="font-medium">{student.group_name}</p>
              </div>
              {student.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium">{student.email}</p>
                </div>
              )}
              {student.phone && (
                <div>
                  <span className="text-muted-foreground">Telefon:</span>
                  <p className="font-medium">{student.phone}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Akademik ko'rsatkichlar */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Akademik ko'rsatkichlar</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.totalScore}</div>
                <div className="text-sm text-muted-foreground">Jami ball</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.attendancePoints}</div>
                <div className="text-sm text-muted-foreground">Davomat ball</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.rewardPenaltyPoints}</div>
                <div className="text-sm text-muted-foreground">Mukofot/Jarima</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">{stats.attendancePercentage}%</div>
                <div className="text-sm text-muted-foreground">Davomat %</div>
              </div>
            </div>
          </Card>

          {/* Davomat tafsilotlari */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold">Davomat tafsilotlari</h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold">{stats.totalClasses}</div>
                <div className="text-xs text-muted-foreground">Jami dars</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{stats.presentCount}</div>
                <div className="text-xs text-muted-foreground">Kelgan</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">{stats.lateCount}</div>
                <div className="text-xs text-muted-foreground">Kech kelgan</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">{stats.absentCount}</div>
                <div className="text-xs text-muted-foreground">Kelmagan</div>
              </div>
            </div>
          </Card>

          {/* So'nggi mukofot va jarimalar */}
          {stats.recentRewards.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-semibold">So'nggi mukofot va jarimalar</h3>
              </div>
              <div className="space-y-2">
                {stats.recentRewards.map((reward, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {reward.type === 'reward' ? (
                        <Gift className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">{reward.reason}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        reward.points > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {reward.points > 0 ? '+' : ''}{reward.points}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(reward.created_at).toLocaleDateString('uz-UZ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              Yopish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentDetailsPopup;
