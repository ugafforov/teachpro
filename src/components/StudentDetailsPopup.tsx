import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  X, 
  User, 
  Trophy, 
  BarChart3, 
  Clock, 
  Check, 
  Plus,
  Gift,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  group_name: string;
  student_id?: string;
  email?: string;
  phone?: string;
}

interface StudentScore {
  total_score: number;
  attendance_points: number;
  reward_penalty_points: number;
  class_rank: number;
}

interface AttendanceRecord {
  date: string;
  status: string;
}

interface RewardPenaltyRecord {
  id: string;
  points: number;
  reason: string;
  type: string;
  created_at: string;
}

interface StudentDetailsPopupProps {
  student: Student;
  teacherId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const StudentDetailsPopup: React.FC<StudentDetailsPopupProps> = ({ 
  student, 
  teacherId, 
  onClose, 
  onUpdate 
}) => {
  const [studentScore, setStudentScore] = useState<StudentScore | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [rewardPenaltyHistory, setRewardPenaltyHistory] = useState<RewardPenaltyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [newReward, setNewReward] = useState({ points: '', type: 'reward' });
  const { toast } = useToast();

  useEffect(() => {
    fetchStudentData();
  }, [student.id, teacherId]);

  const fetchStudentData = async () => {
    try {
      // Fetch student score and ranking
      const { data: scoreData, error: scoreError } = await supabase
        .from('student_scores')
        .select('*')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .single();

      if (scoreError && scoreError.code !== 'PGRST116') {
        console.error('Error fetching student scores:', scoreError);
      } else if (scoreData) {
        setStudentScore(scoreData);
      }

      // Fetch recent attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('date, status')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .order('date', { ascending: false })
        .limit(10);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
      } else {
        setRecentAttendance(attendanceData || []);
      }

      // Fetch reward/penalty history
      const { data: historyData, error: historyError } = await supabase
        .from('reward_penalty_history')
        .select('*')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) {
        console.error('Error fetching reward/penalty history:', historyError);
      } else {
        setRewardPenaltyHistory(historyData || []);
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRewardPenalty = async () => {
    if (!newReward.points) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Ball miqdorini kiriting",
        variant: "destructive",
      });
      return;
    }

    const points = parseFloat(newReward.points);
    if (isNaN(points)) {
      toast({
        title: "Noto'g'ri format",
        description: "Ball sonli qiymat bo'lishi kerak",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('reward_penalty_history')
        .insert({
          student_id: student.id,
          teacher_id: teacherId,
          points: newReward.type === 'penalty' ? -Math.abs(points) : Math.abs(points),
          reason: newReward.type === 'reward' ? 'Mukofot' : 'Jarima',
          type: newReward.type
        });

      if (error) throw error;

      await fetchStudentData();
      onUpdate();
      
      setNewReward({ points: '', type: 'reward' });
      setIsAddingReward(false);
      
      toast({
        title: newReward.type === 'reward' ? "Mukofot berildi" : "Jarima berildi",
        description: `${student.name}ga ${Math.abs(points)} ball ${newReward.type === 'reward' ? 'qo\'shildi' : 'ayrildi'}`,
      });
    } catch (error) {
      console.error('Error adding reward/penalty:', error);
      toast({
        title: "Xatolik",
        description: "Ball qo'shishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <Check className="w-4 h-4 text-green-600" />;
      case 'absent': return <X className="w-4 h-4 text-red-600" />;
      case 'late': return <Clock className="w-4 h-4 text-orange-600" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'present': return 'Kelgan';
      case 'absent': return 'Kelmagan';
      case 'late': return 'Kechikkan';
      default: return '';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700 border-green-200';
      case 'absent': return 'bg-red-50 text-red-700 border-red-200';
      case 'late': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{student.name}</h2>
                <p className="text-gray-600">{student.group_name} guruhi</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Score and Ranking */}
          {studentScore && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 text-center border border-gray-200">
                <div className="flex items-center justify-center mb-2">
                  <Trophy className="w-8 h-8 text-orange-500" />
                </div>
                <p className="text-2xl font-bold">{studentScore.class_rank || 'N/A'}</p>
                <p className="text-sm text-gray-600">Reyting o'rni</p>
              </Card>
              <Card className="p-4 text-center border border-gray-200">
                <div className="flex items-center justify-center mb-2">
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{studentScore.total_score.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Umumiy ball</p>
              </Card>
              <Card className="p-4 text-center border border-gray-200">
                <div className="flex items-center justify-center mb-2">
                  <Calendar className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{studentScore.attendance_points.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Davomat balli</p>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Add Reward/Penalty */}
            <Card className="p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Mukofot/Jarima</h3>
                <Button
                  onClick={() => setIsAddingReward(!isAddingReward)}
                  size="sm"
                  className="bg-black text-white hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Qo'shish
                </Button>
              </div>

              {isAddingReward && (
                <div className="space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => setNewReward({ ...newReward, type: 'reward' })}
                      variant={newReward.type === 'reward' ? 'default' : 'outline'}
                      className={newReward.type === 'reward' ? 'bg-black text-white' : ''}
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      Mukofot
                    </Button>
                    <Button
                      onClick={() => setNewReward({ ...newReward, type: 'penalty' })}
                      variant={newReward.type === 'penalty' ? 'default' : 'outline'}
                      className={newReward.type === 'penalty' ? 'bg-black text-white' : ''}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Jarima
                    </Button>
                  </div>
                  <div>
                    <Label>Ball miqdori</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newReward.points}
                      onChange={(e) => setNewReward({ ...newReward, points: e.target.value })}
                      placeholder="Masalan: 5"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={addRewardPenalty}
                      className="bg-black text-white hover:bg-gray-800 flex-1"
                    >
                      Saqlash
                    </Button>
                    <Button
                      onClick={() => setIsAddingReward(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Bekor qilish
                    </Button>
                  </div>
                </div>
              )}

              {/* Reward/Penalty History */}
              <div className="space-y-3">
                <h4 className="font-medium">Oxirgi o'zgarishlar</h4>
                {rewardPenaltyHistory.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">
                    Hozircha mukofot yoki jarima berilmagan
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {rewardPenaltyHistory.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          {record.type === 'reward' ? (
                            <Gift className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{record.reason}</p>
                            <p className="text-xs text-gray-600">
                              {new Date(record.created_at).toLocaleDateString('uz-UZ')}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          className={`${
                            record.points > 0 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {record.points > 0 ? '+' : ''}{record.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent Attendance */}
            <Card className="p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Oxirgi davomat</h3>
              {recentAttendance.length === 0 ? (
                <p className="text-gray-600 text-center py-4">
                  Davomat ma'lumotlari topilmadi
                </p>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentAttendance.map((record, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(record.status)}
                        <span className="font-medium">
                          {new Date(record.date).toLocaleDateString('uz-UZ', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <Badge className={getStatusBadgeClass(record.status)}>
                        {getStatusText(record.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Additional Student Info */}
          {(student.student_id || student.email || student.phone) && (
            <Card className="p-6 border border-gray-200">
              <h3 className="text-lg font-semibold mb-4">Qo'shimcha ma'lumotlar</h3>
              <div className="space-y-2">
                {student.student_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">O'quvchi ID:</span>
                    <span className="font-medium">{student.student_id}</span>
                  </div>
                )}
                {student.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-medium">{student.email}</span>
                  </div>
                )}
                {student.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Telefon:</span>
                    <span className="font-medium">{student.phone}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDetailsPopup;
