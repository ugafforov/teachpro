import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { logError } from '@/lib/errorUtils';
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
import { Plus, FileText, Archive, Edit2, Search, Calendar, Users, BookOpen, Download, FileSpreadsheet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { examSchema, formatValidationError } from '@/lib/validations';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { formatDateUz, getTashkentToday, getTashkentDate } from '@/lib/utils';
import ConfirmDialog from './ConfirmDialog';
import StudentProfileLink from './StudentProfileLink';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  join_date?: string;
  left_date?: string;
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
  student_name: string;
  group_name: string;
}

type AnalysisRow = {
  studentName: string;
  groupName: string;
  examDate: string;
  score: number;
};

const sanitizeFileName = (name: string) => {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

interface ExamAnalysisProps {
  teacherId: string;
  exams: Exam[];
  groups: Group[];
}

const ExamAnalysis: React.FC<ExamAnalysisProps> = ({ teacherId, exams, groups }) => {
  const exportAnalysis = (format: 'excel' | 'pdf') => {
    if (!selectedExamName || Object.keys(analysisData).length === 0) return;

    const selectedGroupName = selectedAnalysisGroup === 'all'
      ? 'Barcha guruhlar'
      : (groups.find(g => g.id === selectedAnalysisGroup)?.name || '');

    const fileBase = sanitizeFileName(`${selectedExamName}_tahlil`);
    const title = `${selectedExamName} - Natijalar tahlili`;

    const headers = ['O\'quvchi', 'Guruh', ...allDates.map(d => formatDateUz(d, 'short')), "O'rtacha"];

    const rows = Object.values(analysisData)
      .map((results) => {
        const avgScore = (results.reduce((sum, r) => sum + r.score, 0) / results.length);
        const scoresByDate = new Map(results.map(r => [r.examDate, r.score] as const));

        return [
          results[0]?.studentName || '',
          results[0]?.groupName || '',
          ...allDates.map((d) => {
            const score = scoresByDate.get(d);
            return score === undefined ? '' : String(score);
          }),
          avgScore.toFixed(1)
        ];
      })
      .sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]));

    const exportedAt = formatDateUz(getTashkentToday());

    if (format === 'excel') {
      const metaRows: (string | number)[][] = [
        [title],
        ['Guruh:', selectedGroupName],
        ['Export sanasi:', exportedAt],
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...rows]);
      const wb = XLSX.utils.book_new();

      const totalCols = headers.length;
      if (totalCols > 1) {
        (ws as any)['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
      }

      (ws as any)['!cols'] = Array.from({ length: totalCols }, (_, idx) => {
        if (idx === 0) return { wch: 24 };
        if (idx === 1) return { wch: 16 };
        return { wch: 10 };
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Analysis');
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 14);

    doc.setFontSize(10);
    doc.text(`Guruh: ${selectedGroupName}`, 14, 22);
    doc.text(`Export sanasi: ${exportedAt}`, 14, 28);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`${fileBase}.pdf`);
  };
  const [selectedExamName, setSelectedExamName] = useState<string>('');
  const [selectedAnalysisGroup, setSelectedAnalysisGroup] = useState<string>('all');
  const [analysisData, setAnalysisData] = useState<Record<string, AnalysisRow[]>>({});
  const [loading, setLoading] = useState(false);

  const uniqueExamNames = useMemo(() => {
    return [...new Set(exams.map(e => e.exam_name))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [exams]);

  const allDates = useMemo(() => {
    const set = new Set<string>();
    Object.values(analysisData).forEach(rows => {
      rows.forEach(r => {
        if (r.examDate) set.add(r.examDate);
      });
    });
    return [...set].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [analysisData]);

  const fetchAnalysisData = useCallback(async () => {
    if (!selectedExamName) {
      setAnalysisData({});
      return;
    }

    setLoading(true);
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
      const examIdToDate = new Map(
        examsSnap.docs.map(d => {
          const data = d.data() as { exam_date?: string };
          return [d.id, data.exam_date ?? ''] as const;
        })
      );

      if (examIds.length === 0) {
        setAnalysisData({});
        return;
      }

      // Firestore `in` query supports max 10 values. Chunk to avoid failures.
      const examIdChunks = chunkArray(examIds, 10);
      const resultsSnaps = await Promise.all(
        examIdChunks.map((ids) => {
          const resultsQ = query(
            collection(db, 'exam_results'),
            where('teacher_id', '==', teacherId),
            where('exam_id', 'in', ids)
          );
          return getDocs(resultsQ);
        })
      );

      const grouped: Record<string, AnalysisRow[]> = {};
      resultsSnaps.flatMap(s => s.docs).forEach((docSnap) => {
        const data = docSnap.data() as {
          student_id?: string;
          student_name?: string;
          group_name?: string;
          exam_id?: string;
          score?: number;
        };

        const studentId = data.student_id;
        if (!studentId) return;

        if (!grouped[studentId]) grouped[studentId] = [];
        grouped[studentId].push({
          studentName: data.student_name ?? '',
          groupName: data.group_name ?? '',
          examDate: data.exam_id ? (examIdToDate.get(data.exam_id) ?? '') : '',
          score: data.score ?? 0,
        });
      });

      Object.keys(grouped).forEach(studentId => {
        grouped[studentId].sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());
      });

      setAnalysisData(grouped);
    } catch (error) {
      logError('ExamManager:fetchAnalysis', error);
      setAnalysisData({});
    } finally {
      setLoading(false);
    }
  }, [selectedExamName, selectedAnalysisGroup, teacherId]);

  useEffect(() => {
    void fetchAnalysisData();
  }, [fetchAnalysisData]);

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

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!loading && selectedExamName && Object.keys(analysisData).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Tahlil uchun natijalar topilmadi
        </div>
      )}

      {!loading && selectedExamName && Object.keys(analysisData).length > 0 && (
        <Card className="p-6 overflow-x-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">
              {selectedExamName} - Natijalar tahlili
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportAnalysis('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportAnalysis('pdf')}>
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">O'quvchi</TableHead>
                <TableHead className="min-w-[120px]">Guruh</TableHead>
                {allDates.map((date) => (
                  <TableHead key={date} className="text-center min-w-[100px]">
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
                      <TableCell className="font-medium">
                        <StudentProfileLink studentId={studentId} className="text-inherit hover:text-primary">
                          {results[0]?.studentName}
                        </StudentProfileLink>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{results[0]?.groupName}</TableCell>
                      {allDates.map((date) => {
                        const score = scoresByDate.get(date);
                        return (
                          <TableCell key={`${studentId}-${date}`} className="text-center">
                            {score !== undefined ? (
                              <span className={`inline-block px-3 py-1 rounded-md font-semibold ${score >= 90 ? 'bg-green-100 text-green-700 dark:bg-emerald-500/25 dark:text-emerald-300' :
                                score >= 70 ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300' :
                                  score >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-amber-500/25 dark:text-amber-300' :
                                    'bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300'
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
        </Card>
      )}
    </div>
  );
};

const ExamManager: React.FC<ExamManagerProps> = ({ teacherId }) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attendanceOnExamDate, setAttendanceOnExamDate] = useState<Map<string, string>>(new Map());

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedExamType, setSelectedExamType] = useState<string>('');
  const [customExamName, setCustomExamName] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(getTashkentToday());
  const [currentExamId, setCurrentExamId] = useState<string>('');

  const [examResults, setExamResults] = useState<Record<string, string>>({});
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showExamDetailsDialog, setShowExamDetailsDialog] = useState(false);
  const [examDetailsExamId, setExamDetailsExamId] = useState<string>('');
  const [examDetailsData, setExamDetailsData] = useState<ExamResult[]>([]);
  const [loadingExamDetails, setLoadingExamDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingExam, setCreatingExam] = useState(false);
  const [savingResults, setSavingResults] = useState(false);
  const [updatingResult, setUpdatingResult] = useState(false);
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

  const DEFAULT_VISIBLE_EXAMS = 18;
  const VISIBLE_EXAMS_STEP = 18;
  const [visibleExamsLimit, setVisibleExamsLimit] = useState<number>(DEFAULT_VISIBLE_EXAMS);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const groupNameById = useMemo(() => new Map(groups.map(g => [g.id, g.name] as const)), [groups]);
  const examTypeNameById = useMemo(() => new Map(examTypes.map(t => [t.id, t.name] as const)), [examTypes]);
  const uniqueExamNames = useMemo(() => {
    return [...new Set(exams.map(e => e.exam_name))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [exams]);

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

  const setScoreInputRef = useCallback((studentId: string) => {
    return (el: HTMLInputElement | null) => {
      scoreInputRefs.current[studentId] = el;
    };
  }, []);

  const focusScoreInputAtIndex = useCallback((index: number) => {
    const studentId = students[index]?.id;
    if (!studentId) return;
    const el = scoreInputRefs.current[studentId];
    if (!el) return;
    el.focus();
    try {
      el.select();
    } catch {
      // ignore
    }
  }, [students]);

  const handleScoreKeyDown = useCallback((studentIndex: number) => {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;

      e.preventDefault();
      const nextIndex = e.shiftKey ? studentIndex - 1 : studentIndex + 1;
      focusScoreInputAtIndex(nextIndex);
    };
  }, [focusScoreInputAtIndex]);

  useEffect(() => {
    if (!showResultsDialog) return;
    if (students.length === 0) return;

    const t = setTimeout(() => {
      focusScoreInputAtIndex(0);
    }, 0);

    return () => clearTimeout(t);
  }, [showResultsDialog, students.length, focusScoreInputAtIndex]);

  useEffect(() => {
    // Reset pagination whenever filters change
    setVisibleExamsLimit(DEFAULT_VISIBLE_EXAMS);
  }, [searchQuery, filterGroup, filterExamType, dateFilter]);

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

  const visibleExams = useMemo(() => {
    return filteredExams.slice(0, visibleExamsLimit);
  }, [filteredExams, visibleExamsLimit]);

  const hasMoreExams = filteredExams.length > visibleExams.length;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    if (!hasMoreExams) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setVisibleExamsLimit((v) => Math.min(v + VISIBLE_EXAMS_STEP, filteredExams.length));
      },
      { root: null, rootMargin: '300px', threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreExams, filteredExams.length]);

  const groupedExams = useMemo(() => {
    const byMonth: Record<string, Exam[]> = {};
    visibleExams.forEach(exam => {
      const date = getTashkentDate(new Date(exam.exam_date));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(exam);
    });
    Object.keys(byMonth).forEach(key => {
      byMonth[key].sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
    });
    return byMonth;
  }, [visibleExams]);

  const monthKeys = useMemo(() => {
    return Object.keys(groupedExams).sort((a, b) => b.localeCompare(a));
  }, [groupedExams]);

  const stats = useMemo(() => {
    const total = exams.length;
    const thisMonth = exams.filter(e => {
      const date = getTashkentDate(new Date(e.exam_date));
      const now = getTashkentDate();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
    const uniqueTypes = uniqueExamNames.length;
    const groupsWithExams = new Set(exams.map(e => e.group_id)).size;
    return { total, thisMonth, uniqueTypes, groupsWithExams };
  }, [exams, uniqueExamNames]);

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
      logError('ExamManager:fetchGroups', error);
    }
  };

  const fetchAttendanceForExamDate = async (date: string) => {
    try {
      const q = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId),
        where('date', '==', date)
      );
      const snapshot = await getDocs(q);
      const attendanceData = new Map<string, string>();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        attendanceData.set(data.student_id, data.status);
      });
      setAttendanceOnExamDate(attendanceData);
    } catch (error) {
      logError('ExamManager:fetchAttendance', error);
    }
  };

  const fetchStudents = async (groupId: string, examDate?: string) => {
    try {
      const q = query(
        collection(db, 'students'),
        where('teacher_id', '==', teacherId),
        where('group_id', '==', groupId)
      );
      const snapshot = await getDocs(q);
      let allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      
      // If exam date is provided, filter students who were active on that date
      if (examDate) {
        const examDateObj = new Date(examDate);
        allStudents = allStudents.filter(student => {
          const joinDate = student.join_date ? new Date(student.join_date) : null;
          const leftDate = student.left_date ? new Date(student.left_date) : null;
          
          if (joinDate && joinDate > examDateObj) return false;
          if (leftDate && leftDate <= examDateObj) return false;
          
          return true;
        });
      }
      
      setStudents(allStudents);
    } catch (error) {
      logError('ExamManager:fetchStudents', error);
    }
  };

  const fetchExamTypes = async () => {
    try {
      const q = query(collection(db, 'exam_types'), where('teacher_id', '==', teacherId));
      const snapshot = await getDocs(q);
      setExamTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamType)));
    } catch (error) {
      logError('ExamManager:fetchExamTypes', error);
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
      logError('ExamManager:fetchExams', error);
    }
  };

  const createExam = async () => {
    if (creatingExam) return;

    const examName = customExamName || examTypeNameById.get(selectedExamType) || '';

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

    setCreatingExam(true);
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
      setExamResults({});
      setShowCreateDialog(false);
      await fetchStudents(selectedGroup, examDate);
      await fetchAttendanceForExamDate(examDate);
      setShowResultsDialog(true);
      await fetchExams();

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Imtihon yaratildi',
      });
    } catch (error) {
      logError('ExamManager:handleCreateExam', error);
      toast({
        title: 'Xato',
        description: 'Imtihon yaratishda xatolik',
        variant: 'destructive',
      });
    } finally {
      setCreatingExam(false);
    }
  };

  const saveExamResults = async () => {
    if (!currentExamId || savingResults) return;

    setSavingResults(true);
    try {
      type NewExamResult = {
        teacher_id: string;
        exam_id: string;
        student_id: string;
        score: number;
        student_name: string;
        group_name: string;
        created_at: ReturnType<typeof serverTimestamp>;
      };

      const resultsToInsert: NewExamResult[] = Object.entries(examResults)
        .filter(([_, score]) => score && score.trim() !== '')
        .map(([studentId, score]) => {
          const parsed = Number(score);
          if (!Number.isFinite(parsed)) return null;

          const student = students.find(s => s.id === studentId);
          return {
            teacher_id: teacherId,
            exam_id: currentExamId,
            student_id: studentId,
            score: parsed,
            student_name: student?.name || '',
            group_name: groupNameById.get(selectedGroup) || '',
            created_at: serverTimestamp()
          };
        })
        .filter((r): r is NewExamResult => r !== null);

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
      setExamDate(getTashkentToday());
    } catch (error) {
      logError('ExamManager:handleSaveResults', error);
      toast({
        title: 'Xato',
        description: 'Natijalarni saqlashda xatolik',
        variant: 'destructive',
      });
    } finally {
      setSavingResults(false);
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
      logError('ExamManager:handleArchiveExam', error);
      toast({
        title: 'Xato',
        description: 'Imtihonni arxivlashda xatolik',
        variant: 'destructive',
      });
    }
  };

  const exportExamDetails = (format: 'excel' | 'pdf') => {
    const exam = exams.find(e => e.id === examDetailsExamId);
    const examName = exam?.exam_name || 'Imtihon';
    const examDate = exam?.exam_date || '';
    const groupName = exam?.group_id ? (groupNameById.get(exam.group_id) || '') : '';

    const fileBase = sanitizeFileName(`${examName}_${examDate || getTashkentToday()}`);

    const headers = ["O'quvchi", 'Guruh', 'Ball', 'Izoh'];
    const body = examDetailsData.map(r => [r.student_name, r.group_name || groupName, String(r.score), r.notes || '']);

    const avg = examDetailsData.length > 0
      ? (examDetailsData.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / examDetailsData.length)
      : 0;

    const exportedAt = formatDateUz(getTashkentToday());

    if (format === 'excel') {
      const metaRows: (string | number)[][] = [
        [examName],
        ['Sana:', examDate ? formatDateUz(examDate) : ''],
        ['Guruh:', groupName],
        ['Jami o\'quvchi:', examDetailsData.length],
        ["O'rtacha ball:", avg.toFixed(1)],
        ['Export sanasi:', exportedAt],
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...body]);
      const wb = XLSX.utils.book_new();

      (ws as any)['!cols'] = [
        { wch: 26 },
        { wch: 18 },
        { wch: 8 },
        { wch: 32 },
      ];
      (ws as any)['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(examName, 14, 14);

    doc.setFontSize(10);
    if (examDate) doc.text(`Sana: ${formatDateUz(examDate)}`, 14, 22);
    if (groupName) doc.text(`Guruh: ${groupName}`, 14, 28);
    doc.text(`Jami o'quvchi: ${examDetailsData.length}   O'rtacha ball: ${avg.toFixed(1)}`, 14, 34);
    doc.text(`Export sanasi: ${exportedAt}`, 14, 40);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 46,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`${fileBase}.pdf`);
  };

  const fetchExamDetails = async (examId: string) => {
    setShowExamDetailsDialog(true);
    setExamDetailsExamId(examId);
    setLoadingExamDetails(true);

    try {
      // Fetch exam data to get exam date and group
      const examDoc = await getDoc(doc(db, 'exams', examId));
      if (!examDoc.exists()) {
        throw new Error('Imtihon topilmadi');
      }
      const examData = examDoc.data() as Exam;
      
      // Fetch attendance for exam date
      await fetchAttendanceForExamDate(examData.exam_date);
      
      // Fetch students for that group and exam date
      await fetchStudents(examData.group_id, examData.exam_date);
      
      // Fetch existing exam results
      const q = query(
        collection(db, 'exam_results'),
        where('exam_id', '==', examId)
      );
      const snapshot = await getDocs(q);
      const existingResults = new Map();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        existingResults.set(data.student_id, {
          id: doc.id,
          score: data.score || 0,
          notes: data.notes || ''
        });
      });
      
      // Create results for ALL students (including those without results)
      const allResults: ExamResult[] = students.map(student => {
        const existing = existingResults.get(student.id);
        const attendanceStatus = attendanceOnExamDate.get(student.id);
        const wasAbsent = attendanceStatus === 'absent_with_reason' || 
                         attendanceStatus === 'absent_without_reason';
        
        return {
          id: existing?.id || `temp_${student.id}`,
          exam_id: examId,
          student_id: student.id,
          score: existing?.score || (wasAbsent ? 0 : 0),
          notes: existing?.notes || (wasAbsent ? 'Qatnashmadi' : ''),
          student_name: student.name || '',
          group_name: student.group_name || ''
        };
      }).sort((a, b) => b.score - a.score);
      
      setExamDetailsData(allResults);
    } catch (error) {
      logError('ExamManager:fetchExamDetails', error);
      toast({
        title: 'Xato',
        description: 'Imtihon natijalarini yuklashda xatolik',
        variant: 'destructive',
      });
      setExamDetailsData([]);
    } finally {
      setLoadingExamDetails(false);
    }
  };

  const updateExamResult = async () => {
    if (!editingResult || !editScore || !editReason.trim() || updatingResult) {
      toast({
        title: 'Xato',
        description: 'Ball va izohni kiriting',
        variant: 'destructive',
      });
      return;
    }

    const parsed = Number(editScore);
    if (!Number.isFinite(parsed)) {
      toast({
        title: 'Xato',
        description: 'Ball noto\'g\'ri',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingResult(true);
    try {
      const resultRef = doc(db, 'exam_results', editingResult.id);
      await updateDoc(resultRef, {
        score: parsed,
        notes: editReason.trim(),
        updated_at: serverTimestamp()
      });

      toast({
        title: 'Muvaffaqiyatli',
        description: 'Natija yangilandi',
      });

      if (examDetailsExamId) await fetchExamDetails(examDetailsExamId);

      setEditingResult(null);
      setEditScore('');
      setEditReason('');
    } catch (error) {
      logError('ExamManager:handleUpdateResult', error);
      toast({
        title: 'Xato',
        description: 'Natijani yangilashda xatolik',
        variant: 'destructive',
      });
    } finally {
      setUpdatingResult(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <Button
                onClick={createExam}
                className="w-full"
                disabled={creatingExam || !selectedGroup || (!selectedExamType && !customExamName) || !examDate}
              >
                {creatingExam ? "Yaratilmoqda..." : "Davom etish"}
              </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
              {uniqueExamNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
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
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setFilterGroup('all');
              setFilterExamType('all');
              setDateFilter('all');
            }}
          >
            Tozalash
          </Button>
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
                {students.map((student, idx) => {
                  const attendanceStatus = attendanceOnExamDate.get(student.id);
                  const wasAbsent = attendanceStatus === 'absent_with_reason' || 
                                   attendanceStatus === 'absent_without_reason';
                  
                  return (
                    <TableRow key={student.id} className={wasAbsent ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <StudentProfileLink studentId={student.id} className="text-inherit hover:text-primary">
                          {student.name}
                          {wasAbsent && <span className="ml-2 text-destructive text-sm">(Kelmagan)</span>}
                        </StudentProfileLink>
                      </TableCell>
                      <TableCell>
                        {wasAbsent ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-sm">Qatnashmadi</span>
                            <Input
                              ref={setScoreInputRef(student.id)}
                              type="number"
                              inputMode="decimal"
                              enterKeyHint="next"
                              min={0}
                              max={100}
                              step={1}
                              value={examResults[student.id] || ''}
                              onKeyDown={handleScoreKeyDown(idx)}
                              onChange={(e) => setExamResults({ ...examResults, [student.id]: e.target.value })}
                              placeholder="Keyinroq baho"
                              className="w-24"
                            />
                          </div>
                        ) : (
                          <Input
                            ref={setScoreInputRef(student.id)}
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            min={0}
                            max={100}
                            step={1}
                            value={examResults[student.id] || ''}
                            onKeyDown={handleScoreKeyDown(idx)}
                            onChange={(e) => setExamResults({ ...examResults, [student.id]: e.target.value })}
                            placeholder="Ball"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Button onClick={saveExamResults} className="w-full" disabled={savingResults}>
              {savingResults ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
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
            {monthKeys.map((monthKey) => {
              const monthExams = groupedExams[monthKey] || [];
              return (
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
                            {groupNameById.get(exam.group_id) || '-'}
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
              );
            })}

            {filteredExams.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Imtihonlar topilmadi
              </div>
            )}

            {filteredExams.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-sm text-muted-foreground">
                  Ko'rsatilmoqda: {Math.min(visibleExams.length, filteredExams.length)}/{filteredExams.length}
                </div>
                {hasMoreExams && (
                  <div className="text-sm text-muted-foreground">
                    Pastga tushsangiz avtomatik yuklanadi
                  </div>
                )}
              </div>
            )}

            {hasMoreExams && (
              <div ref={loadMoreRef} className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="analysis">
          <ExamAnalysis teacherId={teacherId} exams={exams} groups={groups} />
        </TabsContent>
      </Tabs>

      <Dialog
        open={showExamDetailsDialog}
        onOpenChange={(open) => {
          setShowExamDetailsDialog(open);
          if (!open) {
            setExamDetailsData([]);
            setExamDetailsExamId('');
            setLoadingExamDetails(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <DialogTitle>Imtihon natijalari</DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportExamDetails('excel')}
                  disabled={loadingExamDetails || examDetailsData.length === 0}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportExamDetails('pdf')}
                  disabled={loadingExamDetails || examDetailsData.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
          </DialogHeader>

          {loadingExamDetails ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : examDetailsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Natijalar topilmadi</div>
          ) : (
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
                {examDetailsData.map((result) => {
                  const attendanceStatus = attendanceOnExamDate.get(result.student_id);
                  const wasAbsent = attendanceStatus === 'absent_with_reason' || 
                                   attendanceStatus === 'absent_without_reason';
                  const hasNoResult = result.id.toString().startsWith('temp_');
                  
                  return (
                    <TableRow key={result.id} className={wasAbsent || hasNoResult ? 'bg-muted/50' : ''}>
                      <TableCell className="font-medium">
                        {result.student_id ? (
                          <StudentProfileLink studentId={result.student_id} className="text-inherit hover:text-primary">
                            {result.student_name}
                            {wasAbsent && <span className="ml-2 text-destructive text-sm">(Kelmagan)</span>}
                            {hasNoResult && !wasAbsent && <span className="ml-2 text-orange-500 text-sm">(Natija yo'q)</span>}
                          </StudentProfileLink>
                        ) : (
                          <>
                            {result.student_name}
                            {wasAbsent && <span className="ml-2 text-destructive text-sm">(Kelmagan)</span>}
                            {hasNoResult && !wasAbsent && <span className="ml-2 text-orange-500 text-sm">(Natija yo'q)</span>}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
                          wasAbsent ? 'bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300' :
                          result.score >= 90 ? 'bg-green-100 text-green-700 dark:bg-emerald-500/25 dark:text-emerald-300' :
                          result.score >= 70 ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300' :
                          result.score >= 50 ? 'bg-yellow-100 text-yellow-700 dark:bg-amber-500/25 dark:text-amber-300' :
                          'bg-gray-100 text-gray-700 dark:bg-muted dark:text-muted-foreground'
                        }`}>
                          {wasAbsent ? 'Kelmadi' : result.score}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {result.notes || '-'}
                      </TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          )}
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
              <Input type="number" inputMode="decimal" min={0} max={100} step={1} value={editScore} onChange={(e) => setEditScore(e.target.value)} />
            </div>
            <div>
              <Label>Izoh (sabab)</Label>
              <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="O'zgartirish sababi..." />
            </div>
            <Button onClick={updateExamResult} className="w-full" disabled={updatingResult}>
              {updatingResult ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
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
