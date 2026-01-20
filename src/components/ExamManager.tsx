import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { Plus, FileText, TrendingUp, Archive, Edit2, Search, Calendar, Users, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { examSchema, formatValidationError } from '@/lib/validations';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { formatDateUz, getTashkentToday, getTashkentDate } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';

interface ExamManagerProps {
  teacherId: string;
}

interface Group {
  id: string;
  name: string;
}

interface Student {
  id: string;
  name: string;
  group_name?: string;
  group_id?: string;
}

interface ExamType {
  id: string;
  name: string;
}

interface Exam {
  id: string;
  exam_name: string;
  exam_date: string;
  group_id: string;
  exam_type_id?: string;
}

interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  notes?: string;
  student_name?: string;
  group_name?: string;
}

const ExamManager: React.FC<ExamManagerProps> = ({ teacherId }) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [customExamName, setCustomExamName] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(getTashkentToday());
  const [currentExamId, setCurrentExamId] = useState<string>('');

  const [examResults, setExamResults] = useState<Record<string, string>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showExamDetailsDialog, setShowExamDetailsDialog] = useState(false);
  const [examDetailsData, setExamDetailsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingResult, setEditingResult] = useState<{ id: string, studentName: string, currentScore: number } | null>(null);
  const [editScore, setEditScore] = useState('');
  const [editReason, setEditReason] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    examId: string;
    examName: string;
  }>({
    isOpen: false,
    examId: '',
    examName: ''
  });

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [filterExamType, setFilterExamType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchGroups(),
        fetchExamTypes(),
        fetchExams()
      ]);
      setLoading(false);
    };
    init();
  }, [teacherId]);

  useEffect(() => {
    if (selectedGroup) {
      fetchStudents(selectedGroup);
    }
  }, [selectedGroup]);

  // Filtered and grouped exams
  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      if (searchQuery && !exam.exam_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterGroup !== 'all' && exam.group_id !== filterGroup) {
        return false;
      }
      if (filterExamType !== 'all' && exam.exam_name !== filterExamType) {
        return false;
      }

      const examDateObj = getTashkentDate(new Date(exam.exam_date));
      const today = getTashkentDate();
      today.setHours(0, 0, 0, 0);

      const examDateOnly = new Date(examDateObj);
      examDateOnly.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);

      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      monthAgo.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        return examDateOnly.getTime() === today.getTime();
      } else if (dateFilter === 'week') {
        return examDateObj >= weekAgo;
      } else if (dateFilter === 'month') {
        return examDateObj >= monthAgo;
      }

      return true;
    });
  }, [exams, searchQuery, filterGroup, filterExamType, dateFilter]);

  const groupedExams = useMemo(() => {
    const groups: Record<string, Exam[]> = {};
    filteredExams.forEach(exam => {
      const date = getTashkentDate(new Date(exam.exam_date));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(exam);
    });
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
    });
    return groups;
  }, [filteredExams]);

  const stats = useMemo(() => {
    const total = exams.length;
    const thisMonth = exams.filter(e => {
      const date = getTashkentDate(new Date(e.exam_date));
      const now = getTashkentDate();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    const uniqueTypes = new Set(exams.map(e => e.exam_name)).size;
    const groupsWithExams = new Set(exams.map(e => e.group_id)).size;
    return { total, thisMonth, uniqueTypes, groupsWithExams };
  }, [exams]);

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const uzbekMonths = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
    return `${uzbekMonths[parseInt(month) - 1]}, ${year}`;
  };

  const fetchGroups = async () => {
    try {
      const q = query(
        collection(db, 'groups'),
        where('teacher_id', '==', teacherId),
        where('is_active', '==', true)
      );
      const snapshot = await getDocs(q);
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchStudents = async (groupId: string) => {
    try {
      const q = query(
        collection(db, 'students'),
        where('teacher_id', '==', teacherId),
        where('group_id', '==', groupId),
        where('is_active', '==', true)
      );
      const snapshot = await getDocs(q);
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchExamTypes = async () => {
    try {
      const q = query(collection(db, 'exam_types'), where('teacher_id', '==', teacherId));
      const snapshot = await getDocs(q);
      setExamTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamType)));
    } catch (error) {
      console.error('Error fetching exam types:', error);
    }
  };

  const fetchExams = async () => {
    try {
      const q = query(
        collection(db, 'exams'),
        where('teacher_id', '==', teacherId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Exam))
        .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
      setExams(data);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  const createExam = async () => {
    const examName = customExamName || examTypes.find(t => t.id === selectedExamType)?.name || '';

    try {
      examSchema.parse({
        exam_name: examName,
        exam_date: examDate,
        group_id: selectedGroup
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: 'Validatsiya xatosi',
          description: formatValidationError(error),
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      let examTypeId = selectedExamType;
      if (customExamName) {
        const typeDoc = await addDoc(collection(db, 'exam_types'), {
          teacher_id: teacherId,
          name: customExamName,
          created_at: serverTimestamp()
        });
        examTypeId = typeDoc.id;
        await fetchExamTypes();
      }

      const examDoc = await addDoc(collection(db, 'exams'), {
        teacher_id: teacherId,
        group_id: selectedGroup,
        exam_type_id: examTypeId,
        exam_name: examName,
        exam_date: examDate,
        created_at: serverTimestamp()
      });

      setCurrentExamId(examDoc.id);
      setShowCreateDialog(false);
      await fetchStudents(selectedGroup);
      setShowResultsDialog(true);
      await fetchExams();

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon yaratildi',
      });
    } catch (error) {
      console.error('Error creating exam:', error);
      toast({
        title: 'Xato',
        description: 'Imtihon yaratishda xatolik',
        variant: 'destructive',
      });
    }
  };

  const saveExamResults = async () => {
    if (!currentExamId) return;

    try {
      const resultsToInsert = Object.entries(examResults)
        .filter(([_, score]) => score && score.trim() !== '')
        .map(([studentId, score]) => {
          const student = students.find(s => s.id === studentId);
          return {
            teacher_id: teacherId,
            exam_id: currentExamId,
            student_id: studentId,
            score: parseFloat(score),
            student_name: student?.name || '',
            group_name: groups.find(g => g.id === selectedGroup)?.name || '',
            created_at: serverTimestamp()
          };
        });

      if (resultsToInsert.length === 0) {
        toast({
          title: 'Xato',
          description: 'Hech bo\'lmaganda bitta natija kiriting',
          variant: 'destructive',
        });
        return;
      }

      const batch = writeBatch(db);
      resultsToInsert.forEach(result => {
        const newResultRef = doc(collection(db, 'exam_results'));
        batch.set(newResultRef, result);
      });
      await batch.commit();

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Natijalar saqlandi',
      });

      setShowResultsDialog(false);
      setExamResults({});
      setCurrentExamId('');
      setSelectedGroup('');
      setSelectedExamType('');
      setCustomExamName('');
      setExamDate('');
    } catch (error) {
      console.error('Error saving results:', error);
      toast({
        title: 'Xato',
        description: 'Natijalarni saqlashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const handleAction = (examId: string, examName: string) => {
    setConfirmDialog({
      isOpen: true,
      examId,
      examName
    });
  };

  const executeAction = async () => {
    const { examId } = confirmDialog;
    await archiveExam(examId);
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const archiveExam = async (examId: string) => {
    try {
      const examRef = doc(db, 'exams', examId);
      const examSnap = await getDoc(examRef);
      const examData = examSnap.data();

      const resultsQ = query(collection(db, 'exam_results'), where('exam_id', '==', examId));
      const resultsSnap = await getDocs(resultsQ);
      const resultsData = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      await addDoc(collection(db, 'archived_exams'), {
        teacher_id: teacherId,
        original_exam_id: examId,
        exam_name: examData?.exam_name,
        exam_date: examData?.exam_date,
        group_id: examData?.group_id,
        results_data: resultsData,
        archived_at: serverTimestamp()
      });

      const batch = writeBatch(db);
      resultsSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(examRef);
      await batch.commit();

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon arxivlandi',
      });

      await fetchExams();
    } catch (error) {
      console.error('Error archiving exam:', error);
      toast({
        title: 'Xato',
        description: 'Imtihonni arxivlashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const fetchExamDetails = async (examId: string) => {
    try {
      const q = query(
        collection(db, 'exam_results'),
        where('exam_id', '==', examId)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      setExamDetailsData(results);
      setShowExamDetailsDialog(true);
    } catch (error) {
      console.error('Error fetching exam details:', error);
      toast({
        title: 'Xato',
        description: 'Imtihon natijalarini yuklashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const updateExamResult = async () => {
    if (!editingResult || !editScore || !editReason.trim()) {
      toast({
        title: 'Xato',
        description: 'Ball va izohni kiriting',
        variant: 'destructive',
      });
      return;
    }

    try {
      const resultRef = doc(db, 'exam_results', editingResult.id);
      await updateDoc(resultRef, {
        score: parseFloat(editScore),
        notes: editReason.trim(),
        updated_at: serverTimestamp()
      });

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Natija yangilandi',
      });

      const currentExam = examDetailsData[0]?.exam_id;
      if (currentExam) await fetchExamDetails(currentExam);

      setEditingResult(null);
      setEditScore('');
      setEditReason('');
    } catch (error) {
      console.error('Error updating result:', error);
      toast({
        title: 'Xato',
        description: 'Natijani yangilashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const ExamAnalysis = () => {
    const [selectedExamName, setSelectedExamName] = useState<string>('');
    const [selectedAnalysisGroup, setSelectedAnalysisGroup] = useState<string>('');
    const [analysisData, setAnalysisData] = useState<Record<string, any[]>>({});

    useEffect(() => {
      if (selectedExamName) fetchAnalysisData();
    }, [selectedExamName, selectedAnalysisGroup]);

    const fetchAnalysisData = async () => {
      try {
        let examsQ = query(
          collection(db, 'exams'),
          where('teacher_id', '==', teacherId),
          where('exam_name', '==', selectedExamName)
        );
        if (selectedAnalysisGroup && selectedAnalysisGroup !== 'all') {
          examsQ = query(examsQ, where('group_id', '==', selectedAnalysisGroup));
        }
        const examsSnap = await getDocs(examsQ);
        const examIds = examsSnap.docs.map(d => d.id);
        const examIdToDate = new Map(examsSnap.docs.map(d => [d.id, d.data().exam_date]));

        if (examIds.length === 0) {
          setAnalysisData({});
          return;
        }

        const resultsQ = query(
          collection(db, 'exam_results'),
          where('teacher_id', '==', teacherId),
          where('exam_id', 'in', examIds)
        );
        const resultsSnap = await getDocs(resultsQ);

        const grouped: Record<string, any[]> = {};
        resultsSnap.docs.forEach(doc => {
          const data = doc.data();
          const studentId = data.student_id;
          if (!grouped[studentId]) grouped[studentId] = [];
          grouped[studentId].push({
            studentName: data.student_name,
            groupName: data.group_name,
            examDate: examIdToDate.get(data.exam_id),
            score: data.score,
          });
        });

        Object.keys(grouped).forEach(studentId => {
          grouped[studentId].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
        });

        setAnalysisData(grouped);
      } catch (error) {
        console.error('Error fetching analysis:', error);
      }
    };

    const uniqueExamNames = [...new Set(exams.map(e => e.exam_name))];

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label>Imtihon turi</Label>
            <Select value={selectedExamName} onValueChange={setSelectedExamName}>
              <SelectTrigger>
                <SelectValue placeholder="Imtihon turini tanlang" />
              </SelectTrigger>
              <SelectContent>
                {uniqueExamNames.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>Guruh (ixtiyoriy)</Label>
            <Select value={selectedAnalysisGroup} onValueChange={setSelectedAnalysisGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Barcha guruhlar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barcha guruhlar</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedExamName && Object.keys(analysisData).length > 0 && (
          <Card className="p-6 overflow-x-auto">
            <h3 className="text-lg font-semibold mb-4">
              {selectedExamName} - Natijalar tahlili
            </h3>
            {(() => {
              const allDates = Array.from(new Set(Object.values(analysisData).flat().map(r => r.examDate))).sort();
              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">O'quvchi</TableHead>
                      <TableHead className="min-w-[120px]">Guruh</TableHead>
                      {allDates.map((date, idx) => (
                        <TableHead key={idx} className="text-center min-w-[100px]">
                          {formatDateUz(date, 'short')}
                        </TableHead>
                      ))}
                      <TableHead className="text-center min-w-[80px]">O'rtacha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(analysisData)
                      .sort(([, aRes], [, bRes]) => {
                        const aAvg = aRes.reduce((sum, r) => sum + r.score, 0) / aRes.length;
                        const bAvg = bRes.reduce((sum, r) => sum + r.score, 0) / bRes.length;
                        return bAvg - aAvg;
                      })
                      .map(([studentId, results]) => {
                        const avgScore = (results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1);
                        const scoresByDate = new Map(results.map(r => [r.examDate, r.score]));
                        return (
                          <TableRow key={studentId}>
                            <TableCell className="font-medium">{results[0]?.studentName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{results[0]?.groupName}</TableCell>
                            {allDates.map((date, idx) => {
                              const score = scoresByDate.get(date);
                              return (
                                <TableCell key={idx} className="text-center">
                                  {score !== undefined ? (
                                    <span className={`inline-block px-3 py-1 rounded-md font-semibold ${score >= 90 ? 'bg-green-100 text-green-700' :
                                      score >= 70 ? 'bg-blue-100 text-blue-700' :
                                        score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                      }`}>
                                      {score}
                                    </span>
                                  ) : <span className="text-muted-foreground">-</span>}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-center font-bold text-primary">{avgScore}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              );
            })()}
          </Card>
        )}
      </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Imtihonlar</h2>
          <p className="text-muted-foreground">O'quvchilar imtihon natijalarini boshqaring va tahlil qiling</p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Yangi imtihon</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yangi imtihon yaratish</DialogTitle>
              <DialogDescription>Guruh, imtihon nomi va sanani tanlang.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Guruh</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger><SelectValue placeholder="Guruhni tanlang" /></SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Imtihon turi</Label>
                <Select value={selectedExamType} onValueChange={(v) => { setSelectedExamType(v); setCustomExamName(''); }}>
                  <SelectTrigger><SelectValue placeholder="Imtihon turini tanlang" /></SelectTrigger>
                  <SelectContent>
                    {examTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Yoki yangi imtihon nomini kiriting</Label>
                <Input value={customExamName} onChange={(e) => { setCustomExamName(e.target.value); setSelectedExamType(''); }} placeholder="Masalan: Oraliq nazorat" />
              </div>
              <div>
                <Label>Imtihon sanasi</Label>
                <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              </div>
              <Button onClick={createExam} className="w-full">Davom etish</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jami imtihonlar</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bu oy</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Imtihon turlari</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueTypes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Guruhlar</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.groupsWithExams}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Imtihon nomini qidiring..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger><SelectValue placeholder="Guruh" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterExamType} onValueChange={setFilterExamType}>
            <SelectTrigger><SelectValue placeholder="Imtihon turi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha turlar</SelectItem>
              {Array.from(new Set(exams.map(e => e.exam_name))).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger><SelectValue placeholder="Sana" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha sanalar</SelectItem>
              <SelectItem value="today">Bugun</SelectItem>
              <SelectItem value="week">So'nggi hafta</SelectItem>
              <SelectItem value="month">So'nggi oy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imtihon natijalarini kiriting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>O'quvchi</TableHead>
                  <TableHead>Ball</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={examResults[student.id] || ''}
                        onChange={(e) => setExamResults({ ...examResults, [student.id]: e.target.value })}
                        placeholder="Ball"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={saveExamResults} className="w-full">Saqlash</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Imtihonlar ro'yxati</TabsTrigger>
          <TabsTrigger value="analysis">Tahlil</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="space-y-6">
            {Object.entries(groupedExams).map(([monthKey, monthExams]) => (
              <div key={monthKey} className="space-y-4">
                <h3 className="text-lg font-semibold capitalize text-muted-foreground pl-1">
                  {getMonthName(monthKey)}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {monthExams.map((exam) => (
                    <Card key={exam.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-base font-semibold truncate pr-2" title={exam.exam_name}>
                          {exam.exam_name}
                        </CardTitle>
                        <Badge variant="secondary" className="shrink-0">
                          {groups.find(g => g.id === exam.group_id)?.name}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="mr-2 h-4 w-4" />
                            {formatDateUz(exam.exam_date)}
                          </div>
                          <div className="flex justify-end space-x-2 pt-2">
                            <Button variant="ghost" size="sm" onClick={() => fetchExamDetails(exam.id)}>
                              <FileText className="h-4 w-4 mr-1" /> Natijalar
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleAction(exam.id, exam.exam_name)} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
            {filteredExams.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Imtihonlar topilmadi
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis">
          <ExamAnalysis />
        </TabsContent>
      </Tabs>

      <Dialog open={showExamDetailsDialog} onOpenChange={setShowExamDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imtihon natijalari</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>O'quvchi</TableHead>
                <TableHead>Ball</TableHead>
                <TableHead>Izoh</TableHead>
                <TableHead className="w-[100px]">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {examDetailsData.map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">{result.student_name}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${result.score >= 90 ? 'bg-green-100 text-green-700' :
                      result.score >= 70 ? 'bg-blue-100 text-blue-700' :
                        result.score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                      }`}>
                      {result.score}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{result.notes || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingResult({
                        id: result.id,
                        studentName: result.student_name,
                        currentScore: result.score
                      });
                      setEditScore(result.score.toString());
                      setEditReason(result.notes || '');
                    }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingResult} onOpenChange={() => setEditingResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Natijani tahrirlash</DialogTitle>
            <DialogDescription>{editingResult?.studentName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Ball</Label>
              <Input type="number" value={editScore} onChange={(e) => setEditScore(e.target.value)} />
            </div>
            <div>
              <Label>Izoh (sabab)</Label>
              <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="O'zgartirish sababi..." />
            </div>
            <Button onClick={updateExamResult} className="w-full">Saqlash</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeAction}
        title="Imtihonni arxivlash"
        description={`"${confirmDialog.examName}" ni arxivlashga ishonchingiz komilmi?`}
        confirmText="Arxivlash"
        variant="warning"
      />
    </div>
  );
};

export default ExamManager;
