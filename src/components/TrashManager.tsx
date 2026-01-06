import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Trash2, RotateCcw, Users, Layers, AlertTriangle, Search, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { formatDateUz } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';

interface DeletedStudent {
  id: string;
  original_student_id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  deleted_at: any;
  teacher_id: string;
}

interface DeletedGroup {
  id: string;
  original_group_id: string;
  name: string;
  description?: string;
  deleted_at: any;
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
  deleted_at: any;
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
    isOpen: boolean;
    type: 'restore' | 'permanent' | 'clear_all';
    item?: any;
    itemType?: 'student' | 'group' | 'exam';
  }>({
    isOpen: false,
    type: 'restore',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTrashData();
  }, [teacherId]);

  const fetchTrashData = async () => {
    try {
      setLoading(true);

      const studentsQ = query(
        collection(db, 'deleted_students'),
        where('teacher_id', '==', teacherId)
      );
      const studentsSnap = await getDocs(studentsQ);
      setDeletedStudents(
        studentsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as DeletedStudent))
          .sort((a, b) => {
            const dateA = a.deleted_at?.seconds ? a.deleted_at.seconds : new Date(a.deleted_at).getTime() / 1000;
            const dateB = b.deleted_at?.seconds ? b.deleted_at.seconds : new Date(b.deleted_at).getTime() / 1000;
            return dateB - dateA;
          })
      );

      const groupsQ = query(
        collection(db, 'deleted_groups'),
        where('teacher_id', '==', teacherId)
      );
      const groupsSnap = await getDocs(groupsQ);
      setDeletedGroups(
        groupsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as DeletedGroup))
          .sort((a, b) => {
            const dateA = a.deleted_at?.seconds ? a.deleted_at.seconds : new Date(a.deleted_at).getTime() / 1000;
            const dateB = b.deleted_at?.seconds ? b.deleted_at.seconds : new Date(b.deleted_at).getTime() / 1000;
            return dateB - dateA;
          })
      );

      const examsQ = query(
        collection(db, 'deleted_exams'),
        where('teacher_id', '==', teacherId)
      );
      const examsSnap = await getDocs(examsQ);
      setDeletedExams(
        examsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as DeletedExam))
          .sort((a, b) => {
            const dateA = a.deleted_at?.seconds ? a.deleted_at.seconds : new Date(a.deleted_at).getTime() / 1000;
            const dateB = b.deleted_at?.seconds ? b.deleted_at.seconds : new Date(b.deleted_at).getTime() / 1000;
            return dateB - dateA;
          })
      );

    } catch (error) {
      console.error('Error fetching deleted data:', error);
      toast({
        title: "Xatolik",
        description: "O'chirilgan ma'lumotlarni yuklashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'clear_all'
    });
  };

  const executeClearAll = async () => {
    try {
      const batch = writeBatch(db);

      const studentsQ = query(collection(db, 'deleted_students'), where('teacher_id', '==', teacherId));
      const studentsSnap = await getDocs(studentsQ);
      studentsSnap.docs.forEach(d => batch.delete(d.ref));

      const groupsQ = query(collection(db, 'deleted_groups'), where('teacher_id', '==', teacherId));
      const groupsSnap = await getDocs(groupsQ);
      groupsSnap.docs.forEach(d => batch.delete(d.ref));

      const examsQ = query(collection(db, 'deleted_exams'), where('teacher_id', '==', teacherId));
      const examsSnap = await getDocs(examsQ);
      examsSnap.docs.forEach(d => batch.delete(d.ref));

      await batch.commit();

      await fetchTrashData();
      if (onStatsUpdate) await onStatsUpdate();

      toast({
        title: "Muvaffaqiyatli",
        description: "Chiqindi qutisi tozalandi",
      });
    } catch (error) {
      console.error('Error clearing all trash:', error);
      toast({
        title: "Xatolik",
        description: "Chiqindini tozalashda xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleAction = (type: 'restore' | 'permanent', item: any, itemType: 'student' | 'group' | 'exam') => {
    setConfirmDialog({
      isOpen: true,
      type,
      item,
      itemType
    });
  };

  const executeAction = async () => {
    const { type, item, itemType } = confirmDialog;
    if (!item || !itemType) return;

    try {
      if (itemType === 'student') {
        if (type === 'restore') await restoreStudent(item);
        else await permanentDeleteStudent(item);
      } else if (itemType === 'group') {
        if (type === 'restore') await restoreGroup(item);
        else await permanentDeleteGroup(item);
      } else if (itemType === 'exam') {
        if (type === 'restore') await restoreExam(item);
        else await permanentDeleteExam(item);
      }
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const restoreStudent = async (deletedStudent: DeletedStudent) => {
    try {
      // Restore student to students collection
      await updateDoc(doc(db, 'students', deletedStudent.original_student_id), {
        is_active: true,
        updated_at: serverTimestamp()
      });

      // Delete from deleted_students
      await deleteDoc(doc(db, 'deleted_students', deletedStudent.id));

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi tiklandi",
        description: `${deletedStudent.name} muvaffaqiyatli tiklandi`,
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

  const restoreGroup = async (deletedGroup: DeletedGroup) => {
    try {
      await updateDoc(doc(db, 'groups', deletedGroup.original_group_id), {
        is_active: true,
        updated_at: serverTimestamp()
      });

      await deleteDoc(doc(db, 'deleted_groups', deletedGroup.id));

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Guruh tiklandi",
        description: `${deletedGroup.name} guruhi muvaffaqiyatli tiklandi`,
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

  const permanentDeleteStudent = async (deletedStudent: DeletedStudent) => {
    try {
      await deleteDoc(doc(db, 'deleted_students', deletedStudent.id));

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "O'quvchi o'chirildi",
        description: `${deletedStudent.name} butunlay o'chirildi`,
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

  const permanentDeleteGroup = async (deletedGroup: DeletedGroup) => {
    try {
      await deleteDoc(doc(db, 'deleted_groups', deletedGroup.id));

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Guruh o'chirildi",
        description: `${deletedGroup.name} guruhi butunlay o'chirildi`,
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

  const restoreExam = async (deletedExam: DeletedExam) => {
    try {
      const examDoc = await addDoc(collection(db, 'exams'), {
        teacher_id: teacherId,
        exam_name: deletedExam.exam_name,
        exam_date: deletedExam.exam_date,
        group_id: deletedExam.group_id || null,
        created_at: serverTimestamp()
      });

      if (deletedExam.results_data && Array.isArray(deletedExam.results_data)) {
        const batch = writeBatch(db);
        deletedExam.results_data.forEach((r: any) => {
          const newResultRef = doc(collection(db, 'exam_results'));
          batch.set(newResultRef, {
            teacher_id: teacherId,
            exam_id: examDoc.id,
            student_id: r.student_id,
            score: r.score,
            notes: r.notes || null,
            student_name: r.student_name || '',
            group_name: r.group_name || '',
            created_at: serverTimestamp()
          });
        });
        await batch.commit();
      }

      await deleteDoc(doc(db, 'deleted_exams', deletedExam.id));

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Imtihon tiklandi",
        description: `${deletedExam.exam_name} muvaffaqiyatli tiklandi`,
      });
    } catch (error) {
      console.error('Error restoring exam:', error);
      toast({
        title: "Xatolik",
        description: "Imtihonni tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const permanentDeleteExam = async (deletedExam: DeletedExam) => {
    try {
      await deleteDoc(doc(db, 'deleted_exams', deletedExam.id));

      await fetchTrashData();
      await onStatsUpdate();

      toast({
        title: "Imtihon o'chirildi",
        description: `${deletedExam.exam_name} butunlay o'chirildi`,
      });
    } catch (error) {
      console.error('Error permanently deleting exam:', error);
      toast({
        title: "Xatolik",
        description: "Imtihonni o'chirishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const filterData = (data: any[]) => {
    const term = searchTerm.toLowerCase();
    return data.filter(item =>
      (item.name?.toLowerCase().includes(term)) ||
      (item.exam_name?.toLowerCase().includes(term)) ||
      (item.group_name?.toLowerCase().includes(term)) ||
      (item.student_id?.toLowerCase().includes(term))
    );
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
          onClick={handleClearAll}
          variant="destructive"
          className="flex items-center space-x-2"
          disabled={deletedStudents.length === 0 && deletedGroups.length === 0 && deletedExams.length === 0}
        >
          <Trash2 className="w-4 h-4" />
          <span>Chiqindini tozalash</span>
        </Button>
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
          {filterData(deletedStudents).length === 0 ? (
            <Card className="p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan o'quvchilar yo'q</h3>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-border/50">
                {filterData(deletedStudents).map((student) => (
                  <div key={student.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">{student.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium">{student.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{student.group_name}</span>
                          <span>O'chirilgan: {student.deleted_at?.seconds ? formatDateUz(new Date(student.deleted_at.seconds * 1000).toISOString()) : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleAction('restore', student, 'student')} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4 mr-1" />Tiklash</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction('permanent', student, 'student')} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1" />O'chirish</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups" className="mt-6">
          {filterData(deletedGroups).length === 0 ? (
            <Card className="p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan guruhlar yo'q</h3>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-border/50">
                {filterData(deletedGroups).map((group) => (
                  <div key={group.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center"><Layers className="w-5 h-5" /></div>
                      <div>
                        <p className="font-medium">{group.name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>O'chirilgan: {group.deleted_at?.seconds ? formatDateUz(new Date(group.deleted_at.seconds * 1000).toISOString()) : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleAction('restore', group, 'group')} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4 mr-1" />Tiklash</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction('permanent', group, 'group')} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1" />O'chirish</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exams" className="mt-6">
          {filterData(deletedExams).length === 0 ? (
            <Card className="p-12 text-center">
              <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">O'chirilgan imtihonlar yo'q</h3>
            </Card>
          ) : (
            <Card>
              <div className="divide-y divide-border/50">
                {filterData(deletedExams).map((exam) => (
                  <div key={exam.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center"><FileText className="w-5 h-5" /></div>
                      <div>
                        <p className="font-medium">{exam.exam_name}</p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <span>{exam.group_name}</span>
                          <span>O'chirilgan: {exam.deleted_at?.seconds ? formatDateUz(new Date(exam.deleted_at.seconds * 1000).toISOString()) : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleAction('restore', exam, 'exam')} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4 mr-1" />Tiklash</Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction('permanent', exam, 'exam')} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4 mr-1" />O'chirish</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.type === 'clear_all' ? executeClearAll : executeAction}
        title={
          confirmDialog.type === 'clear_all' ? "Chiqindini tozalash" :
            confirmDialog.type === 'restore' ? "Qayta tiklash" : "Butunlay o'chirish"
        }
        description={
          confirmDialog.type === 'clear_all' ? "Rostdan ham chiqindi qutisidagi barcha ma'lumotlarni butunlay o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi!" :
            `"${confirmDialog.item?.name || confirmDialog.item?.exam_name}" ni ${confirmDialog.type === 'restore' ? 'qayta tiklashga' : "butunlay o'chirishga"} ishonchingiz komilmi?`
        }
        confirmText={
          confirmDialog.type === 'clear_all' ? "Tozalash" :
            confirmDialog.type === 'restore' ? "Qayta tiklash" : "O'chirish"
        }
        variant={confirmDialog.type === 'restore' ? 'info' : 'danger'}
      />
    </div>
  );
};

export default TrashManager;
