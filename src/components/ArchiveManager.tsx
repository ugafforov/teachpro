import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Search, RotateCcw, Trash2, FileText } from 'lucide-react';
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
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'restore' | 'delete';
    itemType: 'student' | 'group' | 'exam';
    itemId: string;
    itemName: string;
  }>({
    isOpen: false,
    type: 'restore',
    itemType: 'student',
    itemId: '',
    itemName: ''
  });

  useEffect(() => {
    fetchArchivedData();
  }, [teacherId]);

  const fetchArchivedData = async () => {
    try {
      setLoading(true);

      const studentsQ = query(
        collection(db, 'archived_students'),
        where('teacher_id', '==', teacherId)
      );
      const studentsSnap = await getDocs(studentsQ);
      setArchivedStudents(
        studentsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ArchivedStudent))
          .sort((a, b) => {
            const dateA = a.archived_at?.seconds ? a.archived_at.seconds : new Date(a.archived_at).getTime() / 1000;
            const dateB = b.archived_at?.seconds ? b.archived_at.seconds : new Date(b.archived_at).getTime() / 1000;
            return dateB - dateA;
          })
      );

      const groupsQ = query(
        collection(db, 'archived_groups'),
        where('teacher_id', '==', teacherId)
      );
      const groupsSnap = await getDocs(groupsQ);
      setArchivedGroups(
        groupsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ArchivedGroup))
          .sort((a, b) => {
            const dateA = a.archived_at?.seconds ? a.archived_at.seconds : new Date(a.archived_at).getTime() / 1000;
            const dateB = b.archived_at?.seconds ? b.archived_at.seconds : new Date(b.archived_at).getTime() / 1000;
            return dateB - dateA;
          })
      );

      const examsQ = query(
        collection(db, 'archived_exams'),
        where('teacher_id', '==', teacherId)
      );
      const examsSnap = await getDocs(examsQ);
      setArchivedExams(
        examsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as ArchivedExam))
          .sort((a, b) => {
            const dateA = a.archived_at?.seconds ? a.archived_at.seconds : new Date(a.archived_at).getTime() / 1000;
            const dateB = b.archived_at?.seconds ? b.archived_at.seconds : new Date(b.archived_at).getTime() / 1000;
            return dateB - dateA;
          })
      );

    } catch (error) {
      console.error('Error fetching archived data:', error);
    } finally {
      setLoading(false);
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

  const handleAction = (type: 'restore' | 'delete', itemType: 'student' | 'group' | 'exam', itemId: string, itemName: string) => {
    setConfirmDialog({
      isOpen: true,
      type,
      itemType,
      itemId,
      itemName
    });
  };

  const executeAction = async () => {
    const { type, itemType, itemId, itemName } = confirmDialog;

    if (type === 'restore') {
      if (itemType === 'student') await restoreStudent(itemId);
      else if (itemType === 'group') await restoreGroup(itemId);
      else if (itemType === 'exam') await restoreExam(itemId);
    } else {
      if (itemType === 'student') await deleteArchivedStudent(itemId);
      else if (itemType === 'group') await deleteArchivedGroup(itemId);
      else if (itemType === 'exam') await deleteArchivedExam(itemId);
    }

    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const restoreStudent = async (studentId: string) => {
    try {
      const archivedStudent = archivedStudents.find(s => s.id === studentId);
      if (!archivedStudent) return;

      await updateDoc(doc(db, 'students', archivedStudent.original_student_id), {
        is_active: true,
        updated_at: serverTimestamp()
      });

      await deleteDoc(doc(db, 'archived_students', studentId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error restoring student:', error);
    }
  };

  const restoreGroup = async (groupId: string) => {
    try {
      const archivedGroup = archivedGroups.find(g => g.id === groupId);
      if (!archivedGroup) return;

      await addDoc(collection(db, 'groups'), {
        teacher_id: teacherId,
        name: archivedGroup.name,
        description: archivedGroup.description || '',
        is_active: true,
        created_at: serverTimestamp()
      });

      await deleteDoc(doc(db, 'archived_groups', groupId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error restoring group:', error);
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
      console.error('Error restoring exam:', error);
    }
  };

  const deleteArchivedStudent = async (studentId: string) => {
    try {
      const archivedStudent = archivedStudents.find(s => s.id === studentId);
      if (!archivedStudent) return;

      await addDoc(collection(db, 'deleted_students'), {
        original_student_id: archivedStudent.original_student_id,
        teacher_id: teacherId,
        name: archivedStudent.name,
        student_id: archivedStudent.student_id || '',
        group_name: archivedStudent.group_name,
        email: archivedStudent.email || '',
        phone: archivedStudent.phone || '',
        deleted_at: serverTimestamp()
      });

      await deleteDoc(doc(db, 'archived_students', studentId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error moving archived student to trash:', error);
    }
  };

  const deleteArchivedGroup = async (groupId: string) => {
    try {
      const archivedGroup = archivedGroups.find(g => g.id === groupId);
      if (!archivedGroup) return;

      await addDoc(collection(db, 'deleted_groups'), {
        original_group_id: archivedGroup.original_group_id,
        teacher_id: teacherId,
        name: archivedGroup.name,
        description: archivedGroup.description || '',
        deleted_at: serverTimestamp()
      });

      await deleteDoc(doc(db, 'archived_groups', groupId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error moving archived group to trash:', error);
    }
  };

  const deleteArchivedExam = async (examId: string) => {
    try {
      const archivedExam = archivedExams.find(e => e.id === examId);
      if (!archivedExam) return;

      await addDoc(collection(db, 'deleted_exams'), {
        original_exam_id: archivedExam.original_exam_id,
        teacher_id: teacherId,
        exam_name: archivedExam.exam_name,
        exam_date: archivedExam.exam_date,
        group_name: archivedExam.group_name,
        results_data: archivedExam.results_data || [],
        deleted_at: serverTimestamp()
      });

      await deleteDoc(doc(db, 'archived_exams', examId));

      await fetchArchivedData();
      if (onStatsUpdate) await onStatsUpdate();
    } catch (error) {
      console.error('Error moving archived exam to trash:', error);
    }
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
                      <span className="text-lg font-medium">{student.name[0]}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{student.name}</h3>
                      <Badge variant="secondary" className="text-xs">{student.group_name}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      {student.archived_at?.seconds ? formatDateUz(new Date(student.archived_at.seconds * 1000).toISOString()) : ''}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleAction('restore', 'student', student.id, student.name)} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleAction('delete', 'student', student.id, student.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
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
                      {group.archived_at?.seconds ? formatDateUz(new Date(group.archived_at.seconds * 1000).toISOString()) : ''}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleAction('restore', 'group', group.id, group.name)} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleAction('delete', 'group', group.id, group.name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
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
                      {exam.archived_at?.seconds ? formatDateUz(new Date(exam.archived_at.seconds * 1000).toISOString()) : ''}
                    </span>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="ghost" onClick={() => handleAction('restore', 'exam', exam.id, exam.exam_name)} className="text-green-600 hover:text-green-700 hover:bg-green-50"><RotateCcw className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleAction('delete', 'exam', exam.id, exam.exam_name)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
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
        <TabsList>
          <TabsTrigger value="students" onClick={() => setActiveTab('students')}>O'quvchilar</TabsTrigger>
          <TabsTrigger value="groups" onClick={() => setActiveTab('groups')}>Guruhlar</TabsTrigger>
          <TabsTrigger value="exams" onClick={() => setActiveTab('exams')}>Imtihonlar</TabsTrigger>
        </TabsList>
        <TabsContent value="students">{loading ? <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : renderStudentsTab()}</TabsContent>
        <TabsContent value="groups">{loading ? <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : renderGroupsTab()}</TabsContent>
        <TabsContent value="exams">{loading ? <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> : renderExamsTab()}</TabsContent>
      </Tabs>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeAction}
        title={confirmDialog.type === 'restore' ? "Qayta tiklash" : "Butunlay o'chirish"}
        description={`"${confirmDialog.itemName}" ni ${confirmDialog.type === 'restore' ? 'qayta tiklashga' : "butunlay o'chirishga"} ishonchingiz komilmi?`}
        confirmText={confirmDialog.type === 'restore' ? "Qayta tiklash" : "O'chirish"}
        variant={confirmDialog.type === 'restore' ? 'info' : 'danger'}
      />
    </div>
  );
};

export default ArchiveManager;
