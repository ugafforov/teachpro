import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Download,
  Plus,
  Edit2,
  MoreVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/errorUtils";
import { formatDateUz, getTashkentToday } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import StudentProfileLink from "../StudentProfileLink";
import { Exam, ExamResult, Group, Student } from "./types";
import { QuickResultEntryDialog } from "./QuickResultEntryDialog";

interface ExamAnalyticsDashboardProps {
  teacherId: string;
}

interface ExamMetrics {
  totalExams: number;
  averageScore: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  totalResults: number;
}

interface GradeDistribution {
  grade: string;
  count: number;
  percentage: number;
}

interface StudentPerformance {
  studentId: string;
  studentName: string;
  groupName: string;
  averageScore: number;
  totalTaken: number;
  passRate: number;
  trend: "up" | "down" | "stable";
}

interface ScoreTrend {
  date: string;
  averageScore: number;
  passCount: number;
  failCount: number;
}

const PASS_SCORE = 60;
const GRADE_COLORS: Record<string, string> = {
  "A+": "#10b981",
  A: "#34d399",
  B: "#60a5fa",
  C: "#fbbf24",
  D: "#f97316",
  F: "#ef4444",
};

const getGrade = (score: number): string => {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
};

export const ExamAnalyticsDashboard: React.FC<ExamAnalyticsDashboardProps> = ({
  teacherId,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allResults, setAllResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedExam, setSelectedExam] = useState<string>("all");
  const [dateRange, setDateRange] = useState<"all" | "week" | "month" | "semester">(
    "semester"
  );

  const [showAddResults, setShowAddResults] = useState(false);

  // Load data
  useEffect(() => {
    if (!teacherId) return;

    setLoading(true);
    const unsubscribers = [
      onSnapshot(
        query(
          collection(db, "groups"),
          where("teacher_id", "==", teacherId),
          where("is_active", "==", true)
        ),
        (snapshot) => {
          setGroups(
            snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Group[]
          );
        },
        (error) => logError("ExamAnalyticsDashboard:groups", error)
      ),
      onSnapshot(
        query(
          collection(db, "students"),
          where("teacher_id", "==", teacherId)
        ),
        (snapshot) => {
          setStudents(
            snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Student[]
          );
        },
        (error) => logError("ExamAnalyticsDashboard:students", error)
      ),
      onSnapshot(
        query(
          collection(db, "exams"),
          where("teacher_id", "==", teacherId)
        ),
        (snapshot) => {
          setExams(
            snapshot.docs
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Exam[]
          );
        },
        (error) => logError("ExamAnalyticsDashboard:exams", error)
      ),
      onSnapshot(
        query(
          collection(db, "exam_results"),
          where("teacher_id", "==", teacherId)
        ),
        (snapshot) => {
          setAllResults(
            snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as ExamResult[]
          );
          setLoading(false);
        },
        (error) => {
          logError("ExamAnalyticsDashboard:results", error);
          setLoading(false);
        }
      ),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [teacherId]);

  // Calculate metrics
  const metrics = useMemo<ExamMetrics>(() => {
    let results = allResults;

    if (selectedGroup !== "all") {
      results = results.filter((r) => {
        const exam = exams.find((e) => e.id === r.exam_id);
        return exam?.group_id === selectedGroup;
      });
    }

    if (selectedExam !== "all" && selectedExam) {
      results = results.filter((r) => r.exam_id === selectedExam);
    }

    if (results.length === 0) {
      return {
        totalExams: 0,
        averageScore: 0,
        passRate: 0,
        highestScore: 0,
        lowestScore: 0,
        totalResults: 0,
      };
    }

    const scores = results.map((r) => r.score);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passed = results.filter((r) => r.score >= PASS_SCORE).length;
    const passRate = (passed / results.length) * 100;

    return {
      totalExams: new Set(results.map((r) => r.exam_id)).size,
      averageScore: Math.round(average * 10) / 10,
      passRate: Math.round(passRate),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      totalResults: results.length,
    };
  }, [allResults, exams, selectedGroup, selectedExam]);

  // Grade distribution
  const gradeDistribution = useMemo<GradeDistribution[]>(() => {
    let results = allResults;

    if (selectedGroup !== "all") {
      results = results.filter((r) => {
        const exam = exams.find((e) => e.id === r.exam_id);
        return exam?.group_id === selectedGroup;
      });
    }

    if (selectedExam !== "all" && selectedExam) {
      results = results.filter((r) => r.exam_id === selectedExam);
    }

    const gradeMap = new Map<string, number>();
    const grades = ["A+", "A", "B", "C", "D", "F"];
    grades.forEach((g) => gradeMap.set(g, 0));

    results.forEach((r) => {
      const grade = getGrade(r.score);
      gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1);
    });

    const total = results.length || 1;
    return grades.map((grade) => ({
      grade,
      count: gradeMap.get(grade) || 0,
      percentage: Math.round((((gradeMap.get(grade) || 0) / total) * 100) * 10) / 10,
    }));
  }, [allResults, exams, selectedGroup, selectedExam]);

  // Student performance
  const studentPerformance = useMemo<StudentPerformance[]>(() => {
    let results = allResults;

    if (selectedGroup !== "all") {
      results = results.filter((r) => {
        const exam = exams.find((e) => e.id === r.exam_id);
        return exam?.group_id === selectedGroup;
      });
    }

    if (selectedExam !== "all" && selectedExam) {
      results = results.filter((r) => r.exam_id === selectedExam);
    }

    const studentMap = new Map<
      string,
      {
        name: string;
        group: string;
        scores: number[];
      }
    >();

    results.forEach((r) => {
      if (!studentMap.has(r.student_id)) {
        studentMap.set(r.student_id, {
          name: r.student_name,
          group: r.group_name,
          scores: [],
        });
      }
      studentMap.get(r.student_id)!.scores.push(r.score);
    });

    return Array.from(studentMap.entries())
      .map(([id, data]) => {
        const average = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        const passed = data.scores.filter((s) => s >= PASS_SCORE).length;
        const passRate = (passed / data.scores.length) * 100;
        
        let trend: "up" | "down" | "stable" = "stable";
        if (data.scores.length >= 2) {
          const lastScore = data.scores[data.scores.length - 1];
          const prevScore = data.scores[data.scores.length - 2];
          if (lastScore > prevScore + 5) trend = "up";
          else if (lastScore < prevScore - 5) trend = "down";
        }

        return {
          studentId: id,
          studentName: data.name,
          groupName: data.group,
          averageScore: Math.round(average * 10) / 10,
          totalTaken: data.scores.length,
          passRate: Math.round(passRate),
          trend,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);
  }, [allResults, exams, selectedGroup, selectedExam]);

  // Score trend
  const scoreTrend = useMemo<ScoreTrend[]>(() => {
    let results = allResults;

    if (selectedGroup !== "all") {
      results = results.filter((r) => {
        const exam = exams.find((e) => e.id === r.exam_id);
        return exam?.group_id === selectedGroup;
      });
    }

    if (selectedExam !== "all" && selectedExam) {
      results = results.filter((r) => r.exam_id === selectedExam);
    }

    const trendMap = new Map<string, { scores: number[]; pass: number; fail: number }>();

    results.forEach((r) => {
      const exam = exams.find((e) => e.id === r.exam_id);
      if (!exam) return;

      if (!trendMap.has(exam.exam_date)) {
        trendMap.set(exam.exam_date, { scores: [], pass: 0, fail: 0 });
      }

      const entry = trendMap.get(exam.exam_date)!;
      entry.scores.push(r.score);
      if (r.score >= PASS_SCORE) entry.pass++;
      else entry.fail++;
    });

    return Array.from(trendMap.entries())
      .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
      .map(([date, data]) => ({
        date: formatDateUz(new Date(date)),
        averageScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10,
        passCount: data.pass,
        failCount: data.fail,
      }));
  }, [allResults, exams, selectedGroup, selectedExam]);

  const handleExportExcel = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Metrics sheet
    const metricsData = [
      ["Imtihon Statistikasi"],
      ["Jami Imtihon", metrics.totalExams],
      ["O'rtacha Baho", metrics.averageScore],
      ["O'tgan Foiz %", metrics.passRate],
      ["Eng Yuqori Baho", metrics.highestScore],
      ["Eng Quyi Baho", metrics.lowestScore],
      ["Jami Natijalar", metrics.totalResults],
    ];
    const metricsWs = XLSX.utils.aoa_to_sheet(metricsData);
    XLSX.utils.book_append_sheet(wb, metricsWs, "Statistika");

    // Student performance sheet
    const perfData = [
      ["O'quvchi", "Guruh", "O'rtacha", "Jami", "O'tgan %", "Trend"],
      ...studentPerformance.map((p) => [
        p.studentName,
        p.groupName,
        p.averageScore,
        p.totalTaken,
        p.passRate,
        p.trend,
      ]),
    ];
    const perfWs = XLSX.utils.aoa_to_sheet(perfData);
    XLSX.utils.book_append_sheet(wb, perfWs, "O'quvchilar");

    XLSX.writeFile(wb, `exam-report-${getTashkentToday()}.xlsx`);
    toast.success("Hisobot yuklab olindi");
  }, [metrics, studentPerformance]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Imtihon Tahlili Hisoboti", 20, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Sana: ${formatDateUz(new Date())}`, 20, 30);

    // Metrics
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Statistika:", 20, 40);

    const metricsData = [
      ["Jami Imtihon", metrics.totalExams.toString()],
      ["O'rtacha Baho", metrics.averageScore.toString()],
      ["O'tgan Foiz %", metrics.passRate.toString()],
      ["Eng Yuqori", metrics.highestScore.toString()],
      ["Eng Quyi", metrics.lowestScore.toString()],
    ];

    autoTable(doc, {
      startY: 45,
      head: [["Ko'rsatkich", "Qiymati"]],
      body: metricsData,
      theme: "grid",
      margin: { left: 20, right: 20 },
    });

    // Student performance table
    const startY = (doc as any).lastAutoTable.finalY + 10;
    doc.text("O'quvchi Ish Faoliyati:", 20, startY);

    const perfData = studentPerformance.slice(0, 10).map((p) => [
      p.studentName,
      p.groupName,
      p.averageScore.toString(),
      p.totalTaken.toString(),
      p.passRate.toString() + "%",
    ]);

    autoTable(doc, {
      startY: startY + 5,
      head: [["O'quvchi", "Guruh", "O'rtacha", "Jami", "O'tgan %"]],
      body: perfData,
      theme: "grid",
      margin: { left: 20, right: 20 },
    });

    doc.save(`exam-report-${getTashkentToday()}.pdf`);
    toast.success("PDF yuklab olindi");
  }, [metrics, studentPerformance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const filteredExams = exams.filter((e) =>
    selectedGroup === "all" ? true : e.group_id === selectedGroup
  );

  const uniqueExamNames = [...new Set(filteredExams.map((e) => e.exam_name))];

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Imtihon Tahlili</h1>
          <p className="text-sm text-muted-foreground">
            Imtihon natijalari va o'quvchi faoliyatini tahlil qiling
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddResults(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Natijalar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-xs mb-2 block">Guruh</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hamma Guruhlar</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Imtihon Nomi</Label>
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Hamma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Hamma</SelectItem>
              {uniqueExamNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs mb-2 block">Davr</Label>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as "all" | "week" | "month" | "semester")}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Hafta</SelectItem>
              <SelectItem value="month">Oy</SelectItem>
              <SelectItem value="semester">Semester</SelectItem>
              <SelectItem value="all">Hamma</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-blue-900 mb-1">O'rtacha Baho</div>
            <div className="text-2xl font-bold text-blue-700">{metrics.averageScore}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-green-900 mb-1">O'tgan %</div>
            <div className="text-2xl font-bold text-green-700">{metrics.passRate}%</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-purple-900 mb-1">Jami Imtihon</div>
            <div className="text-2xl font-bold text-purple-700">{metrics.totalExams}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-red-900 mb-1">Eng Quyi</div>
            <div className="text-2xl font-bold text-red-700">{metrics.lowestScore}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-yellow-900 mb-1">Eng Yuqori</div>
            <div className="text-2xl font-bold text-yellow-700">{metrics.highestScore}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grade Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Baho Taqsimoti</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={gradeDistribution}
                  dataKey="count"
                  nameKey="grade"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {gradeDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={GRADE_COLORS[entry.grade] || "#999"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Baholar Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            {scoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={scoreTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="averageScore"
                    stroke="#3b82f6"
                    name="O'rtacha"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                Ma'lumot yo'q
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pass/Fail Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">O'tgan/Chatgan Statistikasi</CardTitle>
        </CardHeader>
        <CardContent>
          {scoreTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passCount" fill="#10b981" name="O'tgan" />
                <Bar dataKey="failCount" fill="#ef4444" name="Chatgan" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
              Ma'lumot yo'q
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Eng Yaxshi O'quvchilar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {studentPerformance.slice(0, 5).map((perf) => (
              <div
                key={perf.studentId}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <StudentProfileLink
                    studentId={perf.studentId}
                    className="text-sm font-medium truncate hover:underline"
                  >
                    {perf.studentName}
                  </StudentProfileLink>
                  <p className="text-xs text-muted-foreground">{perf.groupName}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{perf.averageScore}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {perf.trend === "up" ? (
                      <ArrowUp className="h-3 w-3 text-green-600" />
                    ) : perf.trend === "down" ? (
                      <ArrowDown className="h-3 w-3 text-red-600" />
                    ) : null}
                    {perf.passRate}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Imtihon Natijalari</CardTitle>
          <CardDescription className="text-xs">
            Jami: {studentPerformance.length} o'quvchi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>O'quvchi</TableHead>
                  <TableHead>Guruh</TableHead>
                  <TableHead className="text-right">O'rtacha</TableHead>
                  <TableHead className="text-right">Jami</TableHead>
                  <TableHead className="text-right">O'tgan %</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentPerformance.map((perf) => (
                      <TableRow key={perf.studentId} className="text-xs">
                        <TableCell className="font-medium">
                          <StudentProfileLink
                            studentId={perf.studentId}
                            className="hover:underline"
                          >
                            {perf.studentName}
                          </StudentProfileLink>
                        </TableCell>
                        <TableCell>{perf.groupName}</TableCell>
                        <TableCell className="text-right font-bold">
                          {perf.averageScore}
                        </TableCell>
                        <TableCell className="text-right">{perf.totalTaken}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              perf.passRate >= 80 ? "default" : "secondary"
                            }
                            className="text-xs"
                          >
                            {perf.passRate}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {perf.trend === "up" ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : perf.trend === "down" ? (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <QuickResultEntryDialog
        teacherId={teacherId}
        isOpen={showAddResults}
        onOpenChange={setShowAddResults}
        exams={filteredExams}
        students={students}
      />
    </div>
  );
};
