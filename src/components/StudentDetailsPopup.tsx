import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Calendar, Gift, AlertTriangle, TrendingUp, Users, Clock, Award, User, BarChart3 } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { cn, formatDateUz, getTashkentDate } from '@/lib/utils';
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
  created_at: any;
  join_date?: string;
  left_date?: string;
  archived_at?: any;
}

interface StudentStats extends StudentScoreResult {
  rank: number;
  recentRewards: Array<{
    points: number;
    reason: string;
    created_at: any;
    type: string;
  }>;
}

type AttendanceStatus = 'present' | 'late' | 'absent_with_reason' | 'absent_without_reason';

interface AttendanceHistoryRecord {
  date: string;
  status: AttendanceStatus;
  notes?: string;
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
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'rewards'>('overview');

  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentDetails();
    }
  }, [isOpen, studentId, teacherId]);

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);

      const studentDoc = await getDoc(doc(db, 'students', studentId));
      if (!studentDoc.exists()) {
        setStudent(null);
        setLoading(false);
        return;
      }

      const studentData = { id: studentDoc.id, ...studentDoc.data() } as StudentDetails;
      setStudent(studentData);

      const effectiveLeaveDate = (() => {
        if (studentData.left_date) return studentData.left_date;
        if (studentData.archived_at) {
          if (studentData.archived_at instanceof Timestamp) {
            return getTashkentDate(studentData.archived_at.toDate()).toISOString().split('T')[0];
          }
          if (typeof studentData.archived_at === 'string') {
            return getTashkentDate(new Date(studentData.archived_at)).toISOString().split('T')[0];
          }
          if (typeof (studentData.archived_at as any)?.seconds === 'number') {
            return getTashkentDate(new Date((studentData.archived_at as any).seconds * 1000)).toISOString().split('T')[0];
          }
        }
        return null;
      })();

      const [scoreResult, rank, recentRewards, attendance] = await Promise.all([
        calculateStudentScore(
          studentData.id,
          teacherId,
          studentData.group_name,
          studentData.created_at,
          studentData.join_date,
          effectiveLeaveDate
        ),
        calculateStudentRank(studentData.id, teacherId),
        fetchRecentRewards(studentData.id, studentData.join_date, effectiveLeaveDate),
        fetchAttendanceHistory(studentData.id, studentData.join_date, effectiveLeaveDate)
      ]);

      setStats({
        ...scoreResult,
        rank,
        recentRewards
      });
      setAttendanceHistory(attendance);

    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentRewards = async (studentId: string, joinDate?: string, leaveDate?: string | null): Promise<StudentStats['recentRewards']> => {
    try {
      const q = query(
        collection(db, 'reward_penalty_history'),
        where('student_id', '==', studentId),
        where('teacher_id', '==', teacherId),
        where('type', 'in', ['Mukofot', 'Jarima']),
        orderBy('created_at', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(d => d.data() as any);
      const filtered = rows.filter(r => {
        if (!r?.date) return false;
        if (joinDate && r.date < joinDate) return false;
        if (leaveDate && r.date > leaveDate) return false;
        return true;
      });
      const sorted = [...filtered].sort((a, b) => {
        if (a.date === b.date) return 0;
        return a.date < b.date ? 1 : -1;
      });
      return sorted;
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }
  };

  const fetchAttendanceHistory = async (studentId: string, joinDate?: string, leaveDate?: string | null): Promise<AttendanceHistoryRecord[]> => {
    try {
      const q = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId),
        where('student_id', '==', studentId)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(d => d.data() as any);
      const filtered = rows.filter(r => {
        if (!r?.date) return false;
        if (joinDate && r.date < joinDate) return false;
        if (leaveDate && r.date > leaveDate) return false;
        return true;
      });
      const sorted = [...filtered].sort((a, b) => {
        if (a.date === b.date) return 0;
        return a.date < b.date ? 1 : -1;
      });
      return sorted.slice(0, 100);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
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

        <div className="space-y-4">
          <div className="flex border-b border-border/60">
            <button
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'overview'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('overview')}
            >
              Umumiy
            </button>
            <button
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'attendance'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('attendance')}
            >
              Davomat
            </button>
            <button
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'rewards'
                  ? 'text-blue-600 border-b-2 border-blue-500'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab('rewards')}
            >
              Mukofot/Jarima
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
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

              {stats.rank > 0 && (
                <Card className="p-4 text-center">
                  <Award className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-600">{stats.rank}</div>
                  <div className="text-sm text-muted-foreground">Reyting pozitsiyasi</div>
                </Card>
              )}

              {stats.rewardPenaltyPoints !== 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-center gap-2">
                    {stats.rewardPenaltyPoints > 0 ? (
                      <Gift className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    )}
                    <span
                      className={cn(
                        'text-lg font-bold',
                        stats.rewardPenaltyPoints > 0 ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {stats.rewardPenaltyPoints > 0 ? '+' : ''}
                      {stats.rewardPenaltyPoints} ball
                    </span>
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    {stats.rewardPenaltyPoints > 0 ? 'Mukofot ballari' : 'Jarima ballari'}
                  </div>
                </Card>
              )}

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
            </div>
          )}

          {activeTab === 'attendance' && (
            <Card className="p-4 space-y-3">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Davomat tarixi
              </h3>
              {attendanceHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Davomat ma'lumotlari topilmadi.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {attendanceHistory.map((record, index) => (
                    <div
                      key={`${record.date}_${index}`}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {formatDateUz(record.date)}
                        </div>
                        {record.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {record.notes}
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-semibold px-2 py-1 rounded-full',
                          record.status === 'present' && 'bg-green-100 text-green-700',
                          record.status === 'late' && 'bg-yellow-100 text-yellow-700',
                          record.status === 'absent_with_reason' && 'bg-orange-100 text-orange-700',
                          record.status === 'absent_without_reason' && 'bg-red-100 text-red-700'
                        )}
                      >
                        {record.status === 'present' && "Kelgan"}
                        {record.status === 'late' && "Kechikkan"}
                        {record.status === 'absent_with_reason' && "Sababli yo'q"}
                        {record.status === 'absent_without_reason' && "Sababsiz yo'q"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'rewards' && (
            <Card className="p-4 space-y-3">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                Mukofot va jarima tarixi
              </h3>
              {stats.recentRewards.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Mukofot yoki jarima ma'lumotlari topilmadi.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {stats.recentRewards.map((reward, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        {reward.type === 'Mukofot' ? (
                          <Gift className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {reward.reason}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {reward.created_at instanceof Timestamp
                              ? formatDateUz(reward.created_at.toDate().toISOString())
                              : formatDateUz(reward.created_at)}
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          reward.type === 'Mukofot' ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {reward.type === 'Mukofot' ? '+' : '-'}
                        {reward.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <div className="flex justify-end pt-2">
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
