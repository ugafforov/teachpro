import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Search, RotateCcw, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ArchivedStudent {
  id: string;
  original_student_id: string;
  teacher_id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  archived_at: string;
}

interface ArchivedGroup {
  id: string;
  original_group_id: string;
  teacher_id: string;
  name: string;
  description?: string;
  archived_at: string;
}

interface ArchivedExam {
  id: string;
  original_exam_id: string;
  teacher_id: string;
  exam_name: string;
  exam_date: string;
  group_name: string;
  group_id?: string;
  archived_at: string;
  results_data?: any;
}

interface ArchiveManagerProps {
  teacherId: string;
  onStatsUpdate?: () => Promise<void>;
}

const ArchiveManager: React.FC<ArchiveManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [archivedStudents, setArchivedStudents] = useState<ArchivedStudent[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<ArchivedGroup[]>([]);
  const [archivedExams, setArchivedExams] = useState<ArchivedExam[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<ArchivedStudent[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ArchivedGroup[]>([]);
  const [filteredExams, setFilteredExams] = useState<ArchivedExam[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArchivedData();
  }, [teacherId]);

  useEffect(() => {
    filterData();
  }, [archivedStudents, archivedGroups, archivedExams, searchTerm, activeTab]);

  const fetchArchivedData = async () => {
    try {
      setLoading(true);

      const { data: studentsData, error: studentsError } = await supabase
        .from('archived_students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('archived_at', { ascending: false });

      if (studentsError) throw studentsError;
      setArchivedStudents(studentsData || []);

      const { data: groupsData, error: groupsError } = await supabase
        .from('archived_groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('archived_at', { ascending: false });

      if (groupsError) throw groupsError;
      setArchivedGroups(groupsData || []);

      const { data: examsData, error: examsError } = await supabase
        .from('archived_exams')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('archived_at', { ascending: false });

      if (examsError) throw examsError;
      setArchivedExams(examsData || []);
    } catch (error) {
      console.error('Error fetching archived data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    const term = searchTerm.toLowerCase();

    if (activeTab === 'students') {
      const filtered = archivedStudents.filter(student =>
        student.name.toLowerCase().includes(term) ||
        (student.student_id && student.student_id.toLowerCase().includes(term)) ||
        student.group_name.toLowerCase().includes(term)
      );
      setFilteredStudents(filtered);
    } else if (activeTab === 'groups') {
      const filtered = archivedGroups.filter(group =>
        group.name.toLowerCase().includes(term) ||
        (group.description && group.description.toLowerCase().includes(term))
      );
      setFilteredGroups(filtered);
    } else if (activeTab === 'exams') {
      const filtered = archivedExams.filter(exam =>
        exam.exam_name.toLowerCase().includes(term) ||
        exam.group_name.toLowerCase().includes(term)
      );
      setFilteredExams(filtered);
    }
  };

  const restoreStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Rostdan ham "${studentName}" ni qayta tiklamoqchimisiz?`)) {
      return;
    }

    try {
      const archivedStudent = archivedStudents.find(s => s.id === studentId);
      if (!archivedStudent) return;

      // Restore to students table
      await supabase
        .from('students')
        .insert({
          teacher_id: teacherId,
          name: archivedStudent.name,
          student_id: archivedStudent.student_id,
          group_name: archivedStudent.group_name,
          email: archivedStudent.email,
          phone: archivedStudent.phone,
          is_active: true
        });

      // Remove from archived_students
      await supabase
        .from('archived_students')
        .delete()
        .eq('id', studentId);

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error restoring student:', error);
    }
  };

  const restoreGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Rostdan ham "${groupName}" guruhini qayta tiklamoqchimisiz?`)) {
      return;
    }

    try {
      const archivedGroup = archivedGroups.find(g => g.id === groupId);
      if (!archivedGroup) return;

      // Restore to groups table
      await supabase
        .from('groups')
        .insert({
          teacher_id: teacherId,
          name: archivedGroup.name,
          description: archivedGroup.description,
          is_active: true
        });

      // Remove from archived_groups
      await supabase
        .from('archived_groups')
        .delete()
        .eq('id', groupId);

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error restoring group:', error);
    }
  };

  const deleteArchivedStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Rostdan ham "${studentName}" ni butunlay o'chirmoqchimisiz? Bu amal bekor qilib bo'lmaydi.`)) {
      return;
    }

    try {
      const archivedStudent = archivedStudents.find(s => s.id === studentId);
      if (!archivedStudent) return;

      // Move to deleted_students table
      await supabase
        .from('deleted_students')
        .insert({
          original_student_id: archivedStudent.original_student_id,
          teacher_id: teacherId,
          name: archivedStudent.name,
          student_id: archivedStudent.student_id,
          group_name: archivedStudent.group_name,
          email: archivedStudent.email,
          phone: archivedStudent.phone
        });

      // Remove from archived_students
      await supabase
        .from('archived_students')
        .delete()
        .eq('id', studentId);

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error moving archived student to trash:', error);
    }
  };

  const deleteArchivedGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Rostdan ham "${groupName}" guruhini butunlay o'chirmoqchimisiz? Bu amal bekor qilib bo'lmaydi.`)) {
      return;
    }

    try {
      const archivedGroup = archivedGroups.find(g => g.id === groupId);
      if (!archivedGroup) return;

      // Move to deleted_groups table
      await supabase
        .from('deleted_groups')
        .insert({
          original_group_id: archivedGroup.original_group_id,
          teacher_id: teacherId,
          name: archivedGroup.name,
          description: archivedGroup.description
        });

      // Remove from archived_groups
      await supabase
        .from('archived_groups')
        .delete()
        .eq('id', groupId);

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error moving archived group to trash:', error);
    }
  };

  const restoreExam = async (examId: string, examName: string) => {
    if (!confirm(`Rostdan ham "${examName}" imtihonini qayta tiklamoqchimisiz?`)) {
      return;
    }

    try {
      const archivedExam = archivedExams.find(e => e.id === examId);
      if (!archivedExam) return;

      // Restore to exams table with correct group_id
      const { data: restoredExam, error: examError } = await supabase
        .from('exams')
        .insert({
          teacher_id: teacherId,
          exam_name: archivedExam.exam_name,
          exam_date: archivedExam.exam_date,
          group_id: archivedExam.group_id || null
        })
        .select()
        .single();

      if (examError) throw examError;

      if (restoredExam && archivedExam.results_data && Array.isArray(archivedExam.results_data)) {
        // Restore exam results with all data
        const resultsToRestore = archivedExam.results_data.map((r: any) => ({
          teacher_id: teacherId,
          exam_id: restoredExam.id,
          student_id: r.student_id,
          score: r.score,
          notes: r.notes || null
        }));

        const { error: resultsError } = await supabase
          .from('exam_results')
          .insert(resultsToRestore);

        if (resultsError) throw resultsError;
      }

      // Remove from archived_exams
      const { error: deleteError } = await supabase
        .from('archived_exams')
        .delete()
        .eq('id', examId);

      if (deleteError) throw deleteError;

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error restoring exam:', error);
    }
  };

  const deleteArchivedExam = async (examId: string, examName: string) => {
    if (!confirm(`Rostdan ham "${examName}" imtihonini butunlay o'chirmoqchimisiz? Bu amal bekor qilib bo'lmaydi.`)) {
      return;
    }

    try {
      const archivedExam = archivedExams.find(e => e.id === examId);
      if (!archivedExam) return;

      // Move to deleted_exams table
      await supabase
        .from('deleted_exams')
        .insert({
          original_exam_id: archivedExam.original_exam_id,
          teacher_id: teacherId,
          exam_name: archivedExam.exam_name,
          exam_date: archivedExam.exam_date,
          group_name: archivedExam.group_name,
          results_data: archivedExam.results_data
        });

      // Remove from archived_exams
      await supabase
        .from('archived_exams')
        .delete()
        .eq('id', examId);

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error moving archived exam to trash:', error);
    }
  };

  const renderStudentsTab = () => (
    <div className="space-y-4">
      {filteredStudents.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Arxivlangan o'quvchilar topilmadi</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Qidiruv bo'yicha arxivlangan o'quvchilar topilmadi" : "Hozircha arxivlangan o'quvchilar yo'q"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map(student => (
            <Card key={student.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                    <span className="text-lg font-medium">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{student.name}</h3>
                    {student.student_id && (
                      <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {student.group_name}
                    </Badge>
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
                    {new Date(student.archived_at).toLocaleDateString('uz-UZ')}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreStudent(student.id, student.name)}
                      title="Qayta tiklash"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteArchivedStudent(student.id, student.name)}
                      title="Chiqindi qutisiga o'tkazish"
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
      )}
    </div>
  );

  const renderGroupsTab = () => (
    <div className="space-y-4">
      {filteredGroups.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Arxivlangan guruhlar topilmadi</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Qidiruv bo'yicha arxivlangan guruhlar topilmadi" : "Hozircha arxivlangan guruhlar yo'q"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => (
            <Card key={group.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-muted-foreground">{group.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {new Date(group.archived_at).toLocaleDateString('uz-UZ')}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreGroup(group.id, group.name)}
                      title="Qayta tiklash"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteArchivedGroup(group.id, group.name)}
                      title="Chiqindi qutisiga o'tkazish"
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
      )}
    </div>
  );

  const renderExamsTab = () => (
    <div className="space-y-4">
      {filteredExams.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Arxivlangan imtihonlar topilmadi</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Qidiruv bo'yicha arxivlangan imtihonlar topilmadi" : "Hozircha arxivlangan imtihonlar yo'q"}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExams.map(exam => (
            <Card key={exam.id} className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{exam.exam_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(exam.exam_date).toLocaleDateString('uz-UZ')}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {exam.group_name}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Arxivlandi: {new Date(exam.archived_at).toLocaleDateString('uz-UZ')}
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => restoreExam(exam.id, exam.exam_name)}
                      title="Qayta tiklash"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteArchivedExam(exam.id, exam.exam_name)}
                      title="Chiqindi qutisiga o'tkazish"
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
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Arxiv</h2>
        <p className="text-muted-foreground">Arxivlangan guruhlar va o'quvchilar</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Qidirish..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students" onClick={() => setActiveTab('students')}>O'quvchilar</TabsTrigger>
          <TabsTrigger value="groups" onClick={() => setActiveTab('groups')}>Guruhlar</TabsTrigger>
          <TabsTrigger value="exams" onClick={() => setActiveTab('exams')}>Imtihonlar</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            renderStudentsTab()
          )}
        </TabsContent>
        <TabsContent value="groups">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            renderGroupsTab()
          )}
        </TabsContent>
        <TabsContent value="exams">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            renderExamsTab()
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArchiveManager;
