import React, { useState, useEffect, useRef } from "react";
import { logError } from "@/lib/errorUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  Calendar as CalendarIcon,
  RotateCcw,
  AlertTriangle,
  Archive,
  Edit2,
  MoreVertical,
  StickyNote,
  X,
  Lightbulb,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { db } from "@/lib/firebase";
import ConfirmDialog from "./ConfirmDialog";
import RestoreDialog from "./RestoreDialog";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  setDoc,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
  writeBatch,
  updateDoc,
  deleteDoc,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import StudentImport from "./StudentImport";
import StudentProfileLink from "./StudentProfileLink";
import AttendanceJournal from "./AttendanceJournal";
import GroupRankingSidebar from "./GroupRankingSidebar";
import { format, parseISO } from "date-fns";
import { uz } from "date-fns/locale";
import { cn, getTashkentToday, getTashkentDate } from "@/lib/utils";
import { fetchAllRecords } from "@/lib/firebaseHelpers";
import { PRESENT_POINTS, LATE_POINTS } from "@/lib/studentScoreCalculator";

interface Student {
  id: string;
  name: string;
  student_id?: string;
  email?: string;
  phone?: string;
  group_name: string;
  teacher_id: string;
  created_at: any;
  join_date?: string; // O'quvchi qo'shilgan sana (YYYY-MM-DD format)
  left_date?: string; // O'quvchi ketgan sana (YYYY-MM-DD format)
  is_active?: boolean;
  rewardPenaltyPoints?: number;
  averageScore?: number;
  totalRewards?: number;
  totalPenalties?: number;
  bahoScore?: number;
  mukofotScore?: number;
  jarimaScore?: number;
  attendancePoints?: number;
  archived_at?: any; // Sana o'quvchi arxivlandi
  archiveDocId?: string; // ID of the document in archived_students collection
}

type AttendanceStatus =
  | "present"
  | "late"
  | "absent_with_reason"
  | "absent_without_reason"
  | "absent";
type ScoreType = "mukofot" | "jarima";

interface GroupDetailsProps {
  groupName: string;
  teacherId: string;
  onBack: () => void;
  onStatsUpdate: () => Promise<void>;
  availableGroups?: Array<{ id: string; name: string }>;
  onGroupChange?: (groupName: string) => void;
}

const GroupDetails: React.FC<GroupDetailsProps> = ({
  groupName,
  teacherId,
  onBack,
  onStatsUpdate,
  availableGroups = [],
  onGroupChange,
}) => {
  const [selectedDate, setSelectedDate] = useState(getTashkentToday());
  const today = getTashkentToday();
  const isFutureDate = selectedDate > today;
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceStatus>
  >({});
  const groupDetailsTabStorageKey = `tp:groupDetails:activeTab:${teacherId}:${groupName}`;
  const [activeTab, setActiveTab] = useState<"journal" | "attendance">(() => {
    try {
      const saved = localStorage.getItem(groupDetailsTabStorageKey);
      return saved === "journal" || saved === "attendance"
        ? saved
        : "attendance";
    } catch {
      return "attendance";
    }
  });
  const [loading, setLoading] = useState(true);
  const [pendingAttendance, setPendingAttendance] = useState<
    Record<string, boolean>
  >({});
  const [savedAttendance, setSavedAttendance] = useState<
    Record<string, boolean>
  >({});
  const [showAbsentDialog, setShowAbsentDialog] = useState<string | null>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const [editingScoreCell, setEditingScoreCell] = useState<{
    studentId: string;
    type: ScoreType;
  } | null>(null);
  const [scoreInputValue, setScoreInputValue] = useState("");
  const [mobileScoreDialog, setMobileScoreDialog] = useState<{
    studentId: string;
    studentName: string;
    type: ScoreType;
  } | null>(null);
  const [mobileScoreInput, setMobileScoreInput] = useState("");
  const [showScoreChangeDialog, setShowScoreChangeDialog] = useState<{
    studentId: string;
    newScore: number;
    type: ScoreType;
    existingRecordId?: string;
  } | null>(null);
  const [scoreChangeReason, setScoreChangeReason] = useState("");
  const [dailyScores, setDailyScores] = useState<
    Record<
      string,
      {
        baho?: { points: number; id: string };
        mukofot?: { points: number; id: string };
        jarima?: { points: number; id: string };
      }
    >
  >({});
  const [attendanceDates, setAttendanceDates] = useState<Date[]>([]);
  // TODO: Kelajakda bu period ni props orqali Dashboard dan olish kerak
  // Hozircha har bir guruh o'zining alohida period ni saqlaydi
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");

  // Keyingi dars uchun eslatmalar (bitta darsda bir nechta bo'lishi mumkin)
  type LessonNote = {
    id: string;
    note: string;
    created_at: any;
    created_date: string;
  };
  const [lessonNotes, setLessonNotes] = useState<LessonNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
  }>({
    isOpen: false,
    studentId: "",
    studentName: "",
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [restoreDialog, setRestoreDialog] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
    archiveDocId?: string;
  }>({
    isOpen: false,
    studentId: "",
    studentName: "",
  });
  const isNavigatingRef = useRef(false);
  const attendanceWriteSeqRef = useRef<Record<string, number>>({});
  const attendanceRefreshTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const hasInitializedRef = useRef(false);
  const selectedDateRef = useRef(selectedDate);
  const studentsRef = useRef<Student[]>([]);

  // 1. Initial load of students (only when group/teacher changes)
  useEffect(() => {
    const loadGroupData = async () => {
      const shouldShowLoading = !hasInitializedRef.current;
      await fetchStudents(shouldShowLoading);
      await fetchLessonNotes();
      hasInitializedRef.current = true;
    };
    loadGroupData();
  }, [groupName, teacherId, selectedPeriod]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(groupDetailsTabStorageKey);
      if (saved === "journal" || saved === "attendance") {
        setActiveTab(saved);
      } else {
        setActiveTab("attendance");
      }
    } catch {
      setActiveTab("attendance");
    }
  }, [groupDetailsTabStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(groupDetailsTabStorageKey, activeTab);
    } catch {
      // ignore
    }
  }, [groupDetailsTabStorageKey, activeTab]);

  // Realtime subscriptions: keep group detail view live without manual refresh.
  useEffect(() => {
    if (!teacherId || !groupName) return;

    type RealtimeTask = "students" | "attendance" | "scores" | "notes";
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingTasks = new Set<RealtimeTask>();
    let flushInProgress = false;

    const flushTasks = async () => {
      if (flushInProgress) return;
      flushInProgress = true;
      try {
        while (pendingTasks.size > 0) {
          const tasks = new Set(pendingTasks);
          pendingTasks.clear();

          const shouldRefreshStudents =
            tasks.has("students") || tasks.has("scores");
          if (shouldRefreshStudents) {
            await fetchStudents(false);
          }

          if (tasks.has("attendance")) {
            await fetchAttendanceForDate(selectedDateRef.current);
            await fetchAttendanceDates();
          }

          if (tasks.has("scores")) {
            await fetchDailyScores(selectedDateRef.current);
          }

          if (tasks.has("notes")) {
            await fetchLessonNotes();
          }
        }
      } finally {
        flushInProgress = false;
      }
    };

    const schedule = (task: RealtimeTask) => {
      pendingTasks.add(task);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        void flushTasks();
      }, 120);
    };

    const studentsQ = query(
      collection(db, "students"),
      where("teacher_id", "==", teacherId),
      where("group_name", "==", groupName),
      where("is_active", "==", true),
    );
    const archivedQ = query(
      collection(db, "archived_students"),
      where("teacher_id", "==", teacherId),
      where("group_name", "==", groupName),
    );
    const attendanceQ = query(
      collection(db, "attendance_records"),
      where("teacher_id", "==", teacherId),
      where("date", "==", selectedDate),
    );
    const rewardsQ = query(
      collection(db, "reward_penalty_history"),
      where("teacher_id", "==", teacherId),
      where("date", "==", selectedDate),
    );
    const notesQ = query(
      collection(db, "group_notes"),
      where("teacher_id", "==", teacherId),
      where("group_name", "==", groupName),
    );

    const unsubs = [
      onSnapshot(
        studentsQ,
        () => schedule("students"),
        (error) => logError("GroupDetails:studentsSnapshot", error),
      ),
      onSnapshot(
        archivedQ,
        () => schedule("students"),
        (error) => logError("GroupDetails:archivedStudentsSnapshot", error),
      ),
      onSnapshot(
        attendanceQ,
        () => schedule("attendance"),
        (error) => logError("GroupDetails:attendanceSnapshot", error),
      ),
      onSnapshot(
        rewardsQ,
        () => schedule("scores"),
        (error) => logError("GroupDetails:rewardsSnapshot", error),
      ),
      onSnapshot(
        notesQ,
        () => schedule("notes"),
        (error) => logError("GroupDetails:notesSnapshot", error),
      ),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      pendingTasks.clear();
    };
  }, [teacherId, groupName, selectedPeriod, selectedDate]);

  // 2. Load daily data when date or students change (no global loading)
  useEffect(() => {
    const loadDailyData = async () => {
      await fetchAttendanceForDate(selectedDate);
      if (students.length > 0) {
        await fetchDailyScores(selectedDate);
      } else {
        setDailyScores({});
      }
    };
    void loadDailyData();
  }, [selectedDate, teacherId, students]);

  // 3. Load calendar highlights when students change
  useEffect(() => {
    if (students.length > 0) {
      fetchAttendanceDates();
    }
  }, [students]);

  // Eslatma funksiyalari
  const normalizeToYMD = (value: any): string => {
    if (!value) return getTashkentToday();

    if (typeof value === "string") {
      // In case it accidentally includes time
      return value.length >= 10 ? value.slice(0, 10) : value;
    }

    if (value instanceof Timestamp) {
      return format(value.toDate(), "yyyy-MM-dd");
    }

    if (typeof value === "object" && typeof value?.seconds === "number") {
      return format(new Date(value.seconds * 1000), "yyyy-MM-dd");
    }

    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return format(d, "yyyy-MM-dd");
      }
    }

    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return format(d, "yyyy-MM-dd");
      }
    } catch {
      // ignore
    }

    return getTashkentToday();
  };

  const toMillisSafe = (value: any): number => {
    if (!value) return 0;
    if (value instanceof Timestamp) return value.toMillis();
    if (typeof value === "object" && typeof value?.seconds === "number")
      return value.seconds * 1000;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.toDate === "function") {
      const d = value.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const fetchLessonNotes = async () => {
    // Primary path: indexed query (fast)
    try {
      const q = query(
        collection(db, "group_notes"),
        where("teacher_id", "==", teacherId),
        where("group_name", "==", groupName),
        where("is_active", "==", true),
        orderBy("created_at", "desc"),
        limit(50),
      );

      const snapshot = await getDocs(q);
      const notes = snapshot.docs.map((d) => {
        const data = d.data() as any;
        const createdDate = normalizeToYMD(
          data.created_date ?? data.created_at,
        );
        return {
          id: d.id,
          note: data.note,
          created_at: data.created_at,
          created_date: createdDate,
        } as LessonNote;
      });
      setLessonNotes(notes);
      return;
    } catch (error: any) {
      // Fallback path: avoid relying on a composite index (works even if index isn't deployed)
      if (
        error?.code !== "failed-precondition" &&
        error?.code !== "permission-denied" &&
        !error?.message?.includes("index")
      ) {
        logError("GroupDetails.fetchLessonNotes", error);
      }
    }

    try {
      const fallbackQ = query(
        collection(db, "group_notes"),
        where("teacher_id", "==", teacherId),
      );
      const snapshot = await getDocs(fallbackQ);
      const rows = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as any)
        .filter((r) => r.group_name === groupName && r.is_active === true);

      const sorted = [...rows]
        .sort((a, b) => toMillisSafe(b.created_at) - toMillisSafe(a.created_at))
        .slice(0, 50);

      const notes = sorted.map((r) => {
        const createdDate = normalizeToYMD(r.created_date ?? r.created_at);
        return {
          id: r.id,
          note: r.note,
          created_at: r.created_at,
          created_date: createdDate,
        } as LessonNote;
      });
      setLessonNotes(notes);
    } catch (fallbackError: any) {
      if (fallbackError?.code !== "permission-denied") {
        logError("GroupDetails.fetchLessonNotes.fallback", fallbackError);
      }
      setLessonNotes([]);
    }
  };

  const startEditLessonNote = (note: LessonNote) => {
    setEditingNoteId(note.id);
    setNoteInput(note.note);
    setIsNoteExpanded(true);
  };

  const saveLessonNote = async () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;

    setSavingNote(true);
    try {
      // Edit mode
      if (editingNoteId) {
        await updateDoc(doc(db, "group_notes", editingNoteId), {
          note: trimmed,
          updated_at: serverTimestamp(),
        });

        setLessonNotes((prev) =>
          prev.map((n) =>
            n.id === editingNoteId ? { ...n, note: trimmed } : n,
          ),
        );
        setEditingNoteId(null);
        setNoteInput("");
        toast({ title: "Eslatma yangilandi" });
        void fetchLessonNotes();
        return;
      }

      // Create mode (bitta kunda bir nechta eslatma)
      const newRef = doc(collection(db, "group_notes"));
      const createdDate = selectedDate;

      await setDoc(newRef, {
        teacher_id: teacherId,
        group_name: groupName,
        note: trimmed,
        is_active: true,
        created_date: createdDate,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setLessonNotes((prev) => [
        {
          id: newRef.id,
          note: trimmed,
          created_at: Timestamp.now(),
          created_date: createdDate,
        },
        ...prev,
      ]);

      setNoteInput("");
      toast({ title: "Eslatma saqlandi" });

      // Background refresh (serverTimestamp / boshqa tablar uchun)
      void fetchLessonNotes();
    } catch (error) {
      logError("GroupDetails:handleSaveNote", error);
      toast({
        title: "Xatolik",
        description: "Eslatmani saqlashda xatolik",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  };

  const completeLessonNote = async (noteId: string) => {
    try {
      await updateDoc(doc(db, "group_notes", noteId), {
        is_active: false,
        completed_at: serverTimestamp(),
        completed_date: selectedDate,
        updated_at: serverTimestamp(),
      });
      setLessonNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast({ title: "Bajarildi!", description: "Eslatma yakunlandi" });
      void fetchLessonNotes();
    } catch (error) {
      logError("GroupDetails:handleCompleteNote", error);
    }
  };

  // Tanlangan sana uchun ko'rsatiladigan eslatmalar (yaratilgan sanadan keyingi sanalarda)
  const notesToShow = lessonNotes.filter((n) => selectedDate > n.created_date);

  // Shu kunda yaratilgan eslatmalar (bir nechta bo'lishi mumkin)
  const notesCreatedOnSelectedDate = lessonNotes.filter(
    (n) => selectedDate === n.created_date,
  );

  const fetchAttendanceDates = async () => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map((d) => d.data());

      // Filter by group students in memory
      const groupStudentIds = new Set(studentsRef.current.map((s) => s.id));
      const uniqueDates = [
        ...new Set(
          records
            .filter((r) => groupStudentIds.has(r.student_id))
            .map((r) => r.date),
        ),
      ];
      setAttendanceDates(uniqueDates.map((date) => parseISO(date)));
    } catch (error) {
      logError("GroupDetails:fetchAttendanceDates", error);
    }
  };

  const fetchStudents = async (showLoading = false) => {
    if (!teacherId || !groupName) return;
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Fetch active students
      const q = query(
        collection(db, "students"),
        where("teacher_id", "==", teacherId),
        where("group_name", "==", groupName),
        where("is_active", "==", true),
      );

      let studentsData: Student[] = [];
      try {
        const snapshot = await getDocs(q);
        studentsData = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data(), is_active: true }) as Student,
        );
      } catch (err) {
        // Silently handle
      }

      // Fetch archived students
      const archivedQ = query(
        collection(db, "archived_students"),
        where("teacher_id", "==", teacherId),
        where("group_name", "==", groupName),
      );

      let archivedData: Student[] = [];
      try {
        const archivedSnapshot = await getDocs(archivedQ);
        archivedData = archivedSnapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: data.original_student_id || data.student_id || d.id,
            name: data.name,
            phone: data.phone,
            group_name: data.group_name,
            teacher_id: data.teacher_id,
            created_at: data.created_at,
            join_date: data.join_date,
            left_date: data.left_date,
            archived_at: data.archived_at,
            is_active: false,
            archiveDocId: d.id,
          } as Student;
        });
      } catch (err) {
        // Silently handle
      }

      const allStudentsData = [...studentsData, ...archivedData].sort(
        (a, b) => {
          // Avval faol o'quvchilar chiqishi kerak (is_active=true)
          if (a.is_active !== b.is_active) {
            return a.is_active ? -1 : 1;
          }
          // Keyin ism bo'yicha saralash
          return a.name.localeCompare(b.name);
        },
      );

      const studentIds = Array.from(new Set(allStudentsData.map((s) => s.id)));
      if (studentIds.length > 0) {
        let historyData: any[] = [];
        let attendanceData: any[] = [];

        try {
          [historyData, attendanceData] = await Promise.all([
            fetchAllRecords<{
              student_id: string;
              points: number;
              type: string;
              date: string;
            }>("reward_penalty_history", teacherId, undefined, studentIds),
            fetchAllRecords<{
              student_id: string;
              status: string;
              date: string;
            }>("attendance_records", teacherId, undefined, studentIds),
          ]);
        } catch (err) {
          // Silently handle
        }

        // Calculate start date for filtering
        let startDate: string | null = null;
        if (selectedPeriod !== "all") {
          const now = getTashkentDate();
          switch (selectedPeriod) {
            case "1_day":
              now.setDate(now.getDate() - 1);
              break;
            case "1_week":
              now.setDate(now.getDate() - 7);
              break;
            case "1_month":
              now.setMonth(now.getMonth() - 1);
              break;
            case "2_months":
              now.setMonth(now.getMonth() - 2);
              break;
            case "3_months":
              now.setMonth(now.getMonth() - 3);
              break;
            case "6_months":
              now.setMonth(now.getMonth() - 6);
              break;
            case "10_months":
              now.setMonth(now.getMonth() - 10);
              break;
          }
          startDate = now.toISOString().split("T")[0];
        }

        const studentsWithStats = allStudentsData.map((student) => {
          const joinDate = getEffectiveJoinDate(student);
          const leaveDate = getEffectiveLeaveDate(student);
          const studentHistory = historyData.filter(
            (h) =>
              h.student_id === student.id &&
              (!startDate || h.date >= startDate) &&
              (!joinDate || h.date >= joinDate) &&
              (!leaveDate || h.date <= leaveDate),
          );
          const studentAttendance = attendanceData.filter(
            (a) =>
              a.student_id === student.id &&
              (!startDate || a.date >= startDate) &&
              (!joinDate || a.date >= joinDate) &&
              (!leaveDate || a.date <= leaveDate),
          );

          let bahoScore = 0;
          let mukofotScore = 0;
          let jarimaScore = 0;

          studentHistory.forEach((record) => {
            if (record.type === "Baho") bahoScore += record.points;
            else if (record.type === "Mukofot") mukofotScore += record.points;
            else if (record.type === "Jarima") jarimaScore += record.points;
          });

          const bahoRecords = studentHistory.filter((h) => h.type === "Baho");
          const averageScore =
            bahoRecords.length > 0 ? bahoScore / bahoRecords.length : 0;

          const attendancePoints = studentAttendance.reduce((total, record) => {
            if (record.status === "present") return total + PRESENT_POINTS;
            if (record.status === "late") return total + LATE_POINTS;
            return total;
          }, 0);

          const totalScore = mukofotScore - jarimaScore + attendancePoints;

          return {
            ...student,
            rewardPenaltyPoints: totalScore,
            averageScore,
            bahoScore,
            mukofotScore,
            jarimaScore,
            attendancePoints,
            totalRewards: mukofotScore,
            totalPenalties: jarimaScore,
          };
        });
        setStudents(studentsWithStats);
        studentsRef.current = studentsWithStats;
      } else {
        setStudents([]);
        studentsRef.current = [];
      }
    } catch (error) {
      logError("GroupDetails:fetchStudents", error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchAttendanceForDate = async (date: string) => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
        where("date", "==", date),
      );
      const snapshot = await getDocs(q);
      const attendanceMap: Record<string, AttendanceStatus> = {};
      const currentStudents = studentsRef.current;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const student = currentStudents.find((s) => s.id === data.student_id);
        if (!student) return;
        if (!isDateWithinStudentPeriod(student, date)) return;
        attendanceMap[data.student_id] = (
          data.status === "absent" ? "absent_without_reason" : data.status
        ) as AttendanceStatus;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      logError("GroupDetails:fetchAttendance", error);
    }
  };

  const fetchDailyScores = async (date: string) => {
    try {
      const currentStudents = studentsRef.current;
      const studentIds = currentStudents.map((s) => s.id);
      if (studentIds.length === 0) {
        setDailyScores({});
        return;
      }

      const q = query(
        collection(db, "reward_penalty_history"),
        where("teacher_id", "==", teacherId),
        where("date", "==", date),
      );
      const snapshot = await getDocs(q);
      const scoresMap: Record<
        string,
        {
          baho?: { points: number; id: string };
          mukofot?: { points: number; id: string };
          jarima?: { points: number; id: string };
        }
      > = {};

      snapshot.docs.forEach((d) => {
        const record = { id: d.id, ...d.data() } as any;
        if (studentIds.includes(record.student_id)) {
          const student = currentStudents.find(
            (s) => s.id === record.student_id,
          );
          if (!student) return;
          if (!isDateWithinStudentPeriod(student, date)) return;
          if (!scoresMap[record.student_id]) scoresMap[record.student_id] = {};
          if (record.type === "Baho")
            scoresMap[record.student_id].baho = {
              points: record.points,
              id: record.id,
            };
          else if (record.type === "Mukofot")
            scoresMap[record.student_id].mukofot = {
              points: record.points,
              id: record.id,
            };
          else if (record.type === "Jarima")
            scoresMap[record.student_id].jarima = {
              points: record.points,
              id: record.id,
            };
        }
      });

      setDailyScores(scoresMap);
    } catch (error) {
      logError("GroupDetails:fetchDailyScores", error);
    }
  };

  const editStudent = async () => {
    if (!editingStudent || !editingStudent.name.trim()) {
      toast({
        title: "Xatolik",
        description: "Ism kiritish majburiy",
        variant: "destructive",
      });
      return;
    }

    if (!editingStudent.join_date) {
      toast({
        title: "Xatolik",
        description: "Qo'shilgan sana kiritish majburiy",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateDoc(doc(db, "students", editingStudent.id), {
        name: editingStudent.name.trim(),
        join_date: editingStudent.join_date,
        student_id: editingStudent.student_id?.trim() || null,
        email: editingStudent.email?.trim() || null,
        phone: editingStudent.phone?.trim() || null,
        updated_at: serverTimestamp(),
      });

      void onStatsUpdate?.();
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      toast({
        title: "Muvaffaqiyatli",
        description: "O'quvchi ma'lumotlari yangilandi",
      });
    } catch (error) {
      logError("GroupDetails:handleUpdateStudent", error);
      toast({
        title: "Xatolik",
        description: "Tahrirlashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const markAttendance = async (
    studentId: string,
    status: AttendanceStatus,
    notes?: string | null,
  ) => {
    if (isFutureDate) {
      toast({
        title: "Xatolik",
        description: "Kelajakdagi sana uchun davomat belgilab bo'lmaydi.",
        variant: "destructive",
      });
      return;
    }
    try {
      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      const effectiveJoinDate = getEffectiveJoinDate(student);
      const effectiveLeaveDate = getEffectiveLeaveDate(student);

      if (effectiveJoinDate && selectedDate < effectiveJoinDate) {
        toast({
          title: "Xatolik",
          description: `${student?.name} ${effectiveJoinDate} sanasida qo'shilgan. Ushbu sanadan oldin davomat kiritib bo'lmaydi.`,
          variant: "destructive",
        });
        return;
      }

      if (effectiveLeaveDate && selectedDate > effectiveLeaveDate) {
        toast({
          title: "Xatolik",
          description: `${student.name} ${effectiveLeaveDate} sanasida chiqib ketgan. Ushbu sanadan keyin davomat kiritib bo'lmaydi.`,
          variant: "destructive",
        });
        return;
      }

      const docId = `${studentId}_${selectedDate}`;
      const docRef = doc(db, "attendance_records", docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const existingData = docSnap.data();
        if (
          existingData.status === status &&
          (notes ?? existingData.notes ?? null) === (existingData.notes ?? null)
        ) {
          await deleteDoc(docRef);
          setAttendance((prev) => {
            const next = { ...prev };
            delete next[studentId];
            return next;
          });
        } else {
          await setDoc(
            docRef,
            {
              status,
              notes: notes === undefined ? (existingData.notes ?? null) : notes,
              updated_at: serverTimestamp(),
            },
            { merge: true },
          );
          setAttendance((prev) => ({ ...prev, [studentId]: status }));
        }
      } else {
        await setDoc(docRef, {
          teacher_id: teacherId,
          student_id: studentId,
          date: selectedDate,
          status,
          notes: notes ?? null,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        setAttendance((prev) => ({ ...prev, [studentId]: status }));
      }
      void fetchAttendanceDates();
    } catch (error) {
      logError("GroupDetails:handleQuickAttendance", error);
      void fetchAttendanceForDate(selectedDate);
    }
  };

  const markAllAsPresent = async () => {
    if (isFutureDate) {
      toast({
        title: "Xatolik",
        description: "Kelajakdagi sana uchun davomat belgilab bo'lmaydi.",
        variant: "destructive",
      });
      return;
    }
    try {
      const batch = writeBatch(db);
      students.forEach((student) => {
        if (!isDateWithinStudentPeriod(student, selectedDate)) return;
        const docId = `${student.id}_${selectedDate}`;
        batch.set(
          doc(db, "attendance_records", docId),
          {
            teacher_id: teacherId,
            student_id: student.id,
            date: selectedDate,
            status: "present",
            updated_at: serverTimestamp(),
          },
          { merge: true },
        );
      });
      await batch.commit();
      setAttendance((prev) => {
        const next = { ...prev };
        students.forEach((student) => {
          if (!isDateWithinStudentPeriod(student, selectedDate)) return;
          next[student.id] = "present";
        });
        return next;
      });
      void fetchAttendanceDates();
    } catch (error) {
      logError("GroupDetails:handleMarkAllPresent", error);
    }
  };

  const clearAllAttendance = async () => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
        where("date", "==", selectedDate),
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      const groupStudentIds = new Set(students.map((s) => s.id));
      snapshot.docs.forEach((d) => {
        const data = d.data() as any;
        if (groupStudentIds.has(data.student_id)) {
          batch.delete(d.ref);
        }
      });

      await batch.commit();

      setAttendance({});
      setPendingAttendance({});
      setSavedAttendance({});
      void fetchAttendanceDates();
    } catch (error) {
      logError("GroupDetails:handleClearAttendance", error);
    }
  };

  const handleScoreCellClick = (studentId: string, type: ScoreType) => {
    setEditingScoreCell({ studentId, type });
    setScoreInputValue("");
  };

  const handleScoreInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || value === "-" || /^-?\d*\.?\d*$/.test(value)) {
      setScoreInputValue(value);
    }
  };

  const saveScore = async (studentId: string, type: ScoreType) => {
    if (scoreInputValue === "" || scoreInputValue === "-") {
      return true; // Allow navigation if empty
    }
    const newScore = parseFloat(scoreInputValue);
    if (isNaN(newScore)) return true; // Allow navigation if invalid (or maybe block?)

    if (newScore < 0 || newScore > 5) {
      toast({
        title: "Xatolik",
        description: "Ball 0 dan 5 gacha bo'lishi kerak",
        variant: "destructive",
      });
      return false;
    }

    const existingScore = dailyScores[studentId]?.[type];
    if (existingScore) {
      if (existingScore.points === newScore) return true; // No change
      setShowScoreChangeDialog({
        studentId,
        newScore,
        type,
        existingRecordId: existingScore.id,
      });
      return false; // Dialog opened, stop navigation
    } else {
      await submitScore(studentId, newScore, null, type);
      return true;
    }
  };

  const handleScoreBlur = async (studentId: string, type: ScoreType) => {
    // Give a small delay to check if navigation happened
    setTimeout(async () => {
      if (isNavigatingRef.current) return;
      await saveScore(studentId, type);
      setEditingScoreCell(null);
    }, 100);
  };

  const submitScore = async (
    studentId: string,
    newScore: number,
    reason: string | null,
    type: ScoreType,
    existingRecordId?: string,
  ) => {
    if (isFutureDate) {
      toast({
        title: "Xatolik",
        description: "Kelajakdagi sana uchun baho kiritib bo'lmaydi.",
        variant: "destructive",
      });
      return;
    }
    try {
      const typeLabel = type === "mukofot" ? "Mukofot" : "Jarima";

      // Tanlangan sana o'quvchining join_date dan oldin bo'lsa, ball kiritmaslik
      const student = students.find((s) => s.id === studentId);
      if (!student) return;
      const effectiveJoinDate = getEffectiveJoinDate(student);
      const effectiveLeaveDate = getEffectiveLeaveDate(student);

      if (effectiveJoinDate && selectedDate < effectiveJoinDate) {
        toast({
          title: "Xatolik",
          description: `${student?.name} ${effectiveJoinDate} sanasida qo'shilgan. Ushbu sanadan oldin ball kiritib bo'lmaydi.`,
          variant: "destructive",
        });
        return;
      }

      if (effectiveLeaveDate && selectedDate > effectiveLeaveDate) {
        toast({
          title: "Xatolik",
          description: `${student.name} ${effectiveLeaveDate} sanasida chiqib ketgan. Ushbu sanadan keyin ball kiritib bo'lmaydi.`,
          variant: "destructive",
        });
        return;
      }

      let savedRecordId = existingRecordId;
      if (existingRecordId) {
        if (!reason || reason.trim() === "") {
          toast({
            title: "Xatolik",
            description: "Izoh kiritish majburiy",
            variant: "destructive",
          });
          return;
        }
        await updateDoc(doc(db, "reward_penalty_history", existingRecordId), {
          points: newScore,
          reason: reason,
          updated_at: serverTimestamp(),
        });
      } else {
        const createdRef = await addDoc(
          collection(db, "reward_penalty_history"),
          {
            student_id: studentId,
            teacher_id: teacherId,
            points: newScore,
            reason: reason || typeLabel,
            type: typeLabel,
            date: selectedDate,
            created_at: serverTimestamp(),
          },
        );
        savedRecordId = createdRef.id;
      }

      if (savedRecordId) {
        setDailyScores((prev) => ({
          ...prev,
          [studentId]: {
            ...(prev[studentId] || {}),
            [type]: { points: newScore, id: savedRecordId },
          },
        }));
      }

      toast({ title: "Muvaffaqiyatli", description: `${typeLabel} saqlandi` });
    } catch (error) {
      logError("GroupDetails:handleScoreSubmit", error);
    } finally {
      setShowScoreChangeDialog(null);
      setScoreChangeReason("");
    }
  };

  const handleScoreKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIndex: number,
    type: ScoreType,
  ) => {
    const types: ScoreType[] = ["mukofot", "jarima"];
    const currentTypeIndex = types.indexOf(type);

    if (
      e.key === "Enter" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight"
    ) {
      e.preventDefault();
      isNavigatingRef.current = true;

      const canNavigate = await saveScore(students[studentIndex].id, type);
      if (!canNavigate) {
        isNavigatingRef.current = false;
        return;
      }

      let nextStudentIndex = studentIndex;
      let nextTypeIndex = currentTypeIndex;

      if (e.key === "Enter" || e.key === "ArrowDown") {
        nextStudentIndex = studentIndex + 1;
      } else if (e.key === "ArrowUp") {
        nextStudentIndex = studentIndex - 1;
      } else if (e.key === "ArrowLeft") {
        nextTypeIndex = currentTypeIndex - 1;
      } else if (e.key === "ArrowRight") {
        nextTypeIndex = currentTypeIndex + 1;
      }

      // Boundary checks
      if (
        nextStudentIndex >= 0 &&
        nextStudentIndex < students.length &&
        nextTypeIndex >= 0 &&
        nextTypeIndex < types.length
      ) {
        setEditingScoreCell({
          studentId: students[nextStudentIndex].id,
          type: types[nextTypeIndex],
        });
        setScoreInputValue("");
      } else {
        // If out of bounds, maybe just close?
        setEditingScoreCell(null);
      }

      // Reset navigation flag after state update
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 200);
    } else if (e.key === "Escape") {
      setEditingScoreCell(null);
    }
  };

  const handleAction = (studentId: string, studentName: string) => {
    setConfirmDialog({
      isOpen: true,
      studentId,
      studentName,
    });
  };

  const executeAction = async () => {
    const { studentId } = confirmDialog;
    await handleArchive(studentId);
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  const handleArchive = async (studentId: string) => {
    try {
      const studentDoc = await getDoc(doc(db, "students", studentId));
      if (!studentDoc.exists()) return;
      const studentData = studentDoc.data();

      await updateDoc(doc(db, "students", studentId), {
        is_active: false,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp(),
      });
      await addDoc(collection(db, "archived_students"), {
        ...studentData,
        original_student_id: studentId,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp(),
      });

      void onStatsUpdate?.();
      toast({ title: "Muvaffaqiyatli", description: "O'quvchi arxivlandi" });
    } catch (error) {
      logError("GroupDetails:handleArchiveStudent", error);
    }
  };

  const handleRestoreClick = (
    studentId: string,
    studentName: string,
    archiveDocId?: string,
  ) => {
    setRestoreDialog({
      isOpen: true,
      studentId,
      studentName,
      archiveDocId,
    });
  };

  const executeRestore = async (date: Date) => {
    const { studentId, archiveDocId } = restoreDialog;
    if (!studentId) return;

    try {
      const formattedDate = format(date, "yyyy-MM-dd");

      // 1. Update student status and join_date
      await updateDoc(doc(db, "students", studentId), {
        is_active: true,
        join_date: formattedDate,
        left_date: null,
        archived_at: null,
        updated_at: serverTimestamp(),
      });

      // 2. Remove from archived_students if archiveDocId exists
      if (archiveDocId) {
        await deleteDoc(doc(db, "archived_students", archiveDocId));
      } else {
        // Fallback: try to find and delete if archiveDocId is missing (shouldn't happen with new logic)
        const q = query(
          collection(db, "archived_students"),
          where("original_student_id", "==", studentId),
        );
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(async (d) => {
          await deleteDoc(d.ref);
        });
      }

      void onStatsUpdate?.();
      toast({ title: "Muvaffaqiyatli", description: "O'quvchi tiklandi" });
    } catch (error) {
      logError("GroupDetails:handleRestoreStudent", error);
      toast({
        title: "Xatolik",
        description: "Tiklashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  // Helper: Get effective join date (join_date or created_at)
  const getEffectiveJoinDate = (student: Student): string | null => {
    if (student.join_date) return student.join_date;

    // Fallback to created_at
    if (student.created_at) {
      if (student.created_at instanceof Timestamp) {
        return student.created_at.toDate().toISOString().split("T")[0];
      } else if (typeof student.created_at === "string") {
        return student.created_at.split("T")[0];
      }
    }
    return null;
  };

  const getEffectiveLeaveDate = (student: Student): string | null => {
    if (student.left_date) return student.left_date;

    if (student.archived_at) {
      if (student.archived_at instanceof Timestamp) {
        return student.archived_at.toDate().toISOString().split("T")[0];
      } else if (typeof student.archived_at === "string") {
        return student.archived_at.split("T")[0];
      } else if (typeof student.archived_at?.seconds === "number") {
        return format(
          getTashkentDate(new Date(student.archived_at.seconds * 1000)),
          "yyyy-MM-dd",
        );
      }
    }
    return null;
  };

  const isDateWithinStudentPeriod = (
    student: Student,
    date: string,
  ): boolean => {
    const joinDate = getEffectiveJoinDate(student);
    if (joinDate && date < joinDate) return false;
    const leaveDate = getEffectiveLeaveDate(student);
    if (leaveDate && date > leaveDate) return false;
    return true;
  };

  // Get the note text to display for grayed out students
  const getStudentStatusNote = (
    student: Student,
    selectedDate: string,
  ): string | null => {
    const effectiveJoinDate = getEffectiveJoinDate(student);

    // Check if before join date
    if (effectiveJoinDate && selectedDate < effectiveJoinDate) {
      const [year, month, day] = effectiveJoinDate.split("-");
      return `${day}-${month}-${year} da kelgan`;
    }

    // Check if archived (after archive date)
    if (!student.is_active) {
      const leaveDate = getEffectiveLeaveDate(student);
      if (leaveDate) {
        const [year, month, day] = leaveDate.split("-");
        return `${day}-${month}-${year} da chiqib ketgan`;
      }
    }

    return null;
  };

  const getToggleButtonStyle = (status?: AttendanceStatus) => {
    const baseStyle = "w-10 h-10 p-0 border rounded-md";
    switch (status) {
      case "present":
        return `${baseStyle} border-green-500 bg-green-500 hover:bg-green-600 text-white`;
      case "late":
        return `${baseStyle} border-orange-500 bg-orange-500 hover:bg-orange-600 text-white`;
      case "absent_without_reason":
        return `${baseStyle} border-red-500 bg-red-500 hover:bg-red-600 text-white`;
      case "absent_with_reason":
        return `${baseStyle} border-yellow-500 bg-yellow-500 hover:bg-yellow-600 text-white`;
      default:
        return `${baseStyle} border-border bg-background hover:bg-muted text-muted-foreground`;
    }
  };

  const getNextAttendanceStatus = (
    current?: AttendanceStatus,
  ): AttendanceStatus => {
    switch (current) {
      case "present":
        return "late";
      case "late":
        return "absent_without_reason";
      case "absent_without_reason":
        return "absent_with_reason";
      case "absent_with_reason":
        return "present";
      default:
        return "present";
    }
  };

  const getAttendanceLabel = (status?: AttendanceStatus) => {
    switch (status) {
      case "present":
        return "Keldi";
      case "late":
        return "Kechikdi";
      case "absent_without_reason":
        return "Kelmadi";
      case "absent_with_reason":
        return "Sababli Kelmadi";
      default:
        return "Belgilash";
    }
  };

  const scheduleAttendanceRefresh = () => {
    if (attendanceRefreshTimerRef.current) {
      clearTimeout(attendanceRefreshTimerRef.current);
    }
    attendanceRefreshTimerRef.current = setTimeout(() => {
      void fetchAttendanceDates();
      attendanceRefreshTimerRef.current = null;
    }, 350);
  };

  const persistAttendance = async (
    studentId: string,
    status: AttendanceStatus,
    notes: string | null,
    seq: number,
  ) => {
    try {
      const docId = `${studentId}_${selectedDate}`;
      const docRef = doc(db, "attendance_records", docId);
      await setDoc(
        docRef,
        {
          teacher_id: teacherId,
          student_id: studentId,
          date: selectedDate,
          status,
          notes: notes ?? null,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );

      if (attendanceWriteSeqRef.current[studentId] !== seq) return;

      setPendingAttendance((prev) => {
        const nextPending = { ...prev };
        delete nextPending[studentId];
        return nextPending;
      });
      setSavedAttendance((prev) => ({ ...prev, [studentId]: true }));
      setTimeout(() => {
        setSavedAttendance((prev) => {
          const nextSaved = { ...prev };
          delete nextSaved[studentId];
          return nextSaved;
        });
      }, 900);

      scheduleAttendanceRefresh();
    } catch (error) {
      logError("GroupDetails:handleMarkAttendance", error);
      if (attendanceWriteSeqRef.current[studentId] !== seq) return;
      setPendingAttendance((prev) => {
        const nextPending = { ...prev };
        delete nextPending[studentId];
        return nextPending;
      });
      toast({
        title: "Xatolik",
        description: "Davomatni saqlashda xatolik yuz berdi",
        variant: "destructive",
      });
      void fetchAttendanceForDate(selectedDate);
    }
  };

  const toggleAttendance = (studentId: string) => {
    if (isFutureDate) {
      toast({
        title: "Xatolik",
        description: "Kelajakdagi sana uchun davomat belgilab bo'lmaydi.",
        variant: "destructive",
      });
      return;
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const effectiveJoinDate = getEffectiveJoinDate(student);
    const effectiveLeaveDate = getEffectiveLeaveDate(student);
    if (effectiveJoinDate && selectedDate < effectiveJoinDate) return;
    if (effectiveLeaveDate && selectedDate > effectiveLeaveDate) return;

    const current = attendance[studentId] as AttendanceStatus | undefined;
    const next = getNextAttendanceStatus(current);
    const notes = next === "absent_with_reason" ? "Sababli" : null;

    const nextSeq = (attendanceWriteSeqRef.current[studentId] || 0) + 1;
    attendanceWriteSeqRef.current[studentId] = nextSeq;

    setAttendance((prev) => ({ ...prev, [studentId]: next }));
    setPendingAttendance((prev) => ({ ...prev, [studentId]: true }));
    setSavedAttendance((prev) => {
      const nextSaved = { ...prev };
      delete nextSaved[studentId];
      return nextSaved;
    });

    void persistAttendance(studentId, next, notes, nextSeq);
  };

  const getScoreCellStyle = (type: string) => {
    const baseStyle = "border";
    if (type === "baho") {
      return `${baseStyle} bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100`;
    }
    if (type === "mukofot") {
      return `${baseStyle} bg-green-50 dark:bg-emerald-500/20 text-green-700 dark:text-emerald-300 border-green-200 dark:border-emerald-500/40 hover:bg-green-100 dark:hover:bg-emerald-500/30`;
    }
    if (type === "jarima") {
      return `${baseStyle} bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40 hover:bg-red-100 dark:hover:bg-red-500/30`;
    }
    return `${baseStyle} bg-muted text-muted-foreground border-border`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="flex-shrink-0 h-8 w-8 p-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {availableGroups &&
              availableGroups.length > 1 &&
              onGroupChange ? (
                <Select value={groupName} onValueChange={onGroupChange}>
                  <SelectTrigger className="w-auto max-w-[160px] sm:max-w-[200px] border-0 hover:bg-muted p-0 h-auto">
                    <SelectValue>
                      <h2 className="text-lg sm:text-2xl font-bold truncate">
                        {groupName}
                      </h2>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableGroups.map((group) => (
                      <SelectItem key={group.id} value={group.name}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div>
                  <h2 className="text-lg sm:text-2xl font-bold truncate">
                    {groupName}
                  </h2>
                </div>
              )}
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[100px] sm:w-[120px] h-8 text-xs sm:text-sm">
                  <SelectValue placeholder="Davr" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1_day">1 kun</SelectItem>
                  <SelectItem value="1_week">1 hafta</SelectItem>
                  <SelectItem value="1_month">1 oy</SelectItem>
                  <SelectItem value="2_months">2 oy</SelectItem>
                  <SelectItem value="3_months">3 oy</SelectItem>
                  <SelectItem value="6_months">6 oy</SelectItem>
                  <SelectItem value="10_months">10 oy</SelectItem>
                  <SelectItem value="all">Barchasi</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {students.length} o'quvchi
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <StudentImport
              teacherId={teacherId}
              groupName={groupName}
              onImportComplete={() => {
                void onStatsUpdate();
              }}
              availableGroups={availableGroups}
            />

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="w-[95vw] max-w-md sm:w-auto rounded-xl">
                <DialogHeader>
                  <DialogTitle>O'quvchini tahrirlash</DialogTitle>
                </DialogHeader>
                {editingStudent && (
                  <div className="space-y-3 py-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm">F.I.SH</Label>
                      <Input
                        value={editingStudent.name}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            name: e.target.value,
                          })
                        }
                        placeholder="Masalan: Ali Valiyev"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">O'quvchi ID (ixtiyoriy)</Label>
                      <Input
                        value={editingStudent.student_id || ""}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            student_id: e.target.value,
                          })
                        }
                        placeholder="Masalan: 12345"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Email (ixtiyoriy)</Label>
                      <Input
                        value={editingStudent.email || ""}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            email: e.target.value,
                          })
                        }
                        placeholder="Masalan: ali@example.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Telefon (ixtiyoriy)</Label>
                      <Input
                        value={editingStudent.phone || ""}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            phone: e.target.value,
                          })
                        }
                        placeholder="Masalan: +998901234567"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">
                        Qo'shilgan sana (majburiy)
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !editingStudent.join_date &&
                                "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingStudent.join_date ? (
                              format(
                                parseISO(editingStudent.join_date),
                                "d-MMMM, yyyy",
                                { locale: uz },
                              )
                            ) : (
                              <span>Sana tanlang</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              editingStudent.join_date
                                ? parseISO(editingStudent.join_date)
                                : getTashkentDate()
                            }
                            onSelect={(date) =>
                              date &&
                              setEditingStudent({
                                ...editingStudent,
                                join_date: format(date, "yyyy-MM-dd"),
                              })
                            }
                            initialFocus
                            locale={uz}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      onClick={editStudent}
                      className="w-full apple-button"
                    >
                      Saqlash
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex border-b border-border overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("attendance")}
            className={cn(
              "px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex-shrink-0",
              activeTab === "attendance"
                ? "border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Kunlik Jurnal
          </button>
          <button
            onClick={() => setActiveTab("journal")}
            className={cn(
              "px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm transition-all border-b-2 whitespace-nowrap flex-shrink-0",
              activeTab === "journal"
                ? "border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Davomat Jurnali
          </button>
        </div>

        <div className="mt-3 sm:mt-6">
          {activeTab === "journal" && (
            <AttendanceJournal teacherId={teacherId} groupName={groupName} />
          )}

          {activeTab === "attendance" && (
            <div className="flex flex-col xl:flex-row gap-4 sm:gap-6 items-start">
              <Card className="apple-card overflow-hidden w-full xl:flex-[65_65_0%] min-w-0 bg-card border-border">
                {/* Eslatma banner - yaratilgan sanadan keyingi sanalarda ko'rsatiladi (bir nechta bo'lishi mumkin) */}
                {notesToShow.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/50 dark:via-amber-900/40 dark:to-orange-950/50 border-b-2 border-amber-300 dark:border-amber-600/50 px-4 py-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/30 flex items-center justify-center animate-pulse mt-0.5">
                        <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">
                          O'zingizga eslatmalar ({notesToShow.length})
                        </p>
                        {notesToShow.length === 1 ? (
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-amber-900 dark:text-amber-100 font-medium flex-1 break-words">
                              {notesToShow[0].note}
                            </p>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  startEditLessonNote(notesToShow[0])
                                }
                                className="h-7 w-7 p-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/30"
                                title="Tahrirlash"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  completeLessonNote(notesToShow[0].id)
                                }
                                className="h-7 w-7 p-0 text-green-700 dark:text-emerald-400 hover:text-green-900 dark:hover:text-emerald-200 hover:bg-green-100 dark:hover:bg-emerald-500/30"
                                title="Bajarildi"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                            {notesToShow.map((n) => (
                              <div
                                key={n.id}
                                className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-500/25 border border-amber-200 dark:border-amber-500/40 px-2 py-1"
                              >
                                <span
                                  className="text-xs text-amber-900 dark:text-amber-100 font-medium truncate max-w-[240px]"
                                  title={n.note}
                                >
                                  {n.note}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEditLessonNote(n)}
                                  className="h-5 w-5 p-0 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-500/40"
                                  title="Tahrirlash"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => completeLessonNote(n.id)}
                                  className="h-5 w-5 p-0 text-green-700 dark:text-emerald-400 hover:text-green-900 dark:hover:text-emerald-200 hover:bg-green-200 dark:hover:bg-emerald-500/40"
                                  title="Bajarildi"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action bar: mobile = 2 rows, sm+ = 1 row */}
                <div className="p-2.5 sm:p-4 border-b border-border/50 bg-muted/30 space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  {/* Row 1 on mobile: Date picker + Notes trigger */}
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 sm:flex-none sm:w-[200px] justify-start text-left font-normal apple-button-secondary text-xs sm:text-sm h-8 sm:h-9",
                            !selectedDate && "text-muted-foreground",
                          )}
                        >
                          <CalendarIcon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                          {selectedDate ? (
                            <>
                              <span className="hidden xs:inline">
                                {format(
                                  parseISO(selectedDate),
                                  "d-MMMM, yyyy",
                                  { locale: uz },
                                )}
                              </span>
                              <span className="xs:hidden">
                                {format(parseISO(selectedDate), "d-MMM, yy", {
                                  locale: uz,
                                })}
                              </span>
                            </>
                          ) : (
                            <span>Sana tanlang</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseISO(selectedDate)}
                          onSelect={(date) =>
                            date && setSelectedDate(format(date, "yyyy-MM-dd"))
                          }
                          initialFocus
                          locale={uz}
                          modifiers={{ hasAttendance: attendanceDates }}
                          modifiersStyles={{
                            hasAttendance: {
                              backgroundColor: "#22c55e",
                              color: "white",
                              borderRadius: "50%",
                            },
                          }}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Notes trigger — compact, always visible */}
                    <Popover
                      open={isNoteExpanded}
                      onOpenChange={(open) => {
                        setIsNoteExpanded(open);
                        if (!open) {
                          setEditingNoteId(null);
                          setNoteInput("");
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          onClick={() => setIsNoteExpanded(true)}
                          className={cn(
                            "flex-shrink-0 flex items-center gap-1.5 text-xs sm:text-sm font-medium rounded-full border px-2.5 sm:px-3 py-1.5 transition-all shadow-sm hover:shadow-md",
                            notesCreatedOnSelectedDate.length > 0
                              ? "bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/40 hover:bg-orange-100 dark:hover:bg-orange-500/30"
                              : "bg-orange-50/50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-500/30 hover:bg-orange-100/70 dark:hover:bg-orange-500/20",
                            "focus:outline-none focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-500/50",
                          )}
                        >
                          <StickyNote className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 dark:text-orange-400 flex-shrink-0" />
                          <span className="hidden sm:inline whitespace-nowrap">
                            {notesCreatedOnSelectedDate.length > 0
                              ? `Eslatmalar (${notesCreatedOnSelectedDate.length})`
                              : "Eslatma qo'shish"}
                          </span>
                          <span className="sm:hidden">
                            {notesCreatedOnSelectedDate.length > 0
                              ? `(${notesCreatedOnSelectedDate.length})`
                              : ""}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[calc(100vw-1rem)] sm:w-96 max-w-[384px] p-3"
                        align="end"
                        sideOffset={8}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              <StickyNote className="w-4 h-4 text-amber-500" />
                              Keyingi dars uchun eslatmalar
                            </div>
                            {editingNoteId && (
                              <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                                Tahrirlash
                              </span>
                            )}
                          </div>

                          {notesCreatedOnSelectedDate.length > 0 &&
                            (notesCreatedOnSelectedDate.length === 1 ? (
                              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 text-sm text-foreground break-words">
                                    {notesCreatedOnSelectedDate[0].note}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      startEditLessonNote(
                                        notesCreatedOnSelectedDate[0],
                                      )
                                    }
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                    title="Tahrirlash"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      completeLessonNote(
                                        notesCreatedOnSelectedDate[0].id,
                                      )
                                    }
                                    className="h-7 w-7 p-0 text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/20"
                                    title="O'chirish"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                                {notesCreatedOnSelectedDate.map((n) => (
                                  <div
                                    key={n.id}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-muted border border-border px-2 py-1"
                                  >
                                    <span
                                      className="text-xs text-foreground truncate max-w-[240px]"
                                      title={n.note}
                                    >
                                      {n.note}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditLessonNote(n)}
                                      className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                      title="Tahrirlash"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => completeLessonNote(n.id)}
                                      className="h-5 w-5 p-0 text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/20"
                                      title="O'chirish"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            ))}

                          <Textarea
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="Vazifa tekshirish, so'rov olish..."
                            className="min-h-[80px] resize-none text-sm"
                            autoFocus
                          />

                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (editingNoteId) {
                                  setEditingNoteId(null);
                                  setNoteInput("");
                                  return;
                                }
                                setIsNoteExpanded(false);
                                setNoteInput("");
                              }}
                            >
                              Bekor
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveLessonNote}
                              disabled={!noteInput.trim() || savingNote}
                              className="bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white"
                            >
                              {savingNote
                                ? "..."
                                : editingNoteId
                                  ? "Yangilash"
                                  : "Saqlash"}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Row 2 on mobile / inline on sm+: Action buttons */}
                  <div className="flex items-center gap-2 sm:contents">
                    <Button
                      onClick={markAllAsPresent}
                      variant="outline"
                      size="sm"
                      className="apple-button-secondary text-xs sm:text-sm h-8 sm:h-9 flex-1 xs:flex-none"
                    >
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-green-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="hidden xs:inline">Barchasi kelgan</span>
                      <span className="xs:hidden">Barchasi</span>
                    </Button>
                    <Button
                      onClick={clearAllAttendance}
                      variant="outline"
                      size="sm"
                      className="apple-button-secondary text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs sm:text-sm h-8 sm:h-9 flex-1 xs:flex-none"
                    >
                      <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
                      <span className="hidden xs:inline">Tozalash</span>
                      <span className="xs:hidden">Tozala</span>
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[280px]">
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[26px] sm:w-[44px] text-center px-1 sm:px-3">
                          #
                        </TableHead>
                        <TableHead className="px-1.5 sm:px-4 min-w-[120px]">
                          O'quvchi
                        </TableHead>
                        <TableHead className="text-center px-1 sm:px-3 w-[52px] sm:w-[72px]">
                          Dav.
                        </TableHead>
                        <TableHead className="text-center px-1 sm:px-4 hidden sm:table-cell">
                          Mukofot/Jarima
                        </TableHead>
                        <TableHead className="text-center px-1 sm:px-4 hidden md:table-cell">
                          Umumiy ball
                        </TableHead>
                        <TableHead className="text-right px-1 sm:px-4 w-[36px] sm:w-[52px]">
                          <span className="hidden sm:inline">Amallar</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student, index) => {
                        const effectiveJoinDate = getEffectiveJoinDate(student);
                        const isBeforeJoinDate =
                          effectiveJoinDate && selectedDate < effectiveJoinDate;
                        const effectiveLeaveDate =
                          getEffectiveLeaveDate(student);
                        const isAfterLeaveDate =
                          effectiveLeaveDate &&
                          selectedDate > effectiveLeaveDate;
                        const isOutsidePeriod =
                          isBeforeJoinDate || isAfterLeaveDate;
                        const isArchived = !student.is_active;
                        const isFirstArchived =
                          isArchived &&
                          (index === 0 || students[index - 1].is_active);

                        return (
                          <React.Fragment key={student.id}>
                            {isFirstArchived && (
                              <TableRow
                                key={`${student.id}-separator`}
                                className="bg-muted hover:bg-muted"
                              >
                                <TableCell
                                  colSpan={6}
                                  className="text-center py-2"
                                >
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Chiqib ketgan o'quvchilar
                                  </span>
                                </TableCell>
                              </TableRow>
                            )}

                            <TableRow
                              key={student.id}
                              className={cn(
                                "transition-colors",
                                isArchived
                                  ? "bg-muted/30 hover:bg-muted/50"
                                  : "hover:bg-muted/30",
                              )}
                            >
                              <TableCell className="text-center text-muted-foreground font-medium px-1 sm:px-3 text-xs">
                                {index + 1}
                              </TableCell>
                              <TableCell className="px-1.5 sm:px-4">
                                <div className="flex flex-col group">
                                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                                    <StudentProfileLink
                                      studentId={student.id}
                                      className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm sm:text-base"
                                    >
                                      {student.name}
                                    </StudentProfileLink>
                                    {getStudentStatusNote(
                                      student,
                                      selectedDate,
                                    ) && (
                                      <span
                                        className={cn(
                                          "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-medium",
                                          isBeforeJoinDate
                                            ? "bg-yellow-100 text-yellow-800 dark:bg-amber-500/25 dark:text-amber-200"
                                            : "bg-orange-100 text-orange-800 dark:bg-orange-500/25 dark:text-orange-200",
                                        )}
                                      >
                                        {getStudentStatusNote(
                                          student,
                                          selectedDate,
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {student.student_id || "ID yo'q"}
                                  </span>
                                  {/* Mobile score badges - visible only below sm, hidden on sm+ */}
                                  <div className="flex items-center gap-1 mt-1.5 sm:hidden flex-wrap">
                                    {(["mukofot", "jarima"] as const).map(
                                      (type) => (
                                        <button
                                          key={type}
                                          disabled={
                                            isOutsidePeriod || isFutureDate
                                          }
                                          className={cn(
                                            "text-[11px] px-2 py-1 rounded-md font-semibold border transition-all",
                                            isOutsidePeriod || isFutureDate
                                              ? "opacity-40 cursor-not-allowed"
                                              : "cursor-pointer active:scale-95",
                                            type === "mukofot"
                                              ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-500/25"
                                              : "bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30 hover:bg-red-100 dark:hover:bg-red-500/25",
                                          )}
                                          onClick={() => {
                                            if (
                                              !isOutsidePeriod &&
                                              !isFutureDate
                                            ) {
                                              setMobileScoreDialog({
                                                studentId: student.id,
                                                studentName: student.name,
                                                type,
                                              });
                                              setMobileScoreInput(
                                                String(
                                                  dailyScores[student.id]?.[
                                                    type
                                                  ]?.points ?? "",
                                                ),
                                              );
                                            }
                                          }}
                                          title={
                                            type === "mukofot"
                                              ? "Mukofot qo'shish"
                                              : "Jarima qo'shish"
                                          }
                                        >
                                          {type === "mukofot" ? "＋" : "－"}
                                          {dailyScores[student.id]?.[type]
                                            ?.points ?? 0}
                                        </button>
                                      ),
                                    )}
                                    <span className="text-[11px] px-2 py-1 rounded-md font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                                      {student.rewardPenaltyPoints?.toFixed(
                                        1,
                                      ) ?? "0.0"}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="px-0.5 sm:px-3">
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className={cn(
                                      getToggleButtonStyle(
                                        attendance[student.id],
                                      ),
                                      "h-7 w-7 sm:h-9 sm:w-9 p-0",
                                    )}
                                    disabled={isOutsidePeriod || isFutureDate}
                                    onClick={() => toggleAttendance(student.id)}
                                    title={
                                      isFutureDate
                                        ? "Kelajak uchun belgilab bo'lmaydi"
                                        : isBeforeJoinDate
                                          ? `${student.name} ${effectiveJoinDate} sanasida qo'shilgan`
                                          : isAfterLeaveDate
                                            ? `${student.name} ${effectiveLeaveDate} sanasida chiqib ketgan`
                                            : getAttendanceLabel(
                                                attendance[student.id],
                                              )
                                    }
                                  >
                                    <span className="relative inline-flex items-center justify-center">
                                      {attendance[student.id] === "present" ? (
                                        <CheckCircle className="w-4 h-4" />
                                      ) : attendance[student.id] === "late" ? (
                                        <Clock className="w-4 h-4" />
                                      ) : attendance[student.id] ===
                                        "absent_with_reason" ? (
                                        <AlertTriangle className="w-4 h-4" />
                                      ) : attendance[student.id] ===
                                        "absent_without_reason" ? (
                                        <XCircle className="w-4 h-4" />
                                      ) : (
                                        <CheckCircle className="w-4 h-4" />
                                      )}
                                      {pendingAttendance[student.id] && (
                                        <span className="absolute -right-2 -top-2 inline-block animate-spin rounded-full h-3 w-3 border-b-2 border-current opacity-80" />
                                      )}
                                    </span>
                                  </Button>
                                  <span
                                    className={cn(
                                      "text-[9px] sm:text-[10px] font-medium leading-none text-center max-w-[52px] truncate",
                                      pendingAttendance[student.id]
                                        ? "text-muted-foreground"
                                        : savedAttendance[student.id]
                                          ? "text-emerald-600 dark:text-emerald-400"
                                          : attendance[student.id] === "present"
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : attendance[student.id] === "late"
                                              ? "text-orange-600 dark:text-orange-400"
                                              : attendance[student.id] ===
                                                  "absent_with_reason"
                                                ? "text-yellow-700 dark:text-yellow-400"
                                                : attendance[student.id] ===
                                                    "absent_without_reason"
                                                  ? "text-red-600 dark:text-red-400"
                                                  : "text-muted-foreground",
                                    )}
                                  >
                                    {pendingAttendance[student.id]
                                      ? "..."
                                      : savedAttendance[student.id]
                                        ? "✓"
                                        : getAttendanceLabel(
                                            attendance[student.id],
                                          )}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center px-1 sm:px-4 hidden sm:table-cell">
                                <div className="flex justify-center gap-1.5">
                                  {(["mukofot", "jarima"] as const).map(
                                    (type) => (
                                      <div key={type}>
                                        {editingScoreCell?.studentId ===
                                          student.id &&
                                        editingScoreCell?.type === type &&
                                        !isOutsidePeriod &&
                                        !isFutureDate ? (
                                          <Input
                                            className="w-10 h-10 mx-auto text-center p-0 text-sm"
                                            value={scoreInputValue}
                                            onChange={handleScoreInputChange}
                                            onBlur={() =>
                                              handleScoreBlur(student.id, type)
                                            }
                                            onKeyDown={(e) =>
                                              handleScoreKeyDown(e, index, type)
                                            }
                                            autoFocus
                                          />
                                        ) : (
                                          <div
                                            className={cn(
                                              "w-10 h-10 mx-auto flex items-center justify-center rounded-md transition-all font-medium text-sm",
                                              isOutsidePeriod || isFutureDate
                                                ? "opacity-40 cursor-not-allowed bg-muted"
                                                : "cursor-pointer hover:ring-2 hover:ring-primary/20",
                                              getScoreCellStyle(type),
                                            )}
                                            onClick={() =>
                                              !isOutsidePeriod &&
                                              !isFutureDate &&
                                              handleScoreCellClick(
                                                student.id,
                                                type,
                                              )
                                            }
                                            title={
                                              isFutureDate
                                                ? "Kelajak uchun belgilab bo'lmaydi"
                                                : isBeforeJoinDate
                                                  ? `${student.name} ${effectiveJoinDate} sanasida qo'shilgan`
                                                  : isAfterLeaveDate
                                                    ? `${student.name} ${effectiveLeaveDate} sanasida chiqib ketgan`
                                                    : type === "mukofot"
                                                      ? "Mukofot"
                                                      : "Jarima"
                                            }
                                          >
                                            {dailyScores[student.id]?.[type]
                                              ?.points || 0}
                                          </div>
                                        )}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center px-1 sm:px-4 hidden md:table-cell">
                                <div className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-green-100 dark:bg-emerald-500/25 text-green-700 dark:text-emerald-300">
                                  {student.rewardPenaltyPoints?.toFixed(1) || 0}
                                </div>
                              </TableCell>
                              <TableCell className="text-right px-1 sm:px-4">
                                <div className="flex justify-end gap-1">
                                  {!isArchived ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                                        >
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-44"
                                      >
                                        <DropdownMenuItem
                                          onSelect={() => {
                                            const studentWithJoinDate = {
                                              ...student,
                                              join_date:
                                                student.join_date ||
                                                getEffectiveJoinDate(student) ||
                                                getTashkentToday(),
                                            };
                                            setEditingStudent(
                                              studentWithJoinDate,
                                            );
                                            setIsEditDialogOpen(true);
                                          }}
                                          className="gap-2"
                                        >
                                          <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                          Tahrirlash
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            handleAction(
                                              student.id,
                                              student.name,
                                            )
                                          }
                                          className="gap-2"
                                        >
                                          <Archive className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                          Arxivlash
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-2 text-xs text-green-600 dark:text-emerald-400 hover:text-green-700 dark:hover:text-emerald-300 hover:bg-green-50 dark:hover:bg-emerald-500/20"
                                      onClick={() =>
                                        handleRestoreClick(
                                          student.id,
                                          student.name,
                                          student.archiveDocId,
                                        )
                                      }
                                    >
                                      Tiklash
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
              <div className="w-full xl:flex-[35_35_0%] min-w-0">
                <GroupRankingSidebar students={students} loading={loading} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showAbsentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-end xs:items-center justify-center z-50 p-0 xs:p-4">
          <div className="bg-card rounded-t-2xl xs:rounded-xl p-5 w-full xs:max-w-sm border border-border shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-base font-semibold truncate">
                  {students.find((s) => s.id === showAbsentDialog)?.name}
                </h3>
                <p className="text-sm text-muted-foreground">Davomat holati</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAbsentDialog(null)}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            {!showReasonInput ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => {
                    markAttendance(showAbsentDialog, "absent_without_reason");
                    setShowAbsentDialog(null);
                  }}
                  variant="outline"
                  className="h-14 flex-col gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <XCircle className="w-5 h-5" />
                  <span className="text-xs font-medium">Sababsiz</span>
                </Button>
                <Button
                  onClick={() => setShowReasonInput(true)}
                  variant="outline"
                  className="h-14 flex-col gap-1 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30 hover:bg-yellow-50 dark:hover:bg-yellow-500/10"
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-xs font-medium">Sababli</span>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Sabab (majburiy)</Label>
                  <Input
                    value={absentReason}
                    onChange={(e) => setAbsentReason(e.target.value)}
                    placeholder="Sabab kiriting..."
                    className="mt-1.5"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      markAttendance(
                        showAbsentDialog,
                        "absent_with_reason",
                        absentReason,
                      );
                      setShowAbsentDialog(null);
                    }}
                    className="flex-1 apple-button"
                    disabled={!absentReason.trim()}
                  >
                    Saqlash
                  </Button>
                  <Button
                    onClick={() => setShowReasonInput(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Ortga
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showScoreChangeDialog && (
        <AlertDialog
          open={!!showScoreChangeDialog}
          onOpenChange={() => setShowScoreChangeDialog(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ballni o'zgartirish</AlertDialogTitle>
              <AlertDialogDescription>
                Siz mavjud ballni o'zgartirmoqchisiz. Iltimos, sababini
                ko'rsating.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>O'zgartirish sababi</Label>
              <Input
                value={scoreChangeReason}
                onChange={(e) => setScoreChangeReason(e.target.value)}
                placeholder="Masalan: Xato kiritilgan"
                autoFocus
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  submitScore(
                    showScoreChangeDialog.studentId,
                    showScoreChangeDialog.newScore,
                    scoreChangeReason,
                    showScoreChangeDialog.type,
                    showScoreChangeDialog.existingRecordId,
                  )
                }
                disabled={!scoreChangeReason.trim()}
              >
                Tasdiqlash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeAction}
        title="O'quvchini arxivlash"
        description={`"${confirmDialog.studentName}" ni arxivlashga ishonchingiz komilmi?`}
        confirmText="Arxivlash"
        variant="warning"
      />

      {/* Mobile score entry dialog */}
      {mobileScoreDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-end xs:items-center justify-center z-50 sm:hidden">
          <div className="bg-card w-full xs:w-[360px] xs:mx-4 rounded-t-2xl xs:rounded-2xl border border-border shadow-xl overflow-hidden">
            {/* Header */}
            <div
              className={cn(
                "px-5 pt-5 pb-3 border-b border-border",
                mobileScoreDialog.type === "mukofot"
                  ? "bg-emerald-50 dark:bg-emerald-500/10"
                  : "bg-red-50 dark:bg-red-500/10",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-medium">
                    {mobileScoreDialog.type === "mukofot"
                      ? "Mukofot"
                      : "Jarima"}
                  </p>
                  <h3 className="font-semibold text-foreground text-base truncate">
                    {mobileScoreDialog.studentName}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setMobileScoreDialog(null);
                    setMobileScoreInput("");
                  }}
                  className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Ball kiriting{" "}
                  <span className="text-muted-foreground font-normal">
                    (0 – 5)
                  </span>
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="5"
                  step="0.5"
                  value={mobileScoreInput}
                  onChange={(e) => setMobileScoreInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="0"
                  className="text-center text-2xl font-bold h-14 tracking-widest"
                  autoFocus
                />
                {/* Quick value buttons */}
                <div className="grid grid-cols-6 gap-1.5 pt-1">
                  {[0, 1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => setMobileScoreInput(String(v))}
                      className={cn(
                        "rounded-lg py-2 text-sm font-semibold border transition-all active:scale-95",
                        mobileScoreInput === String(v)
                          ? mobileScoreDialog.type === "mukofot"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-red-500 text-white border-red-500"
                          : "bg-muted/50 border-border text-foreground hover:bg-muted",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setMobileScoreDialog(null);
                    setMobileScoreInput("");
                  }}
                >
                  Bekor
                </Button>
                <Button
                  className={cn(
                    "flex-2 flex-[2]",
                    mobileScoreDialog.type === "mukofot"
                      ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white"
                      : "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 text-white",
                  )}
                  disabled={mobileScoreInput === "" || mobileScoreInput === "-"}
                  onClick={async () => {
                    const val = parseFloat(mobileScoreInput);
                    if (isNaN(val)) return;
                    if (val < 0 || val > 5) {
                      toast({
                        title: "Xatolik",
                        description: "Ball 0 dan 5 gacha bo'lishi kerak",
                        variant: "destructive",
                      });
                      return;
                    }
                    const { studentId, type } = mobileScoreDialog;
                    const existingScore = dailyScores[studentId]?.[type];
                    setMobileScoreDialog(null);
                    setMobileScoreInput("");
                    if (existingScore && existingScore.points !== val) {
                      // Existing score — trigger change-reason dialog
                      setShowScoreChangeDialog({
                        studentId,
                        newScore: val,
                        type,
                        existingRecordId: existingScore.id,
                      });
                    } else if (!existingScore) {
                      await submitScore(studentId, val, null, type);
                    }
                    // If existingScore.points === val, no change needed
                  }}
                >
                  Saqlash
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RestoreDialog
        isOpen={restoreDialog.isOpen}
        onClose={() => setRestoreDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={executeRestore}
        title="O'quvchini tiklash"
        description={`"${restoreDialog.studentName}" ni tiklashni tasdiqlaysizmi?`}
      />
    </div>
  );
};

export default GroupDetails;
