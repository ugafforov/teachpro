import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, UserCheck, Users } from 'lucide-react';
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
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
    fetchTodayAttendance();
  }, [groupName, teacherId]);

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

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('group_name', groupName)
        .eq('date', today);

      if (error) throw error;

      const attendanceData = data || [];
      const attendanceMap: Record<string, boolean> = {};
      attendanceData.forEach(record => {
        attendanceMap[record.student_id] = record.status === 'present';
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching today\'s attendance:', error);
      toast({
        title: "Xatolik",
        description: "Bugungi davomatni yuklashda xatolik yuz berdi",
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

  const markAttendance = async (studentId: string, isPresent: boolean) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existingRecord = await supabase
        .from('attendance_records')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .eq('date', today)
        .single();

      if (existingRecord.data) {
        // Update existing record
        const { error } = await supabase
          .from('attendance_records')
          .update({ status: isPresent ? 'present' : 'absent' })
          .eq('id', existingRecord.data.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('attendance_records')
          .insert({
            teacher_id: teacherId,
            student_id: studentId,
            group_name: groupName,
            date: today,
            status: isPresent ? 'present' : 'absent'
          });

        if (error) throw error;
      }

      setAttendance(prevAttendance => ({
        ...prevAttendance,
        [studentId]: isPresent,
      }));
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
              fetchTodayAttendance();
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
          <h3 className="text-lg font-semibold">Bugungi davomat ({new Date().toLocaleDateString('uz-UZ')})</h3>
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
                  <Checkbox
                    id={`attendance-${student.id}`}
                    checked={attendance[student.id] === true}
                    onCheckedChange={(checked) => markAttendance(student.id, checked === true)}
                  />
                  <Label htmlFor={`attendance-${student.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed">
                    {attendance[student.id] === true ? 'Keldi' : 'Yo\'q'}
                  </Label>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default GroupDetails;
