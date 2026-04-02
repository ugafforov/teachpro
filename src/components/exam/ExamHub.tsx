import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  addDoc,
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
import { Download, TrendingUp, TrendingDown } from "lucide-react";
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
import { Exam, ExamResult, Group, Student, ExamType } from "./types";
import { QuickResultEntryDialog } from "./QuickResultEntryDialog";

interface ExamHubProps {
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

// ============ Tab 1 & 2 Combined: Imtihon Yaratish va Natija Kiritish ============
const CreateAndResultsTab: React.FC<{
  teacherId: string;
  groups: Group[];
  examTypes: ExamType[];
  exams: Exam[];
  students: Student[];
  allResults: ExamResult[];
  onExamCreated?: () => void;
}> = ({ teacherId, groups, examTypes, exams, students, allResults, onExamCreated }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedExamType, setSelectedExamType] = useState<string>("");
  const [customExamName, setCustomExamName] = useState<string>("");
  const [examDate, setExamDate] = useState<string>(getTashkentToday());
  const [creating, setCreating] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [justCreatedExamId, setJustCreatedExamId] = useState<string | null>(null);
  const [justCreatedExamName, setJustCreatedExamName] = useState<string>("");

  useEffect(() => {
    if (groups.length && !selectedGroup) {
      setSelectedGroup(groups[0].id);
    }
  }, [groups, selectedGroup]);

  useEffect(() => {
    if (examTypes.length && !selectedExamType && !customExamName) {
      setSelectedExamType(examTypes[0].id);
    }
  }, [examTypes, selectedExamType, customExamName]);

  const handleCreateExam = async () => {
    if (!selectedGroup || (!selectedExamType && !customExamName) || !examDate) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }

    setCreating(true);
    try {
      const examName = customExamName || examTypes.find((t) => t.id === selectedExamType)?.name || "Imtihon";

      const docRef = await addDoc(collection(db, "exams"), {
        exam_name: examName,
        exam_date: examDate,
        group_id: selectedGroup,
        exam_type_id: selectedExamType || null,
        teacher_id: teacherId,
        created_at: serverTimestamp(),
      });

      setJustCreatedExamId(docRef.id);
      setJustCreatedExamName(examName);
      toast.success(`"${examName}" imtihoni yaratildi ✓`);
      
      // Show results dialog immediately
      setTimeout(() => {
        setShowResultsDialog(true);
      }, 500);

      // Reset form for next exam
      setCustomExamName("");
      setSelectedExamType(examTypes[0]?.id || "");
      setExamDate(getTashkentToday());
      
      onExamCreated?.();
    } catch (error) {
      logError("CreateAndResultsTab:handleCreateExam", error);
      toast.error("Xatolik yuz berdi");
    } finally {
      setCreating(false);
    }
  };

  // Get recent exams (last 5)
  const recentExams = useMemo(() => {
    return [...exams].reverse().slice(0, 5);
  }, [exams]);

  // Get recently entered results
  const recentResults = useMemo(() => {
    return [...allResults].reverse().slice(0, 5);
  }, [allResults]);

  return (
    <div className="space-y-6 py-6">
      {/* Main Action Section - Exam Creation */}
      <Card className="border-2 border-dashed bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <span>📝</span> Yangi Imtihon Yaratish
          </CardTitle>
          <CardDescription>Imtihon yarating va darhol natijalaar kiritishni boshlang</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Guruh Tanlash */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Guruh <span className="text-red-500">*</span></Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Guruhni tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sana */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Sana <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.currentTarget.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Imtihon Turi */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Imtihon Turi</Label>
              <Select
                value={selectedExamType}
                onValueChange={(v) => {
                  setSelectedExamType(v);
                  if (v) setCustomExamName("");
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Tur tanlang (ixtiyoriy)" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Nom */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Yoki Shaxsiy Nom</Label>
              <Input
                placeholder="Masalan: Oraliq nazorat"
                value={customExamName}
                onChange={(e) => {
                  setCustomExamName(e.currentTarget.value);
                  if (e.currentTarget.value) setSelectedExamType("");
                }}
                className="h-10"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleCreateExam}
              disabled={creating || !selectedGroup || (!selectedExamType && !customExamName)}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {creating ? "Yaratilmoqda..." : "✓ Imtihonni Yaratish va Natijalani Kiritish"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1️⃣</div>
            <p className="text-sm font-semibold mt-2">Yaratish</p>
            <p className="text-xs text-muted-foreground mt-1">Imtihonni 30 sekundda yarating</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">2️⃣</div>
            <p className="text-sm font-semibold mt-2">Kiritish</p>
            <p className="text-xs text-muted-foreground mt-1">Darhol natijalaar kiritishni boshlang</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">3️⃣</div>
            <p className="text-sm font-semibold mt-2">Tahlil</p>
            <p className="text-xs text-muted-foreground mt-1">"Tahlil" tabida statistika ko'ring</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Results Entry Dialog */}
      {justCreatedExamId && (
        <QuickResultEntryDialog
          teacherId={teacherId}
          isOpen={showResultsDialog}
          onOpenChange={setShowResultsDialog}
          exams={exams.filter((e) => e.id === justCreatedExamId)}
          students={students}
        />
      )}

      {/* Recently Created Exams Table */}
      {recentExams.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Oxirgi Yaratilgan Imtihonlar</CardTitle>
            <CardDescription className="text-xs">
              Eng so'nggi {Math.min(recentExams.length, 5)} ta imtihon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="text-sm w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs min-w-[140px]">Imtihon Nomi</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Guruh</TableHead>
                    <TableHead className="text-xs min-w-[100px]">Sana</TableHead>
                    <TableHead className="text-xs text-right min-w-[80px]">Natijalaar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentExams.map((exam) => {
                    const examResults = allResults.filter((r) => r.exam_id === exam.id);
                    const groupName = groups.find((g) => g.id === exam.group_id)?.name;
                    return (
                      <TableRow key={exam.id} className="hover:bg-muted/50">
                        <TableCell className="font-semibold min-w-[140px] line-clamp-2">
                          {exam.exam_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground min-w-[100px]">
                          {groupName || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground min-w-[100px] whitespace-nowrap">
                          {formatDateUz(exam.exam_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={examResults.length > 0 ? "default" : "secondary"}
                            className={examResults.length > 0 ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                          >
                            {examResults.length}/{students.filter((s) => s.group_id === exam.group_id).length}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recently Entered Results Table */}
      {recentResults.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Oxirgi Kiritilgan Natijalaar</CardTitle>
            <CardDescription className="text-xs">
              Eng so'nggi {Math.min(recentResults.length, 5)} ta natijar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="text-sm w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs min-w-[150px]">O'quvchi</TableHead>
                    <TableHead className="text-xs min-w-[130px]">Imtihon</TableHead>
                    <TableHead className="text-xs text-right min-w-[70px]">Baho</TableHead>
                    <TableHead className="text-xs text-center min-w-[60px]">Baho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentResults.map((result) => {
                    const exam = exams.find((e) => e.id === result.exam_id);
                    const student = students.find((s) => s.id === result.student_id);
                    const studentName = result.student_name || student?.name || "—";
                    const grade = getGrade(result.score);
                    return (
                      <TableRow key={result.id} className="hover:bg-muted/50">
                        <TableCell 
                          className="font-semibold min-w-[150px]"
                          title={`${result.student_id} / ${result.student_name} / ${student?.name}`}
                        >
                          {studentName || `[${result.student_id}]`}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs min-w-[130px]">
                          {exam?.exam_name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-bold min-w-[70px]">
                          {result.score}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            style={{
                              backgroundColor: GRADE_COLORS[grade],
                              color: "white",
                            }}
                            className="font-bold"
                          >
                            {grade}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ============ Tab 3: Tahlil va Statistika ============
const AnalysisTab: React.FC<{
  teacherId: string;
  exams: Exam[];
  allResults: ExamResult[];
  groups: Group[];
  students: Student[];
}> = ({ teacherId, exams, allResults, groups, students }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedExam, setSelectedExam] = useState<string>("all");

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
        const student = students.find((s) => s.id === r.student_id);
        const studentName = r.student_name || student?.name || r.student_id;
        studentMap.set(r.student_id, {
          name: studentName,
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
    toast.success("Excel yuklab olindi");
  }, [metrics, studentPerformance]);

  const handleExportPDF = useCallback(() => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Imtihon Tahlili Hisoboti", 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Sana: ${formatDateUz(new Date())}`, 20, 30);

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

    doc.save(`exam-report-${getTashkentToday()}.pdf`);
    toast.success("PDF yuklab olindi");
  }, [metrics]);

  const filteredExams = exams.filter((e) =>
    selectedGroup === "all" ? true : e.group_id === selectedGroup
  );
  const uniqueExamNames = [...new Set(filteredExams.map((e) => e.exam_name))];

  return (
    <div className="space-y-6 py-6">
      {/* Filtrlar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs mb-2 block font-semibold">Guruh</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="h-9">
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
          <Label className="text-xs mb-2 block font-semibold">Imtihon</Label>
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger className="h-9">
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

        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={handleExportExcel} className="h-9" size="sm">
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" onClick={handleExportPDF} className="h-9" size="sm">
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Metrikalar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">O'rtacha Baho</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{metrics.averageScore}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-green-900 dark:text-green-200">O'tgan %</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{metrics.passRate}%</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-purple-900 dark:text-purple-200">Jami Imtihon</div>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{metrics.totalExams}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-red-900 dark:text-red-200">Eng Quyi</div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{metrics.lowestScore}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4">
            <div className="text-xs font-semibold text-yellow-900 dark:text-yellow-200">Eng Yuqori</div>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{metrics.highestScore}</div>
          </CardContent>
        </Card>
      </div>

      {/* Grafiklar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <Line type="monotone" dataKey="averageScore" stroke="#3b82f6" dot={false} />
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
          <CardTitle className="text-sm">O'tgan/Chatgan</CardTitle>
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

      {/* Student Performance Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">O'quvchi Faoliyati</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentPerformance.map((perf) => (
                  <TableRow key={perf.studentId} className="text-xs">
                    <TableCell className="font-medium">
                      <StudentProfileLink studentId={perf.studentId} className="hover:underline">
                        {perf.studentName}
                      </StudentProfileLink>
                    </TableCell>
                    <TableCell>{perf.groupName}</TableCell>
                    <TableCell className="text-right font-bold">{perf.averageScore}</TableCell>
                    <TableCell className="text-right">{perf.totalTaken}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={perf.passRate >= 80 ? "default" : "secondary"}>
                        {perf.passRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============ Main Hub Component ============
export const ExamHub: React.FC<ExamHubProps> = ({ teacherId }) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [allResults, setAllResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId) return;

    setLoading(true);
    const unsubscribers = [
      onSnapshot(
        query(collection(db, "groups"), where("teacher_id", "==", teacherId), where("is_active", "==", true)),
        (snapshot) => {
          setGroups(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Group[]);
        },
        (error) => logError("ExamHub:groups", error)
      ),
      onSnapshot(
        query(collection(db, "students"), where("teacher_id", "==", teacherId)),
        (snapshot) => {
          setStudents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Student[]);
        },
        (error) => logError("ExamHub:students", error)
      ),
      onSnapshot(
        query(collection(db, "exam_types"), where("teacher_id", "==", teacherId)),
        (snapshot) => {
          setExamTypes(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ExamType[]);
        },
        (error) => logError("ExamHub:examTypes", error)
      ),
      onSnapshot(
        query(collection(db, "exams"), where("teacher_id", "==", teacherId)),
        (snapshot) => {
          setExams(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Exam[]);
        },
        (error) => logError("ExamHub:exams", error)
      ),
      onSnapshot(
        query(collection(db, "exam_results"), where("teacher_id", "==", teacherId)),
        (snapshot) => {
          setAllResults(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ExamResult[]);
          setLoading(false);
        },
        (error) => {
          logError("ExamHub:results", error);
          setLoading(false);
        }
      ),
    ];

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [teacherId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">📚 Imtihon Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Imtihonlarni yaratish, natijalaar kiritish va tahlillar qilish uchun bir markaziy o'rin
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="create-results" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="create-results" className="text-sm">
            📝 Yaratish & Natijalar
          </TabsTrigger>
          <TabsTrigger value="analysis" className="text-sm">
            📊 Tahlil
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create-results" className="space-y-6">
          <CreateAndResultsTab
            teacherId={teacherId}
            groups={groups}
            examTypes={examTypes}
            exams={exams}
            students={students}
            allResults={allResults}
            onExamCreated={() => {}}
          />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <AnalysisTab teacherId={teacherId} exams={exams} allResults={allResults} groups={groups} students={students} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
