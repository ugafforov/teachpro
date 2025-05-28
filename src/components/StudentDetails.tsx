
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, User, Trophy, BarChart3, Clock, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  group_name: string;
  student_id?: string;
  email?: string;
  phone?: string;
}

interface StudentStats {
  total_classes: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  attendance_percentage: number;
  rank_position: number;
}

interface StudentDetailsProps {
  student: Student;
  teacherId: string;
  onClose: () => void;
}

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, teacherId, onClose }) => {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudentStats();
    fetchRecentAttendance();
  }, [student.id, teacherId]);

  const fetchStudentStats = async () => {
    try {
      const { data, error } = await supabase
        .from('student_rankings')
        .select('*')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setStats(data);
    } catch (error) {
      console.error('Error fetching student stats:', error);
    }
  };

  const fetchRecentAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('date, status')
        .eq('student_id', student.id)
        .eq('teacher_id', teacherId)
        .order('date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentAttendance(data || []);
    } catch (error) {
      console.error('Error fetching recent attendance:', error);
    } finally {
      setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700';
      case 'absent': return 'bg-red-50 text-red-700';
      case 'late': return 'bg-orange-50 text-orange-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{student.name}</h2>
                <p className="text-muted-foreground">{student.group_name} guruhi</p>
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
          {/* Reyting va statistika */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
                <p className="text-2xl font-bold">{stats.rank_position}</p>
                <p className="text-sm text-muted-foreground">Reyting o'rni</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{stats.attendance_percentage.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Davomat foizi</p>
              </Card>
              <Card className="p-4 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Calendar className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{stats.total_classes}</p>
                <p className="text-sm text-muted-foreground">Jami darslar</p>
              </Card>
            </div>
          )}

          {/* Batafsil statistika */}
          {stats && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Davomat statistikasi</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-xl font-bold text-green-600">{stats.present_count}</p>
                  <p className="text-sm text-muted-foreground">Kelgan</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                  <p className="text-xl font-bold text-orange-600">{stats.late_count}</p>
                  <p className="text-sm text-muted-foreground">Kechikkan</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <X className="w-6 h-6 text-red-600" />
                  </div>
                  <p className="text-xl font-bold text-red-600">{stats.absent_count}</p>
                  <p className="text-sm text-muted-foreground">Kelmagan</p>
                </div>
              </div>
            </Card>
          )}

          {/* Oxirgi davomat */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Oxirgi davomat</h3>
            {recentAttendance.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Davomat ma'lumotlari topilmadi
              </p>
            ) : (
              <div className="space-y-3">
                {recentAttendance.map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(record.status)}
                      <span className="font-medium">
                        {new Date(record.date).toLocaleDateString('uz-UZ', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <Badge className={getStatusColor(record.status)}>
                      {getStatusText(record.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Qo'shimcha ma'lumotlar */}
          {(student.student_id || student.email || student.phone) && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Qo'shimcha ma'lumotlar</h3>
              <div className="space-y-2">
                {student.student_id && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">O'quvchi ID:</span>
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
      </div>
    </div>
  );
};

export default StudentDetails;
