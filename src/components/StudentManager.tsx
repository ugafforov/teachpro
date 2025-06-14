import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StudentDetailsPopup from './StudentDetailsPopup';
import StudentImport from './StudentImport';
import StudentListItem from './student/StudentListItem';
import StudentGridItem from './student/StudentGridItem';
import StudentFilters from './student/StudentFilters';
import AddStudentDialog from './student/AddStudentDialog';
import EditStudentDialog from './student/EditStudentDialog';
import RewardDialog from './student/RewardDialog';

export interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export interface NewStudent {
  name: string;
  student_id: string;
  email: string;
  phone: string;
  group_name: string;
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [rewardingStudent, setRewardingStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
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

  const addStudent = async (newStudent: NewStudent) => {
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

  const editStudent = async (studentToUpdate: Student) => {
    if (!studentToUpdate || !studentToUpdate.name.trim()) {
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
          name: studentToUpdate.name.trim(),
          student_id: studentToUpdate.student_id?.trim() || null,
          email: studentToUpdate.email?.trim() || null,
          phone: studentToUpdate.phone?.trim() || null,
          group_name: studentToUpdate.group_name
        })
        .eq('id', studentToUpdate.id);

      if (error) throw error;

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      
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

      toast({
        title: "Muvaffaqiyat",
        description: `${studentName} muvaffaqiyatli arxivlandi`,
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

  const deleteStudent = async (studentId: string, studentName: string) => {
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

      toast({
        title: "Muvaffaqiyat",
        description: `${studentName} muvaffaqiyatli o'chirildi`,
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

  const addReward = async (studentId: string, points: number, type: 'reward' | 'penalty') => {
    try {
      const { error } = await supabase
        .from('reward_penalty_history')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          points: type === 'penalty' ? -Math.abs(points) : Math.abs(points),
          reason: type === 'reward' ? 'Mukofot' : 'Jarima',
          type: type
        });

      if (error) throw error;

      setRewardingStudent(null);
      if (onStatsUpdate) await onStatsUpdate();
      
      const studentName = students.find(s => s.id === studentId)?.name || '';
      toast({
        title: type === 'reward' ? "Mukofot berildi" : "Jarima berildi",
        description: `${studentName}ga ${Math.abs(points)} ball ${type === 'reward' ? 'qo\'shildi' : 'ayrildi'}`,
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

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsEditDialogOpen(true);
  };
  
  const handleReward = (student: Student) => {
    setRewardingStudent(student);
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
          <Button className="apple-button" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Yangi o'quvchi
          </Button>
        </div>
      </div>

      <StudentFilters
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        selectedGroup={selectedGroup}
        onSelectedGroupChange={setSelectedGroup}
        groups={groups}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      
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
      ) : viewMode === 'list' ? (
        <Card className="apple-card">
          <div className="p-6 border-b border-border/50">
            <h3 className="text-lg font-semibold">O'quvchilar ro'yxati</h3>
            <p className="text-sm text-muted-foreground">{filteredStudents.length} o'quvchi topildi</p>
          </div>
          <div className="divide-y divide-border/50">
            {filteredStudents.map(student => (
              <StudentListItem 
                key={student.id} 
                student={student}
                onSelectStudent={setSelectedStudent}
                onEdit={handleEdit}
                onArchive={archiveStudent}
                onDelete={deleteStudent}
                onReward={handleReward}
              />
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map(student => (
            <StudentGridItem
              key={student.id}
              student={student}
              onSelectStudent={setSelectedStudent}
              onEdit={handleEdit}
              onArchive={archiveStudent}
              onDelete={deleteStudent}
              onReward={handleReward}
            />
          ))}
        </div>
      )}

      <AddStudentDialog 
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAddStudent={addStudent}
        groups={groups}
      />

      <EditStudentDialog 
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        student={editingStudent}
        onEditStudent={editStudent}
        groups={groups}
      />

      <RewardDialog
        isOpen={!!rewardingStudent}
        onOpenChange={(isOpen) => !isOpen && setRewardingStudent(null)}
        student={rewardingStudent}
        onAddReward={addReward}
      />
      
      {selectedStudent && (
        <StudentDetailsPopup
          studentId={selectedStudent.id}
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          teacherId={teacherId}
        />
      )}
    </div>
  );
};

export default StudentManager;
