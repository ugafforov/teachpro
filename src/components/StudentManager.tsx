
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, Upload, Edit2, Trash2, Search, Archive } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface Student {
  id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  created_at: string;
  is_active: boolean;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface StudentManagerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const StudentManager: React.FC<StudentManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [bulkImportText, setBulkImportText] = useState('');
  const [loading, setLoading] = useState(true);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    name: '',
    student_id: '',
    group_name: '',
    email: '',
    phone: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();
    fetchStudents();
  }, [teacherId]);

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

  const availableGroups = [...new Set([
    ...groups.map(g => g.name),
    ...students.map(s => s.group_name)
  ])];
  
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup === 'all' || student.group_name === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const addStudent = async () => {
    if (!newStudent.name || !newStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Ism va guruh nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      // Agar yangi guruh kiritilgan bo'lsa, uni guruhlar jadvaliga qo'shish
      const existingGroup = groups.find(g => g.name === newStudent.group_name);
      if (!existingGroup) {
        const { error: groupError } = await supabase
          .from('groups')
          .insert({
            teacher_id: teacherId,
            name: newStudent.group_name,
            description: `${newStudent.group_name} guruhi`
          });

        if (groupError) {
          console.warn('Group creation failed:', groupError);
          // Guruh yaratilmasa ham o'quvchini qo'shishda davom etamiz
        }
      }

      const { error } = await supabase
        .from('students')
        .insert({
          teacher_id: teacherId,
          name: newStudent.name,
          student_id: newStudent.student_id || null,
          group_name: newStudent.group_name,
          email: newStudent.email || null,
          phone: newStudent.phone || null
        });

      if (error) throw error;

      await fetchStudents();
      await fetchGroups();
      await onStatsUpdate();
      
      setNewStudent({ name: '', student_id: '', group_name: '', email: '', phone: '' });
      setIsAddDialogOpen(false);
      
      toast({
        title: "O'quvchi qo'shildi",
        description: `${newStudent.name} ${newStudent.group_name} guruhiga qo'shildi`,
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
    if (!editingStudent || !editingStudent.name || !editingStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Ism va guruh nomini kiriting",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: editingStudent.name,
          student_id: editingStudent.student_id || null,
          group_name: editingStudent.group_name,
          email: editingStudent.email || null,
          phone: editingStudent.phone || null
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      await fetchStudents();
      await onStatsUpdate();
      
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

      // O'quvchini arxivga ko'chirish
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

      // O'quvchini faolsizlashtirish
      await supabase
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);

      await fetchStudents();
      await onStatsUpdate();
      
      toast({
        title: "O'quvchi arxivlandi",
        description: `${studentName} arxivga ko'chirildi`,
      });
    } catch (error) {
      console.error('Error archiving student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini arxivlashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const processBulkImport = async () => {
    if (!bulkImportText.trim()) {
      toast({
        title: "Ma'lumot yo'q",
        description: "Import qilish uchun o'quvchi ma'lumotlarini kiriting",
        variant: "destructive",
      });
      return;
    }

    const lines = bulkImportText.trim().split('\n');
    const studentsToInsert = [];
    let errors = 0;

    lines.forEach((line) => {
      const parts = line.split(/[,\t]/).map(part => part.trim());
      if (parts.length >= 2) {
        studentsToInsert.push({
          teacher_id: teacherId,
          name: parts[0],
          group_name: parts[1],
          student_id: parts[2] || null,
          email: parts[3] || null,
          phone: parts[4] || null
        });
      } else {
        errors++;
      }
    });

    if (studentsToInsert.length > 0) {
      try {
        const { error } = await supabase
          .from('students')
          .insert(studentsToInsert);

        if (error) throw error;

        await fetchStudents();
        await onStatsUpdate();
        
        setBulkImportText('');
        setIsBulkImportOpen(false);
        
        toast({
          title: "Import tugallandi",
          description: `${studentsToInsert.length} o'quvchi muvaffaqiyatli import qilindi. ${errors > 0 ? `${errors} ta qator xatolik sababli o'tkazib yuborildi.` : ''}`,
        });
      } catch (error) {
        console.error('Error importing students:', error);
        toast({
          title: "Import muvaffaqiyatsiz",
          description: "O'quvchilarni import qilishda xatolik yuz berdi",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Import muvaffaqiyatsiz",
        description: "To'g'ri formatda o'quvchi ma'lumotlari topilmadi",
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">O'quvchilar boshqaruvi</h2>
          <p className="text-muted-foreground">O'quvchilar ro'yxatini boshqaring</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="apple-button-secondary">
                <Upload className="w-4 h-4 mr-2" />
                Ommaviy import
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>O'quvchilarni ommaviy import qilish</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>O'quvchi ma'lumotlarini kiriting (har bir qatorda bittadan)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Format: Ism, Guruh, O'quvchi ID, Email, Telefon
                  </p>
                  <Textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder="Ahmadjon Karimov, 10-A, ST001, ahmad@email.com, 998901234567"
                    rows={8}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={processBulkImport} className="apple-button flex-1">
                    Import qilish
                  </Button>
                  <Button onClick={() => setIsBulkImportOpen(false)} variant="outline" className="flex-1">
                    Bekor qilish
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
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
                  <Label htmlFor="name">To'liq ismi *</Label>
                  <Input
                    id="name"
                    value={newStudent.name || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="O'quvchining to'liq ismi"
                  />
                </div>
                <div>
                  <Label htmlFor="group">Guruh *</Label>
                  {availableGroups.length > 0 ? (
                    <Select 
                      value={newStudent.group_name || ''} 
                      onValueChange={(value) => setNewStudent({ ...newStudent, group_name: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Guruhni tanlang yoki yangi kiriting" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableGroups.map(groupName => (
                          <SelectItem key={groupName} value={groupName}>{groupName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="group"
                      value={newStudent.group_name || ''}
                      onChange={(e) => setNewStudent({ ...newStudent, group_name: e.target.value })}
                      placeholder="Guruh nomi"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="studentId">O'quvchi ID</Label>
                  <Input
                    id="studentId"
                    value={newStudent.student_id || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, student_id: e.target.value })}
                    placeholder="Ixtiyoriy o'quvchi ID"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={newStudent.phone || ''}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="Telefon raqami"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addStudent} className="apple-button flex-1">
                    O'quvchi qo'shish
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

      {/* Qidiruv va filtr */}
      <Card className="apple-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>O'quvchilarni qidirish</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ism yoki ID bo'yicha qidirish..."
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Guruh bo'yicha filtr</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {availableGroups.map(group => (
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
            <p className="text-muted-foreground mb-4">
              {searchTerm || selectedGroup !== 'all' 
                ? 'Qidiruv yoki filtrlarni o\'zgartiring'
                : 'Birinchi o\'quvchingizni qo\'shishni boshlang'
              }
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="apple-button">
              <Plus className="w-4 h-4 mr-2" />
              Birinchi o'quvchini qo'shish
            </Button>
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
                    <p className="font-medium">{student.name}</p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>{student.group_name}</span>
                      {student.student_id && <span>ID: {student.student_id}</span>}
                      {student.email && <span>{student.email}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
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
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tahrirlash dialogi */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>O'quvchini tahrirlash</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">To'liq ismi *</Label>
                <Input
                  id="edit-name"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-group">Guruh *</Label>
                <Select 
                  value={editingStudent.group_name} 
                  onValueChange={(value) => setEditingStudent({ ...editingStudent, group_name: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups.map(groupName => (
                      <SelectItem key={groupName} value={groupName}>{groupName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={editingStudent.email || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Telefon</Label>
                <Input
                  id="edit-phone"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={editStudent} className="apple-button flex-1">
                  O'zgarishlarni saqlash
                </Button>
                <Button onClick={() => setIsEditDialogOpen(false)} variant="outline" className="flex-1">
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentManager;
