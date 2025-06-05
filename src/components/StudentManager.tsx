import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Edit2, Archive, Gift, AlertTriangle, Search, List, LayoutGrid, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import StudentDetailsPopup from './StudentDetailsPopup';
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

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface StudentManagerProps {
  teacherId: string;
  onStatsUpdate?: () => Promise<void>;
}

const StudentManager: React.FC<StudentManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState('');
  const [rewardType, setRewardType] = useState<'reward' | 'penalty'>('reward');
  const [loading, setLoading] = useState(true);
  const [newStudent, setNewStudent] = useState({
    name: '',
    student_id: '',
    email: '',
    phone: '',
    group_name: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
    fetchGroups();
  }, [teacherId]);

  useEffect(() => {
    filterStudents();
  }, [students, selectedGroup, searchTerm]);

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
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    if (selectedGroup !== 'all') {
      filtered = filtered.filter(student => student.group_name === selectedGroup);
    }

    if (searchTerm) {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.student_id && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredStudents(filtered);
  };

  const addStudent = async () => {
    if (!newStudent.name.trim() || !newStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "O'quvchi nomi va guruhni tanlashingiz shart",
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
          group_name: newStudent.group_name
        });

      if (error) throw error;

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      
      setNewStudent({ name: '', student_id: '', email: '', phone: '', group_name: '' });
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

  const editStudent = async () => {
    if (!editingStudent || !editingStudent.name.trim()) {
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
        .update({
          name: editingStudent.name.trim(),
          student_id: editingStudent.student_id?.trim() || null,
          email: editingStudent.email?.trim() || null,
          phone: editingStudent.phone?.trim() || null,
          group_name: editingStudent.group_name
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      
      setEditingStudent(null);
      setIsEditDialogOpen(false);
      
      toast({
        title: "O'quvchi yangilandi",
        description: "O'quvchi ma'lumotlari muvaffaqiyatli yangilandi",
      });
    } catch (error) {
      console.error('Error updating student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const archiveStudent = async (studentId: string, studentName: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      await supabase
        .from('archived_students')
        .insert({
          original_student_id: studentId,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          group_name: student.group_name,
          email: student.email,
          phone: student.phone,
          archived_by: teacherId
        });

      await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error archiving student:', error);
    }
  };

  const deleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Rostdan ham "${studentName}" ni o'chirmoqchimisiz? Bu amal bekor qilib bo'lmaydi.`)) {
      return;
    }

    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      await supabase
        .from('deleted_students')
        .insert({
          original_student_id: studentId,
          teacher_id: teacherId,
          name: student.name,
          student_id: student.student_id,
          group_name: student.group_name,
          email: student.email,
          phone: student.phone
        });

      await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error deleting student:', error);
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

  const renderStudentsList = () => (
    <Card className="apple-card">
      <div className="p-6 border-b border-border/50">
        <h3 className="text-lg font-semibold">O'quvchilar ro'yxati</h3>
        <p className="text-sm text-muted-foreground">
          {filteredStudents.length} o'quvchi topildi
        </p>
      </div>
      <div className="divide-y divide-border/50">
        {filteredStudents.map(student => (
          <div key={student.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">
                  {student.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <h3 className="font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSelectedStudent(student)}>
                  {student.name}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  {student.student_id && <span>ID: {student.student_id}</span>}
                  <span className="text-blue-600">{student.group_name}</span>
                </div>
                {(student.email || student.phone) && (
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                    {student.email && <span>{student.email}</span>}
                    {student.phone && <span>{student.phone}</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRewardDialog(student.id)}
                title="Mukofot/Jarima berish"
              >
                <Gift className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingStudent(student);
                  setIsEditDialogOpen(true);
                }}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => archiveStudent(student.id, student.name)}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                <Archive className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteStudent(student.id, student.name)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderStudentsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredStudents.map(student => (
        <Card key={student.id} className="apple-card p-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium">
                    {student.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold cursor-pointer hover:text-blue-600 transition-colors" onClick={() => setSelectedStudent(student)}>
                    {student.name}
                  </h3>
                  {student.student_id && (
                    <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                  )}
                  <p className="text-sm text-blue-600">{student.group_name}</p>
                </div>
              </div>
            </div>

            {(student.email || student.phone) && (
              <div className="space-y-1">
                {student.email && (
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                )}
                {student.phone && (
                  <p className="text-sm text-muted-foreground">{student.phone}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                {new Date(student.created_at).toLocaleDateString('uz-UZ')}
              </span>
              <div className="flex items-center space-x-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRewardDialog(student.id)}
                  title="Mukofot/Jarima berish"
                >
                  <Gift className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingStudent(student);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => archiveStudent(student.id, student.name)}
                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                >
                  <Archive className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteStudent(student.id, student.name)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

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
          <p className="text-muted-foreground">O'quvchilarni qo'shing va boshqaring</p>
        </div>
        <div className="flex gap-2">
          <StudentImport 
            teacherId={teacherId} 
            groupName={selectedGroup !== 'all' ? selectedGroup : undefined}
            onImportComplete={() => {
              fetchStudents();
              if (onStatsUpdate) onStatsUpdate();
            }}
          />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="apple-button">
                <Plus className="w-4 h-4 mr-2" />
                Yangi o'quvchi
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
                  <Label htmlFor="studentGroup">Guruh *</Label>
                  <Select value={newStudent.group_name} onValueChange={(value) => setNewStudent({ ...newStudent, group_name: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Guruhni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map(group => (
                        <SelectItem key={group.id} value={group.name}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

      {/* Filter va qidiruv */}
      <Card className="apple-card p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="O'quvchi nomi yoki ID bo'yicha qidiring..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.name}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
              size="sm"
              title="Grid ko'rinishi"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              size="sm"
              title="Ro'yxat ko'rinishi"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* O'quvchilar ro'yxati */}
      {filteredStudents.length === 0 ? (
        <Card className="apple-card p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || selectedGroup !== 'all' 
              ? "Qidiruv yoki filtr bo'yicha o'quvchilar topilmadi"
              : "Birinchi o'quvchingizni qo'shing"
            }
          </p>
          {!searchTerm && selectedGroup === 'all' && (
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
                <Plus className="w-4 h-4 mr-2" />
                Birinchi o'quvchini qo'shish
              </Button>
              <StudentImport 
                teacherId={teacherId} 
                onImportComplete={() => {
                  fetchStudents();
                  if (onStatsUpdate) onStatsUpdate();
                }}
              />
            </div>
          )}
        </Card>
      ) : (
        viewMode === 'grid' ? renderStudentsGrid() : renderStudentsList()
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

      {/* Tahrirlash dialogi */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>O'quvchini tahrirlash</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-studentName">O'quvchi nomi *</Label>
                <Input
                  id="edit-studentName"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-studentId">O'quvchi ID</Label>
                <Input
                  id="edit-studentId"
                  value={editingStudent.student_id || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, student_id: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-studentGroup">Guruh</Label>
                <Select value={editingStudent.group_name} onValueChange={(value) => setEditingStudent({ ...editingStudent, group_name: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(group => (
                      <SelectItem key={group.id} value={group.name}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-studentEmail">Email</Label>
                <Input
                  id="edit-studentEmail"
                  type="email"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-studentPhone">Telefon</Label>
                <Input
                  id="edit-studentPhone"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={editStudent} className="apple-button flex-1">
                  Saqlash
                </Button>
                <Button onClick={() => setIsEditDialogOpen(false)} variant="outline" className="flex-1">
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Details Popup */}
      {selectedStudent && (
        <StudentDetailsPopup
          student={selectedStudent}
          teacherId={teacherId}
          onClose={() => setSelectedStudent(null)}
          onUpdate={fetchStudents}
        />
      )}
    </div>
  );
};

export default StudentManager;
