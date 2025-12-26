import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Calendar, Gift, AlertTriangle, TrendingUp, Users, Clock, Award, User, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateUz } from '@/lib/utils';

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
      // O'quvchining qo'shilgan sanasi
      const studentCreatedAt = new Date(studentData.created_at).toISOString().split('T')[0];

      // Guruhning barcha darslarini olish (noyob sanalar)
      const { data: groupStudents } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('group_name', studentData.group_name)
        .eq('is_active', true)
        .range(0, 10000);

      const groupStudentIds = groupStudents?.map(s => s.id) || [];
      
      // Guruhdagi barcha davomat yozuvlarini olish
      const { data: groupAttendance } = await supabase
        .from('attendance_records')
        .select('date, student_id')
        .eq('teacher_id', teacherId)
        .range(0, 10000);

      // Faqat shu guruhdagi o'quvchilarning davomatini filtrlash
      const groupStudentIdSet = new Set(groupStudentIds);
      const filteredGroupAttendance = groupAttendance?.filter(a => groupStudentIdSet.has(a.student_id)) || [];
      
      // Guruhning noyob dars sanalarini olish
      const groupClassDates = [...new Set(filteredGroupAttendance.map(a => a.date))];
      
      // Faqat o'quvchi qo'shilgandan keyingi darslarni hisoblash
      const relevantClassDates = groupClassDates.filter(date => date >= studentCreatedAt);
      const totalClasses = relevantClassDates.length;

      // O'quvchining davomat yozuvlarini olish
      const { data: attendanceData, error } = await supabase
        .from('attendance_records')
        .select('status, date')
        .eq('student_id', studentData.id)
        .eq('teacher_id', teacherId)
        .range(0, 10000);

      if (error) throw error;

      // Faqat qo'shilgan sanadan keyingi davomatni hisoblash
      const relevantAttendance = attendanceData?.filter(a => a.date >= studentCreatedAt) || [];
      
      const presentCount = relevantAttendance.filter(a => a.status === 'present').length;
      const lateCount = relevantAttendance.filter(a => a.status === 'late').length;
      // Yo'qlik = Jami darslar - Kelganlar - Kech qolganlar
      const absentCount = totalClasses - presentCount - lateCount;
      
      // Kechikib kelgan ham davomat sifatida hisoblansin
      const attendancePercentage = totalClasses > 0 ? Math.round(((presentCount + lateCount) / totalClasses) * 100) : 0;

      // Davomat ballari - TO'G'RI FORMULA: Present: +1, Late: +0.5, Absent: 0
      const attendancePoints = presentCount * 1 + lateCount * 0.5;

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
      const studentCreatedAt = new Date(studentData.created_at).toISOString().split('T')[0];

      // Mukofot/jarima ballari - turlar bo'yicha ajratish
      const { data: rewardData, error: rewardError } = await supabase
        .from('reward_penalty_history')
        .select('points, type')
        .eq('student_id', studentData.id)
        .eq('teacher_id', teacherId)
        .range(0, 10000);

      if (rewardError) throw rewardError;

      // Mukofot va Jarima turlarini alohida hisoblash (Baho ni chiqarib tashlash)
      const mukofotPoints = rewardData?.filter(r => r.type === 'Mukofot')
        .reduce((sum, r) => sum + Number(r.points || 0), 0) || 0;
      const jarimaPoints = rewardData?.filter(r => r.type === 'Jarima')
        .reduce((sum, r) => sum + Number(r.points || 0), 0) || 0;
      const rewardPenaltyPoints = mukofotPoints - jarimaPoints;

      // Guruhning barcha darslarini olish
      const { data: groupStudents } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('group_name', studentData.group_name)
        .eq('is_active', true)
        .range(0, 10000);

      const groupStudentIds = groupStudents?.map(s => s.id) || [];
      
      const { data: groupAttendance } = await supabase
        .from('attendance_records')
        .select('date, student_id')
        .eq('teacher_id', teacherId)
        .range(0, 10000);

      const groupStudentIdSet = new Set(groupStudentIds);
      const filteredGroupAttendance = groupAttendance?.filter(a => groupStudentIdSet.has(a.student_id)) || [];
      const groupClassDates = [...new Set(filteredGroupAttendance.map(a => a.date))];
      const relevantClassDates = groupClassDates.filter(date => date >= studentCreatedAt);

      // Davomat yozuvlarini olish
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('status, date')
        .eq('student_id', studentData.id)
        .eq('teacher_id', teacherId)
        .range(0, 10000);

      if (attendanceError) throw attendanceError;

      const relevantAttendance = attendanceData?.filter(a => a.date >= studentCreatedAt) || [];
      const presentCount = relevantAttendance.filter(a => a.status === 'present').length;
      const lateCount = relevantAttendance.filter(a => a.status === 'late').length;
      
      // TO'G'RI FORMULA: Present: +1, Late: +0.5, Absent: 0
      const attendancePoints = presentCount * 1 + lateCount * 0.5;

      // Jami ball = davomat ballari + (mukofot - jarima)
      const totalScore = attendancePoints + rewardPenaltyPoints;

      // Reyting pozitsiyasini hisoblash
      const { data: allStudentsData, error: allStudentsError } = await supabase
        .from('students')
        .select('id, created_at, group_name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .range(0, 10000);

      if (allStudentsError) throw allStudentsError;

      let rank = 1;
      if (allStudentsData && allStudentsData.length > 1) {
        // Barcha o'quvchilarning ballarini hisoblash
        const { data: allRewardData } = await supabase
          .from('reward_penalty_history')
          .select('student_id, points, type')
          .eq('teacher_id', teacherId)
          .range(0, 10000);

        const { data: allAttendanceData } = await supabase
          .from('attendance_records')
          .select('student_id, status, date')
          .eq('teacher_id', teacherId)
          .range(0, 10000);

        // Guruhlar bo'yicha noyob dars sanalarini hisoblash
        const groupClassDatesMap = new Map<string, Set<string>>();
        allStudentsData.forEach(s => {
          if (!groupClassDatesMap.has(s.group_name)) {
            groupClassDatesMap.set(s.group_name, new Set());
          }
        });

        allAttendanceData?.forEach(a => {
          const student = allStudentsData.find(s => s.id === a.student_id);
          if (student && groupClassDatesMap.has(student.group_name)) {
            groupClassDatesMap.get(student.group_name)!.add(a.date);
          }
        });

        const studentScores = allStudentsData.map(s => {
          const sCreatedAt = new Date(s.created_at).toISOString().split('T')[0];
          
          // Guruhning dars sanalarini olish va filtrlash
          const sGroupDates = groupClassDatesMap.get(s.group_name);
          const sRelevantDates = sGroupDates 
            ? Array.from(sGroupDates).filter(date => date >= sCreatedAt)
            : [];

          // Mukofot/Jarima
          const sMukofot = allRewardData?.filter(r => r.student_id === s.id && r.type === 'Mukofot')
            .reduce((sum, r) => sum + Number(r.points || 0), 0) || 0;
          const sJarima = allRewardData?.filter(r => r.student_id === s.id && r.type === 'Jarima')
            .reduce((sum, r) => sum + Number(r.points || 0), 0) || 0;
          const sRewardPoints = sMukofot - sJarima;

          // Davomat
          const sAttendance = allAttendanceData?.filter(a => 
            a.student_id === s.id && a.date >= sCreatedAt
          ) || [];
          const sPresentCount = sAttendance.filter(a => a.status === 'present').length;
          const sLateCount = sAttendance.filter(a => a.status === 'late').length;
          
          // TO'G'RI FORMULA: Present: +1, Late: +0.5, Absent: 0
          const sAttendancePoints = sPresentCount * 1 + sLateCount * 0.5;
          
          return {
            studentId: s.id,
            totalScore: sAttendancePoints + sRewardPoints
          };
        });

        // Ballar bo'yicha tartiblash va reyting topish
        studentScores.sort((a, b) => b.totalScore - a.totalScore);
        const currentStudentIndex = studentScores.findIndex(s => s.studentId === studentData.id);
        rank = currentStudentIndex + 1;
      }

      setStats(prev => ({
        ...prev!,
        totalScore,
        rank,
        rewardPenaltyPoints
      }));

    } catch (error) {
      console.error('Error fetching score stats:', error);
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
        .in('type', ['Mukofot', 'Jarima']) // Faqat Mukofot va Jarima
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
