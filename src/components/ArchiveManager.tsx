import React, { useState, useEffect } from 'react';
import { logError } from '@/lib/errorUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Search, RotateCcw, FileText, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { formatDateUz, getTashkentDate, getTashkentToday } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';
import RestoreDialog from './RestoreDialog';
import StudentProfileLink from './StudentProfileLink';
import { format } from 'date-fns';

interface ArchivedStudent {
  id: string;
  original_student_id: string;
  teacher_id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  archived_at: any;
}

interface ArchivedGroup {
  id: string;
  original_group_id: string;
  teacher_id: string;
  name: string;
  description?: string;
  archived_at: any;
}

interface ArchivedExam {
  id: string;
  original_exam_id: string;
  teacher_id: string;
  exam_name: string;
  exam_date: string;
  group_name: string;
  group_id?: string;
  archived_at: any;
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
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    action: 'restore_exam' | 'delete';
    itemType: 'student' | 'group' | 'exam';
    itemId: string;
    itemName: string;
  }>({
    isOpen: false,
    action: 'restore_exam',
    itemType: 'student',
    itemId: '',
    itemName: ''
  });
  const [restoreDialog, setRestoreDialog] = useState<{
    isOpen: boolean;
    itemType: 'student' | 'group' | 'exam';
    itemId: string;
    itemName: string;
  }>({
    isOpen: false,
    itemType: 'student',
    itemId: '',
    itemName: ''
  });

  useEffect(() => {
    fetchArchivedData();
  }, [teacherId]);

  const fetchArchivedData = async () => {
    if (!teacherId) return;
    try {
      setLoading(true);

      // Helper function to get time from various date formats
      const getTime = (val: any) => {
        if (!val) return 0;
        if (typeof val.getTime === 'function') return val.getTime() / 1000;
        if (val.seconds !== undefined) return val.seconds;
        if (typeof val === 'number') return val > 1e11 ? val / 1000 : val;
        try {
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime() / 1000;
        } catch (e) {
          return 0;
        }
      };

      // Fetch students
      try {
        const studentsQ = query(
          collection(db, 'archived_students'),
          where('teacher_id', '==', teacherId)
        );
        const studentsSnap = await getDocs(studentsQ);
        const studentsData = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ArchivedStudent));
        setArchivedStudents(
          studentsData.sort((a, b) => getTime(b.archived_at) - getTime(a.archived_at))
        );
      } catch (err) {
        // Silently handle or log only in production if needed
      }

      // Fetch groups
      try {
        const groupsQ = query(
          collection(db, 'archived_groups'),
          where('teacher_id', '==', teacherId)
        );
        const groupsSnap = await getDocs(groupsQ);
        const groupsData = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ArchivedGroup));
        setArchivedGroups(
          groupsData.sort((a, b) => getTime(b.archived_at) - getTime(a.archived_at))
        );
      } catch (err) {
        // Silently handle
      }

      // Fetch exams
      try {
        const examsQ = query(
          collection(db, 'archived_exams'),
          where('teacher_id', '==', teacherId)
        );
        const examsSnap = await getDocs(examsQ);
        const examsData = examsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ArchivedExam));
        setArchivedExams(
          examsData.sort((a, b) => getTime(b.archived_at) - getTime(a.archived_at))
        );
      } catch (err) {
        // Silently handle
      }

    } catch (error) {
      // General error
    } finally {
      setLoading(false);
    }
  };

  const filterData = (data: any[]) => {
    if (!searchTerm) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item =>
      (item.name?.toLowerCase().includes(term)) ||
      (item.exam_name?.toLowerCase().includes(term)) ||
      (item.group_name?.toLowerCase().includes(term)) ||
      (item.student_id?.toLowerCase().includes(term))
    );
  };

  const handleRestore = (itemType: 'student' | 'group' | 'exam', itemId: string, itemName: string) => {
    if (itemType === 'student' || itemType === 'group') {
      setRestoreDialog({
        isOpen: true,
        itemType,
        itemId,
        itemName
      });
    } else {
      setConfirmDialog({
        isOpen: true,
        action: 'restore_exam',
        itemType,
        itemId,
        itemName
      });
    }
  };

  const handleDelete = (itemType: 'student' | 'group' | 'exam', itemId: string, itemName: string) => {
    setConfirmDialog({
      isOpen: true,
      action: 'delete',
      itemType,
      itemId,
      itemName
    });
  };

  const executeAction = async () => {
    const { action, itemType, itemId, itemName } = confirmDialog;
    try {
      if (action === 'restore_exam') {
        if (itemType === 'exam') {
          await restoreExam(itemId);
          toast({ title: "Muvaffaqiyatli", description: "Imtihon tiklandi" });
        }
        return;
      }

      if (itemType === 'student') {
        await deleteArchivedStudent(itemId);
        toast({ title: "O'chirildi", description: `"${itemName}" arxivdan o'chirildi` });
      } else if (itemType === 'group') {
        await deleteArchivedGroup(itemId);
        toast({ title: "O'chirildi", description: `"${itemName}" arxivdan o'chirildi` });
      } else if (itemType === 'exam') {
        await deleteArchivedExam(itemId);
        toast({ title: "O'chirildi", description: `"${itemName}" arxivdan o'chirildi` });
      }
    } catch (error) {
      logError('ArchiveManager:handleAction', error);
      toast({ title: "Xatolik", description: "Amal bajarilmadi", variant: "destructive" });
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleRestoreConfirm = async (date: Date) => {
    const { itemType, itemId } = restoreDialog;

    if (itemType === 'student') await restoreStudent(itemId, date);
    else if (itemType === 'group') await restoreGroup(itemId, date);

    setRestoreDialog(prev => ({ ...prev, isOpen: false }));
  };

  const restoreStudent = async (studentId: string, date?: Date) => {
    try {
      const archivedStudent = archivedStudents.find(s => s.id === studentId);
      if (!archivedStudent) return;

      await updateDoc(doc(db, 'students', archivedStudent.original_student_id), {
        is_active: true,
        left_date: null,
        archived_at: null,
        updated_at: serverTimestamp(),
        ...(date && { join_date: format(date, 'yyyy-MM-dd') })
      });

      await deleteDoc(doc(db, 'archived_students', studentId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      logError('ArchiveManager:handleRestoreStudent', error);
    }
  };

  const restoreGroup = async (groupId: string, date?: Date) => {
    try {
      const archivedGroup = archivedGroups.find(g => g.id === groupId);
      if (!archivedGroup) return;

      await addDoc(collection(db, 'groups'), {
        teacher_id: teacherId,
        name: archivedGroup.name,
        description: archivedGroup.description || '',
        is_active: true,
        created_at: date ? Timestamp.fromDate(date) : serverTimestamp()
      });

      await deleteDoc(doc(db, 'archived_groups', groupId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      logError('ArchiveManager:handleRestoreGroup', error);
    }
  };

  const restoreExam = async (examId: string) => {
    try {
      const archivedExam = archivedExams.find(e => e.id === examId);
      if (!archivedExam) return;

      const examDoc = await addDoc(collection(db, 'exams'), {
        teacher_id: teacherId,
        exam_name: archivedExam.exam_name,
        exam_date: archivedExam.exam_date,
        group_id: archivedExam.group_id || null,
        created_at: serverTimestamp()
      });

      if (archivedExam.results_data && Array.isArray(archivedExam.results_data)) {
        const batch = writeBatch(db);
        archivedExam.results_data.forEach((r: any) => {
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

      await deleteDoc(doc(db, 'archived_exams', examId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      logError('ArchiveManager:handleRestoreExam', error);
    }
  };

  const deleteArchivedStudent = async (studentId: string) => {
    await deleteDoc(doc(db, 'archived_students', studentId));
    await fetchArchivedData();
    if (onStatsUpdate) await onStatsUpdate();
  };

  const deleteArchivedGroup = async (groupId: string) => {
    await deleteDoc(doc(db, 'archived_groups', groupId));
    await fetchArchivedData();
    if (onStatsUpdate) await onStatsUpdate();
  };

  const deleteArchivedExam = async (examId: string) => {
    await deleteDoc(doc(db, 'archived_exams', examId));
    await fetchArchivedData();
    if (onStatsUpdate) await onStatsUpdate();
  };

  const renderStudentsTab = () => {
    const filtered = filterData(archivedStudents);
    return (
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Arxivlangan o'quvchilar topilmadi</h3>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(student => (
              <Card key={student.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium">{(student.name || '?')[0]}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        <StudentProfileLink studentId={student.original_student_id} className="text-inherit hover:text-blue-700">
                          {student.name || 'Ismsiz o\'quvchi'}
                        </StudentProfileLink>
                      </h3>
                      <Badge variant="secondary" className="text-xs">{student.group_name}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {student.archived_at ? `Arxivlangan: ${formatDateUz(student.archived_at)}` : ''}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleRestore('student', student.id, student.name)} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete('student', student.id, student.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderGroupsTab = () => {
    const filtered = filterData(archivedGroups);
    return (
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Arxivlangan guruhlar topilmadi</h3>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(group => (
              <Card key={group.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center"><BookOpen className="w-6 h-6" /></div>
                    <div className="flex-1"><h3 className="font-semibold">{group.name}</h3></div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {group.archived_at ? `Arxivlangan: ${formatDateUz(group.archived_at)}` : ''}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleRestore('group', group.id, group.name)} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete('group', group.id, group.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExamsTab = () => {
    const filtered = filterData(archivedExams);
    return (
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Arxivlangan imtihonlar topilmadi</h3>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(exam => (
              <Card key={exam.id} className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center"><FileText className="w-6 h-6" /></div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{exam.exam_name}</h3>
                      <p className="text-sm text-muted-foreground">{formatDateUz(exam.exam_date)}</p>
                      <Badge variant="secondary" className="text-xs">{exam.group_name}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {exam.archived_at ? `Arxivlangan: ${formatDateUz(exam.archived_at)}` : ''}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleRestore('exam', exam.id, exam.exam_name)} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete('exam', exam.id, exam.exam_name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Arxiv</h2>
        <p className="text-muted-foreground">Arxivlangan guruhlar va o'quvchilar</p>
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input placeholder="Qidirish..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
      </Card>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList className="rounded-lg">
          <TabsTrigger value="students" onClick={() => setActiveTab('students')} className="rounded-lg">O'quvchilar</TabsTrigger>
          <TabsTrigger value="groups" onClick={() => setActiveTab('groups')} className="rounded-lg">Guruhlar</TabsTrigger>
          <TabsTrigger value="exams" onClick={() => setActiveTab('exams')} className="rounded-lg">Imtihonlar</TabsTrigger>
        </TabsList>
        <TabsContent value="students">{loading ? <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : renderStudentsTab()}</TabsContent>
        <TabsContent value="groups">{loading ? <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : renderGroupsTab()}</TabsContent>
        <TabsContent value="exams">{loading ? <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : renderExamsTab()}</TabsContent>
      </Tabs>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeAction}
        title={confirmDialog.action === 'delete'
          ? (confirmDialog.itemType === 'student'
            ? "O'quvchini o'chirish"
            : confirmDialog.itemType === 'group'
              ? "Guruhni o'chirish"
              : "Imtihonni o'chirish")
          : "Imtihonni tiklash"}
        description={confirmDialog.action === 'delete'
          ? `"${confirmDialog.itemName}" ni arxivdan butunlay o'chirishni tasdiqlaysizmi?`
          : `"${confirmDialog.itemName}" ni tiklashni tasdiqlaysizmi?`}
        confirmText={confirmDialog.action === 'delete' ? "O'chirish" : "Tiklash"}
        variant={confirmDialog.action === 'delete' ? "danger" : "info"}
      />

      <RestoreDialog
        isOpen={restoreDialog.isOpen}
        onClose={() => setRestoreDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleRestoreConfirm}
        title={restoreDialog.itemType === 'student' ? "O'quvchini tiklash" : "Guruhni tiklash"}
        description={`"${restoreDialog.itemName}" ni tiklashni tasdiqlaysizmi?`}
      />
    </div>
  );
};

export default ArchiveManager;
