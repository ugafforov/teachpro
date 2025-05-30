import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Archive, RotateCcw, Trash2, Users, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ArchivedStudent {
  id: string;
  original_student_id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  archived_at: string;
  can_restore: boolean;
}

interface ArchivedGroup {
  id: string;
  original_group_id: string;
  name: string;
  description?: string;
  archived_at: string;
  can_restore: boolean;
}

interface ArchiveManagerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const ArchiveManager: React.FC<ArchiveManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [archivedStudents, setArchivedStudents] = useState<ArchivedStudent[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<ArchivedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchArchivedData();
  }, [teacherId]);

  const fetchArchivedData = async () => {
    try {
      // Arxivlangan o'quvchilarni olish
      const { data: students, error: studentsError } = await supabase
        .from('archived_students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('archived_at', { ascending: false });

      if (studentsError) throw studentsError;

      // Arxivlangan guruhlarni olish
      const { data: groups, error: groupsError } = await supabase
        .from('archived_groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('archived_at', { ascending: false });

      if (groupsError) throw groupsError;

      setArchivedStudents(students || []);
      setArchivedGroups(groups || []);
    } catch (error) {
      console.error('Error fetching archived data:', error);
      toast({
        title: "Xatolik",
        description: "Arxiv ma'lumotlarini yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreStudent = async (archivedStudent: ArchivedStudent) => {
    try {
      // O'quvchini tiklash
      const { error: restoreError } = await supabase
        .from('students')
        .update({ is_active: true })
        .eq('id', archivedStudent.original_student_id);

      if (restoreError) throw restoreError;

      // Arxivdan o'chirish
      const { error: deleteError } = await supabase
        .from('archived_students')
        .delete()
        .eq('id', archivedStudent.id);

      if (deleteError) throw deleteError;

      await fetchArchivedData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi tiklandi",
        description: `${archivedStudent.name} muvaffaqiyatli tiklandi`,
      });
    } catch (error) {
      console.error('Error restoring student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const restoreGroup = async (archivedGroup: ArchivedGroup) => {
    try {
      // Guruhni tiklash
      const { error: restoreError } = await supabase
        .from('groups')
        .update({ is_active: true })
        .eq('id', archivedGroup.original_group_id);

      if (restoreError) throw restoreError;

      // Guruhdagi o'quvchilarni tiklash
      const { error: studentsError } = await supabase
        .from('students')
        .update({ is_active: true })
        .eq('teacher_id', teacherId)
        .eq('group_name', archivedGroup.name);

      if (studentsError) throw studentsError;

      // Arxivdan o'chirish
      const { error: deleteGroupError } = await supabase
        .from('archived_groups')
        .delete()
        .eq('id', archivedGroup.id);

      if (deleteGroupError) throw deleteGroupError;

      // Guruhdagi o'quvchilarni arxivdan o'chirish
      const { error: deleteStudentsError } = await supabase
        .from('archived_students')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('group_name', archivedGroup.name);

      if (deleteStudentsError) throw deleteStudentsError;

      await fetchArchivedData();
      await onStatsUpdate();

      toast({
        title: "Guruh tiklandi",
        description: `${archivedGroup.name} guruhi va barcha o'quvchilari tiklandi`,
      });
    } catch (error) {
      console.error('Error restoring group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteStudent = async (archivedStudent: ArchivedStudent) => {
    try {
      // Avval barcha bog'liq ma'lumotlarni o'chirish
      await supabase
        .from('attendance_records')
        .delete()
        .eq('student_id', archivedStudent.original_student_id);

      await supabase
        .from('reward_penalty_history')
        .delete()
        .eq('student_id', archivedStudent.original_student_id);

      await supabase
        .from('student_scores')
        .delete()
        .eq('student_id', archivedStudent.original_student_id);

      await supabase
        .from('student_rankings')
        .delete()
        .eq('student_id', archivedStudent.original_student_id);

      // O'quvchini butunlay o'chirish
      const { error: deleteStudentError } = await supabase
        .from('students')
        .delete()
        .eq('id', archivedStudent.original_student_id);

      if (deleteStudentError) throw deleteStudentError;

      // Arxivdan o'chirish
      const { error: deleteArchiveError } = await supabase
        .from('archived_students')
        .delete()
        .eq('id', archivedStudent.id);

      if (deleteArchiveError) throw deleteArchiveError;

      await fetchArchivedData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi o'chirildi",
        description: `${archivedStudent.name} butunlay o'chirildi`,
      });
    } catch (error) {
      console.error('Error permanently deleting student:', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteGroup = async (archivedGroup: ArchivedGroup) => {
    try {
      // Guruhdagi barcha o'quvchilarni topish
      const { data: groupStudents, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('group_name', archivedGroup.name);

      if (studentsError) throw studentsError;

      if (groupStudents && groupStudents.length > 0) {
        const studentIds = groupStudents.map(s => s.id);

        // Har bir o'quvchi uchun bog'liq ma'lumotlarni o'chirish
        await supabase
          .from('attendance_records')
          .delete()
          .in('student_id', studentIds);

        await supabase
          .from('reward_penalty_history')
          .delete()
          .in('student_id', studentIds);

        await supabase
          .from('student_scores')
          .delete()
          .in('student_id', studentIds);

        await supabase
          .from('student_rankings')
          .delete()
          .in('student_id', studentIds);

        // Guruhdagi barcha o'quvchilarni o'chirish
        await supabase
          .from('students')
          .delete()
          .eq('teacher_id', teacherId)
          .eq('group_name', archivedGroup.name);
      }

      // Guruhni butunlay o'chirish
      const { error: deleteGroupError } = await supabase
        .from('groups')
        .delete()
        .eq('id', archivedGroup.original_group_id);

      if (deleteGroupError) throw deleteGroupError;

      // Arxivdan o'chirish
      const { error: deleteArchiveError } = await supabase
        .from('archived_groups')
        .delete()
        .eq('id', archivedGroup.id);

      if (deleteArchiveError) throw deleteArchiveError;

      // Guruhdagi o'quvchilarni arxivdan o'chirish
      const { error: deleteArchivedStudentsError } = await supabase
        .from('archived_students')
        .delete()
        .eq('teacher_id', teacherId)
        .eq('group_name', archivedGroup.name);

      if (deleteArchivedStudentsError) throw deleteArchivedStudentsError;

      await fetchArchivedData();
      await onStatsUpdate();

      toast({
        title: "Guruh o'chirildi",
        description: `${archivedGroup.name} guruhi va barcha o'quvchilari butunlay o'chirildi`,
      });
    } catch (error) {
      console.error('Error permanently deleting group:', error);
      toast({
        title: "Xatolik",
        description: "Guruhni o'chirishda xatolik yuz berdi",
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
      <div>
        <h2 className="text-2xl font-bold">Arxiv boshqaruvi</h2>
        <p className="text-muted-foreground">O'chirilgan ma'lumotlarni tiklash yoki butunlay o'chirish</p>
      </div>

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            O'quvchilar ({archivedStudents.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Guruhlar ({archivedGroups.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6">
          {archivedStudents.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Arxivlangan o'quvchilar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday o'quvchi arxivlanmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">Arxivlangan o'quvchilar</h3>
                <p className="text-sm text-muted-foreground">
                  {archivedStudents.length} arxivlangan o'quvchi
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {archivedStudents.map((student) => (
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
                          <span>Arxivlangan: {new Date(student.archived_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {student.can_restore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreStudent(student)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Tiklash
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => permanentDeleteStudent(student)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        O'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          {archivedGroups.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Arxivlangan guruhlar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday guruh arxivlanmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">Arxivlangan guruhlar</h3>
                <p className="text-sm text-muted-foreground">
                  {archivedGroups.length} arxivlangan guruh
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {archivedGroups.map((group) => (
                  <div key={group.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          {group.description && <span>{group.description}</span>}
                          <span>Arxivlangan: {new Date(group.archived_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {group.can_restore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => restoreGroup(group)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Tiklash
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => permanentDeleteGroup(group)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        O'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ArchiveManager;
