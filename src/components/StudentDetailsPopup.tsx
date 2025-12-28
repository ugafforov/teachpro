import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Calendar, Gift, AlertTriangle, TrendingUp, Users, Clock, Award, User, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateUz } from '@/lib/utils';
import { calculateStudentScore, calculateStudentRank, StudentScoreResult } from '@/lib/studentScoreCalculator';

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

interface StudentStats extends StudentScoreResult {
  rank: number;
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

      // Markaziy funksiya orqali ball hisoblash (GroupDetails bilan bir xil)
      const [scoreResult, rank, recentRewards] = await Promise.all([
        calculateStudentScore(
          studentData.id,
          teacherId,
          studentData.group_name,
          studentData.created_at
        ),
        calculateStudentRank(studentData.id, teacherId),
        fetchRecentRewards(studentData.id)
      ]);

      setStats({
        ...scoreResult,
        rank,
        recentRewards
      });

    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentRewards = async (studentId: string): Promise<StudentStats['recentRewards']> => {
    try {
      const { data: rewardsData, error } = await supabase
        .from('reward_penalty_history')
        .select('points, reason, created_at, type')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .in('type', ['Mukofot', 'Jarima'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return rewardsData || [];
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-xl">
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
        <DialogContent className="max-w-xl">
          <div className="text-center p-8">
            <p className="text-muted-foreground">O'quvchi ma'lumotlari topilmadi</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">{student.name}</DialogTitle>
              <p className="text-muted-foreground">{student.group_name} guruhi</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Asosiy ko'rsatkichlar */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 text-center">
              <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-600">{stats.totalScore.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Jami ball</div>
            </Card>
            <Card className="p-4 text-center">
              <BarChart3 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-600">{stats.attendancePercentage}%</div>
              <div className="text-sm text-muted-foreground">Davomat</div>
            </Card>
          </div>

          {/* Reyting */}
          {stats.rank > 0 && (
            <Card className="p-4 text-center">
              <Award className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-600">{stats.rank}</div>
              <div className="text-sm text-muted-foreground">Reyting pozitsiyasi</div>
            </Card>
          )}

          {/* Mukofot/Jarima ko'rsatkichlari */}
          {stats.rewardPenaltyPoints !== 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-center gap-2">
                {stats.rewardPenaltyPoints > 0 ? (
                  <Gift className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span className={`text-lg font-bold ${
                  stats.rewardPenaltyPoints > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.rewardPenaltyPoints > 0 ? '+' : ''}{stats.rewardPenaltyPoints} ball
                </span>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                {stats.rewardPenaltyPoints > 0 ? 'Mukofot ballari' : 'Jarima ballari'}
              </div>
            </Card>
          )}

          {/* Davomat statistikasi */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Davomat statistikasi
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold">{stats.totalClasses}</div>
                <div className="text-xs text-muted-foreground">Jami</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">{stats.presentCount}</div>
                <div className="text-xs text-muted-foreground">Kelgan</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">{stats.lateCount}</div>
                <div className="text-xs text-muted-foreground">Kech</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600">{stats.absentCount}</div>
                <div className="text-xs text-muted-foreground">Yo'q</div>
              </div>
            </div>
          </Card>

          {/* So'nggi faoliyat */}
          {stats.recentRewards.length > 0 && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                So'nggi faoliyat
              </h3>
              <div className="space-y-2">
                {stats.recentRewards.slice(0, 3).map((reward, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      {reward.type === 'Mukofot' ? (
                        <Gift className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">{reward.reason}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        reward.type === 'Mukofot' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {reward.type === 'Mukofot' ? '+' : '-'}{reward.points}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateUz(reward.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Qo'shimcha ma'lumotlar */}
          {(student.student_id || student.email || student.phone) && (
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Ma'lumotlar</h3>
              <div className="space-y-2 text-sm">
                {student.student_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-medium">{student.student_id}</span>
                  </div>
                )}
                {student.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{student.email}</span>
                  </div>
                )}
                {student.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefon:</span>
                    <span className="font-medium">{student.phone}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          <div className="flex justify-end pt-4">
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
