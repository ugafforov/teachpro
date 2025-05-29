import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Users, Check, X, Clock, Download, Gift, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StudentDetailsPopup from './StudentDetailsPopup';

interface Student {
  id: string;
  name: string;
  group_name: string;
  student_id?: string;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  students?: Student;
}

interface AttendanceTrackerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ teacherId, onStatsUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchAttendanceRecords();
  }, [teacherId, selectedDate]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true);

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchilarni yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students (
            id,
            name,
            group_name,
            student_id,
            is_active
          )
        `)
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate);

      if (error) throw error;
      
      const typedData = (data || [])
        .filter(record => record.students?.is_active)
        .map(record => ({
          ...record,
          status: record.status as 'present' | 'absent' | 'late'
        }));
      
      setAttendanceRecords(typedData);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  const groups = [...new Set(students.map(student => student.group_name))];
  
  const filteredStudents = selectedGroup === 'all' 
    ? students 
    : students.filter(student => student.group_name === selectedGroup);

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(record => record.student_id === studentId);
    return record?.status || null;
  };

  const markAttendance = async (studentId: string, status: 'present' | 'absent' | 'late') => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          student_id: studentId,
          teacher_id: teacherId,
          date: selectedDate,
          status: status
        }, {
          onConflict: 'student_id,date'
        });

      if (error) throw error;

      await fetchAttendanceRecords();
      await onStatsUpdate();
      
      toast({
        title: "Davomat yangilandi",
        description: `O'quvchi ${status === 'present' ? 'kelgan' : status === 'late' ? 'kechikkan' : 'kelmagan'} deb belgilandi`,
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast({
        title: "Xatolik",
        description: "Davomatni yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const markAllPresent = async () => {
    try {
      const attendancePromises = filteredStudents.map(student =>
        supabase
          .from('attendance_records')
          .upsert({
            student_id: student.id,
            teacher_id: teacherId,
            date: selectedDate,
            status: 'present'
          }, {
            onConflict: 'student_id,date'
          })
      );

      await Promise.all(attendancePromises);
      await fetchAttendanceRecords();
      await onStatsUpdate();

      toast({
        title: "Davomat yangilandi",
        description: `Barcha ${filteredStudents.length} o'quvchi kelgan deb belgilandi`,
      });
    } catch (error) {
      console.error('Error marking all present:', error);
      toast({
        title: "Xatolik",
        description: "Davomatni yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const handleStudentClick = async (studentId: string) => {
    try {
      const { data: student, error } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();

      if (error) throw error;
      setSelectedStudent(student);
    } catch (error) {
      console.error('Error fetching student details:', error);
    }
  };

  const addReward = async (studentId: string) => {
    if (!rewardPoints) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Ball miqdorini kiriting",
        variant: "destructive",
      });
      return;
    }

    const points = parseFloat(rewardPoints);
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
          student_id: studentId,
          teacher_id: teacherId,
          points: rewardType === 'penalty' ? -Math.abs(points) : Math.abs(points),
          reason: rewardType === 'reward' ? 'Mukofot' : 'Jarima',
          type: rewardType
        });

      if (error) throw error;

      await onStatsUpdate();
      setShowRewardDialog(null);
      setRewardPoints('');
      
      const studentName = students.find(s => s.id === studentId)?.name || '';
      toast({
        title: rewardType === 'reward' ? "Mukofot berildi" : "Jarima berildi",
        description: `${studentName}ga ${Math.abs(points)} ball ${rewardType === 'reward' ? 'qo\'shildi' : 'ayrildi'}`,
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

  const exportToCSV = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
          *,
          students (name, group_name, student_id)
        `)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      const headers = ['O\'quvchi nomi', 'Guruh', 'O\'quvchi ID', 'Sana', 'Holat'];
      const csvContent = [
        headers.join(','),
        ...(data || []).map(record => [
          record.students?.name || '',
          record.students?.group_name || '',
          record.students?.student_id || '',
          record.date,
          record.status === 'present' ? 'Kelgan' : record.status === 'late' ? 'Kechikkan' : 'Kelmagan'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `davomat-${selectedGroup}-${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export muvaffaqiyatli",
        description: "Davomat ma'lumotlari yuklab olindi",
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Xatolik",
        description: "Ma'lumotlarni eksport qilishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-50';
      case 'absent': return 'text-red-600 bg-red-50';
      case 'late': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present': return <Check className="w-4 h-4" />;
      case 'absent': return <X className="w-4 h-4" />;
      case 'late': return <Clock className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'present': return 'Kelgan';
      case 'absent': return 'Kelmagan';
      case 'late': return 'Kechikkan';
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Davomat olish</h2>
          <p className="text-muted-foreground">O'quvchilar davomatini samarali boshqaring</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={exportToCSV} variant="outline" className="apple-button-secondary">
            <Download className="w-4 h-4 mr-2" />
            CSV export
          </Button>
          <Button onClick={markAllPresent} className="apple-button">
            <Users className="w-4 h-4 mr-2" />
            Barchani kelgan deb belgilash
          </Button>
        </div>
      </div>

      {/* Filtrlar */}
      <Card className="apple-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sana</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Guruh</label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Davomat ro'yxati */}
      <Card className="apple-card">
        <div className="p-6 border-b border-border/50">
          <h3 className="text-lg font-semibold">
            {selectedGroup === 'all' ? 'Barcha o\'quvchilar' : `Guruh: ${selectedGroup}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {new Date(selectedDate).toLocaleDateString('uz-UZ', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
            <p className="text-muted-foreground">
              {selectedGroup === 'all' 
                ? 'Davomat olish uchun avval o\'quvchilar qo\'shing'
                : `${selectedGroup} guruhida o'quvchilar topilmadi`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredStudents.map(student => {
              const status = getAttendanceStatus(student.id);
              return (
                <div key={student.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium cursor-pointer hover:text-blue-600" onClick={() => handleStudentClick(student.id)}>
                        {student.name}
                      </p>
                      <p className="text-sm text-muted-foreground">{student.group_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {status && (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(status)}`}>
                        {getStatusIcon(status)}
                        <span>{getStatusText(status)}</span>
                      </span>
                    )}
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant={status === 'present' ? 'default' : 'outline'}
                        onClick={() => markAttendance(student.id, 'present')}
                        className="w-8 h-8 p-0"
                        title="Kelgan"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'late' ? 'default' : 'outline'}
                        onClick={() => markAttendance(student.id, 'late')}
                        className="w-8 h-8 p-0"
                        title="Kechikkan"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={status === 'absent' ? 'default' : 'outline'}
                        onClick={() => markAttendance(student.id, 'absent')}
                        className="w-8 h-8 p-0"
                        title="Kelmagan"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRewardDialog(student.id)}
                        className="w-8 h-8 p-0"
                        title="Mukofot/Jarima berish"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Reward Dialog */}
      {showRewardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Mukofot/Jarima berish</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setRewardType('reward')}
                  variant={rewardType === 'reward' ? 'default' : 'outline'}
                  className="flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  Mukofot
                </Button>
                <Button
                  onClick={() => setRewardType('penalty')}
                  variant={rewardType === 'penalty' ? 'default' : 'outline'}
                  className="flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Jarima
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium">Ball miqdori</label>
                <Input
                  type="number"
                  step="0.1"
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(e.target.value)}
                  placeholder="Masalan: 5"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => addReward(showRewardDialog)}
                  className="flex-1"
                >
                  Saqlash
                </Button>
                <Button
                  onClick={() => {
                    setShowRewardDialog(null);
                    setRewardPoints('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <StudentDetailsPopup
          student={selectedStudent}
          teacherId={teacherId}
          onClose={() => setSelectedStudent(null)}
          onUpdate={onStatsUpdate}
        />
      )}
    </div>
  );
};

export default AttendanceTracker;
