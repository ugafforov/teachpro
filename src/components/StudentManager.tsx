import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Users, Edit2, Trash2, Archive, Gift, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StudentDetailsPopup from './StudentDetailsPopup';

interface Student {
  id: string;
  name: string;
  group_name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
}

interface Group {
  id: string;
  name: string;
}

interface StudentManagerProps {
  teacherId: string;
  onStudentUpdate?: () => void;
}

const StudentManager: React.FC<StudentManagerProps> = ({ teacherId, onStudentUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [newStudent, setNewStudent] = useState({
    name: '',
    group_name: '',
    student_id: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchGroups();
  }, [teacherId]);

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
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

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('id, name')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const addStudent = async () => {
    if (!newStudent.name || !newStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchi nomi va guruh nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .insert({
          ...newStudent,
          teacher_id: teacherId
        });

      if (error) throw error;

      await fetchStudents();
      setIsAddingStudent(false);
      setNewStudent({ name: '', group_name: '', student_id: '', email: '', phone: '' });
      onStudentUpdate?.();
      
      toast({
        title: "O'quvchi qo'shildi",
        description: `${newStudent.name} muvaffaqiyatli qo'shildi`,
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

  const updateStudent = async () => {
    if (!editingStudent || !editingStudent.name || !editingStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchi nomi va guruh nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editingStudent.name,
          group_name: editingStudent.group_name,
          student_id: editingStudent.student_id,
          email: editingStudent.email,
          phone: editingStudent.phone
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      await fetchStudents();
      setEditingStudent(null);
      onStudentUpdate?.();
      
      toast({
        title: "O'quvchi yangilandi",
        description: `${editingStudent.name}ning ma'lumotlari yangilandi`,
      });
    } catch (error) {
      console.error('Error updating student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchi ma'lumotlarini yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!confirm("Haqiqatan ham bu o'quvchini o'chirmoqchimisiz?")) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      if (error) throw error;

      await fetchStudents();
      onStudentUpdate?.();
      
      toast({
        title: "O'quvchi o'chirildi",
        description: "O'quvchi muvaffaqiyatli o'chirildi",
      });
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini o'chirishda xatolik yuz berdi",
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

      onStudentUpdate?.();
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

  const filteredStudents = students.filter(student => {
    const matchesGroup = selectedGroup === 'all' || student.group_name === selectedGroup;
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.group_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (student.student_id && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesGroup && matchesSearch;
  });

  const uniqueGroups = [...new Set(students.map(student => student.group_name))];

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
          <h2 className="text-2xl font-bold">O'quvchilar boshqaruvi</h2>
          <p className="text-muted-foreground">O'quvchilarni qo'shish, tahrirlash va boshqarish</p>
        </div>
        <Button onClick={() => setIsAddingStudent(true)} className="apple-button">
          <Plus className="w-4 h-4 mr-2" />
          O'quvchi qo'shish
        </Button>
      </div>

      {/* Filtrlar */}
      <Card className="apple-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Qidirish</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nom, guruh yoki ID bo'yicha qidiring..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Guruh</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Guruhni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {uniqueGroups.map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* O'quvchilar ro'yxati */}
      <Card className="apple-card">
        <div className="p-6 border-b border-border/50">
          <h3 className="text-lg font-semibold">
            {selectedGroup === 'all' ? 'Barcha o\'quvchilar' : `Guruh: ${selectedGroup}`}
          </h3>
          <p className="text-sm text-muted-foreground">
            {filteredStudents.length} o'quvchi topildi
          </p>
        </div>
        
        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Qidiruv natijalari topilmadi'
                : selectedGroup === 'all' 
                  ? 'Hali o\'quvchilar qo\'shilmagan'
                  : `${selectedGroup} guruhida o'quvchilar topilmadi`
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filteredStudents.map(student => (
              <div key={student.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSelectedStudent(student)}>
                      {student.name}
                    </p>
                    <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                      <span>{student.group_name}</span>
                      {student.student_id && <span>ID: {student.student_id}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRewardDialog(student.id)}
                    className="w-8 h-8 p-0"
                    title="Mukofot/Jarima berish"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingStudent(student)}
                    className="w-8 h-8 p-0"
                    title="Tahrirlash"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteStudent(student.id)}
                    className="w-8 h-8 p-0"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Student Dialog */}
      {isAddingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Yangi o'quvchi qo'shish</h3>
            <div className="space-y-4">
              <div>
                <Label>Ism</Label>
                <Input
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                  placeholder="O'quvchi ismi"
                />
              </div>
              <div>
                <Label>Guruh</Label>
                <Select value={newStudent.group_name} onValueChange={(value) => setNewStudent({ ...newStudent, group_name: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>O'quvchi ID (ixtiyoriy)</Label>
                <Input
                  value={newStudent.student_id}
                  onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                  placeholder="O'quvchi ID"
                />
              </div>
              <div>
                <Label>Email (ixtiyoriy)</Label>
                <Input
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>Telefon (ixtiyoriy)</Label>
                <Input
                  value={newStudent.phone}
                  onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                  placeholder="+998 XX XXX XX XX"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={addStudent} className="flex-1">Qo'shish</Button>
                <Button onClick={() => setIsAddingStudent(false)} variant="outline" className="flex-1">Bekor qilish</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Dialog */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">O'quvchi ma'lumotlarini tahrirlash</h3>
            <div className="space-y-4">
              <div>
                <Label>Ism</Label>
                <Input
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  placeholder="O'quvchi ismi"
                />
              </div>
              <div>
                <Label>Guruh</Label>
                <Select value={editingStudent.group_name} onValueChange={(value) => setEditingStudent({ ...editingStudent, group_name: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>O'quvchi ID (ixtiyoriy)</Label>
                <Input
                  value={editingStudent.student_id || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, student_id: e.target.value })}
                  placeholder="O'quvchi ID"
                />
              </div>
              <div>
                <Label>Email (ixtiyoriy)</Label>
                <Input
                  type="email"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>Telefon (ixtiyoriy)</Label>
                <Input
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  placeholder="+998 XX XXX XX XX"
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={updateStudent} className="flex-1">Yangilash</Button>
                <Button onClick={() => setEditingStudent(null)} variant="outline" className="flex-1">Bekor qilish</Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <Label>Ball miqdori</Label>
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

      {/* Student Details Popup */}
      {selectedStudent && (
        <StudentDetailsPopup
          student={selectedStudent}
          teacherId={teacherId}
          onClose={() => setSelectedStudent(null)}
          onUpdate={() => {
            onStudentUpdate?.();
          }}
        />
      )}
    </div>
  );
};

export default StudentManager;
