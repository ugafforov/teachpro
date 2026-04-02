import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { logError } from "@/lib/errorUtils";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
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
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { examSchema, formatValidationError } from "@/lib/validations";
import { z } from "zod";
import { formatDateUz, getTashkentToday, getTashkentDate } from "@/lib/utils";
import ConfirmDialog from "./ConfirmDialog";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { Group, Student, ExamType, Exam, ExamResult } from "./exam/types";
import { ExamAnalysis } from "./exam/ExamAnalysis";
import { ExamList } from "./exam/ExamList";
import { ExamStats } from "./exam/ExamStats";
import { ExamFilters } from "./exam/ExamFilters";
import { CreateExamDialog } from "./exam/CreateExamDialog";
import { ResultEntryDialog } from "./exam/ResultEntryDialog";
import { ExamDetailsDialog } from "./exam/ExamDetailsDialog";
import { EditResultDialog } from "./exam/EditResultDialog";

interface ExamManagerProps {
  teacherId: string;
}

const sanitizeFileName = (name: string) => {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
};

const ExamManager: React.FC<ExamManagerProps> = ({ teacherId }) => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [attendanceOnExamDate, setAttendanceOnExamDate] = useState<
    Map<string, string>
  >(new Map());

  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedExamType, setSelectedExamType] = useState<string>("");
  const [customExamName, setCustomExamName] = useState<string>("");
  const [examDate, setExamDate] = useState<string>(getTashkentToday());
  const [currentExamId, setCurrentExamId] = useState<string>("");

  const [examResults, setExamResults] = useState<Record<string, string>>({});
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [showExamDetailsDialog, setShowExamDetailsDialog] = useState(false);
  const [examDetailsExamId, setExamDetailsExamId] = useState<string>("");
  const [examDetailsData, setExamDetailsData] = useState<ExamResult[]>([]);
  const [loadingExamDetails, setLoadingExamDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingExam, setCreatingExam] = useState(false);
  const [savingResults, setSavingResults] = useState(false);
  const [updatingResult, setUpdatingResult] = useState(false);
  const [editingResult, setEditingResult] = useState<{
    id: string;
    studentName: string;
    currentScore: number;
  } | null>(null);
  const [editScore, setEditScore] = useState("");
  const [editReason, setEditReason] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    examId: string;
    examName: string;
  }>({
    isOpen: false,
    examId: "",
    examName: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterExamType, setFilterExamType] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const DEFAULT_VISIBLE_EXAMS = 18;
  const VISIBLE_EXAMS_STEP = 18;
  const [visibleExamsLimit, setVisibleExamsLimit] = useState<number>(
    DEFAULT_VISIBLE_EXAMS,
  );
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const groupNameById = useMemo(
    () => new Map(groups.map((g) => [g.id, g.name] as const)),
    [groups],
  );
  const examTypeNameById = useMemo(
    () => new Map(examTypes.map((t) => [t.id, t.name] as const)),
    [examTypes],
  );
  const uniqueExamNames = useMemo(() => {
    return [...new Set(exams.map((e) => e.exam_name))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [exams]);

  useEffect(() => {
    if (!teacherId) return;

    setLoading(true);
    let groupsReady = false;
    let examTypesReady = false;
    let examsReady = false;

    const markReady = () => {
      if (groupsReady && examTypesReady && examsReady) {
        setLoading(false);
      }
    };

    const groupsQ = query(
      collection(db, "groups"),
      where("teacher_id", "==", teacherId),
      where("is_active", "==", true),
    );
    const examTypesQ = query(
      collection(db, "exam_types"),
      where("teacher_id", "==", teacherId),
    );
    const examsQ = query(
      collection(db, "exams"),
      where("teacher_id", "==", teacherId),
    );

    const unsubs = [
      onSnapshot(
        groupsQ,
        (snapshot) => {
          setGroups(
            snapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() }) as Group,
            ),
          );
          groupsReady = true;
          markReady();
        },
        (error) => {
          logError("ExamManager:groupsSnapshot", error);
          groupsReady = true;
          markReady();
        },
      ),
      onSnapshot(
        examTypesQ,
        (snapshot) => {
          setExamTypes(
            snapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() }) as ExamType,
            ),
          );
          examTypesReady = true;
          markReady();
        },
        (error) => {
          logError("ExamManager:examTypesSnapshot", error);
          examTypesReady = true;
          markReady();
        },
      ),
      onSnapshot(
        examsQ,
        (snapshot) => {
          const data = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }) as Exam)
            .sort(
              (a, b) =>
                new Date(b.exam_date).getTime() -
                new Date(a.exam_date).getTime(),
            );
          setExams(data);
          examsReady = true;
          markReady();
        },
        (error) => {
          logError("ExamManager:examsSnapshot", error);
          examsReady = true;
          markReady();
        },
      ),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [teacherId]);

  const setScoreInputRef = useCallback((studentId: string) => {
    return (el: HTMLInputElement | null) => {
      scoreInputRefs.current[studentId] = el;
    };
  }, []);

  const focusScoreInputAtIndex = useCallback(
    (index: number) => {
      const studentId = students[index]?.id;
      if (!studentId) return;
      const el = scoreInputRefs.current[studentId];
      if (!el) return;
      el.focus();
      try {
        el.select();
      } catch (e) {
        // ignore
      }
    },
    [students],
  );

  const handleScoreKeyDown = useCallback(
    (studentIndex: number) => {
      return (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;

        e.preventDefault();
        const nextIndex = e.shiftKey ? studentIndex - 1 : studentIndex + 1;
        focusScoreInputAtIndex(nextIndex);
      };
    },
    [focusScoreInputAtIndex],
  );

  useEffect(() => {
    if (!showResultsDialog) return;
    if (students.length === 0) return;

    const t = setTimeout(() => {
      focusScoreInputAtIndex(0);
    }, 0);

    return () => clearTimeout(t);
  }, [showResultsDialog, students.length, focusScoreInputAtIndex]);

  useEffect(() => {
    setVisibleExamsLimit(DEFAULT_VISIBLE_EXAMS);
  }, [searchQuery, filterGroup, filterExamType, dateFilter]);

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (
        searchQuery &&
        !exam.exam_name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      if (filterGroup !== "all" && exam.group_id !== filterGroup) {
        return false;
      }
      if (filterExamType !== "all" && exam.exam_name !== filterExamType) {
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

      if (dateFilter === "today") {
        return examDateOnly.getTime() === today.getTime();
      } else if (dateFilter === "week") {
        return examDateObj >= weekAgo;
      } else if (dateFilter === "month") {
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
        setVisibleExamsLimit((v) =>
          Math.min(v + VISIBLE_EXAMS_STEP, filteredExams.length),
        );
      },
      { root: null, rootMargin: "300px", threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreExams, filteredExams.length]);

  const groupedExams = useMemo(() => {
    const byMonth: Record<string, Exam[]> = {};
    visibleExams.forEach((exam) => {
      const date = getTashkentDate(new Date(exam.exam_date));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(exam);
    });
    Object.keys(byMonth).forEach((key) => {
      byMonth[key].sort(
        (a, b) =>
          new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime(),
      );
    });
    return byMonth;
  }, [visibleExams]);

  const monthKeys = useMemo(() => {
    return Object.keys(groupedExams).sort((a, b) => b.localeCompare(a));
  }, [groupedExams]);

  const stats = useMemo(() => {
    const total = exams.length;
    const thisMonth = exams.filter((e) => {
      const date = getTashkentDate(new Date(e.exam_date));
      const now = getTashkentDate();
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }).length;
    const uniqueTypes = uniqueExamNames.length;
    const groupsWithExams = new Set(exams.map((e) => e.group_id)).size;
    return { total, thisMonth, uniqueTypes, groupsWithExams };
  }, [exams, uniqueExamNames]);

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split("-");
    const uzbekMonths = [
      "yanvar",
      "fevral",
      "mart",
      "aprel",
      "may",
      "iyun",
      "iyul",
      "avgust",
      "sentabr",
      "oktabr",
      "noyabr",
      "dekabr",
    ];
    return `${uzbekMonths[parseInt(month) - 1]}, ${year}`;
  };

  const fetchAttendanceForExamDate = async (date: string) => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
        where("date", "==", date),
      );
      const snapshot = await getDocs(q);
      const attendanceData = new Map<string, string>();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        attendanceData.set(data.student_id, data.status);
      });
      setAttendanceOnExamDate(attendanceData);
    } catch (error) {
      logError("ExamManager:fetchAttendance", error);
    }
  };

  const fetchStudents = useCallback(async (groupId: string, examDate?: string) => {
    try {
      const q = query(
        collection(db, "students"),
        where("teacher_id", "==", teacherId),
        where("group_id", "==", groupId),
      );
      const snapshot = await getDocs(q);
      let allStudents = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Student,
      );

      if (examDate) {
        const examDateObj = new Date(examDate);
        allStudents = allStudents.filter((student) => {
          const joinDate = student.join_date
            ? new Date(student.join_date)
            : null;
          const leftDate = student.left_date
            ? new Date(student.left_date)
            : null;

          if (joinDate && joinDate > examDateObj) return false;
          if (leftDate && leftDate <= examDateObj) return false;

          return true;
        });
      }

      setStudents(allStudents);
    } catch (error) {
      logError("ExamManager:fetchStudents", error);
    }
  }, [teacherId]);

  useEffect(() => {
    if (selectedGroup) {
      void fetchStudents(selectedGroup);
    }
  }, [selectedGroup, fetchStudents]);

  const createExam = async () => {
    if (creatingExam) return;

    const examName =
      customExamName || examTypeNameById.get(selectedExamType) || "";

    try {
      examSchema.parse({
        exam_name: examName,
        exam_date: examDate,
        group_id: selectedGroup,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validatsiya xatosi",
          description: formatValidationError(error),
          variant: "destructive",
        });
      }
      return;
    }

    setCreatingExam(true);
    try {
      let examTypeId = selectedExamType;
      if (customExamName) {
        const typeDoc = await addDoc(collection(db, "exam_types"), {
          teacher_id: teacherId,
          name: customExamName,
          created_at: serverTimestamp(),
        });
        examTypeId = typeDoc.id;
      }

      const examDoc = await addDoc(collection(db, "exams"), {
        teacher_id: teacherId,
        group_id: selectedGroup,
        exam_type_id: examTypeId,
        exam_name: examName,
        exam_date: examDate,
        created_at: serverTimestamp(),
      });

      setCurrentExamId(examDoc.id);
      setExamResults({});
      setShowCreateDialog(false);
      await fetchStudents(selectedGroup, examDate);
      await fetchAttendanceForExamDate(examDate);
      setShowResultsDialog(true);

      toast({
        title: "Muvaffaqiyatli",
        description: "Imtihon yaratildi",
      });
    } catch (error) {
      logError("ExamManager:handleCreateExam", error);
      toast({
        title: "Xato",
        description: "Imtihon yaratishda xatolik",
        variant: "destructive",
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
        .filter(([_, score]) => score && score.trim() !== "")
        .map(([studentId, score]) => {
          const parsed = Number(score);
          if (!Number.isFinite(parsed)) return null;

          const student = students.find((s) => s.id === studentId);
          return {
            teacher_id: teacherId,
            exam_id: currentExamId,
            student_id: studentId,
            score: parsed,
            student_name: student?.name || "",
            group_name: groupNameById.get(selectedGroup) || "",
            created_at: serverTimestamp(),
          };
        })
        .filter((r): r is NewExamResult => r !== null);

      if (resultsToInsert.length === 0) {
        toast({
          title: "Xato",
          description: "Hech bo'lmaganda bitta natija kiriting",
          variant: "destructive",
        });
        return;
      }

      const batch = writeBatch(db);
      resultsToInsert.forEach((result) => {
        const newResultRef = doc(collection(db, "exam_results"));
        batch.set(newResultRef, result);
      });
      await batch.commit();

      toast({
        title: "Muvaffaqiyatli",
        description: "Natijalar saqlandi",
      });

      setShowResultsDialog(false);
      setExamResults({});
      setCurrentExamId("");
      setSelectedGroup("");
      setSelectedExamType("");
      setCustomExamName("");
      setExamDate(getTashkentToday());
    } catch (error) {
      logError("ExamManager:handleSaveResults", error);
      toast({
        title: "Xato",
        description: "Natijalarni saqlashda xatolik",
        variant: "destructive",
      });
    } finally {
      setSavingResults(false);
    }
  };

  const handleAction = (examId: string, examName: string) => {
    setConfirmDialog({
      isOpen: true,
      examId,
      examName,
    });
  };

  const executeAction = async () => {
    const { examId } = confirmDialog;
    await archiveExam(examId);
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const archiveExam = async (examId: string) => {
    try {
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      const examData = examSnap.data();

      const resultsQ = query(
        collection(db, "exam_results"),
        where("exam_id", "==", examId),
      );
      const resultsSnap = await getDocs(resultsQ);
      const resultsData = resultsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      await addDoc(collection(db, "archived_exams"), {
        teacher_id: teacherId,
        original_exam_id: examId,
        exam_name: examData?.exam_name,
        exam_date: examData?.exam_date,
        group_id: examData?.group_id,
        results_data: resultsData,
        archived_at: serverTimestamp(),
      });

      const batch = writeBatch(db);
      resultsSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(examRef);
      await batch.commit();

      toast({
        title: "Muvaffaqiyatli",
        description: "Imtihon arxivlandi",
      });
    } catch (error) {
      logError("ExamManager:handleArchiveExam", error);
      toast({
        title: "Xato",
        description: "Imtihonni arxivlashda xatolik",
        variant: "destructive",
      });
    }
  };

  const exportExamDetails = (format: "excel" | "pdf") => {
    const exam = exams.find((e) => e.id === examDetailsExamId);
    const examName = exam?.exam_name || "Imtihon";
    const examDate = exam?.exam_date || "";
    const groupName = exam?.group_id
      ? groupNameById.get(exam.group_id) || ""
      : "";

    const fileBase = sanitizeFileName(
      `${examName}_${examDate || getTashkentToday()}`,
    );

    const headers = ["O'quvchi", "Guruh", "Ball", "Izoh"];
    const body = examDetailsData.map((r) => [
      r.student_name,
      r.group_name || groupName,
      String(r.score),
      r.notes || "",
    ]);

    const avg =
      examDetailsData.length > 0
        ? examDetailsData.reduce((sum, r) => sum + (Number(r.score) || 0), 0) /
          examDetailsData.length
        : 0;

    const exportedAt = formatDateUz(getTashkentToday());

    if (format === "excel") {
      const metaRows: (string | number)[][] = [
        [examName],
        ["Sana:", examDate ? formatDateUz(examDate) : ""],
        ["Guruh:", groupName],
        ["Jami o'quvchi:", examDetailsData.length],
        ["O'rtacha ball:", avg.toFixed(1)],
        ["Export sanasi:", exportedAt],
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...body]);
      const wb = XLSX.utils.book_new();

      (ws as any)["!cols"] = [
        { wch: 26 },
        { wch: 18 },
        { wch: 8 },
        { wch: 32 },
      ];
      (ws as any)["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

      XLSX.utils.book_append_sheet(wb, ws, "Results");
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(examName, 14, 14);

    doc.setFontSize(10);
    if (examDate) doc.text(`Sana: ${formatDateUz(examDate)}`, 14, 22);
    if (groupName) doc.text(`Guruh: ${groupName}`, 14, 28);
    doc.text(
      `Jami o'quvchi: ${examDetailsData.length}   O'rtacha ball: ${avg.toFixed(1)}`,
      14,
      34,
    );
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
      const examDoc = await getDoc(doc(db, "exams", examId));
      if (!examDoc.exists()) {
        throw new Error("Imtihon topilmadi");
      }
      const examData = examDoc.data() as Exam;

      await fetchAttendanceForExamDate(examData.exam_date);
      await fetchStudents(examData.group_id, examData.exam_date);

      const q = query(
        collection(db, "exam_results"),
        where("exam_id", "==", examId),
      );
      const snapshot = await getDocs(q);
      const existingResults = new Map();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        existingResults.set(data.student_id, {
          id: doc.id,
          score: data.score || 0,
          notes: data.notes || "",
        });
      });

      const allResults: ExamResult[] = students
        .map((student) => {
          const existing = existingResults.get(student.id);
          const attendanceStatus = attendanceOnExamDate.get(student.id);
          const wasAbsent =
            attendanceStatus === "absent_with_reason" ||
            attendanceStatus === "absent_without_reason";

          return {
            id: existing?.id || `temp_${student.id}`,
            exam_id: examId,
            student_id: student.id,
            score: existing?.score || (wasAbsent ? 0 : 0),
            notes: existing?.notes || (wasAbsent ? "Qatnashmadi" : ""),
            student_name: student.name || "",
            group_name: student.group_name || "",
          };
        })
        .sort((a, b) => b.score - a.score);

      setExamDetailsData(allResults);
    } catch (error) {
      logError("ExamManager:fetchExamDetails", error);
      toast({
        title: "Xato",
        description: "Imtihon natijalarini yuklashda xatolik",
        variant: "destructive",
      });
      setExamDetailsData([]);
    } finally {
      setLoadingExamDetails(false);
    }
  };

  const updateExamResult = async () => {
    if (!editingResult || !editScore || !editReason.trim() || updatingResult) {
      toast({
        title: "Xato",
        description: "Ball va izohni kiriting",
        variant: "destructive",
      });
      return;
    }

    const parsed = Number(editScore);
    if (!Number.isFinite(parsed)) {
      toast({
        title: "Xato",
        description: "Ball noto'g'ri",
        variant: "destructive",
      });
      return;
    }

    setUpdatingResult(true);
    try {
      const resultRef = doc(db, "exam_results", editingResult.id);
      await updateDoc(resultRef, {
        score: parsed,
        notes: editReason.trim(),
        updated_at: serverTimestamp(),
      });

      toast({
        title: "Muvaffaqiyatli",
        description: "Natija yangilandi",
      });

      if (examDetailsExamId) await fetchExamDetails(examDetailsExamId);

      setEditingResult(null);
      setEditScore("");
      setEditReason("");
    } catch (error) {
      logError("ExamManager:handleUpdateResult", error);
      toast({
        title: "Xato",
        description: "Natijani yangilashda xatolik",
        variant: "destructive",
      });
    } finally {
      setUpdatingResult(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground animate-pulse">Imtihonlar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Imtihonlar</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O'quvchilar imtihon natijalarini boshqaring va tahlil qiling
          </p>
        </div>

        <CreateExamDialog
          showCreateDialog={showCreateDialog}
          setShowCreateDialog={setShowCreateDialog}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          selectedExamType={selectedExamType}
          setSelectedExamType={setSelectedExamType}
          customExamName={customExamName}
          setCustomExamName={setCustomExamName}
          examDate={examDate}
          setExamDate={setExamDate}
          groups={groups}
          examTypes={examTypes}
          creatingExam={creatingExam}
          createExam={createExam}
        />
      </div>

      <ExamStats stats={stats} />

      <ExamFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterGroup={filterGroup}
        setFilterGroup={setFilterGroup}
        filterExamType={filterExamType}
        setFilterExamType={setFilterExamType}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        groups={groups}
        uniqueExamNames={uniqueExamNames}
      />

      <ResultEntryDialog
        showResultsDialog={showResultsDialog}
        setShowResultsDialog={setShowResultsDialog}
        students={students}
        attendanceOnExamDate={attendanceOnExamDate}
        examResults={examResults}
        setExamResults={setExamResults}
        saveExamResults={saveExamResults}
        savingResults={savingResults}
        setScoreInputRef={setScoreInputRef}
        handleScoreKeyDown={handleScoreKeyDown}
      />

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto hide-scrollbar bg-transparent p-0 border-b border-zinc-200 dark:border-zinc-800 rounded-none h-auto gap-4">
          <TabsTrigger 
            value="list" 
            className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm font-medium transition-all"
          >
            Imtihonlar ro'yxati
          </TabsTrigger>
          <TabsTrigger 
            value="analysis" 
            className="flex-1 sm:flex-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2.5 text-sm font-medium transition-all"
          >
            Natijalar tahlili
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
          <ExamList
            groupedExams={groupedExams}
            monthKeys={monthKeys}
            filteredExams={filteredExams}
            visibleExams={visibleExams}
            hasMoreExams={hasMoreExams}
            loadMoreRef={loadMoreRef}
            groupNameById={groupNameById}
            getMonthName={getMonthName}
            fetchExamDetails={fetchExamDetails}
            handleAction={handleAction}
          />
        </TabsContent>

        <TabsContent value="analysis" className="mt-6 focus-visible:outline-none focus-visible:ring-0">
          <ExamAnalysis teacherId={teacherId} exams={exams} groups={groups} />
        </TabsContent>
      </Tabs>

      <ExamDetailsDialog
        showExamDetailsDialog={showExamDetailsDialog}
        setShowExamDetailsDialog={setShowExamDetailsDialog}
        loadingExamDetails={loadingExamDetails}
        examDetailsData={examDetailsData}
        attendanceOnExamDate={attendanceOnExamDate}
        exportExamDetails={exportExamDetails}
        setEditingResult={setEditingResult}
        setEditScore={setEditScore}
        setEditReason={setEditReason}
      />

      <EditResultDialog
        editingResult={editingResult}
        setEditingResult={setEditingResult}
        editScore={editScore}
        setEditScore={setEditScore}
        editReason={editReason}
        setEditReason={setEditReason}
        updateExamResult={updateExamResult}
        updatingResult={updatingResult}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeAction}
        title="Imtihonni arxivlash"
        description={`"${confirmDialog.examName}" ni arxivlashga ishonchingiz komilmi? Bu amalni ortga qaytarib bo'lmaydi.`}
        confirmText="Arxivlash"
        variant="warning"
      />
    </div>
  );
};

export default ExamManager;
