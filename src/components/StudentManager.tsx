import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logError } from "@/lib/errorUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Edit2,
  Archive,
  Gift,
  AlertTriangle,
  Search,
  List,
  LayoutGrid,
  Calendar as CalendarIcon,
  CheckSquare,
  Square,
  Trash2,
  Download,
  Trophy,
  Award,
  BarChart3,
  Clock,
  User as UserIcon,
  TrendingUp,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { uz } from "date-fns/locale";
import {
  cn,
  formatDateUz,
  getTashkentToday,
  getTashkentDate,
} from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { z } from "zod";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { StudentScoreResult } from "@/lib/studentScoreCalculator";
import StudentImport from "./StudentImport";
import StudentProfileLink from "./StudentProfileLink";
import ConfirmDialog from "./ConfirmDialog";

// Validation schema
const studentSchema = z.object({
  name: z.string().min(2, "Ism kamida 2 ta harfdan iborat bo'lishi kerak"),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana noto'g'ri formatda"),
  student_id: z.string().optional(),
  email: z
    .string()
    .email("Noto'g'ri email format")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .min(9, "Telefon raqam noto'g'ri")
    .optional()
    .or(z.literal("")),
});

const formatValidationError = (error: z.ZodError) => {
  return error.errors.map((err) => err.message).join(", ");
};

const calculateStats = (
  studentId: string,
  joinDateStr: string | undefined,
  createdAt: any,
  attendanceRecords: any[],
  rewardRecords: any[],
  groupDates: Set<string>,
): StudentScoreResult => {
  // Join date logic
  let joinDate = joinDateStr || "";
  if (!joinDate) {
    if (createdAt instanceof Timestamp) {
      joinDate = getTashkentDate(createdAt.toDate())
        .toISOString()
        .split("T")[0];
    } else if (typeof createdAt === "string") {
      joinDate = getTashkentDate(new Date(createdAt))
        .toISOString()
        .split("T")[0];
    }
  }

  // Total classes for this student (based on group history after join date)
  const totalClasses = Array.from(groupDates).filter(
    (d) => d >= joinDate,
  ).length;

  // Student's attendance records
  const studentAttendance = attendanceRecords.filter(
    (a) => a.student_id === studentId && a.date >= joinDate,
  );

  const presentCount = studentAttendance.filter(
    (a) => a.status === "present",
  ).length;
  const lateCount = studentAttendance.filter((a) => a.status === "late").length;
  // const excusedAbsentCount = studentAttendance.filter(a => a.status === 'absent_with_reason').length;
  const unexcusedAbsentCount = studentAttendance.filter(
    (a) => a.status === "absent_without_reason",
  ).length;
  const absentCount = Math.max(0, totalClasses - presentCount - lateCount);

  const attendancePercentage =
    totalClasses > 0
      ? Math.round(((presentCount + lateCount) / totalClasses) * 100)
      : 0;

  const attendancePoints = presentCount * 1 + lateCount * 0.5; // Constants from calculator

  // Rewards
  const studentRewards = rewardRecords.filter(
    (r) => r.student_id === studentId && r.date >= joinDate,
  );
  let mukofotPoints = 0;
  let jarimaPoints = 0;
  let bahoScore = 0;
  let bahoCount = 0;

  studentRewards.forEach((r: any) => {
    const p = Number(r.points || 0);
    if (r.type === "Mukofot") mukofotPoints += p;
    else if (r.type === "Jarima") jarimaPoints += p;
    else if (r.type === "Baho") {
      bahoScore += p;
      bahoCount++;
    }
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
    efficiency: attendancePercentage,
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
  onStatsUpdate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [rewardRecords, setRewardRecords] = useState<any[]>([]);

  // UI States
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(),
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("list"); // Kept for compatibility but we prioritize list/table
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  // Advanced Filters & Sort
  const [filterAttendance, setFilterAttendance] = useState<[number, number]>([
    0, 100,
  ]);
  const [filterPoints, setFilterPoints] = useState<[number, number]>([
    -1000, 1000,
  ]);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState<
    "all" | "risk" | "top" | "negative" | "no-attendance"
  >("all");

  // Form State
  const [newStudent, setNewStudent] = useState({
    name: "",
    join_date: getTashkentToday(),
    student_id: "",
    email: "",
    phone: "",
    group_name: "",
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    studentId: string;
    studentName: string;
  }>({
    isOpen: false,
    studentId: "",
    studentName: "",
  });

  const { toast } = useToast();

  const fetchStudents = useCallback(async () => {
    const q = query(
      collection(db, "students"),
      where("teacher_id", "==", teacherId),
      where("is_active", "==", true),
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Student,
    );
    setStudents(data);
  }, [teacherId]);

  const fetchGroups = useCallback(async () => {
    const q = query(
      collection(db, "groups"),
      where("teacher_id", "==", teacherId),
      where("is_active", "==", true),
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Group)
      .sort((a, b) => a.name.localeCompare(b.name));
    setGroups(data);
  }, [teacherId]);

  const fetchAttendance = useCallback(async () => {
    const q = query(
      collection(db, "attendance_records"),
      where("teacher_id", "==", teacherId),
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ ...doc.data() }));
    setAttendanceRecords(data);
  }, [teacherId]);

  const fetchRewards = useCallback(async () => {
    const q = query(
      collection(db, "reward_penalty_history"),
      where("teacher_id", "==", teacherId),
    );
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ ...doc.data() }));
    setRewardRecords(data);
  }, [teacherId]);

  const realtimeStatsCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchStudents(),
          fetchGroups(),
          fetchAttendance(),
          fetchRewards(),
        ]);
      } catch (error) {
        logError("StudentManager:loadData", error);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [fetchStudents, fetchGroups, fetchAttendance, fetchRewards]);

  useEffect(() => {
    if (!teacherId) return;

    type RealtimeResource = "students" | "groups" | "attendance" | "rewards";
    const pendingResources = new Set<RealtimeResource>();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshInFlight = false;

    const scheduleStatsUpdate = () => {
      if (!onStatsUpdate) return;
      if (realtimeStatsCooldownRef.current) {
        return;
      }
      realtimeStatsCooldownRef.current = setTimeout(() => {
        realtimeStatsCooldownRef.current = null;
      }, 250);
      void onStatsUpdate();
    };

    const flushRefresh = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        while (pendingResources.size > 0) {
          const batch = new Set(pendingResources);
          pendingResources.clear();
          const tasks: Promise<unknown>[] = [];
          const statsAffected =
            batch.has("students") ||
            batch.has("attendance") ||
            batch.has("rewards");

          if (batch.has("students")) tasks.push(fetchStudents());
          if (batch.has("groups")) tasks.push(fetchGroups());
          if (batch.has("attendance")) tasks.push(fetchAttendance());
          if (batch.has("rewards")) tasks.push(fetchRewards());

          if (tasks.length > 0) {
            await Promise.all(tasks);
          }
          if (statsAffected) {
            scheduleStatsUpdate();
          }
        }
      } catch (error) {
        logError("StudentManager:flushRealtimeRefresh", error);
      } finally {
        refreshInFlight = false;
      }
    };

    const scheduleRefresh = (resource: RealtimeResource) => {
      pendingResources.add(resource);
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        void flushRefresh();
      }, 120);
    };

    const studentsQ = query(
      collection(db, "students"),
      where("teacher_id", "==", teacherId),
      where("is_active", "==", true),
    );
    const groupsQ = query(
      collection(db, "groups"),
      where("teacher_id", "==", teacherId),
      where("is_active", "==", true),
    );
    const attendanceQ = query(
      collection(db, "attendance_records"),
      where("teacher_id", "==", teacherId),
    );
    const rewardsQ = query(
      collection(db, "reward_penalty_history"),
      where("teacher_id", "==", teacherId),
    );

    const unsubs = [
      onSnapshot(
        studentsQ,
        () => scheduleRefresh("students"),
        (error) => logError("StudentManager:studentsSnapshot", error),
      ),
      onSnapshot(
        groupsQ,
        () => scheduleRefresh("groups"),
        (error) => logError("StudentManager:groupsSnapshot", error),
      ),
      onSnapshot(
        attendanceQ,
        () => scheduleRefresh("attendance"),
        (error) => logError("StudentManager:attendanceSnapshot", error),
      ),
      onSnapshot(
        rewardsQ,
        () => scheduleRefresh("rewards"),
        (error) => logError("StudentManager:rewardsSnapshot", error),
      ),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      pendingResources.clear();
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      if (realtimeStatsCooldownRef.current) {
        clearTimeout(realtimeStatsCooldownRef.current);
        realtimeStatsCooldownRef.current = null;
      }
    };
  }, [
    teacherId,
    fetchStudents,
    fetchGroups,
    fetchAttendance,
    fetchRewards,
    onStatsUpdate,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Compute stats for all students
  const studentsWithStats = useMemo(() => {
    if (students.length === 0) return [];

    // Group dates map: Group Name -> Set of Dates
    const groupDatesMap: Record<string, Set<string>> = {};

    // Populate group dates from attendance records
    // We try to infer group from the student in the record if possible, or we iterate students
    // Since attendance record might not have group_name, we use the student map
    const studentGroupMap = new Map(students.map((s) => [s.id, s.group_name]));

    attendanceRecords.forEach((record) => {
      const studentId = record.student_id;
      const groupName = studentGroupMap.get(studentId);
      if (groupName && record.date) {
        // Date Range Filter logic
        if (dateRange && dateRange.from && dateRange.to) {
          const rDate = new Date(record.date);
          // Reset time part for accurate comparison if needed, but standard Date comparison works if initialized correctly
          // Assuming record.date is YYYY-MM-DD string
          const rDateStr = record.date;
          const fromStr = getTashkentDate(dateRange.from)
            .toISOString()
            .split("T")[0];
          const toStr = getTashkentDate(dateRange.to)
            .toISOString()
            .split("T")[0];

          if (rDateStr < fromStr || rDateStr > toStr) return;
        }

        if (!groupDatesMap[groupName]) {
          groupDatesMap[groupName] = new Set();
        }
        groupDatesMap[groupName].add(record.date);
      }
    });

    return students.map((student) => {
      const groupDates = groupDatesMap[student.group_name] || new Set();

      let filteredAttendance = attendanceRecords;
      let filteredRewards = rewardRecords;

      if (dateRange && dateRange.from && dateRange.to) {
        const fromStr = getTashkentDate(dateRange.from)
          .toISOString()
          .split("T")[0];
        const toStr = getTashkentDate(dateRange.to).toISOString().split("T")[0];

        filteredAttendance = attendanceRecords.filter(
          (r) => r.date >= fromStr && r.date <= toStr,
        );
        filteredRewards = rewardRecords.filter(
          (r) => r.date >= fromStr && r.date <= toStr,
        );
      }

      const stats = calculateStats(
        student.id,
        student.join_date,
        student.created_at,
        filteredAttendance,
        filteredRewards,
        groupDates,
      );
      return { ...student, stats };
    });
  }, [students, attendanceRecords, rewardRecords, dateRange]);

  // Filtering and Sorting
  const filteredStudents = useMemo(() => {
    let filtered = studentsWithStats;

    // Group Filter
    if (selectedGroup !== "all") {
      filtered = filtered.filter(
        (student) => student.group_name === selectedGroup,
      );
    }

    // Search Filter
    if (debouncedSearchTerm) {
      const lowerSearch = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(lowerSearch) ||
          (student.student_id &&
            student.student_id.toLowerCase().includes(lowerSearch)),
      );
    }

    // Advanced Stats Filters
    filtered = filtered.filter((student) => {
      const att = student.stats.attendancePercentage;
      const pts = student.stats.totalScore;

      const attMatch = att >= filterAttendance[0] && att <= filterAttendance[1];
      const ptsMatch = pts >= filterPoints[0] && pts <= filterPoints[1];

      return attMatch && ptsMatch;
    });

    if (quickFilter === "risk") {
      filtered = filtered.filter(
        (student) => student.stats.attendancePercentage < 70,
      );
    } else if (quickFilter === "top") {
      filtered = filtered.filter(
        (student) =>
          student.stats.attendancePercentage >= 90 &&
          student.stats.totalScore >= 0,
      );
    } else if (quickFilter === "negative") {
      filtered = filtered.filter((student) => student.stats.totalScore < 0);
    } else if (quickFilter === "no-attendance") {
      filtered = filtered.filter((student) => student.stats.totalClasses === 0);
    }

    // Sorting
    if (sortConfig) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Student];
        let bValue: any = b[sortConfig.key as keyof Student];

        // Handle nested stats keys
        if (sortConfig.key === "attendance") {
          aValue = a.stats.attendancePercentage;
          bValue = b.stats.attendancePercentage;
        } else if (sortConfig.key === "points") {
          aValue = a.stats.totalScore;
          bValue = b.stats.totalScore;
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by name
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [
    studentsWithStats,
    selectedGroup,
    debouncedSearchTerm,
    filterAttendance,
    filterPoints,
    sortConfig,
    quickFilter,
  ]);

  const totalStudents = filteredStudents.length;
  const avgAttendance =
    totalStudents > 0
      ? Math.round(
          filteredStudents.reduce(
            (acc, s) => acc + s.stats.attendancePercentage,
            0,
          ) / totalStudents,
        )
      : 0;
  const avgScore =
    totalStudents > 0
      ? filteredStudents.reduce((acc, s) => acc + s.stats.totalScore, 0) /
        totalStudents
      : 0;
  const insights = useMemo(() => {
    const riskStudents = filteredStudents.filter(
      (s) => s.stats.attendancePercentage < 70,
    );
    const topStudents = filteredStudents.filter(
      (s) => s.stats.attendancePercentage >= 90 && s.stats.totalScore >= 0,
    );
    const negativeStudents = filteredStudents.filter(
      (s) => s.stats.totalScore < 0,
    );
    const noAttendanceStudents = filteredStudents.filter(
      (s) => s.stats.totalClasses === 0,
    );
    const attendanceBuckets = [
      { label: "0-59%", min: 0, max: 59 },
      { label: "60-74%", min: 60, max: 74 },
      { label: "75-89%", min: 75, max: 89 },
      { label: "90-100%", min: 90, max: 100 },
    ].map((bucket) => {
      const count = filteredStudents.filter((s) => {
        const value = s.stats.attendancePercentage;
        return value >= bucket.min && value <= bucket.max;
      }).length;
      return { ...bucket, count };
    });
    const riskList = [...riskStudents]
      .sort(
        (a, b) => a.stats.attendancePercentage - b.stats.attendancePercentage,
      )
      .slice(0, 5);
    return {
      riskStudents,
      topStudents,
      negativeStudents,
      noAttendanceStudents,
      attendanceBuckets,
      riskList,
    };
  }, [filteredStudents]);

  // Actions
  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return current.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
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
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  // Handlers for Add/Edit/Archive/Export (kept similar to before but updated for new structure)
  const addStudent = async () => {
    if (!newStudent.group_name) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Guruhni tanlashingiz shart",
        variant: "destructive",
      });
      return;
    }
    try {
      studentSchema.parse(newStudent);
      await addDoc(collection(db, "students"), {
        teacher_id: teacherId,
        name: newStudent.name.trim(),
        join_date: newStudent.join_date,
        student_id: newStudent.student_id.trim() || null,
        email: newStudent.email.trim() || null,
        phone: newStudent.phone.trim() || null,
        group_name: newStudent.group_name,
        is_active: true,
        created_at: serverTimestamp(),
      });
      if (onStatsUpdate) {
        void onStatsUpdate();
      }
      setNewStudent({
        name: "",
        join_date: getTashkentToday(),
        student_id: "",
        email: "",
        phone: "",
        group_name: "",
      });
      setIsAddDialogOpen(false);
      toast({
        title: "O'quvchi qo'shildi",
        description: `"${newStudent.name}" muvaffaqiyatli qo'shildi`,
      });
    } catch (error) {
      logError("StudentManager:handleCreateStudent", error);
      toast({
        title: "Xatolik",
        description: "Xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const editStudent = async () => {
    if (!editingStudent) return;
    try {
      await updateDoc(doc(db, "students", editingStudent.id), {
        name: editingStudent.name.trim(),
        student_id: editingStudent.student_id?.trim() || null,
        email: editingStudent.email?.trim() || null,
        phone: editingStudent.phone?.trim() || null,
        group_name: editingStudent.group_name,
      });
      if (onStatsUpdate) {
        void onStatsUpdate();
      }
      setIsEditDialogOpen(false);
      setEditingStudent(null);
      toast({
        title: "Yangilandi",
        description: "O'quvchi ma'lumotlari yangilandi",
      });
    } catch (error) {
      logError("StudentManager:handleEditStudent", error);
      toast({
        title: "Xatolik",
        description: "Xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const archiveStudent = (studentId: string, studentName: string) => {
    setConfirmDialog({ isOpen: true, studentId, studentName });
  };

  const executeArchiveStudent = async () => {
    const { studentId, studentName } = confirmDialog;
    try {
      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      await addDoc(collection(db, "archived_students"), {
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
        archived_at: serverTimestamp(),
      });

      await updateDoc(doc(db, "students", studentId), {
        is_active: false,
        left_date: getTashkentToday(),
        archived_at: serverTimestamp(),
      });

      if (onStatsUpdate) {
        void onStatsUpdate();
      }
      toast({
        title: "Arxivlandi",
        description: `"${studentName}" arxivlandi`,
      });
    } catch (error) {
      logError("StudentManager:handleArchiveStudent", error);
      toast({
        title: "Xatolik",
        description: "Xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleBatchArchive = async () => {
    if (
      !window.confirm(
        `${selectedStudentIds.size} ta o'quvchini arxivlashni tasdiqlaysizmi?`,
      )
    )
      return;
    setLoading(true);
    try {
      for (const studentId of Array.from(selectedStudentIds)) {
        const student = students.find((s) => s.id === studentId);
        if (student) {
          await addDoc(collection(db, "archived_students"), {
            original_student_id: studentId,
            teacher_id: teacherId,
            name: student.name,
            group_name: student.group_name,
            archived_at: serverTimestamp(),
            left_date: getTashkentToday(),
          });
          await updateDoc(doc(db, "students", studentId), {
            is_active: false,
            left_date: getTashkentToday(),
            archived_at: serverTimestamp(),
          });
        }
      }
      setSelectedStudentIds(new Set());
      if (onStatsUpdate) {
        void onStatsUpdate();
      }
      toast({ title: "Muvaffaqiyat", description: "O'quvchilar arxivlandi" });
    } catch (error) {
      logError("StudentManager:handleDeleteStudent", error);
      toast({
        title: "Xatolik",
        description: "Xatolik yuz berdi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportStudents = (format: "excel" | "pdf") => {
    const exportList =
      selectedStudentIds.size > 0
        ? studentsWithStats.filter((s) => selectedStudentIds.has(s.id))
        : filteredStudents;

    if (exportList.length === 0) {
      toast({
        title: "Xatolik",
        description: "Export uchun o'quvchilar yo'q",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Ism",
      "Guruh",
      "Davomat %",
      "Jami Ball",
      "Kelgan",
      "Kech",
      "Sababsiz",
      "Telefon",
    ];
    const body = exportList.map((s) => [
      s.name,
      s.group_name,
      `${s.stats.attendancePercentage}%`,
      s.stats.totalScore.toFixed(1),
      s.stats.presentCount,
      s.stats.lateCount,
      s.stats.unexcusedAbsentCount,
      s.phone || "",
    ]);

    if (format === "excel") {
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
        startY: 20,
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">O'quvchilar tahlili</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            O'quvchilar davomati va natijalarini tahlil qiling
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 flex-1 sm:flex-none">
                <Download className="w-3.5 h-3.5" />
                <span className="sm:inline">Yuklash</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportStudents("excel")}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportStudents("pdf")}>
                <FileText className="w-4 h-4 mr-2 text-red-600" />
                PDF (.pdf)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <StudentImport
            teacherId={teacherId}
            groupName={selectedGroup !== "all" ? selectedGroup : undefined}
            onImportComplete={async () => {
              if (onStatsUpdate) {
                void onStatsUpdate();
              }
            }}
            availableGroups={groups}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-3 shadow-sm border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Jami o'quvchilar</p>
              <h3 className="text-xl font-bold text-foreground leading-none mt-0.5">{totalStudents}</h3>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 shadow-sm border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">O'rtacha davomat</p>
              <h3 className="text-xl font-bold text-foreground leading-none mt-0.5">{avgAttendance}%</h3>
            </div>
          </div>
        </Card>
        
        <Card className="p-3 shadow-sm border rounded-lg col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">O'rtacha ball</p>
              <h3 className="text-xl font-bold text-foreground leading-none mt-0.5">{avgScore.toFixed(1)}</h3>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-3 shadow-sm border rounded-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Tezkor tahlil
            </div>
          </div>
          <div className="flex overflow-x-auto pb-1 -mb-1 sm:pb-0 sm:mb-0 hide-scrollbar gap-1.5 w-full sm:w-auto">
            <Button
              size="sm"
              variant={quickFilter === "all" ? "secondary" : "ghost"}
              onClick={() => setQuickFilter("all")}
              className="h-7 text-xs px-3 rounded-md flex-shrink-0"
            >
              Barchasi
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "risk" ? "secondary" : "ghost"}
              onClick={() => setQuickFilter("risk")}
              className={cn(
                "h-7 text-xs px-3 rounded-md flex-shrink-0",
                quickFilter === "risk" && "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
              )}
            >
              Riskli
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "top" ? "secondary" : "ghost"}
              onClick={() => setQuickFilter("top")}
              className={cn(
                "h-7 text-xs px-3 rounded-md flex-shrink-0",
                quickFilter === "top" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
              )}
            >
              Yuqori
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "negative" ? "secondary" : "ghost"}
              onClick={() => setQuickFilter("negative")}
              className="h-7 text-xs px-3 rounded-md flex-shrink-0"
            >
              Manfiy
            </Button>
            <Button
              size="sm"
              variant={quickFilter === "no-attendance" ? "secondary" : "ghost"}
              onClick={() => setQuickFilter("no-attendance")}
              className="h-7 text-xs px-3 rounded-md flex-shrink-0"
            >
              Davomat yo'q
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="border rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Kategoriyalar</div>
            <div className="flex items-center justify-between text-sm">
              <span>Riskli davomat (&lt;70%)</span>
              <Badge variant="destructive">
                {insights.riskStudents.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Yuqori natija (90%+)</span>
              <Badge variant="secondary">{insights.topStudents.length}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Manfiy ball</span>
              <Badge variant="secondary">
                {insights.negativeStudents.length}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Davomat yo'q</span>
              <Badge variant="secondary">
                {insights.noAttendanceStudents.length}
              </Badge>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="text-sm font-medium">Davomat taqsimoti</div>
            {insights.attendanceBuckets.map((bucket) => {
              const percent =
                totalStudents > 0
                  ? Math.round((bucket.count / totalStudents) * 100)
                  : 0;
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
              <div className="text-sm text-muted-foreground">
                Riskli o'quvchilar yo'q
              </div>
            ) : (
              <div className="space-y-2">
                {insights.riskList.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        <StudentProfileLink
                          studentId={student.id}
                          className="text-inherit hover:text-primary"
                        >
                          {student.name}
                        </StudentProfileLink>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {student.group_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {student.stats.attendancePercentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {student.stats.totalScore.toFixed(1)} ball
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Filters & Search */}
      <Card className="p-3 sm:p-4 apple-card space-y-2.5 sm:space-y-3">
        {/* Row 1: Search + Group */}
        <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Ism yoki ID bo'yicha qidirish..."
              className="pl-9 text-sm h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-full xs:w-[160px] sm:w-[200px] h-9 text-sm">
              <SelectValue placeholder="Barcha guruhlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.name}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: Date range + Filters */}
        <div className="flex flex-wrap gap-2">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "gap-1.5 sm:gap-2 justify-start text-left font-normal flex-1 xs:flex-none xs:min-w-[180px] sm:min-w-[200px] h-9 text-xs sm:text-sm",
                  !dateRange && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd.MM.yy")} -{" "}
                        {format(dateRange.to, "dd.MM.yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd.MM.yy", { locale: uz })
                    )
                  ) : (
                    "Sana oralig'i"
                  )}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={1}
                locale={uz}
              />
              <div className="p-3 border-t flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateRange(undefined);
                    setIsCalendarOpen(false);
                  }}
                >
                  Tozalash
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="gap-1.5 sm:gap-2 h-9 text-xs sm:text-sm"
              >
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Filtrlar
                {(filterAttendance[0] > 0 ||
                  filterAttendance[1] < 100 ||
                  filterPoints[0] > -1000) && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1">
                    !
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[calc(100vw-2rem)] xs:w-80 max-w-80 p-4"
              align="end"
              sideOffset={8}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Davomat (%)</Label>
                    <span className="text-xs text-muted-foreground">
                      {filterAttendance[0]}% - {filterAttendance[1]}%
                    </span>
                  </div>
                  <Slider
                    defaultValue={[0, 100]}
                    value={[filterAttendance[0], filterAttendance[1]]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={(val) =>
                      setFilterAttendance([val[0], val[1]])
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Ballar</Label>
                    <span className="text-xs text-muted-foreground">
                      {filterPoints[0]} dan {filterPoints[1]} gacha
                    </span>
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterAttendance([0, 100]);
                      setFilterPoints([-1000, 1000]);
                    }}
                  >
                    Tozalash
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* ── Main Student List ── */}
      <Card className="apple-card overflow-hidden">
        {/* Toolbar */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAllSelection}
              className="text-xs sm:text-sm h-8"
            >
              {selectedStudentIds.size === filteredStudents.length &&
              filteredStudents.length > 0 ? (
                <CheckSquare className="w-4 h-4 mr-1.5" />
              ) : (
                <Square className="w-4 h-4 mr-1.5" />
              )}
              {selectedStudentIds.size > 0
                ? `${selectedStudentIds.size} ta tanlandi`
                : "Hammasini tanlash"}
            </Button>
            {selectedStudentIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchArchive}
                className="text-xs h-8"
              >
                <Archive className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden xs:inline">Arxivlash</span>
                <span className="xs:hidden">{selectedStudentIds.size}</span>
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {filteredStudents.length} ta o'quvchi
          </span>
        </div>

        {/* ── MOBILE card list (hidden on sm+) ── */}
        <div className="sm:hidden divide-y divide-border">
          {filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              O'quvchilar topilmadi
            </div>
          ) : (
            filteredStudents.map((student) => {
              const attPct = student.stats.attendancePercentage;
              const avatarBg =
                attPct >= 90
                  ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                  : attPct >= 70
                    ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white"
                    : attPct >= 50
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                      : "bg-gradient-to-br from-red-400 to-red-600 text-white";
              const isRiskStudent = attPct < 70 || student.stats.totalScore < 0;
              const isTopStudent =
                attPct >= 90 && student.stats.totalScore >= 0;
              const totalScore = student.stats.totalScore;

              return (
                <div
                  key={student.id}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-3 transition-colors",
                    isRiskStudent && "bg-red-50/40 dark:bg-red-500/10",
                    isTopStudent && "bg-emerald-50/40 dark:bg-emerald-500/10",
                    selectedStudentIds.has(student.id) &&
                      "bg-blue-50 dark:bg-blue-500/15",
                  )}
                >
                  {/* Checkbox */}
                  <div
                    onClick={() => toggleStudentSelection(student.id)}
                    className="flex-shrink-0 cursor-pointer p-2 -ml-2"
                  >
                    {selectedStudentIds.has(student.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm",
                      avatarBg,
                    )}
                  >
                    {student.name.substring(0, 2).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <StudentProfileLink
                        studentId={student.id}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors truncate"
                      >
                        {student.name}
                      </StudentProfileLink>
                      {isTopStudent && (
                        <Trophy className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )}
                      {isRiskStudent && (
                        <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Group + ID */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 h-4 bg-muted font-normal"
                      >
                        {student.group_name}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {student.student_id || "ID yo'q"}
                      </span>
                    </div>

                    {/* Progress + score */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-bold",
                              attPct >= 90
                                ? "text-emerald-600 dark:text-emerald-400"
                                : attPct >= 70
                                  ? "text-blue-600 dark:text-blue-400"
                                  : attPct >= 50
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-red-600 dark:text-red-400",
                            )}
                          >
                            {attPct}%
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {student.stats.presentCount +
                              student.stats.lateCount}
                            /{student.stats.totalClasses}
                          </span>
                        </div>
                        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                              attPct >= 90
                                ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                : attPct >= 70
                                  ? "bg-gradient-to-r from-blue-400 to-blue-500"
                                  : attPct >= 50
                                    ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                    : "bg-gradient-to-r from-red-400 to-red-500",
                            )}
                            style={{ width: `${attPct}%` }}
                          />
                        </div>
                      </div>
                      {/* Total score badge */}
                      <span
                        className={cn(
                          "flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border",
                          totalScore >= 10
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30"
                            : totalScore >= 0
                              ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30"
                              : "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
                        )}
                      >
                        {totalScore >= 0 ? "+" : ""}
                        {totalScore.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Actions dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 flex-shrink-0"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() =>
                          navigate(`/students/${student.id}`, {
                            state: {
                              from: `${location.pathname}${location.search}`,
                            },
                          })
                        }
                      >
                        <UserIcon className="w-4 h-4 mr-2" /> Profilni ko'rish
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingStudent(student);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Tahrirlash
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 dark:text-red-400"
                        onClick={() => archiveStudent(student.id, student.name)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Arxivlash
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </div>

        {/* ── DESKTOP table (hidden below sm) ── */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[44px]"></TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Ism{" "}
                    {sortConfig?.key === "name" && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hidden md:table-cell"
                  onClick={() => handleSort("group_name")}
                >
                  <div className="flex items-center gap-1">
                    Guruh{" "}
                    {sortConfig?.key === "group_name" && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer"
                  onClick={() => handleSort("attendance")}
                >
                  <div className="flex items-center gap-1">
                    Davomat{" "}
                    {sortConfig?.key === "attendance" && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hidden lg:table-cell"
                  onClick={() => handleSort("points")}
                >
                  <div className="flex items-center gap-1">
                    Ball{" "}
                    {sortConfig?.key === "points" && (
                      <ArrowUpDown className="w-3 h-3" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-right">Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    O'quvchilar topilmadi
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const attPct = student.stats.attendancePercentage;
                  const avatarBg =
                    attPct >= 90
                      ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white"
                      : attPct >= 70
                        ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white"
                        : attPct >= 50
                          ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                          : "bg-gradient-to-br from-red-400 to-red-600 text-white";
                  const isRiskStudent =
                    attPct < 70 || student.stats.totalScore < 0;
                  const isTopStudent =
                    attPct >= 90 && student.stats.totalScore >= 0;

                  return (
                    <TableRow
                      key={student.id}
                      className={cn(
                        "group transition-all duration-200",
                        "hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-indigo-50/50 dark:hover:bg-none dark:hover:bg-accent",
                        isRiskStudent && "bg-red-50/30 dark:bg-red-500/10",
                        isTopStudent &&
                          "bg-emerald-50/30 dark:bg-emerald-500/10",
                        selectedStudentIds.has(student.id) &&
                          "bg-blue-50 dark:bg-blue-500/15",
                      )}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div
                          onClick={() => toggleStudentSelection(student.id)}
                          className="cursor-pointer p-1 rounded hover:bg-muted transition-colors"
                        >
                          {selectedStudentIds.has(student.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-transform group-hover:scale-105 flex-shrink-0",
                              avatarBg,
                            )}
                          >
                            {student.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <StudentProfileLink
                                studentId={student.id}
                                className="font-semibold text-foreground group-hover:text-primary transition-colors truncate text-sm"
                              >
                                {student.name}
                              </StudentProfileLink>
                              {isTopStudent && (
                                <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              )}
                              {isRiskStudent && (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 flex-shrink-0" />
                              )}
                              
                              {/* Mobile/Tablet Score Badge */}
                              <Badge
                                variant="outline"
                                className={cn(
                                  "lg:hidden text-[10px] px-1.5 py-0 h-4 font-normal",
                                  student.stats.totalScore >= 0
                                    ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300"
                                    : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300"
                                )}
                              >
                                {student.stats.totalScore >= 0 ? "+" : ""}
                                {student.stats.totalScore.toFixed(1)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground truncate">
                                {student.student_id || "ID yo'q"}
                              </span>
                              {/* Mobile/Tablet Group Badge */}
                              <Badge 
                                variant="secondary" 
                                className="md:hidden text-[10px] px-1.5 py-0 h-4 font-normal bg-muted text-muted-foreground"
                              >
                                {student.group_name}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge
                          variant="outline"
                          className="font-medium bg-muted text-xs"
                        >
                          {student.group_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-[120px] sm:w-[140px] space-y-1">
                          <div className="flex justify-between items-center">
                            <span
                              className={cn(
                                "font-bold text-sm",
                                attPct >= 90
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : attPct >= 70
                                    ? "text-blue-600 dark:text-blue-400"
                                    : attPct >= 50
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-red-600 dark:text-red-400",
                              )}
                            >
                              {attPct}%
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {student.stats.presentCount +
                                student.stats.lateCount}
                              /{student.stats.totalClasses}
                            </span>
                          </div>
                          <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                                attPct >= 90
                                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                                  : attPct >= 70
                                    ? "bg-gradient-to-r from-blue-400 to-blue-500"
                                    : attPct >= 50
                                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                                      : "bg-gradient-to-r from-red-400 to-red-500",
                              )}
                              style={{ width: `${attPct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span className="text-green-600 dark:text-emerald-400">
                              ✓{student.stats.presentCount}
                            </span>
                            <span className="text-amber-600">
                              ⏱{student.stats.lateCount}
                            </span>
                            <span className="text-red-600 dark:text-red-400">
                              ✗{student.stats.absentCount}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-col items-start gap-0.5">
                          <Badge
                            className={cn(
                              "font-bold px-2.5 py-0.5 text-xs",
                              student.stats.totalScore >= 10 &&
                                "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/25 dark:text-emerald-300",
                              student.stats.totalScore >= 0 &&
                                student.stats.totalScore < 10 &&
                                "bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300",
                              student.stats.totalScore < 0 &&
                                "bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300",
                            )}
                          >
                            {student.stats.totalScore >= 0 ? "+" : ""}
                            {student.stats.totalScore.toFixed(1)}
                          </Badge>
                          {(student.stats.mukofotPoints > 0 ||
                            student.stats.jarimaPoints > 0) && (
                            <div className="flex gap-1.5 text-[10px]">
                              {student.stats.mukofotPoints > 0 && (
                                <span className="text-green-600 dark:text-emerald-400">
                                  +{student.stats.mukofotPoints}
                                </span>
                              )}
                              {student.stats.jarimaPoints > 0 && (
                                <span className="text-red-600 dark:text-red-400">
                                  -{student.stats.jarimaPoints}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              setEditingStudent(student);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Amallar</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(`/students/${student.id}`, {
                                    state: {
                                      from: `${location.pathname}${location.search}`,
                                    },
                                  })
                                }
                              >
                                <UserIcon className="w-4 h-4 mr-2" /> Profilni
                                ko'rish
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingStudent(student);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-2" /> Tahrirlash
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={() =>
                                  archiveStudent(student.id, student.name)
                                }
                              >
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
        </div>
      </Card>

      {/* Add/Edit/Reward Dialogs */}
      {/* Add/Edit Dialogs */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md sm:w-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>Yangi o'quvchi qo'shish</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="grid gap-2">
              <Label htmlFor="name">F.I.SH <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                value={newStudent.name}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, name: e.target.value })
                }
                placeholder="Masalan: Ali Valiyev"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Guruh <span className="text-red-500">*</span></Label>
                <Select
                  value={newStudent.group_name}
                  onValueChange={(value) =>
                    setNewStudent({ ...newStudent, group_name: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Guruhni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.name}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="join_date">Qo'shilgan sana</Label>
                <Input
                  id="join_date"
                  type="date"
                  value={newStudent.join_date}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, join_date: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon raqam</Label>
                <Input
                  id="phone"
                  value={newStudent.phone}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, phone: e.target.value })
                  }
                  placeholder="+998 90 123 45 67"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="student_id">ID raqam (ixtiyoriy)</Label>
                <Input
                  id="student_id"
                  value={newStudent.student_id}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, student_id: e.target.value })
                  }
                  placeholder="ST-1234"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email (ixtiyoriy)</Label>
              <Input
                id="email"
                type="email"
                value={newStudent.email}
                onChange={(e) =>
                  setNewStudent({ ...newStudent, email: e.target.value })
                }
                placeholder="example@mail.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={addStudent}>Qo'shish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md sm:w-auto rounded-xl">
          <DialogHeader>
            <DialogTitle>O'quvchini tahrirlash</DialogTitle>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-3 py-2">
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
                <Label className="text-sm">Guruh</Label>
                <Select
                  value={editingStudent.group_name}
                  onValueChange={(v) =>
                    setEditingStudent({ ...editingStudent, group_name: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.name}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={editStudent} className="w-full mt-2">
                Saqlash
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
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
