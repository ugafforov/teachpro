import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Gift, AlertTriangle, Award, User, BarChart3, TrendingUp, TrendingDown, PieChart, FileSpreadsheet, FileText, ChevronLeft, Phone, Mail, Hash, Clock, Target, Zap, CheckCircle, XCircle, MinusCircle, ArrowLeft, Download, GraduationCap, BookOpen, Minus } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { cn, formatDateUz, getTashkentDate, getTashkentToday } from '@/lib/utils';
import { calculateStudentScore, calculateStudentRank, StudentScoreResult } from '@/lib/studentScoreCalculator';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend,
    Cell
  } from 'recharts';

interface StudentDetailViewProps {
  studentId: string;
  teacherId: string;
  onBack: () => void;
}

interface StudentDetails {
  id: string;
  name: string;
  student_id?: string;
  group_name: string;
  email?: string;
  phone?: string;
  created_at: any;
  join_date?: string;
  left_date?: string;
  archived_at?: any;
}

interface StudentStats extends StudentScoreResult {
  rank: number;
  recentRewards: Array<{
    points: number;
    reason: string;
    created_at: any;
    type: string;
  }>;
}

type AttendanceStatus = 'present' | 'late' | 'absent_with_reason' | 'absent_without_reason';

interface AttendanceHistoryRecord {
  date: string;
  status: AttendanceStatus;
  notes?: string;
}

interface ExamResultRecord {
  id: string;
  exam_id: string;
  exam_name: string;
  exam_date: string;
  score: number;
  notes?: string;
}

const StudentDetailView: React.FC<StudentDetailViewProps> = ({
  studentId,
  teacherId,
  onBack
}) => {
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResultRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'rewards' | 'exams' | 'analysis'>('overview');

  const attendanceChartData = useMemo(() => {
    if (!attendanceHistory.length) return [];
    // Take last 15 records for better visualization
    const recentAttendance = attendanceHistory.slice(0, 15).reverse();
    return recentAttendance.map(r => ({
      date: formatDateUz(r.date).split(',')[0], // Shorten date
      score: r.status === 'present' ? 100 : r.status === 'late' ? 50 : 0,
      status: r.status
    }));
  }, [attendanceHistory]);

  const rewardsChartData = useMemo(() => {
    if (!stats?.recentRewards?.length) return [];
    // Take last 10 rewards for better visualization
    const recentData = stats.recentRewards.slice(0, 10).reverse();
    return recentData.map(r => {
      const dateValue = r.created_at instanceof Timestamp 
        ? r.created_at.toDate().toISOString() 
        : (r.created_at || r.date);
      return {
        date: formatDateUz(dateValue).split(',')[0],
        points: r.type === 'Mukofot' ? r.points : -r.points,
        reason: r.reason
      };
    });
  }, [stats]);

  const examChartData = useMemo(() => {
    if (!examResults.length) return [];
    // Sort by date and take last 15
    const sorted = [...examResults].sort((a, b) => 
      new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
    ).slice(-15);
    return sorted.map(r => ({
      date: formatDateUz(r.exam_date).split(',')[0],
      score: r.score,
      name: r.exam_name
    }));
  }, [examResults]);

  const examStats = useMemo(() => {
    if (!examResults.length) return { avg: 0, max: 0, min: 0, total: 0 };
    const scores = examResults.map(r => r.score);
    return {
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
      max: Math.max(...scores),
      min: Math.min(...scores),
      total: examResults.length
    };
  }, [examResults]);

  // Imtihon turlariga ko'ra guruhlangan tahlil
  const examsByType = useMemo(() => {
    if (!examResults.length) return [];
    
    // Imtihonlarni turlariga ko'ra guruhlash
    const typeMap = new Map<string, ExamResultRecord[]>();
    
    examResults.forEach(result => {
      const examName = result.exam_name.toLowerCase();
      // Tur nomini aniqlash
      let typeName = result.exam_name;
      
      // Typing exam va boshqa turlarni ajratish
      if (examName.includes('typing') || examName.includes('tezlik') || examName.includes('yozish')) {
        typeName = 'Typing exam';
      } else if (examName.includes('nazorat') || examName.includes('control')) {
        typeName = 'Nazorat ishi';
      } else if (examName.includes('test')) {
        typeName = 'Test';
      } else if (examName.includes('oraliq')) {
        typeName = 'Oraliq nazorat';
      } else if (examName.includes('yakuniy')) {
        typeName = 'Yakuniy nazorat';
      }
      
      if (!typeMap.has(typeName)) {
        typeMap.set(typeName, []);
      }
      typeMap.get(typeName)!.push(result);
    });
    
    // Har bir tur uchun statistika hisoblash
    const typeStats: Array<{
      typeName: string;
      results: ExamResultRecord[];
      avg: number;
      trend: 'up' | 'down' | 'stable';
      trendValue: number;
      chartData: Array<{ date: string; score: number; name: string }>;
    }> = [];
    
    typeMap.forEach((results, typeName) => {
      // Sanaga ko'ra tartiblash
      const sortedResults = [...results].sort((a, b) => 
        new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()
      );
      
      const scores = sortedResults.map(r => r.score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      // Trend hisoblash (oxirgi 2 natija solishtiriladi)
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let trendValue = 0;
      
      if (sortedResults.length >= 2) {
        const lastScore = sortedResults[sortedResults.length - 1].score;
        const prevScore = sortedResults[sortedResults.length - 2].score;
        trendValue = lastScore - prevScore;
        if (trendValue > 0) trend = 'up';
        else if (trendValue < 0) trend = 'down';
      }
      
      // Grafik uchun ma'lumot
      const chartData = sortedResults.slice(-10).map(r => ({
        date: formatDateUz(r.exam_date).split(',')[0],
        score: r.score,
        name: r.exam_name
      }));
      
      typeStats.push({
        typeName,
        results: sortedResults,
        avg: Math.round(avg * 10) / 10,
        trend,
        trendValue,
        chartData
      });
    });
    
    return typeStats;
  }, [examResults]);

  useEffect(() => {
    if (studentId) {
      fetchStudentDetails();
    }
  }, [studentId, teacherId]);

  const fetchRecentRewards = async (id: string, joinDate?: string, leaveDate?: string | null): Promise<StudentStats['recentRewards']> => {
    try {
      // Composite index bo'lmasligi uchun alohida query qilamiz
      const q = query(
        collection(db, 'reward_penalty_history'),
        where('student_id', '==', id),
        where('teacher_id', '==', teacherId)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(d => d.data() as any);
      
      // Filter by type, date range, and sort in memory
      const filtered = rows.filter(r => {
        if (!r?.type || !['Mukofot', 'Jarima'].includes(r.type)) return false;
        if (!r?.date) return false;
        if (joinDate && r.date < joinDate) return false;
        if (leaveDate && r.date > leaveDate) return false;
        return true;
      });
      
      // Sort by created_at or date
      const sorted = [...filtered].sort((a, b) => {
        const aTime = a.created_at instanceof Timestamp ? a.created_at.toMillis() : new Date(a.created_at || a.date).getTime();
        const bTime = b.created_at instanceof Timestamp ? b.created_at.toMillis() : new Date(b.created_at || b.date).getTime();
        return bTime - aTime; // Descending order
      });
      
      return sorted.slice(0, 20);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      return [];
    }
  };

  const fetchAttendanceHistory = async (id: string, joinDate?: string, leaveDate?: string | null): Promise<AttendanceHistoryRecord[]> => {
    try {
      const q = query(
        collection(db, 'attendance_records'),
        where('teacher_id', '==', teacherId),
        where('student_id', '==', id)
      );
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(d => d.data() as any);
      const filtered = rows.filter(r => {
        if (!r?.date) return false;
        if (joinDate && r.date < joinDate) return false;
        if (leaveDate && r.date > leaveDate) return false;
        return true;
      });
      const sorted = [...filtered].sort((a, b) => {
        if (a.date === b.date) return 0;
        return a.date < b.date ? 1 : -1;
      });
      return sorted.slice(0, 100);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      return [];
    }
  };

  const fetchExamResults = async (id: string, joinDate?: string, leaveDate?: string | null): Promise<ExamResultRecord[]> => {
    try {
      // First get exam results for this student
      const resultsQ = query(
        collection(db, 'exam_results'),
        where('student_id', '==', id),
        where('teacher_id', '==', teacherId)
      );
      const resultsSnap = await getDocs(resultsQ);
      
      if (resultsSnap.empty) return [];
      
      const resultsData = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const examIds = [...new Set(resultsData.map(r => r.exam_id))];
      
      // Get exam details
      const examsQ = query(
        collection(db, 'exams'),
        where('teacher_id', '==', teacherId)
      );
      const examsSnap = await getDocs(examsQ);
      const examsMap = new Map<string, { name: string; date: string }>();
      examsSnap.docs.forEach(d => {
        const data = d.data();
        examsMap.set(d.id, { name: data.exam_name, date: data.exam_date });
      });
      
      // Combine results with exam info
      const combined = resultsData
        .filter(r => examsMap.has(r.exam_id))
        .map(r => {
          const examInfo = examsMap.get(r.exam_id)!;
          return {
            id: r.id,
            exam_id: r.exam_id,
            exam_name: examInfo.name,
            exam_date: examInfo.date,
            score: r.score,
            notes: r.notes
          };
        })
        .filter(r => {
          if (joinDate && r.exam_date < joinDate) return false;
          if (leaveDate && r.exam_date > leaveDate) return false;
          return true;
        })
        .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime());
      
      return combined;
    } catch (error) {
      console.error('Error fetching exam results:', error);
      return [];
    }
  };

  const fetchStudentDetails = async () => {
    try {
      setLoading(true);

      const studentDoc = await getDoc(doc(db, 'students', studentId));
      if (!studentDoc.exists()) {
        setStudent(null);
        setStats(null);
        setAttendanceHistory([]);
        setLoading(false);
        return;
      }

      const studentData = { id: studentDoc.id, ...studentDoc.data() } as StudentDetails;
      setStudent(studentData);

      const effectiveLeaveDate = (() => {
        if (studentData.left_date) return studentData.left_date;
        if (studentData.archived_at) {
          if (studentData.archived_at instanceof Timestamp) {
            return getTashkentDate(studentData.archived_at.toDate()).toISOString().split('T')[0];
          }
          if (typeof studentData.archived_at === 'string') {
            return getTashkentDate(new Date(studentData.archived_at)).toISOString().split('T')[0];
          }
          if (typeof (studentData.archived_at as any)?.seconds === 'number') {
            return getTashkentDate(new Date((studentData.archived_at as any).seconds * 1000)).toISOString().split('T')[0];
          }
        }
        return null;
      })();

      const [scoreResult, rank, recentRewards, attendance, exams] = await Promise.all([
        calculateStudentScore(
          studentData.id,
          teacherId,
          studentData.group_name,
          studentData.created_at,
          studentData.join_date,
          effectiveLeaveDate
        ),
        calculateStudentRank(studentData.id, teacherId),
        fetchRecentRewards(studentData.id, studentData.join_date, effectiveLeaveDate),
        fetchAttendanceHistory(studentData.id, studentData.join_date, effectiveLeaveDate),
        fetchExamResults(studentData.id, studentData.join_date, effectiveLeaveDate)
      ]);

      setStats({
        ...scoreResult,
        rank,
        recentRewards
      });
      setAttendanceHistory(attendance);
      setExamResults(exams);
    } catch (error) {
      console.error('Error fetching student details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateValue = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return formatDateUz(value);
    if (value instanceof Timestamp) {
      return formatDateUz(value.toDate().toISOString());
    }
    if (typeof (value as any)?.seconds === 'number') {
      return formatDateUz(new Date((value as any).seconds * 1000).toISOString());
    }
    return '';
  };

  const handleExportStudent = (format: 'excel' | 'pdf') => {
    if (!student || !stats) return;

    const overviewRows = [
      ["Ism", student.name],
      ["Guruh", student.group_name],
      ["ID", student.student_id || ''],
      ["Email", student.email || ''],
      ["Telefon", student.phone || ''],
      ["Ro'yxatdan o'tgan sana", formatDateValue(student.created_at)],
      ["A'zo bo'lgan sana", student.join_date ? formatDateUz(student.join_date) : ''],
      ["Chiqib ketgan sana", student.left_date ? formatDateUz(student.left_date) : ''],
      ["Jami ball", stats.totalScore.toFixed(1)],
      ["Davomat %", `${stats.attendancePercentage}%`],
      ["Reyting", stats.rank ? String(stats.rank) : ''],
      ["Mukofot/Jarima ballari", String(stats.rewardPenaltyPoints)],
      ["Jami dars", String(stats.totalClasses)],
      ["Kelgan", String(stats.presentCount)],
      ["Kech", String(stats.lateCount)],
      ["Yo'q", String(stats.absentCount)]
    ];

    const attendanceHeader = ["Sana", "Holat", "Izoh"];
    const attendanceBody = attendanceHistory.map(record => [
      formatDateUz(record.date),
      record.status === 'present'
        ? 'Kelgan'
        : record.status === 'late'
        ? 'Kechikkan'
        : record.status === 'absent_with_reason'
        ? "Sababli yo'q"
        : "Sababsiz yo'q",
      record.notes || ''
    ]);

    const rewardsHeader = ["Sana", "Turi", "Sabab", "Ball"];
    const rewardsBody = stats.recentRewards.map(reward => [
      reward.created_at instanceof Timestamp
        ? formatDateUz(reward.created_at.toDate().toISOString())
        : formatDateUz(reward.created_at),
      reward.type,
      reward.reason,
      String(reward.points)
    ]);

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();
      const overviewSheet = XLSX.utils.aoa_to_sheet([["Ko'rsatkich", "Qiymat"], ...overviewRows]);
      XLSX.utils.book_append_sheet(wb, overviewSheet, 'Umumiy');

      const attendanceSheet = XLSX.utils.aoa_to_sheet([attendanceHeader, ...attendanceBody]);
      XLSX.utils.book_append_sheet(wb, attendanceSheet, 'Davomat');

      const rewardsSheet = XLSX.utils.aoa_to_sheet([rewardsHeader, ...rewardsBody]);
      XLSX.utils.book_append_sheet(wb, rewardsSheet, 'Mukofotlar');

      const fileName = `Oquvchi_${student.name}_${getTashkentToday()}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } else {
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(student.name, 14, 16);
      doc.setFontSize(12);
      doc.text(`${student.group_name} guruhi`, 14, 24);

      autoTable(doc, {
        head: [["Ko'rsatkich", "Qiymat"]],
        body: overviewRows,
        startY: 32,
        styles: { fontSize: 8 }
      });

      let finalY = (doc as any).lastAutoTable?.finalY || 32;

      if (attendanceBody.length > 0) {
        autoTable(doc, {
          head: [attendanceHeader],
          body: attendanceBody,
          startY: finalY + 8,
          styles: { fontSize: 7 }
        });
        finalY = (doc as any).lastAutoTable?.finalY || finalY;
      }

      if (rewardsBody.length > 0) {
        autoTable(doc, {
          head: [rewardsHeader],
          body: rewardsBody,
          startY: finalY + 8,
          styles: { fontSize: 7 }
        });
      }

      const fileName = `Oquvchi_${student.name}_${getTashkentToday()}.pdf`;
      doc.save(fileName);
    }
  };

  const handleExportStudentExcel = () => handleExportStudent('excel');
  const handleExportStudentPdf = () => handleExportStudent('pdf');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!student || !stats) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            Orqaga
          </Button>
        </div>
        <Card className="apple-card p-8 text-center">
          <p className="text-muted-foreground">O'quvchi ma'lumotlari topilmadi</p>
        </Card>
      </div>
    );
  }

  // Determine performance level based on attendance and score
  const attPct = stats.attendancePercentage;
  const performanceLevel = attPct >= 90 && stats.totalScore >= 0 
    ? 'excellent' 
    : attPct >= 70 
      ? 'good' 
      : attPct >= 50 
        ? 'average' 
        : 'risk';
  
  const performanceColors = {
    excellent: 'from-emerald-400 to-emerald-600',
    good: 'from-blue-400 to-blue-600',
    average: 'from-amber-400 to-amber-600',
    risk: 'from-red-400 to-red-600'
  };

  const performanceLabels = {
    excellent: "A'lo natija",
    good: 'Yaxshi',
    average: "O'rtacha",
    risk: 'Diqqat talab'
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header with back button and export */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2 hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
          Orqaga
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStudentExcel}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStudentPdf}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card className="apple-card overflow-hidden">
        <div className={cn(
          "h-32 bg-gradient-to-r",
          performanceColors[performanceLevel]
        )} />
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <div className={cn(
              "w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-lg border-4 border-white bg-gradient-to-br",
              performanceColors[performanceLevel]
            )}>
              {student.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 pt-2 sm:pt-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                <Badge className={cn(
                  "text-xs font-semibold",
                  performanceLevel === 'excellent' && 'bg-emerald-100 text-emerald-700',
                  performanceLevel === 'good' && 'bg-blue-100 text-blue-700',
                  performanceLevel === 'average' && 'bg-amber-100 text-amber-700',
                  performanceLevel === 'risk' && 'bg-red-100 text-red-700'
                )}>
                  {performanceLabels[performanceLevel]}
                </Badge>
                {stats.rank > 0 && stats.rank <= 3 && (
                  <Badge className="bg-amber-100 text-amber-700">
                    <Trophy className="w-3 h-3 mr-1" />
                    #{stats.rank}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1">{student.group_name} guruhi</p>
              {(student.phone || student.email) && (
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {student.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {student.phone}
                    </span>
                  )}
                  {student.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {student.email}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/50">
          <div className="text-3xl font-bold text-blue-600">{stats.totalScore.toFixed(1)}</div>
          <div className="text-xs text-blue-600/70 font-medium mt-1">Jami ball</div>
        </Card>
        <Card className={cn(
          "p-4 text-center border-opacity-50",
          attPct >= 90 ? "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/50" :
          attPct >= 70 ? "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/50" :
          attPct >= 50 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/50" :
          "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200/50"
        )}>
          <div className={cn(
            "text-3xl font-bold",
            attPct >= 90 ? "text-emerald-600" :
            attPct >= 70 ? "text-blue-600" :
            attPct >= 50 ? "text-amber-600" : "text-red-600"
          )}>{attPct}%</div>
          <div className="text-xs text-muted-foreground font-medium mt-1">Davomat</div>
        </Card>
        <Card className="p-4 text-center bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/50">
          <div className="text-3xl font-bold text-purple-600">#{stats.rank || '-'}</div>
          <div className="text-xs text-purple-600/70 font-medium mt-1">Reyting</div>
        </Card>
        <Card className={cn(
          "p-4 text-center",
          stats.rewardPenaltyPoints >= 0 
            ? "bg-gradient-to-br from-green-50 to-green-100/50 border-green-200/50" 
            : "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200/50"
        )}>
          <div className={cn(
            "text-3xl font-bold",
            stats.rewardPenaltyPoints >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {stats.rewardPenaltyPoints >= 0 ? '+' : ''}{stats.rewardPenaltyPoints}
          </div>
          <div className="text-xs text-muted-foreground font-medium mt-1">Mukofot/Jarima</div>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Card className="apple-card">
        <div className="flex border-b border-border/60">
          <button
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-all relative',
              activeTab === 'overview'
                ? 'text-blue-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
            )}
            onClick={() => setActiveTab('overview')}
          >
            Umumiy
            {activeTab === 'overview' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-all relative',
              activeTab === 'attendance'
                ? 'text-blue-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
            )}
            onClick={() => setActiveTab('attendance')}
          >
            Davomat
            {activeTab === 'attendance' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-all relative',
              activeTab === 'rewards'
                ? 'text-blue-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
            )}
            onClick={() => setActiveTab('rewards')}
          >
            Mukofot/Jarima
            {activeTab === 'rewards' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-all relative',
              activeTab === 'exams'
                ? 'text-blue-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
            )}
            onClick={() => setActiveTab('exams')}
          >
            Imtihonlar
            {activeTab === 'exams' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
          <button
            className={cn(
              'flex-1 px-4 py-3 text-sm font-medium transition-all relative',
              activeTab === 'analysis'
                ? 'text-blue-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
            )}
            onClick={() => setActiveTab('analysis')}
          >
            Tahlil
            {activeTab === 'analysis' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        </div>

          {activeTab === 'overview' && (
            <div className="p-6 space-y-6">
              {/* Attendance Statistics with Visual Progress */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Davomat statistikasi
                </h3>
                
                {/* Circular Progress Indicator */}
                <div className="flex items-center justify-center mb-6">
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="#e5e7eb"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke={attPct >= 90 ? '#10b981' : attPct >= 70 ? '#3b82f6' : attPct >= 50 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="12"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${attPct * 4.4} 440`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn(
                        "text-4xl font-bold",
                        attPct >= 90 ? 'text-emerald-600' : attPct >= 70 ? 'text-blue-600' : attPct >= 50 ? 'text-amber-600' : 'text-red-600'
                      )}>{attPct}%</span>
                      <span className="text-xs text-muted-foreground">davomat</span>
                    </div>
                  </div>
                </div>

                {/* Detailed Stats Grid */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-200 flex items-center justify-center">
                      <Target className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-gray-700">{stats.totalClasses}</div>
                    <div className="text-xs text-muted-foreground">Jami dars</div>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-200 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{stats.presentCount}</div>
                    <div className="text-xs text-emerald-600/70">Kelgan</div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-amber-200 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-bold text-amber-600">{stats.lateCount}</div>
                    <div className="text-xs text-amber-600/70">Kechikkan</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-red-200 flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">{stats.absentCount}</div>
                    <div className="text-xs text-red-600/70">Kelmagan</div>
                  </div>
                </div>
              </div>

              {/* Score Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Ball taqsimoti
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">Davomat ballari</span>
                    </div>
                    <span className="font-bold text-blue-600">+{stats.attendancePoints.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium">Mukofot ballari</span>
                    </div>
                    <span className="font-bold text-emerald-600">+{stats.mukofotPoints}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-medium">Jarima ballari</span>
                    </div>
                    <span className="font-bold text-red-600">-{stats.jarimaPoints}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-900 rounded-lg text-white">
                    <span className="font-semibold">Jami ball</span>
                    <span className="text-xl font-bold">{stats.totalScore.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              {(student.student_id || student.join_date) && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-500" />
                    Qo'shimcha ma'lumotlar
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {student.student_id && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Hash className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-xs text-muted-foreground">O'quvchi ID</div>
                          <div className="font-medium">{student.student_id}</div>
                        </div>
                      </div>
                    )}
                    {student.join_date && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-xs text-muted-foreground">A'zo bo'lgan sana</div>
                          <div className="font-medium">{formatDateUz(student.join_date)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  Davomat tarixi
                </h3>
                <Badge variant="outline">
                  {attendanceHistory.length} ta yozuv
                </Badge>
              </div>
              {attendanceHistory.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium mb-2">
                    Davomat ma'lumotlari topilmadi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bu o'quvchining davomati hali qayd qilinmagan
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {attendanceHistory.map((record, index) => (
                    <div
                      key={`${record.date}_${index}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-colors",
                        record.status === 'present' && 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50',
                        record.status === 'late' && 'bg-amber-50/50 border-amber-200 hover:bg-amber-50',
                        record.status === 'absent_with_reason' && 'bg-orange-50/50 border-orange-200 hover:bg-orange-50',
                        record.status === 'absent_without_reason' && 'bg-red-50/50 border-red-200 hover:bg-red-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          record.status === 'present' && 'bg-emerald-200',
                          record.status === 'late' && 'bg-amber-200',
                          record.status === 'absent_with_reason' && 'bg-orange-200',
                          record.status === 'absent_without_reason' && 'bg-red-200'
                        )}>
                          {record.status === 'present' && <CheckCircle className="w-5 h-5 text-emerald-700" />}
                          {record.status === 'late' && <Clock className="w-5 h-5 text-amber-700" />}
                          {record.status === 'absent_with_reason' && <MinusCircle className="w-5 h-5 text-orange-700" />}
                          {record.status === 'absent_without_reason' && <XCircle className="w-5 h-5 text-red-700" />}
                        </div>
                        <div>
                          <div className="font-medium">
                            {formatDateUz(record.date)}
                          </div>
                          {record.notes && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {record.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          'font-semibold',
                          record.status === 'present' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                          record.status === 'late' && 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                          record.status === 'absent_with_reason' && 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                          record.status === 'absent_without_reason' && 'bg-red-100 text-red-700 hover:bg-red-200'
                        )}
                      >
                        {record.status === 'present' && "Kelgan"}
                        {record.status === 'late' && "Kechikkan"}
                        {record.status === 'absent_with_reason' && "Sababli"}
                        {record.status === 'absent_without_reason' && "Sababsiz"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Award className="w-5 h-5 text-purple-500" />
                  Mukofot va jarima tarixi
                </h3>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-100 text-emerald-700">
                    +{stats.mukofotPoints} mukofot
                  </Badge>
                  <Badge className="bg-red-100 text-red-700">
                    -{stats.jarimaPoints} jarima
                  </Badge>
                </div>
              </div>
              {stats.recentRewards.length === 0 ? (
                <div className="text-center py-12">
                  <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium mb-2">
                    Mukofot yoki jarima ma'lumotlari topilmadi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bu o'quvchiga hali mukofot yoki jarima berilmagan
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {stats.recentRewards.map((reward, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-colors",
                        reward.type === 'Mukofot' 
                          ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50' 
                          : 'bg-red-50/50 border-red-200 hover:bg-red-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          reward.type === 'Mukofot' ? 'bg-emerald-200' : 'bg-red-200'
                        )}>
                          {reward.type === 'Mukofot' ? (
                            <Gift className="w-5 h-5 text-emerald-700" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-700" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">
                            {reward.reason}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {reward.created_at instanceof Timestamp
                              ? formatDateUz(reward.created_at.toDate().toISOString())
                              : formatDateUz(reward.created_at)}
                          </div>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          'font-bold text-base px-3 py-1',
                          reward.type === 'Mukofot' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        )}
                      >
                        {reward.type === 'Mukofot' ? '+' : '-'}
                        {reward.points}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'exams' && (
            <div className="p-6 space-y-6">
              {/* Imtihon statistikasi */}
              {examResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="text-2xl font-bold text-blue-600">{examStats.total}</div>
                    <div className="text-xs text-blue-600/70">Jami imtihon</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="text-2xl font-bold text-purple-600">{examStats.avg}</div>
                    <div className="text-xs text-purple-600/70">O'rtacha ball</div>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="text-2xl font-bold text-emerald-600">{examStats.max}</div>
                    <div className="text-xs text-emerald-600/70">Eng yuqori</div>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="text-2xl font-bold text-amber-600">{examStats.min}</div>
                    <div className="text-xs text-amber-600/70">Eng past</div>
                  </div>
                </div>
              )}

              {/* Imtihon turlariga ko'ra guruhlangan natijalar */}
              {examsByType.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    Imtihon turlari bo'yicha natijalar
                  </h3>
                  
                  {examsByType.map((typeData, typeIndex) => (
                    <div 
                      key={typeData.typeName} 
                      className="p-4 rounded-xl border bg-gradient-to-r from-gray-50 to-slate-50"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{typeData.typeName}</h4>
                            <p className="text-xs text-muted-foreground">{typeData.results.length} ta imtihon</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold text-gray-700">{typeData.avg}</div>
                            <div className="text-xs text-muted-foreground">O'rtacha</div>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium",
                            typeData.trend === 'up' && "bg-emerald-100 text-emerald-700",
                            typeData.trend === 'down' && "bg-red-100 text-red-700",
                            typeData.trend === 'stable' && "bg-gray-100 text-gray-600"
                          )}>
                            {typeData.trend === 'up' && <TrendingUp className="w-4 h-4" />}
                            {typeData.trend === 'down' && <TrendingDown className="w-4 h-4" />}
                            {typeData.trend === 'stable' && <Minus className="w-4 h-4" />}
                            {typeData.trend === 'up' && `+${typeData.trendValue}`}
                            {typeData.trend === 'down' && typeData.trendValue}
                            {typeData.trend === 'stable' && 'Barqaror'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Mini chart for this type */}
                      {typeData.chartData.length > 1 && (
                        <div className="h-[150px] w-full mb-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={typeData.chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                              <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
                              <YAxis domain={[0, 100]} fontSize={10} tickLine={false} axisLine={false} hide />
                              <RechartsTooltip 
                                contentStyle={{ 
                                  backgroundColor: 'white', 
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '12px'
                                }}
                                formatter={(value: number) => [`${value} ball`, typeData.typeName]}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="score" 
                                stroke={typeData.trend === 'up' ? '#10b981' : typeData.trend === 'down' ? '#ef4444' : '#6366f1'}
                                strokeWidth={2}
                                fill={`url(#colorType${typeIndex})`}
                                fillOpacity={0.3} 
                              />
                              <defs>
                                <linearGradient id={`colorType${typeIndex}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={typeData.trend === 'up' ? '#10b981' : typeData.trend === 'down' ? '#ef4444' : '#6366f1'} stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor={typeData.trend === 'up' ? '#10b981' : typeData.trend === 'down' ? '#ef4444' : '#6366f1'} stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      
                      {/* Results list for this type */}
                      <div className="space-y-2">
                        {typeData.results.slice(-5).reverse().map((result) => {
                          const scoreColor = result.score >= 90 ? 'emerald' : result.score >= 70 ? 'blue' : result.score >= 50 ? 'amber' : 'red';
                          return (
                            <div 
                              key={result.id} 
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100"
                            >
                              <div className="flex items-center gap-2">
                                <div className="text-sm text-muted-foreground">
                                  {formatDateUz(result.exam_date).split(',')[0]}
                                </div>
                                <div className="text-sm font-medium">{result.exam_name}</div>
                              </div>
                              <Badge 
                                className={cn(
                                  "font-bold",
                                  scoreColor === 'emerald' && 'bg-emerald-100 text-emerald-700',
                                  scoreColor === 'blue' && 'bg-blue-100 text-blue-700',
                                  scoreColor === 'amber' && 'bg-amber-100 text-amber-700',
                                  scoreColor === 'red' && 'bg-red-100 text-red-700'
                                )}
                              >
                                {result.score}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Imtihon natijalari ro'yxati */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-500" />
                  Barcha imtihon natijalari
                </h3>
                {examResults.length > 0 && (
                  <Badge variant="outline">
                    {examResults.length} ta imtihon
                  </Badge>
                )}
              </div>
              
              {examResults.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium mb-2">
                    Imtihon natijalari topilmadi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bu o'quvchi hali imtihon topshirmagan
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {examResults.map((result) => {
                    const scoreColor = result.score >= 90 
                      ? 'emerald' 
                      : result.score >= 70 
                        ? 'blue' 
                        : result.score >= 50 
                          ? 'amber' 
                          : 'red';
                    return (
                      <div
                        key={result.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-colors",
                          `bg-${scoreColor}-50/50 border-${scoreColor}-200 hover:bg-${scoreColor}-50`
                        )}
                        style={{
                          backgroundColor: scoreColor === 'emerald' ? 'rgb(236 253 245 / 0.5)' :
                            scoreColor === 'blue' ? 'rgb(239 246 255 / 0.5)' :
                            scoreColor === 'amber' ? 'rgb(255 251 235 / 0.5)' :
                            'rgb(254 242 242 / 0.5)',
                          borderColor: scoreColor === 'emerald' ? 'rgb(167 243 208)' :
                            scoreColor === 'blue' ? 'rgb(191 219 254)' :
                            scoreColor === 'amber' ? 'rgb(253 230 138)' :
                            'rgb(254 202 202)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{
                              backgroundColor: scoreColor === 'emerald' ? 'rgb(167 243 208)' :
                                scoreColor === 'blue' ? 'rgb(191 219 254)' :
                                scoreColor === 'amber' ? 'rgb(253 230 138)' :
                                'rgb(254 202 202)'
                            }}
                          >
                            <GraduationCap 
                              className="w-6 h-6" 
                              style={{
                                color: scoreColor === 'emerald' ? 'rgb(4 120 87)' :
                                  scoreColor === 'blue' ? 'rgb(29 78 216)' :
                                  scoreColor === 'amber' ? 'rgb(180 83 9)' :
                                  'rgb(185 28 28)'
                              }}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {result.exam_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDateUz(result.exam_date)}
                            </div>
                            {result.notes && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {result.notes}
                              </div>
                            )}
                          </div>
                        </div>
                        <div 
                          className="text-2xl font-bold px-4 py-2 rounded-lg"
                          style={{
                            backgroundColor: scoreColor === 'emerald' ? 'rgb(209 250 229)' :
                              scoreColor === 'blue' ? 'rgb(219 234 254)' :
                              scoreColor === 'amber' ? 'rgb(254 243 199)' :
                              'rgb(254 226 226)',
                            color: scoreColor === 'emerald' ? 'rgb(4 120 87)' :
                              scoreColor === 'blue' ? 'rgb(29 78 216)' :
                              scoreColor === 'amber' ? 'rgb(180 83 9)' :
                              'rgb(185 28 28)'
                          }}
                        >
                          {result.score}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="p-6 space-y-6">
              {/* Imtihon turlari bo'yicha o'sish/pasayish tahlili */}
              {examsByType.length > 0 && (
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-indigo-500" />
                    Imtihon turlari bo'yicha tahlil
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {examsByType.map((typeData, typeIndex) => (
                      <div 
                        key={typeData.typeName}
                        className={cn(
                          "p-4 rounded-xl border",
                          typeData.trend === 'up' && "bg-emerald-50/50 border-emerald-200",
                          typeData.trend === 'down' && "bg-red-50/50 border-red-200",
                          typeData.trend === 'stable' && "bg-gray-50 border-gray-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{typeData.typeName}</h4>
                            <p className="text-xs text-muted-foreground">{typeData.results.length} ta natija</p>
                          </div>
                          <div className={cn(
                            "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold",
                            typeData.trend === 'up' && "bg-emerald-200 text-emerald-800",
                            typeData.trend === 'down' && "bg-red-200 text-red-800",
                            typeData.trend === 'stable' && "bg-gray-200 text-gray-700"
                          )}>
                            {typeData.trend === 'up' && <TrendingUp className="w-4 h-4" />}
                            {typeData.trend === 'down' && <TrendingDown className="w-4 h-4" />}
                            {typeData.trend === 'stable' && <Minus className="w-4 h-4" />}
                            {typeData.trend === 'up' && `+${typeData.trendValue} o'sish`}
                            {typeData.trend === 'down' && `${typeData.trendValue} pasayish`}
                            {typeData.trend === 'stable' && 'Barqaror'}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-3">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-700">{typeData.avg}</div>
                            <div className="text-xs text-muted-foreground">O'rtacha</div>
                          </div>
                          {typeData.results.length >= 2 && (
                            <>
                              <div className="text-center">
                                <div className="text-lg font-semibold text-gray-600">
                                  {typeData.results[typeData.results.length - 2].score}
                                </div>
                                <div className="text-xs text-muted-foreground">Oldingi</div>
                              </div>
                              <div className="text-center">
                                <div className={cn(
                                  "text-lg font-bold",
                                  typeData.trend === 'up' && "text-emerald-600",
                                  typeData.trend === 'down' && "text-red-600",
                                  typeData.trend === 'stable' && "text-gray-600"
                                )}>
                                  {typeData.results[typeData.results.length - 1].score}
                                </div>
                                <div className="text-xs text-muted-foreground">Oxirgi</div>
                              </div>
                            </>
                          )}
                        </div>
                        
                        {typeData.chartData.length > 1 && (
                          <div className="h-[100px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={typeData.chartData}>
                                <Area 
                                  type="monotone" 
                                  dataKey="score" 
                                  stroke={typeData.trend === 'up' ? '#10b981' : typeData.trend === 'down' ? '#ef4444' : '#6b7280'}
                                  strokeWidth={2}
                                  fill={typeData.trend === 'up' ? '#d1fae5' : typeData.trend === 'down' ? '#fee2e2' : '#f3f4f6'}
                                  fillOpacity={0.5} 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Davomat Dinamikasi
                </h3>
                {attendanceChartData.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-muted-foreground font-medium">
                      Davomat dinamikasi uchun ma'lumot yo'q
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kamida 2 ta davomat yozuvi kerak
                    </p>
                  </div>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attendanceChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e7ff" />
                        <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis hide domain={[0, 100]} />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #e0e7ff',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          fill="url(#colorScore)" 
                          fillOpacity={0.3} 
                        />
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  So'nggi Mukofot va Jarimalar
                </h3>
                {rewardsChartData.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-muted-foreground font-medium">
                      Mukofot/Jarima tarixi mavjud emas
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kamida 1 ta mukofot yoki jarima kerak
                    </p>
                  </div>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rewardsChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d1fae5" />
                        <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis fontSize={11} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: 'white', 
                            border: '1px solid #d1fae5',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Bar dataKey="points" radius={[6, 6, 0, 0]}>
                          {rewardsChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.points > 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
      </Card>
    </div>
  );
};

export default StudentDetailView;

