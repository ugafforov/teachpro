import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Trash2, RotateCcw, Users, Layers, AlertTriangle, BookOpen, Search, X, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatDateUz } from '@/lib/utils';
import { logError } from '@/lib/errorUtils';

interface DeletedStudent {
  id: string;
  original_student_id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  deleted_at: string;
  teacher_id: string;
}

interface DeletedGroup {
  id: string;
  original_group_id: string;
  name: string;
  description?: string;
  deleted_at: string;
  teacher_id: string;
}

interface DeletedExam {
  id: string;
  original_exam_id: string;
  teacher_id: string;
  exam_name: string;
  exam_date: string;
  group_name: string;
  group_id?: string;
  deleted_at: string;
  results_data?: any;
}

interface TrashManagerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const TrashManager: React.FC<TrashManagerProps> = ({ teacherId, onStatsUpdate }) => {
  const [deletedStudents, setDeletedStudents] = useState<DeletedStudent[]>([]);
  const [deletedGroups, setDeletedGroups] = useState<DeletedGroup[]>([]);
  const [deletedExams, setDeletedExams] = useState<DeletedExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'restore' | 'permanent',
    item: any,
    itemType: 'student' | 'group' | 'exam'
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTrashData();
  }, [teacherId]);

  const fetchTrashData = async () => {
    try {
      // O'chirilgan o'quvchilarni olish
      const { data: students, error: studentsError } = await supabase
        .from('deleted_students')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('deleted_at', { ascending: false });

      if (studentsError) {
        logError('TrashManager.fetchTrashData.students', studentsError);
        setDeletedStudents([]);
      } else {
        setDeletedStudents(students || []);
      }

      // O'chirilgan guruhlarni olish
      const { data: groups, error: groupsError } = await supabase
        .from('deleted_groups')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('deleted_at', { ascending: false });

      if (groupsError) {
        logError('TrashManager.fetchTrashData.groups', groupsError);
        setDeletedGroups([]);
      } else {
        setDeletedGroups(groups || []);
      }

      // O'chirilgan imtihonlarni olish
      const { data: exams, error: examsError } = await supabase
        .from('deleted_exams')
        .select('*')
        .eq('teacher_id', teacherId)
        .order('deleted_at', { ascending: false });

      if (examsError) {
        logError('TrashManager.fetchTrashData.exams', examsError);
        setDeletedExams([]);
      } else {
        setDeletedExams(exams || []);
      }
    } catch (error) {
      logError('TrashManager.fetchTrashData', error);
      toast({
        title: "Xatolik",
        description: "O'chirilgan ma'lumotlarni yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAllTrash = async () => {
    if (!confirm('Rostdan ham chiqindi qutisidagi barcha ma\'lumotlarni butunlay o\'chirmoqchimisiz? Bu amal bekor qilib bo\'lmaydi!')) {
      return;
    }

    try {
      // Permanently delete all deleted students
      const { error: studentsError } = await supabase
        .from('deleted_students')
        .delete()
        .eq('teacher_id', teacherId);

      if (studentsError) throw studentsError;

      // Permanently delete all deleted groups
      const { error: groupsError } = await supabase
        .from('deleted_groups')
        .delete()
        .eq('teacher_id', teacherId);

      if (groupsError) throw groupsError;

      // Permanently delete all deleted exams
      const { error: examsError } = await supabase
        .from('deleted_exams')
        .delete()
        .eq('teacher_id', teacherId);

      if (examsError) throw examsError;

      await fetchTrashData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      logError('TrashManager.clearAllTrash', error);
    }
  };

  const handleAction = (type: 'restore' | 'permanent', item: any, itemType: 'student' | 'group' | 'exam') => {
    setConfirmDialog({ type, item, itemType });
  };

  const confirmAction = async () => {
    if (!confirmDialog) return;

    const { type, item, itemType } = confirmDialog;

    try {
      if (itemType === 'student') {
        if (type === 'restore') {
          await restoreStudent(item);
        } else {
          await permanentDeleteStudent(item);
        }
      } else if (itemType === 'group') {
        if (type === 'restore') {
          await restoreGroup(item);
        } else {
          await permanentDeleteGroup(item);
        }
      } else if (itemType === 'exam') {
        if (type === 'restore') {
          await restoreExam(item);
        } else {
          await permanentDeleteExam(item);
        }
      }
    } catch (error) {
      logError('TrashManager.confirmAction', error);
    } finally {
      setConfirmDialog(null);
    }
  };

  const restoreStudent = async (deletedStudent: DeletedStudent) => {
    try {
      const { data, error } = await (supabase as any).rpc('restore_student_full', {
        p_deleted_student_id: deletedStudent.id
      });
      
      if (error) throw error;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi tiklandi",
        description: `${deletedStudent.name} barcha ma'lumotlari bilan tiklandi`,
      });
    } catch (error) {
      logError('TrashManager.restoreStudent', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const restoreGroup = async (deletedGroup: DeletedGroup) => {
    try {
      // Guruhni tiklash
      const { error: restoreError } = await supabase
        .from('groups')
        .update({ is_active: true })
        .eq('id', deletedGroup.original_group_id);

      if (restoreError) throw restoreError;

      // Trash dan o'chirish
      const { error: deleteError } = await supabase
        .from('deleted_groups')
        .delete()
        .eq('id', deletedGroup.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Guruh tiklandi",
        description: `${deletedGroup.name} guruhi muvaffaqiyatli tiklandi`,
      });
    } catch (error) {
      logError('TrashManager.restoreGroup', error);
      toast({
        title: "Xatolik",
        description: "Guruhni tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteStudent = async (deletedStudent: DeletedStudent) => {
    try {
      // Butunlay o'chirish
      const { error: deleteError } = await supabase
        .from('deleted_students')
        .delete()
        .eq('id', deletedStudent.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi o'chirildi",
        description: `${deletedStudent.name} butunlay o'chirildi`,
      });
    } catch (error) {
      logError('TrashManager.permanentDeleteStudent', error);
      toast({
        title: "Xatolik",
        description: "O'quvchini o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteGroup = async (deletedGroup: DeletedGroup) => {
    try {
      // Butunlay o'chirish
      const { error: deleteError } = await supabase
        .from('deleted_groups')
        .delete()
        .eq('id', deletedGroup.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Guruh o'chirildi",
        description: `${deletedGroup.name} guruhi butunlay o'chirildi`,
      });
    } catch (error) {
      logError('TrashManager.permanentDeleteGroup', error);
      toast({
        title: "Xatolik",
        description: "Guruhni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const restoreExam = async (deletedExam: DeletedExam) => {
    try {
      // Imtihonni tiklash - exams jadvaliga qaytarish with correct group_id
      const { data: restoredExam, error: examError } = await supabase
        .from('exams')
        .insert({
          teacher_id: teacherId,
          exam_name: deletedExam.exam_name,
          exam_date: deletedExam.exam_date,
          group_id: deletedExam.group_id || null
        })
        .select()
        .single();

      if (examError) throw examError;

      if (restoredExam && deletedExam.results_data && Array.isArray(deletedExam.results_data)) {
        // Natijalarni to'liq tiklash
        const resultsToRestore = deletedExam.results_data.map((r: any) => ({
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

      // Trash dan o'chirish
      const { error: deleteError } = await supabase
        .from('deleted_exams')
        .delete()
        .eq('id', deletedExam.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Imtihon tiklandi",
        description: `${deletedExam.exam_name} muvaffaqiyatli tiklandi`,
      });
    } catch (error) {
      logError('TrashManager.restoreExam', error);
      toast({
        title: "Xatolik",
        description: "Imtihonni tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteExam = async (deletedExam: DeletedExam) => {
    try {
      // Butunlay o'chirish
      const { error: deleteError } = await supabase
        .from('deleted_exams')
        .delete()
        .eq('id', deletedExam.id);

      if (deleteError) throw deleteError;

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Imtihon o'chirildi",
        description: `${deletedExam.exam_name} butunlay o'chirildi`,
      });
    } catch (error) {
      logError('TrashManager.permanentDeleteExam', error);
      toast({
        title: "Xatolik",
        description: "Imtihonni o'chirishda xatolik yuz berdi",
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
          <h2 className="text-2xl font-bold">Chiqindilar qutisi</h2>
          <p className="text-muted-foreground">O'chirilgan ma'lumotlarni boshqaring</p>
        </div>
        <Button
          onClick={clearAllTrash}
          variant="destructive"
          className="flex items-center space-x-2"
          disabled={deletedStudents.length === 0 && deletedGroups.length === 0 && deletedExams.length === 0}
        >
          <Trash2 className="w-4 h-4" />
          <span>Chiqindini tozalash</span>
        </Button>
      </div>

      {/* Search */}
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

      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            O'quvchilar ({deletedStudents.length})
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Guruhlar ({deletedGroups.length})
          </TabsTrigger>
          <TabsTrigger value="exams" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Imtihonlar ({deletedExams.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6">
          {deletedStudents.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan o'quvchilar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday o'quvchi o'chirilmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">O'chirilgan o'quvchilar</h3>
                <p className="text-sm text-muted-foreground">
                  {deletedStudents.length} o'chirilgan o'quvchi
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {deletedStudents.map((student) => (
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
                          <span>O'chirilgan: {formatDateUz(student.deleted_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('restore', student, 'student')}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Tiklash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('permanent', student, 'student')}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Butunlay o'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          {deletedGroups.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan guruhlar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday guruh o'chirilmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">O'chirilgan guruhlar</h3>
                <p className="text-sm text-muted-foreground">
                  {deletedGroups.length} o'chirilgan guruh
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {deletedGroups.map((group) => (
                  <div key={group.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          {group.description && <span>{group.description}</span>}
                          <span>O'chirilgan: {formatDateUz(group.deleted_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('restore', group, 'group')}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Tiklash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('permanent', group, 'group')}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Butunlay o'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-6">
          {deletedExams.length === 0 ? (
            <Card className="apple-card p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan imtihonlar yo'q</h3>
              <p className="text-muted-foreground">
                Hali hech qanday imtihon o'chirilmagan
              </p>
            </Card>
          ) : (
            <Card className="apple-card">
              <div className="p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold">O'chirilgan imtihonlar</h3>
                <p className="text-sm text-muted-foreground">
                  {deletedExams.length} o'chirilgan imtihon
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {deletedExams.map((exam) => (
                  <div key={exam.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-medium">{exam.exam_name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{exam.group_name}</span>
                          <span>{formatDateUz(exam.exam_date)}</span>
                          <span>O'chirilgan: {formatDateUz(exam.deleted_at)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('restore', exam, 'exam')}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Tiklash
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAction('permanent', exam, 'exam')}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Butunlay o'chirish
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <Dialog open={true} onOpenChange={() => setConfirmDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                Tasdiqlash
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                {confirmDialog.type === 'restore' 
                  ? `${confirmDialog.item.name}ni tiklashni xohlaysizmi?`
                  : `${confirmDialog.item.name}ni butunlay o'chirishni xohlaysizmi? Bu amalni bekor qilib bo'lmaydi.`
                }
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(null)}
              >
                Bekor qilish
              </Button>
              <Button
                onClick={confirmAction}
                variant={confirmDialog.type === 'permanent' ? 'destructive' : 'default'}
              >
                {confirmDialog.type === 'restore' ? 'Tiklash' : 'Butunlay o\'chirish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TrashManager;
