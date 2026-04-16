import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { logError } from "@/lib/errorUtils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths, parseISO } from "date-fns";
import { uz } from "date-fns/locale";
import { cn, getTashkentDate, getTashkentToday } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DateRange } from "react-day-picker";
import StudentProfileLink from "./StudentProfileLink";

interface Student {
  id: string;
  name: string;
  student_id?: string;
  group_name: string;
  teacher_id: string;
  created_at: string | Timestamp;
  join_date?: string;
  left_date?: string;
  is_active?: boolean;
  archived_at?: string | Timestamp;
}

interface AttendanceRecord {
  student_id: string;
  status: "present" | "late" | "absent_with_reason" | "absent_without_reason";
  date: string;
  notes?: string;
}

interface AttendanceJournalProps {
  teacherId: string;
  groupName: string;
}

const AttendanceJournal: React.FC<AttendanceJournalProps> = ({
  teacherId,
  groupName,
}) => {
  const today = getTashkentToday();
  const [filterMode, setFilterMode] = useState<"all" | "month" | "range">(
    "all",
  );
  const [currentMonth, setCurrentMonth] = useState(getTashkentDate());
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceRecord>
  >({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // O'quvchilarni olish
  const fetchStudents = useCallback(async () => {
    try {
      const q = query(
        collection(db, "students"),
        where("teacher_id", "==", teacherId),
        where("group_name", "==", groupName),
      );
      const snapshot = await getDocs(q);
      const studentsData = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Student)
        .sort((a, b) => a.name.localeCompare(b.name));
      setStudents(studentsData);
    } catch (error) {
      logError("AttendanceJournal:fetchStudents", error);
      toast({
        title: "Xatolik",
        description: "O'quvchilarni olishda xatolik",
        variant: "destructive",
      });
    }
  }, [groupName, teacherId, toast]);

  // Davomat ma'lumotlarini olish
  const fetchAttendance = useCallback(async () => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
      );
      const snapshot = await getDocs(q);
      const attendanceData: Record<string, AttendanceRecord> = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const key = `${data.student_id}_${data.date}`;
        attendanceData[key] = data as AttendanceRecord;
      });
      setAttendance(attendanceData);
    } catch (error) {
      logError("AttendanceJournal:fetchAttendance", error);
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    void fetchStudents();
    void fetchAttendance();
  }, [fetchAttendance, fetchStudents]);

  // Effective join date olish
  const getEffectiveJoinDate = (student: Student): string | null => {
    if (student.join_date) return student.join_date;
    if (student.created_at) {
      if (student.created_at instanceof Timestamp) {
        return format(
          getTashkentDate(student.created_at.toDate()),
          "yyyy-MM-dd",
        );
      } else if (typeof student.created_at === "string") {
        return getTashkentDate(new Date(student.created_at))
          .toISOString()
          .split("T")[0];
      }
    }
    return null;
  };

  // Effective archive date olish
  const getEffectiveArchiveDate = (student: Student): string | null => {
    if (student.left_date) return student.left_date;
    if (student.archived_at) {
      if (student.archived_at instanceof Timestamp) {
        return format(
          getTashkentDate(student.archived_at.toDate()),
          "yyyy-MM-dd",
        );
      } else if (typeof student.archived_at === "string") {
        return getTashkentDate(new Date(student.archived_at))
          .toISOString()
          .split("T")[0];
      } else if (typeof student.archived_at === 'object' && student.archived_at !== null && 'seconds' in student.archived_at && typeof (student.archived_at as { seconds: number }).seconds === 'number') {
        return format(
          getTashkentDate(new Date((student.archived_at as { seconds: number }).seconds * 1000)),
          "yyyy-MM-dd",
        );
      }
    }
    return null;
  };

  // Davomat holatini o'zgartirishazuyi
  const toggleAttendance = async (studentId: string, date: string) => {
    if (date > today) {
      toast({
        title: "Xatolik",
        description: `Kelajakdagi sana uchun davomat belgilab bo'lmaydi`,
        variant: "destructive",
      });
      return;
    }
    const student = students.find((s) => s.id === studentId);
    const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;
    const effectiveArchiveDate = student
      ? getEffectiveArchiveDate(student)
      : null;

    if (effectiveJoinDate && date < effectiveJoinDate) {
      toast({
        title: "Xatolik",
        description: `Bu sana o'quvchining kelgan sanasidan oldin`,
        variant: "destructive",
      });
      return;
    }

    if (effectiveArchiveDate && date > effectiveArchiveDate) {
      toast({
        title: "Xatolik",
        description: `Bu sana o'quvchining ketgan sanasidan keyin`,
        variant: "destructive",
      });
      return;
    }

    const key = `${studentId}_${date}`;
    const current = attendance[key];

    let nextStatus:
      | "present"
      | "late"
      | "absent_with_reason"
      | "absent_without_reason"
      | null = null;

    if (!current) {
      nextStatus = "present";
    } else if (current.status === "present") {
      nextStatus = "late";
    } else if (current.status === "late") {
      nextStatus = "absent_without_reason";
    } else {
      nextStatus = null;
    }

    try {
      const recordId = `${studentId}_${date}`;
      if (nextStatus) {
        await setDoc(doc(db, "attendance_records", recordId), {
          student_id: studentId,
          teacher_id: teacherId,
          date: date,
          status: nextStatus,
        });
        setAttendance((prev) => ({
          ...prev,
          [key]: { student_id: studentId, status: nextStatus!, date },
        }));
      } else {
        await deleteDoc(doc(db, "attendance_records", recordId));
        setAttendance((prev) => {
          const newAttendance = { ...prev };
          delete newAttendance[key];
          return newAttendance;
        });
      }
    } catch (error) {
      logError("AttendanceJournal:updateAttendance", error);
      toast({
        title: "Xatolik",
        description: "Davomatni o'zgartirishda xatolik",
        variant: "destructive",
      });
    }
  };

  // Davomat holati uchun rang
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800 border-green-300 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/40";
      case "late":
        return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40";
      case "absent_with_reason":
      case "absent_without_reason":
        return "bg-red-100 text-red-800 border-red-300 dark:bg-red-500/25 dark:text-red-300 dark:border-red-500/40";
      default:
        return "bg-gray-50 text-gray-600 border-gray-300 dark:bg-muted dark:text-muted-foreground dark:border-border";
    }
  };

  const getStatusSymbol = (status?: string) => {
    switch (status) {
      case "present":
        return "✓";
      case "late":
        return "○";
      case "absent_with_reason":
      case "absent_without_reason":
        return "−";
      default:
        return "";
    }
  };

  const studentIdsInGroup = new Set(students.map((s) => s.id));
  const allLessonDays = [
    ...new Set(
      Object.values(attendance)
        .filter((record) => studentIdsInGroup.has(record.student_id))
        .map((record) => record.date),
    ),
  ];
  const sortedLessonDays = [...allLessonDays].sort();
  const monthStr = format(currentMonth, "yyyy-MM");
  const rangeFromStr = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : null;
  const rangeToStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : null;

  const displayedLessonDays = (() => {
    if (filterMode === "month") {
      return sortedLessonDays.filter((d) => d.startsWith(monthStr));
    }
    if (filterMode === "range") {
      if (rangeFromStr && rangeToStr) {
        return sortedLessonDays.filter(
          (d) => d >= rangeFromStr && d <= rangeToStr,
        );
      }
      if (rangeFromStr) {
        return sortedLessonDays.filter((d) => d === rangeFromStr);
      }
      return [];
    }
    return sortedLessonDays;
  })();

  const getAttendancePercentage = (studentId: string): number => {
    const student = students.find((s) => s.id === studentId);
    const effectiveJoinDate = student ? getEffectiveJoinDate(student) : null;
    const effectiveArchiveDate = student
      ? getEffectiveArchiveDate(student)
      : null;

    const applicableLessonDays = displayedLessonDays.filter(
      (day) =>
        (!effectiveJoinDate || day >= effectiveJoinDate) &&
        (!effectiveArchiveDate || day <= effectiveArchiveDate),
    );

    if (applicableLessonDays.length === 0) {
      return 100;
    }

    const presentDays = applicableLessonDays.filter((day) => {
      const key = `${studentId}_${day}`;
      const record = attendance[key];
      return (
        record && (record.status === "present" || record.status === "late")
      );
    }).length;

    return Math.round((presentDays / applicableLessonDays.length) * 100);
  };

  const buildExportTable = () => {
    const header = [
      "O'quvchi (Foiz)",
      ...displayedLessonDays.map((dateStr) => format(parseISO(dateStr), "d")),
    ];

    const rows = students.map((student) => {
      const studentRow: (string | number)[] = [
        `${student.name} (${getAttendancePercentage(student.id)}%)`,
      ];
      displayedLessonDays.forEach((dateStr) => {
        const key = `${student.id}_${dateStr}`;
        const record = attendance[key];
        const symbol = getStatusSymbol(record?.status);

        const effectiveJoinDate = getEffectiveJoinDate(student);
        const effectiveArchiveDate = getEffectiveArchiveDate(student);
        const isBeforeJoinDate =
          effectiveJoinDate && dateStr < effectiveJoinDate;
        const isAfterArchiveDate =
          effectiveArchiveDate && dateStr > effectiveArchiveDate;
        const isDisabled =
          isBeforeJoinDate || isAfterArchiveDate || dateStr > today;

        studentRow.push(isDisabled ? "" : symbol);
      });
      return studentRow;
    });

    return { header, rows };
  };

  const getPeriodLabel = () => {
    if (filterMode === "month") {
      return format(currentMonth, "MMMM_yyyy", { locale: uz });
    }
    if (filterMode === "range") {
      if (rangeFromStr && rangeToStr) {
        return `${rangeFromStr}_${rangeToStr}`;
      }
      if (rangeFromStr) {
        return rangeFromStr;
      }
      return "Tanlanmagan";
    }
    return "Barchasi";
  };

  const handleExportToExcel = () => {
    const { header, rows } = buildExportTable();
    const excelData = [header, ...rows];

    const ws = XLSX.utils.aoa_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Davomat");

    const periodLabel = getPeriodLabel();
    const fileName = `Davomat_${groupName}_${periodLabel}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleExportToPdf = () => {
    const { header, rows } = buildExportTable();
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const periodLabel = getPeriodLabel();

    doc.setFontSize(14);
    doc.text(`Davomat - ${groupName}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Davr: ${periodLabel}`, 14, 24);

    const head = [header.map((cell) => String(cell))];
    const body = rows.map((r) => r.map((cell) => String(cell ?? "")));

    autoTable(doc, {
      head,
      body,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [240, 240, 240] },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Davomat_${groupName}_${periodLabel}.pdf`);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          Davomat ma'lumotlari yuklanmoqda...
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-3 sm:p-4 w-full min-w-0">
        {/* Filter controls */}
        <div className="flex flex-col gap-2 sm:gap-3 mb-4">
          {/* Row 1: Filter type + period controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filterMode}
              onValueChange={(v) => setFilterMode(v as "all" | "month" | "range")}
            >
              <SelectTrigger className="w-[110px] xs:w-[140px] sm:w-[160px] text-xs sm:text-sm h-8 sm:h-9">
                <SelectValue placeholder="Filtr" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                <SelectItem value="month">Oy bo'yicha</SelectItem>
                <SelectItem value="range">Sana oralig'i</SelectItem>
              </SelectContent>
            </Select>

            {filterMode === "month" && (
              <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 xs:flex-none xs:w-[130px] sm:w-48 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9 min-w-0"
                    >
                      <CalendarIcon className="mr-1 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">
                        <span className="hidden sm:inline">
                          {format(currentMonth, "MMMM yyyy", { locale: uz })}
                        </span>
                        <span className="sm:hidden">
                          {format(currentMonth, "MMM yy", { locale: uz })}
                        </span>
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentMonth}
                      onSelect={(date) => date && setCurrentMonth(date)}
                      initialFocus
                      locale={uz}
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="h-8 w-8 p-0 flex-shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {filterMode === "range" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex-1 xs:flex-none xs:min-w-[200px] justify-start text-xs sm:text-sm h-8 sm:h-9 truncate"
                  >
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">
                      {rangeFromStr && rangeToStr
                        ? `${rangeFromStr} — ${rangeToStr}`
                        : rangeFromStr
                          ? rangeFromStr
                          : "Sana tanlang"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0"
                  align="start"
                  sideOffset={8}
                >
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={1}
                    initialFocus
                    locale={uz}
                  />
                </PopoverContent>
              </Popover>
            )}

            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {displayedLessonDays.length} dars kuni
            </div>
          </div>

          {/* Row 2: Export buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleExportToExcel}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-1 xs:flex-none text-xs sm:text-sm h-8 sm:h-9"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline">Excel chiqarish</span>
              <span className="xs:hidden">Excel</span>
            </Button>
            <Button
              onClick={handleExportToPdf}
              variant="outline"
              size="sm"
              className="gap-1.5 flex-1 xs:flex-none text-xs sm:text-sm h-8 sm:h-9"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden xs:inline">PDF chiqarish</span>
              <span className="xs:hidden">PDF</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-3 sm:-mx-4">
          <div className="min-w-full inline-block align-middle px-3 sm:px-4">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-muted/80 dark:bg-muted border border-border px-2 sm:px-3 py-2 text-left text-xs sm:text-sm font-semibold w-[120px] xs:w-[148px] sm:w-[180px] z-10 text-foreground">
                    <span className="hidden xs:inline">O'quvchi (Foiz)</span>
                    <span className="xs:hidden">O'quvchi</span>
                  </th>
                  {displayedLessonDays.map((dateStr) => {
                    const day = parseISO(dateStr);
                    return (
                      <th
                        key={dateStr}
                        className="border border-border px-0.5 sm:px-1.5 py-1 sm:py-2 text-center text-xs font-medium bg-muted/80 dark:bg-muted min-w-[32px] sm:min-w-[40px] text-foreground"
                      >
                        <div className="text-foreground text-[11px] sm:text-xs font-semibold">
                          {format(day, "d")}
                        </div>
                        <div className="text-muted-foreground text-[9px] sm:text-[10px]">
                          {format(day, "EEE", { locale: uz }).substring(0, 2)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {displayedLessonDays.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      Tanlangan davrda dars o'tilmagan
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td
                      colSpan={displayedLessonDays.length + 1}
                      className="text-center py-8 text-muted-foreground text-sm"
                    >
                      O'quvchilar topilmadi
                    </td>
                  </tr>
                ) : (
                  students.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <td className="sticky left-0 bg-background dark:bg-card border border-border px-2 sm:px-3 py-1 sm:py-2 font-medium text-xs sm:text-sm z-10 w-[120px] xs:w-[148px] sm:w-[180px]">
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <StudentProfileLink
                            studentId={student.id}
                            className="truncate text-inherit hover:text-primary min-w-0 flex-1 text-xs sm:text-sm"
                          >
                            {student.name}
                          </StudentProfileLink>
                          <span
                            className={cn(
                              "flex-shrink-0 inline-block px-1 py-0.5 rounded text-[10px] font-semibold",
                              getAttendancePercentage(student.id) >= 75
                                ? "bg-green-100 text-green-700 dark:bg-emerald-500/25 dark:text-emerald-300"
                                : getAttendancePercentage(student.id) >= 50
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-amber-500/25 dark:text-amber-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300",
                            )}
                          >
                            {getAttendancePercentage(student.id)}%
                          </span>
                        </div>
                      </td>
                      {displayedLessonDays.map((dateStr) => {
                        const key = `${student.id}_${dateStr}`;
                        const record = attendance[key];
                        const effectiveJoinDate = getEffectiveJoinDate(student);
                        const effectiveArchiveDate =
                          getEffectiveArchiveDate(student);

                        const isBeforeJoinDate =
                          effectiveJoinDate && dateStr < effectiveJoinDate;
                        const isAfterArchiveDate =
                          effectiveArchiveDate &&
                          dateStr > effectiveArchiveDate;
                        const isFutureDate = dateStr > today;
                        const isDisabled =
                          isBeforeJoinDate ||
                          isAfterArchiveDate ||
                          isFutureDate;
                        const effectiveRecord =
                          isBeforeJoinDate || isAfterArchiveDate
                            ? undefined
                            : record;

                        let tooltipText = "";
                        if (isFutureDate) {
                          tooltipText = "Kelajak uchun belgilab bo'lmaydi";
                        } else if (isBeforeJoinDate) {
                          tooltipText = `O'quvchi ${format(parseISO(effectiveJoinDate!), "d-MM-yyyy", { locale: uz })} da qo'shilgan.`;
                        } else if (isAfterArchiveDate) {
                          tooltipText = `O'quvchi ${format(parseISO(effectiveArchiveDate!), "d-MM-yyyy", { locale: uz })} da chiqib ketgan.`;
                        }

                        return (
                          <td
                            key={key}
                            className="border border-border p-0.5 text-center min-w-[32px] sm:min-w-[40px]"
                          >
                            <button
                              onClick={() =>
                                !isDisabled &&
                                toggleAttendance(student.id, dateStr)
                              }
                              disabled={isDisabled}
                              className={cn(
                                "w-full py-1 sm:py-1.5 px-0.5 border-2 rounded font-bold text-xs transition-colors",
                                isDisabled
                                  ? "opacity-30 cursor-not-allowed"
                                  : "cursor-pointer hover:opacity-80 active:scale-95",
                                getStatusColor(effectiveRecord?.status),
                              )}
                              title={tooltipText}
                            >
                              {getStatusSymbol(effectiveRecord?.status) || "−"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm border-t border-border pt-3 sm:pt-4 text-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 text-green-800 border border-green-300 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/40 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              ✓
            </div>
            <span>Kelgan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              ○
            </div>
            <span>Kech kelgan</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-red-100 text-red-800 border border-red-300 dark:bg-red-500/25 dark:text-red-300 dark:border-red-500/40 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              −
            </div>
            <span>Kelmadi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-50 text-gray-600 border border-gray-300 dark:bg-muted dark:text-muted-foreground dark:border-border rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0">
              −
            </div>
            <span>Ma'lumot yo'q</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AttendanceJournal;
