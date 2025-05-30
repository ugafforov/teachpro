import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Users, CheckCircle, Clock, XCircle, Gift, Calendar, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import StudentImport from './StudentImport';

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
}

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRecord {
  id: string;
  student_id: string;
  teacher_id: string;
  date: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
}

interface GroupDetailsProps {
  groupName: string;
  teacherId: string;
  onBack: () => void;
  onStatsUpdate: () => Promise<void>;
}

const GroupDetails: React.FC<GroupDetailsProps> = ({ 
  groupName, 
  teacherId, 
  onBack, 
  onStatsUpdate 
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [loading, setLoading] = useState(true);
  const [newStudent, setNewStudent] = useState({
    name: '',
    student_id: '',
    email: '',
    phone: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchAttendanceForDate(selectedDate);
  }, [groupName, teacherId, selectedDate]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName)
        .eq('is_active', true)
        .order('name');

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

  const fetchAttendanceForDate = async (date: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .eq('teacher_id', teacherId)
        .eq('date', date);

      if (error) throw error;

      const attendanceMap: Record<string, AttendanceStatus> = {};
      if (data) {
        data.forEach((record: any) => {
          attendanceMap[record.student_id] = record.status as AttendanceStatus;
        });
      }
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast({
        title: "Xatolik",
        description: "Davomatni yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const addStudent = async () => {
    if (!newStudent.name.trim()) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchi nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .insert({
          teacher_id: teacherId,
          name: newStudent.name.trim(),
          student_id: newStudent.student_id.trim() || null,
          email: newStudent.email.trim() || null,
          phone: newStudent.phone.trim() || null,
          group_name: groupName
        });

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();
      
      setNewStudent({ name: '', student_id: '', email: '', phone: '' });
      setIsAddDialogOpen(false);
      
      toast({
        title: "O'quvchi qo'shildi",
        description: `"${newStudent.name}" muvaffaqiyatli qo'shildi`,
      });
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchi qo'shishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const markAttendance = async (studentId: string, status: AttendanceStatus) => {
    try {
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .eq('date', selectedDate)
        .maybeSingle();

      if (existingRecord) {
        // Agar belgi bir xil bo'lsa, belgilanmagan holatga qaytarish
        if (existingRecord.status === status) {
          const { error } = await supabase
            .from('attendance_records')
            .delete()
            .eq('id', existingRecord.id);

          if (error) throw error;

          // State'dan o'chirish
          setAttendance(prevAttendance => {
            const newAttendance = { ...prevAttendance };
            delete newAttendance[studentId];
            return newAttendance;
          });
        } else {
          // Mavjud yozuvni yangilash
          const { error } = await supabase
            .from('attendance_records')
            .update({ status: status })
            .eq('id', existingRecord.id);

          if (error) throw error;

          setAttendance(prevAttendance => ({
            ...prevAttendance,
            [studentId]: status,
          }));
        }
      } else {
        // Yangi yozuv yaratish
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            teacher_id: teacherId,
            student_id: studentId,
            date: selectedDate,
            status: status
          });

        if (error) throw error;

        setAttendance(prevAttendance => ({
          ...prevAttendance,
          [studentId]: status,
        }));
      }

      await onStatsUpdate();
      
      toast({
        title: "Davomat yangilandi",
        description: "Davomat ma'lumotlari muvaffaqiyatli yangilandi",
      });
    } catch (error) {
      console.error('Error marking attendance:', error);
      toast({
        title: "Xatolik",
        description: "Davomatni belgilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const markAllAsPresent = async () => {
    try {
      const attendancePromises = students.map(student => 
        markAttendance(student.id, 'present')
      );
      
      await Promise.all(attendancePromises);
      
      toast({
        title: "Barchasi belgilandi",
        description: "Barcha o'quvchilar kelgan deb belgilandi",
      });
    } catch (error) {
      console.error('Error marking all as present:', error);
      toast({
        title: "Xatolik",
        description: "Barchasini belgilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const clearAllAttendance = async () => {
    try {
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('date', selectedDate);

      if (error) throw error;

      setAttendance({});
      await onStatsUpdate();
      
      toast({
        title: "Belgilar tozalandi",
        description: "Barcha davomat belgilari olib tashlandi",
      });
    } catch (error) {
      console.error('Error clearing attendance:', error);
      toast({
        title: "Xatolik",
        description: "Belgilarni tozalashda xatolik yuz berdi",
        variant: "destructive",
      });
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

      setShowRewardDialog(null);
      setRewardPoints('');
      if (onStatsUpdate) await onStatsUpdate();
      
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

  const getStatusColor = (status: AttendanceStatus | undefined) => {
    switch (status) {
      case 'present': return 'text-green-600 bg-green-50';
      case 'late': return 'text-yellow-600 bg-yellow-50';
      case 'absent': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button onClick={onBack} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{groupName}</h2>
            <p className="text-muted-foreground">{students.length} o'quvchi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <StudentImport 
            teacherId={teacherId} 
            groupName={groupName}
            onImportComplete={() => {
              fetchStudents();
              fetchAttendanceForDate(selectedDate);
              if (onStatsUpdate) onStatsUpdate();
            }}
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="apple-button">
                <Plus className="w-4 h-4 mr-2" />
                O'quvchi qo'shish
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="studentName">O'quvchi nomi *</Label>
                  <Input
                    id="studentName"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="To'liq ism sharif"
                  />
                </div>
                <div>
                  <Label htmlFor="studentId">O'quvchi ID</Label>
                  <Input
                    id="studentId"
                    value={newStudent.student_id}
                    onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                    placeholder="Masalan: 2024001"
                  />
                </div>
                <div>
                  <Label htmlFor="studentEmail">Email</Label>
                  <Input
                    id="studentEmail"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="studentPhone">Telefon</Label>
                  <Input
                    id="studentPhone"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addStudent} className="apple-button flex-1">
                    Qo'shish
                  </Button>
                  <Button onClick={() => setIsAddDialogOpen(false)} variant="outline" className="flex-1">
                    Bekor qilish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="apple-card">
        <div className="p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold">Davomat</h3>
              <p className="text-sm text-muted-foreground">
                O'quvchilar davomatini boshqaring
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                onClick={markAllAsPresent}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Barchani kelgan deb belgilash
              </Button>
              <Button
                onClick={clearAllAttendance}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Belgilarni tozalash
              </Button>
            </div>
          </div>
        </div>
        {students.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
            <p className="text-muted-foreground mb-4">
              Guruhga o'quvchilarni qo'shing
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              Birinchi o'quvchini qo'shish
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {students.map(student => (
              <div key={student.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{student.name}</h3>
                    {student.student_id && (
                      <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant={attendance[student.id] === 'present' ? 'default' : 'outline'}
                    onClick={() => markAttendance(student.id, 'present')}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Keldi
                  </Button>
                  <Button
                    size="sm"
                    variant={attendance[student.id] === 'late' ? 'default' : 'outline'}
                    onClick={() => markAttendance(student.id, 'late')}
                    className="flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    Kechikdi
                  </Button>
                  <Button
                    size="sm"
                    variant={attendance[student.id] === 'absent' ? 'default' : 'outline'}
                    onClick={() => markAttendance(student.id, 'absent')}
                    className="flex items-center gap-1"
                  >
                    <XCircle className="w-3 h-3" />
                    Yo'q
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRewardDialog(student.id)}
                    title="Mukofot/Jarima berish"
                  >
                    <Gift className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
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
                  <XCircle className="w-4 h-4" />
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
    </div>
  );
};

export default GroupDetails;
