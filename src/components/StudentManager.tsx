import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { logError } from '@/lib/errorUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, Plus, Edit2, Archive, Gift, AlertTriangle, Search, 
  List, LayoutGrid, Calendar as CalendarIcon, CheckSquare, Square, 
  Trash2, Download, Trophy, Award, BarChart3, Clock, User as UserIcon, TrendingUp,
  Filter, ArrowUpDown, MoreHorizontal, FileSpreadsheet, FileText, ArrowUp, ArrowDown, X
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn, formatDateUz, getTashkentToday, getTashkentDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { StudentScoreResult } from '@/lib/studentScoreCalculator';
import StudentImport from './StudentImport';
import StudentProfileLink from './StudentProfileLink';
import ConfirmDialog from './ConfirmDialog';

// Validation schema
const studentSchema = z.object({
  name: z.string().min(2, "Ism kamida 2 ta harfdan iborat bo'lishi kerak"),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
  student_id: z.string().optional(),
  email: z.string().email("Noto'g'ri email format").optional().or(z.literal('')),
  phone: z.string().min(9, "Telefon raqam noto'g'ri").optional().or(z.literal(''))
});

const formatValidationError = (error: z.ZodError) => {
  return error.errors.map(err => err.message).join(', ');
};

const calculateStats = (
  studentId: string,
  joinDateStr: string | undefined,
  createdAt: any,
  attendanceRecords: any[],
  rewardRecords: any[],
  groupDates: Set<string>
): StudentScoreResult => {
  // Join date logic
  let joinDate = joinDateStr || '';
  if (!joinDate) {
    if (createdAt instanceof Timestamp) {
      joinDate = getTashkentDate(createdAt.toDate()).toISOString().split('T')[0];
    } else if (typeof createdAt === 'string') {
      joinDate = getTashkentDate(new Date(createdAt)).toISOString().split('T')[0];
    }
  }

  // Total classes for this student (based on group history after join date)
  const totalClasses = Array.from(groupDates).filter(d => d >= joinDate).length;

  // Student's attendance records
  const studentAttendance = attendanceRecords.filter(a => a.student_id === studentId && a.date >= joinDate);
  
  const presentCount = studentAttendance.filter(a => a.status === 'present').length;
  const lateCount = studentAttendance.filter(a => a.status === 'late').length;
  // const excusedAbsentCount = studentAttendance.filter(a => a.status === 'absent_with_reason').length;
  const unexcusedAbsentCount = studentAttendance.filter(a => a.status === 'absent_without_reason').length;
  const absentCount = Math.max(0, totalClasses - presentCount - lateCount);

  const attendancePercentage = totalClasses > 0
    ? Math.round(((presentCount + lateCount) / totalClasses) * 100)
    : 0;

  const attendancePoints = presentCount * 1 + lateCount * 0.5; // Constants from calculator

  // Rewards
  const studentRewards = rewardRecords.filter(r => r.student_id === studentId && r.date >= joinDate);
  let mukofotPoints = 0;
  let jarimaPoints = 0;
  let bahoScore = 0;
  let bahoCount = 0;

  studentRewards.forEach((r: any) => {
    const p = Number(r.points || 0);
    if (r.type === 'Mukofot') mukofotPoints += p;
    else if (r.type === 'Jarima') jarimaPoints += p;
    else if (r.type === 'Baho') { bahoScore += p; bahoCount++; }
  });

  const rewardPenaltyPoints = mukofotPoints - jarimaPoints;
  const totalScore = rewardPenaltyPoints + attendancePoints;
  const bahoAverage = bahoCount > 0 ? bahoScore / bahoCount : 0;

  return {
    totalScore,
    attendancePoints,
    mukofotPoints,
    jarimaPoints,
    bahoScore,
    bahoAverage,
    presentCount,
    lateCount,
    absentCount,
    unexcusedAbsentCount,
    totalClasses,
    attendancePercentage,
    rewardPenaltyPoints,
    efficiency: attendancePercentage
  };
};

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: string;
  join_date?: string;
  is_active?: boolean;
}

interface StudentWithStats extends Student {
  stats: StudentScoreResult;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface StudentManagerProps {
  teacherId: string;
  onStatsUpdate?: () => Promise<void>;
}

const StudentManager: React.FC<StudentManagerProps> = ({
  teacherId,
  onStatsUpdate
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [rewardRecords, setRewardRecords] = useState<any[]>([]);
  
  // UI States
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Kept for compatibility but we prioritize list/table
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Advanced Filters & Sort
  const [filterAttendance, setFilterAttendance] = useState<[number, number]>([0, 100]);
  const [filterPoints, setFilterPoints] = useState<[number, number]>([-1000, 1000]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'all' | 'risk' | 'top' | 'negative' | 'no-attendance'>('all');

  // Form State
  const [newStudent, setNewStudent] = useState({
    name: '',
    join_date: getTashkentToday(),
    student_id: '',
    email: '',
    phone: '',
    group_name: ''
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
  }>({
    isOpen: false,
    studentId: '',
    studentName: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchStudents(),
          fetchGroups(),
          fetchAttendance(),
          fetchRewards()
        ]);
      } catch (error) {
        logError('StudentManager:loadData', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [teacherId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchStudents = async () => {
    const q = query(
      collection(db, 'students'),
      where('teacher_id', '==', teacherId),
      where('is_active', '==', true)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Student));
    setStudents(data);
  };

  const fetchGroups = async () => {
    const q = query(
      collection(db, 'groups'),
      where('teacher_id', '==', teacherId),
      where('is_active', '==', true)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Group))
      .sort((a, b) => a.name.localeCompare(b.name));
    setGroups(data);
  };

  const fetchAttendance = async () => {
    const q = query(
      collection(db, 'attendance_records'),
      where('teacher_id', '==', teacherId)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ ...doc.data() }));
    setAttendanceRecords(data);
  };

  const fetchRewards = async () => {
    const q = query(
      collection(db, 'reward_penalty_history'),
      where('teacher_id', '==', teacherId)
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ ...doc.data() }));
    setRewardRecords(data);
  };

  // Compute stats for all students
  const studentsWithStats = useMemo(() => {
    if (students.length === 0) return [];

    // Group dates map: Group Name -> Set of Dates
    const groupDatesMap: Record<string, Set<string>> = {};
    
    // Populate group dates from attendance records
    // We try to infer group from the student in the record if possible, or we iterate students
    // Since attendance record might not have group_name, we use the student map
    const studentGroupMap = new Map(students.map(s => [s.id, s.group_name]));

    attendanceRecords.forEach(record => {
      const studentId = record.student_id;
      const groupName = studentGroupMap.get(studentId);
      if (groupName && record.date) {
        // Date Range Filter logic
        if (dateRange && dateRange.from && dateRange.to) {
           const rDate = new Date(record.date);
           // Reset time part for accurate comparison if needed, but standard Date comparison works if initialized correctly
           // Assuming record.date is YYYY-MM-DD string
           const rDateStr = record.date;
           const fromStr = getTashkentDate(dateRange.from).toISOString().split('T')[0];
           const toStr = getTashkentDate(dateRange.to).toISOString().split('T')[0];
           
           if (rDateStr < fromStr || rDateStr > toStr) return;
        }

        if (!groupDatesMap[groupName]) {
          groupDatesMap[groupName] = new Set();
        }
        groupDatesMap[groupName].add(record.date);
      }
    });

    return students.map(student => {
      const groupDates = groupDatesMap[student.group_name] || new Set();
      
      let filteredAttendance = attendanceRecords;
      let filteredRewards = rewardRecords;

      if (dateRange && dateRange.from && dateRange.to) {
        const fromStr = getTashkentDate(dateRange.from).toISOString().split('T')[0];
        const toStr = getTashkentDate(dateRange.to).toISOString().split('T')[0];

        filteredAttendance = attendanceRecords.filter(r => r.date >= fromStr && r.date <= toStr);
        filteredRewards = rewardRecords.filter(r => r.date >= fromStr && r.date <= toStr);
      }

      const stats = calculateStats(
        student.id,
        student.join_date,
        student.created_at,
        filteredAttendance,
        filteredRewards,
        groupDates
      );
      return { ...student, stats };
    });
  }, [students, attendanceRecords, rewardRecords, dateRange]);

  // Filtering and Sorting
  const filteredStudents = useMemo(() => {
    let filtered = studentsWithStats;

    // Group Filter
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(student => student.group_name === selectedGroup);
    }

    // Search Filter
    if (debouncedSearchTerm) {
      const lowerSearch = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(lowerSearch) ||
        (student.student_id && student.student_id.toLowerCase().includes(lowerSearch))
      );
    }

    // Advanced Stats Filters
    filtered = filtered.filter(student => {
      const att = student.stats.attendancePercentage;
      const pts = student.stats.totalScore;
      
      const attMatch = att >= filterAttendance[0] && att <= filterAttendance[1];
      const ptsMatch = pts >= filterPoints[0] && pts <= filterPoints[1];
      
      return attMatch && ptsMatch;
    });

    if (quickFilter === 'risk') {
      filtered = filtered.filter(student => student.stats.attendancePercentage < 70);
    } else if (quickFilter === 'top') {
      filtered = filtered.filter(student => student.stats.attendancePercentage >= 90 && student.stats.totalScore >= 0);
    } else if (quickFilter === 'negative') {
      filtered = filtered.filter(student => student.stats.totalScore < 0);
    } else if (quickFilter === 'no-attendance') {
      filtered = filtered.filter(student => student.stats.totalClasses === 0);
    }

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Student];
        let bValue: any = b[sortConfig.key as keyof Student];

        // Handle nested stats keys
        if (sortConfig.key === 'attendance') {
          aValue = a.stats.attendancePercentage;
          bValue = b.stats.attendancePercentage;
        } else if (sortConfig.key === 'points') {
          aValue = a.stats.totalScore;
          bValue = b.stats.totalScore;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by name
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [studentsWithStats, selectedGroup, debouncedSearchTerm, filterAttendance, filterPoints, sortConfig, quickFilter]);

  const totalStudents = filteredStudents.length;
  const avgAttendance = totalStudents > 0 
    ? Math.round(filteredStudents.reduce((acc, s) => acc + s.stats.attendancePercentage, 0) / totalStudents)
    : 0;
  const avgScore = totalStudents > 0 
    ? filteredStudents.reduce((acc, s) => acc + s.stats.totalScore, 0) / totalStudents
    : 0;
  const insights = useMemo(() => {
    const riskStudents = filteredStudents.filter(s => s.stats.attendancePercentage < 70);
    const topStudents = filteredStudents.filter(s => s.stats.attendancePercentage >= 90 && s.stats.totalScore >= 0);
    const negativeStudents = filteredStudents.filter(s => s.stats.totalScore < 0);
    const noAttendanceStudents = filteredStudents.filter(s => s.stats.totalClasses === 0);
    const attendanceBuckets = [
      { label: '0-59%', min: 0, max: 59 },
      { label: '60-74%', min: 60, max: 74 },
      { label: '75-89%', min: 75, max: 89 },
      { label: '90-100%', min: 90, max: 100 }
    ].map(bucket => {
      const count = filteredStudents.filter(s => {
        const value = s.stats.attendancePercentage;
        return value >= bucket.min && value <= bucket.max;
      }).length;
      return { ...bucket, count };
    });
    const riskList = [...riskStudents]
      .sort((a, b) => a.stats.attendancePercentage - b.stats.attendancePercentage)
      .slice(0, 5);
    return {
      riskStudents,
      topStudents,
      negativeStudents,
      noAttendanceStudents,
      attendanceBuckets,
      riskList
    };
  }, [filteredStudents]);

  // Actions
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' 
          ? { key, direction: 'desc' } 
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const toggleAllSelection = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // Handlers for Add/Edit/Archive/Export (kept similar to before but updated for new structure)
  const addStudent = async () => {
    if (!newStudent.group_name) {
      toast({ title: "Ma'lumot yetishmayapti", description: "Guruhni tanlashingiz shart", variant: "destructive" });
      return;
    }
    try {
      studentSchema.parse(newStudent);
      await addDoc(collection(db, 'students'), {
        teacher_id: teacherId,
        name: newStudent.name.trim(),
        join_date: newStudent.join_date,
        student_id: newStudent.student_id.trim() || null,
        email: newStudent.email.trim() || null,
        phone: newStudent.phone.trim() || null,
        group_name: newStudent.group_name,
        is_active: true,
        created_at: getTashkentDate().toISOString()
      });
      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      setNewStudent({ name: '', join_date: getTashkentToday(), student_id: '', email: '', phone: '', group_name: '' });
      setIsAddDialogOpen(false);
      toast({ title: "O'quvchi qo'shildi", description: `"${newStudent.name}" muvaffaqiyatli qo'shildi` });
    } catch (error) {
      logError('StudentManager:handleCreateStudent', error);
      toast({ title: "Xatolik", description: "Xatolik yuz berdi", variant: "destructive" });
    }
  };

  const editStudent = async () => {
    if (!editingStudent) return;
    try {
      await updateDoc(doc(db, 'students', editingStudent.id), {
        name: editingStudent.name.trim(),
        student_id: editingStudent.student_id?.trim() || null,
        email: editingStudent.email?.trim() || null,
        phone: editingStudent.phone?.trim() || null,
        group_name: editingStudent.group_name
      });
      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      toast({ title: "Yangilandi", description: "O'quvchi ma'lumotlari yangilandi" });
    } catch (error) {
      logError('StudentManager:handleEditStudent', error);
      toast({ title: "Xatolik", description: "Xatolik yuz berdi", variant: "destructive" });
    }
  };

  const archiveStudent = (studentId: string, studentName: string) => {
    setConfirmDialog({ isOpen: true, studentId, studentName });
  };

  const executeArchiveStudent = async () => {
    const { studentId, studentName } = confirmDialog;
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      
      await addDoc(collection(db, 'archived_students'), {
        original_student_id: studentId,
        teacher_id: teacherId,
        name: student.name,
        student_id: student.student_id,
        group_name: student.group_name,
        email: student.email,
        phone: student.phone,
        join_date: student.join_date || null,
        created_at: student.created_at || null,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp()
      });

      await updateDoc(doc(db, 'students', studentId), {
        is_active: false,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp()
      });

      await fetchStudents();
      if (onStatsUpdate) await onStatsUpdate();
      toast({ title: "Arxivlandi", description: `"${studentName}" arxivlandi` });
    } catch (error) {
      logError('StudentManager:handleArchiveStudent', error);
      toast({ title: "Xatolik", description: "Xatolik yuz berdi", variant: "destructive" });
    } finally {
      setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleBatchArchive = async () => {
    if (!window.confirm(`${selectedStudentIds.size} ta o'quvchini arxivlashni tasdiqlaysizmi?`)) return;
    setLoading(true);
    try {
      for (const studentId of Array.from(selectedStudentIds)) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          await addDoc(collection(db, 'archived_students'), {
            original_student_id: studentId,
            teacher_id: teacherId,
            name: student.name,
            group_name: student.group_name,
            archived_at: serverTimestamp(),
            left_date: getTashkentToday()
          });
          await updateDoc(doc(db, 'students', studentId), { is_active: false, left_date: getTashkentToday(), archived_at: serverTimestamp() });
        }
      }
      await fetchStudents();
      setSelectedStudentIds(new Set());
      if (onStatsUpdate) await onStatsUpdate();
      toast({ title: "Muvaffaqiyat", description: "O'quvchilar arxivlandi" });
    } catch (error) {
      logError('StudentManager:handleDeleteStudent', error);
      toast({ title: "Xatolik", description: "Xatolik yuz berdi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportStudents = (format: 'excel' | 'pdf') => {
    const exportList = selectedStudentIds.size > 0 
      ? studentsWithStats.filter(s => selectedStudentIds.has(s.id))
      : filteredStudents;

    if (exportList.length === 0) {
      toast({ title: "Xatolik", description: "Export uchun o'quvchilar yo'q", variant: "destructive" });
      return;
    }

    const headers = ["Ism", "Guruh", "Davomat %", "Jami Ball", "Kelgan", "Kech", "Sababsiz", "Telefon"];
    const body = exportList.map(s => [
      s.name,
      s.group_name,
      `${s.stats.attendancePercentage}%`,
      s.stats.totalScore.toFixed(1),
      s.stats.presentCount,
      s.stats.lateCount,
      s.stats.unexcusedAbsentCount,
      s.phone || ''
    ]);

    if (format === 'excel') {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(wb, `Students_${getTashkentToday()}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.text("O'quvchilar Hisoboti", 14, 15);
      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 20
      });
      doc.save(`Students_${getTashkentToday()}.pdf`);
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">O'quvchilar tahlili</h2>
          <p className="text-muted-foreground">O'quvchilar davomati va natijalarini tahlil qiling</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExportStudents('excel')}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExportStudents('pdf')}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <StudentImport 
            teacherId={teacherId} 
            groupName={selectedGroup !== 'all' ? selectedGroup : undefined} 
            onImportComplete={async () => {
              await fetchStudents();
              if (onStatsUpdate) await onStatsUpdate();
            }} 
            availableGroups={groups} 
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 apple-card">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-500/25 rounded-full text-blue-600 dark:text-blue-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jami o'quvchilar</p>
              <h3 className="text-2xl font-bold">{totalStudents}</h3>
            </div>
          </div>
        </Card>
        <Card className="p-4 apple-card">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 dark:bg-emerald-500/25 rounded-full text-green-600 dark:text-emerald-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">O'rtacha davomat</p>
              <h3 className="text-2xl font-bold">{avgAttendance}%</h3>
            </div>
          </div>
        </Card>
        <Card className="p-4 apple-card">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">O'rtacha ball</p>
              <h3 className="text-2xl font-bold">{avgScore.toFixed(1)}</h3>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 apple-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Tezkor tahlil</div>
            <div className="text-sm text-muted-foreground">Kuchli va riskli o'quvchilarni tezda ajrating</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={quickFilter === 'all' ? 'default' : 'outline'} onClick={() => setQuickFilter('all')}>
              Barchasi
            </Button>
            <Button size="sm" variant={quickFilter === 'risk' ? 'default' : 'outline'} onClick={() => setQuickFilter('risk')}>
              Riskli
            </Button>
            <Button size="sm" variant={quickFilter === 'top' ? 'default' : 'outline'} onClick={() => setQuickFilter('top')}>
              Yuqori
            </Button>
            <Button size="sm" variant={quickFilter === 'negative' ? 'default' : 'outline'} onClick={() => setQuickFilter('negative')}>
              Manfiy ball
            </Button>
            <Button size="sm" variant={quickFilter === 'no-attendance' ? 'default' : 'outline'} onClick={() => setQuickFilter('no-attendance')}>
              Davomat yo'q
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="border rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Kategoriyalar</div>
            <div className="flex items-center justify-between text-sm">
              <span>Riskli davomat (&lt;70%)</span>
              <Badge variant="destructive">{insights.riskStudents.length}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Yuqori natija (90%+)</span>
              <Badge variant="secondary">{insights.topStudents.length}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Manfiy ball</span>
              <Badge variant="secondary">{insights.negativeStudents.length}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Davomat yo'q</span>
              <Badge variant="secondary">{insights.noAttendanceStudents.length}</Badge>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Davomat taqsimoti</div>
            {insights.attendanceBuckets.map(bucket => {
              const percent = totalStudents > 0 ? Math.round((bucket.count / totalStudents) * 100) : 0;
              return (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{bucket.label}</span>
                    <span>{bucket.count}</span>
                  </div>
                  <Progress value={percent} className="h-2" />
                </div>
              );
            })}
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Top xavfli o'quvchilar</div>
            {insights.riskList.length === 0 ? (
              <div className="text-sm text-muted-foreground">Riskli o'quvchilar yo'q</div>
            ) : (
              <div className="space-y-2">
                {insights.riskList.map(student => (
                  <div key={student.id} className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        <StudentProfileLink studentId={student.id} className="text-inherit hover:text-primary">
                          {student.name}
                        </StudentProfileLink>
                      </div>
                      <div className="text-xs text-muted-foreground">{student.group_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-600 dark:text-red-400">{student.stats.attendancePercentage}%</div>
                      <div className="text-xs text-muted-foreground">{student.stats.totalScore.toFixed(1)} ball</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Filters & Search */}
      <Card className="p-4 apple-card space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ism yoki ID bo'yicha qidirish..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Barcha guruhlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map(group => (
                <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("gap-2 justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                <CalendarIcon className="w-4 h-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y", { locale: uz })} -{" "}
                      {format(dateRange.to, "LLL dd, y", { locale: uz })}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y", { locale: uz })
                  )
                ) : (
                  <span>Sana oralig'i</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={uz}
              />
              <div className="p-3 border-t flex justify-end">
                 <Button variant="ghost" size="sm" onClick={() => { setDateRange(undefined); setIsCalendarOpen(false); }}>
                   Tozalash
                 </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filtrlar
                {(filterAttendance[0] > 0 || filterAttendance[1] < 100 || filterPoints[0] > -1000) && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">!</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Davomat (%)</Label>
                    <span className="text-xs text-muted-foreground">{filterAttendance[0]}% - {filterAttendance[1]}%</span>
                  </div>
                  <Slider
                    defaultValue={[0, 100]}
                    value={[filterAttendance[0], filterAttendance[1]]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(val) => setFilterAttendance([val[0], val[1]])}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Ballar</Label>
                    <span className="text-xs text-muted-foreground">{filterPoints[0]} dan {filterPoints[1]} gacha</span>
                  </div>
                  <Slider
                    defaultValue={[-100, 1000]}
                    value={[filterPoints[0], filterPoints[1]]}
                    min={-100}
                    max={1000}
                    step={10}
                    onValueChange={(val) => setFilterPoints([val[0], val[1]])}
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFilterAttendance([0, 100]);
                    setFilterPoints([-1000, 1000]);
                  }}>
                    Tozalash
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Main Data Table */}
      <Card className="apple-card overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="sm" onClick={toggleAllSelection}>
              {selectedStudentIds.size === filteredStudents.length && filteredStudents.length > 0 ? (
                <CheckSquare className="w-4 h-4 mr-2" />
              ) : (
                <Square className="w-4 h-4 mr-2" />
              )}
              {selectedStudentIds.size > 0 ? `${selectedStudentIds.size} tanlandi` : "Barchasini tanlash"}
            </Button>
            {selectedStudentIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBatchArchive}>
                <Archive className="w-4 h-4 mr-2" /> Arxivlash
              </Button>
            )}
          </div>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                <div className="flex items-center">Ism {sortConfig?.key === 'name' && <ArrowUpDown className="ml-2 w-3 h-3" />}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('group_name')}>
                <div className="flex items-center">Guruh {sortConfig?.key === 'group_name' && <ArrowUpDown className="ml-2 w-3 h-3" />}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('attendance')}>
                <div className="flex items-center">Davomat {sortConfig?.key === 'attendance' && <ArrowUpDown className="ml-2 w-3 h-3" />}</div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => handleSort('points')}>
                <div className="flex items-center">Ball {sortConfig?.key === 'points' && <ArrowUpDown className="ml-2 w-3 h-3" />}</div>
              </TableHead>
              <TableHead className="text-right">Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  O'quvchilar topilmadi
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => {
                // Determine avatar color based on attendance percentage
                const attPct = student.stats.attendancePercentage;
                const avatarBg = attPct >= 90 
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' 
                  : attPct >= 70 
                    ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' 
                    : attPct >= 50 
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white' 
                      : 'bg-gradient-to-br from-red-400 to-red-600 text-white';
                
                const isRiskStudent = attPct < 70 || student.stats.totalScore < 0;
                const isTopStudent = attPct >= 90 && student.stats.totalScore >= 0;
                
                return (
                  <TableRow 
                    key={student.id} 
                    className={cn(
                      "group transition-all duration-200",
                      "hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-indigo-50/50",
                      isRiskStudent && "bg-red-50/30 dark:bg-red-500/10",
                      isTopStudent && "bg-emerald-50/30 dark:bg-emerald-500/10",
                      selectedStudentIds.has(student.id) && "bg-blue-50 dark:bg-blue-500/15"
                    )}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div onClick={() => toggleStudentSelection(student.id)} className="cursor-pointer p-1 rounded hover:bg-muted transition-colors">
                        {selectedStudentIds.has(student.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-transform group-hover:scale-105",
                          avatarBg
                        )}>
                          {student.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <StudentProfileLink
                              studentId={student.id}
                              className="font-semibold text-foreground group-hover:text-primary transition-colors truncate"
                            >
                              {student.name}
                            </StudentProfileLink>
                            {isTopStudent && (
                              <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            )}
                            {isRiskStudent && (
                              <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {student.student_id || 'ID belgilanmagan'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium bg-muted">
                        {student.group_name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-[140px] space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className={cn(
                            "font-bold text-sm",
                            attPct >= 90 ? "text-emerald-600" :
                            attPct >= 70 ? "text-blue-600 dark:text-blue-400" :
                            attPct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {attPct}%
                          </span>
                          <span className="text-muted-foreground">
                            {student.stats.presentCount + student.stats.lateCount}/{student.stats.totalClasses}
                          </span>
                        </div>
                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                              attPct >= 90 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" :
                              attPct >= 70 ? "bg-gradient-to-r from-blue-400 to-blue-500" :
                              attPct >= 50 ? "bg-gradient-to-r from-amber-400 to-amber-500" : 
                              "bg-gradient-to-r from-red-400 to-red-500"
                            )}
                            style={{ width: `${attPct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span className="text-green-600 dark:text-emerald-400">✓{student.stats.presentCount}</span>
                          <span className="text-amber-600">⏱{student.stats.lateCount}</span>
                          <span className="text-red-600 dark:text-red-400">✗{student.stats.absentCount}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge 
                          variant={student.stats.totalScore < 0 ? "destructive" : "secondary"}
                          className={cn(
                            "font-bold px-3 py-1",
                            student.stats.totalScore >= 10 && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                            student.stats.totalScore >= 0 && student.stats.totalScore < 10 && "bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/40",
                            student.stats.totalScore < 0 && "bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-500/40"
                          )}
                        >
                          {student.stats.totalScore >= 0 ? '+' : ''}{student.stats.totalScore.toFixed(1)}
                        </Badge>
                        {(student.stats.mukofotPoints > 0 || student.stats.jarimaPoints > 0) && (
                          <div className="flex gap-2 text-[10px]">
                            {student.stats.mukofotPoints > 0 && (
                              <span className="text-green-600 dark:text-emerald-400">+{student.stats.mukofotPoints}</span>
                            )}
                            {student.stats.jarimaPoints > 0 && (
                              <span className="text-red-600 dark:text-red-400">-{student.stats.jarimaPoints}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { setEditingStudent(student); setIsEditDialogOpen(true); }}
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => navigate(`/students/${student.id}`, { state: { from: `${location.pathname}${location.search}` } })}
                            >
                              <UserIcon className="w-4 h-4 mr-2" /> Profilni ko'rish
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingStudent(student); setIsEditDialogOpen(true); }}>
                              <Edit2 className="w-4 h-4 mr-2" /> Tahrirlash
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => archiveStudent(student.id, student.name)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Arxivlash
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit/Reward Dialogs */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">F.I.SH</Label>
              <Input
                id="name"
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Guruh</Label>
              <Select
                value={newStudent.group_name}
                onValueChange={(value) => setNewStudent({ ...newStudent, group_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.name}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Add other fields as needed */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Bekor qilish</Button>
            <Button onClick={addStudent}>Qo'shish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tahrirlash</DialogTitle></DialogHeader>
          {editingStudent && (
             <div className="space-y-4">
               <Input value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} placeholder="Ism" />
               <Select value={editingStudent.group_name} onValueChange={v => setEditingStudent({...editingStudent, group_name: v})}>
                 <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                   {groups.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                 </SelectContent>
               </Select>
               <Button onClick={editStudent}>Saqlash</Button>
             </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeArchiveStudent}
        title="O'quvchini arxivlash"
        description={`"${confirmDialog.studentName}" ni arxivlashga ishonchingiz komilmi?`}
        confirmText="Arxivlash"
        variant="warning"
      />
    </div>
  );
};

export default StudentManager;
