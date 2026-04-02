import React, { useState, useEffect, useCallback } from "react";
import { logError } from "@/lib/errorUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  Users,
  Check,
  X,
  Clock,
  Download,
  Gift,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { uz } from "date-fns/locale";
import { cn, formatDateUz, getTashkentToday } from "@/lib/utils";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import StudentProfileLink from "./StudentProfileLink";

interface Student {
  id: string;
  name: string;
  group_name: string;
  student_id?: string;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: "present" | "absent_with_reason" | "absent_without_reason" | "late";
  notes?: string;
}

interface AttendanceTrackerProps {
  teacherId: string;
  onStatsUpdate: () => Promise<void>;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  teacherId,
  onStatsUpdate,
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(getTashkentToday());
  const [loading, setLoading] = useState(true);
  const [showRewardDialog, setShowRewardDialog] = useState<string | null>(null);
  const [rewardPoints, setRewardPoints] = useState("");
  const [rewardType, setRewardType] = useState<"reward" | "penalty">("reward");
  const [showAbsentDialog, setShowAbsentDialog] = useState<string | null>(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const [attendanceDates, setAttendanceDates] = useState<Date[]>([]);
  const { toast } = useToast();

  const fetchStudents = useCallback(async () => {
    try {
      const q = query(
        collection(db, "students"),
        where("teacher_id", "==", teacherId),
        where("is_active", "==", true),
      );
      const snapshot = await getDocs(q);
      setStudents(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Student),
      );
    } catch (error) {
      logError("AttendanceTracker:fetchStudents", error);
    }
  }, [teacherId]);

  const fetchAttendanceRecords = useCallback(async () => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
        where("date", "==", selectedDate),
      );
      const snapshot = await getDocs(q);
      setAttendanceRecords(
        snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as AttendanceRecord,
        ),
      );
    } catch (error) {
      logError("AttendanceTracker:fetchAttendanceRecords", error);
    }
  }, [selectedDate, teacherId]);

  const fetchAttendanceDates = useCallback(async () => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map((d) => d.data());
      const uniqueDates = [...new Set(records.map((r) => r.date))];
      setAttendanceDates(uniqueDates.map((date) => parseISO(date)));
    } catch (error) {
      logError("AttendanceTracker:fetchAttendanceDates", error);
    }
  }, [teacherId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        fetchStudents(),
        fetchAttendanceRecords(),
        fetchAttendanceDates(),
      ]);
      setLoading(false);
    };
    void init();
  }, [fetchAttendanceDates, fetchAttendanceRecords, fetchStudents]);

  const groups = [...new Set(students.map((student) => student.group_name))];

  const filteredStudents =
    selectedGroup === "all"
      ? students
      : students.filter((student) => student.group_name === selectedGroup);

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceRecords.find(
      (record) => record.student_id === studentId,
    );
    return record?.status || null;
  };

  const markAttendance = async (
    studentId: string,
    status: "present" | "absent_with_reason" | "absent_without_reason" | "late",
    notes?: string,
  ) => {
    try {
      const docId = `${studentId}_${selectedDate}`;
      await setDoc(
        doc(db, "attendance_records", docId),
        {
          student_id: studentId,
          teacher_id: teacherId,
          date: selectedDate,
          status: status,
          notes: notes || null,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );

      await fetchAttendanceRecords();
      await onStatsUpdate();

      const statusText =
        status === "present"
          ? "kelgan"
          : status === "late"
            ? "kechikkan"
            : status === "absent_with_reason"
              ? "sababli kelmagan"
              : "sababsiz kelmagan";

      toast({
        title: "Davomat yangilandi",
        description: `O'quvchi ${statusText} deb belgilandi`,
      });
    } catch (error) {
      logError("AttendanceTracker:markAttendance", error);
      toast({
        title: "Xatolik",
        description: "Davomatni yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const handleAbsentWithReason = async (studentId: string) => {
    if (!absentReason.trim()) {
      toast({
        title: "Xatolik",
        description: "Sabab kiritish majburiy",
        variant: "destructive",
      });
      return;
    }
    await markAttendance(studentId, "absent_with_reason", absentReason);
    setShowAbsentDialog(null);
    setShowReasonInput(false);
    setAbsentReason("");
  };

  const handleAbsentWithoutReason = async (studentId: string) => {
    await markAttendance(studentId, "absent_without_reason");
    setShowAbsentDialog(null);
    setShowReasonInput(false);
    setAbsentReason("");
  };

  const closeAbsentDialog = () => {
    setShowAbsentDialog(null);
    setShowReasonInput(false);
    setAbsentReason("");
  };

  const markAllPresent = async () => {
    try {
      const batch = writeBatch(db);
      filteredStudents.forEach((student) => {
        const docId = `${student.id}_${selectedDate}`;
        batch.set(
          doc(db, "attendance_records", docId),
          {
            student_id: student.id,
            teacher_id: teacherId,
            date: selectedDate,
            status: "present",
            updated_at: serverTimestamp(),
          },
          { merge: true },
        );
      });

      await batch.commit();
      await fetchAttendanceRecords();
      await onStatsUpdate();

      toast({
        title: "Davomat yangilandi",
        description: `Barcha ${filteredStudents.length} o'quvchi kelgan deb belgilandi`,
      });
    } catch (error) {
      logError("AttendanceTracker:markAllPresent", error);
      toast({
        title: "Xatolik",
        description: "Davomatni yangilashda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const addReward = async (studentId: string) => {
    if (!rewardPoints) {
      toast({
        title: "Ma'lumot yetishmayapti",
        description: "Ball miqdorini kiriting",
        variant: "destructive",
      });
      return;
    }

    const points = parseFloat(rewardPoints);
    if (isNaN(points)) {
      toast({
        title: "Noto'g'ri format",
        description: "Ball sonli qiymat bo'lishi kerak",
        variant: "destructive",
      });
      return;
    }

    try {
      const type = rewardType === "reward" ? "Mukofot" : "Jarima";
      await addDoc(collection(db, "reward_penalty_history"), {
        student_id: studentId,
        teacher_id: teacherId,
        points: Math.abs(points),
        type,
        reason: type,
        date: getTashkentToday(),
        created_at: serverTimestamp(),
      });

      await onStatsUpdate();
      setShowRewardDialog(null);
      setRewardPoints("");

      const studentName = students.find((s) => s.id === studentId)?.name || "";
      toast({
        title: rewardType === "reward" ? "Mukofot berildi" : "Jarima berildi",
        description: `${studentName}ga ${Math.abs(points)} ball ${rewardType === "reward" ? "qo'shildi" : "ayrildi"}`,
      });
    } catch (error) {
      logError("AttendanceTracker:handleAddReward", error);
      toast({
        title: "Xatolik",
        description: "Ball qo'shishda xatolik yuz berdi",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = async () => {
    try {
      const q = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", teacherId),
      );
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map((d) => d.data());

      // We need student names, so we'll use the already fetched students list
      const studentMap = new Map(students.map((s) => [s.id, s]));

      const headers = [
        "O'quvchi nomi",
        "Guruh",
        "O'quvchi ID",
        "Sana",
        "Holat",
      ];
      const csvContent = [
        headers.join(","),
        ...records.map((record) => {
          const student = studentMap.get(record.student_id);
          const statusText =
            record.status === "present"
              ? "Kelgan"
              : record.status === "late"
                ? "Kechikkan"
                : record.status === "absent_with_reason"
                  ? "Sababli kelmagan"
                  : "Sababsiz kelmagan";
          return [
            student?.name || "",
            student?.group_name || "",
            student?.student_id || "",
            record.date,
            statusText,
          ].join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `davomat-${selectedGroup}-${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export muvaffaqiyatli",
        description: "Davomat ma'lumotlari yuklab olindi",
      });
    } catch (error) {
      logError("AttendanceTracker:handleExportCSV", error);
    }
  };

  const normalizeStatus = (status: string | null) => {
    return status === "absent" ? "absent_without_reason" : status;
  };

  const getStatusColor = (status: string | null) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "present":
        return "text-green-600 bg-green-50";
      case "absent_without_reason":
        return "text-red-600 bg-red-50";
      case "absent_with_reason":
        return "text-yellow-600 bg-yellow-50";
      case "late":
        return "text-orange-600 bg-orange-50";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getStatusIcon = (status: string | null) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "present":
        return <Check className="w-4 h-4" />;
      case "absent_without_reason":
        return <X className="w-4 h-4" />;
      case "absent_with_reason":
        return <X className="w-4 h-4" />;
      case "late":
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string | null) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "present":
        return "Kelgan";
      case "absent_without_reason":
        return "Sababsiz kelmagan";
      case "absent_with_reason":
        return "Sababli kelmagan";
      case "late":
        return "Kechikkan";
      default:
        return null;
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
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          📋 Davomat Olish
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          O'quvchilar davomatini samarali boshqaring va statistika ko'ring
        </p>
      </div>

      {/* Filters & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Sana</label>
          <div className="relative">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(parseISO(selectedDate), "d-MMMM, yyyy", {
                      locale: uz,
                    })
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
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-semibold">Guruh</label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Guruhni tanlang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha guruhlar</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold">Tezkor Amallar</label>
          <div className="flex gap-2">
            <Button
              onClick={markAllPresent}
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              title="Barcha o'quvchilarni kelgan deb belgilash"
            >
              <Check className="w-4 h-4 mr-1" />
              Barchasi Keldi
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              title="CSV formatida export qilish"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {filteredStudents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const presentCount = filteredStudents.filter(
              (s) => getAttendanceStatus(s.id) === "present"
            ).length;
            const lateCount = filteredStudents.filter(
              (s) => getAttendanceStatus(s.id) === "late"
            ).length;
            const absentCount = filteredStudents.filter(
              (s) =>
                getAttendanceStatus(s.id)?.startsWith("absent")
            ).length;
            const notMarkedCount =
              filteredStudents.length - presentCount - lateCount - absentCount;
            const attendancePercent = Math.round(
              ((presentCount + lateCount) / filteredStudents.length) * 100
            );

            return (
              <>
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200/50 dark:border-green-800/50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">
                      {presentCount}
                    </div>
                    <p className="text-xs font-semibold text-green-700/70 mt-1">
                      ✓ Kelgan
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200/50 dark:border-orange-800/50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {lateCount}
                    </div>
                    <p className="text-xs font-semibold text-orange-700/70 mt-1">
                      🕐 Kechikkan
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-200/50 dark:border-red-800/50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">
                      {absentCount}
                    </div>
                    <p className="text-xs font-semibold text-red-700/70 mt-1">
                      ✗ Kelmagan
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200/50 dark:border-blue-800/50">
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {attendancePercent}%
                    </div>
                    <p className="text-xs font-semibold text-blue-700/70 mt-1">
                      📊 Davomat
                    </p>
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>
      )}

      {/* Students List */}
      <Card>
        <div className="p-6 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedGroup === "all"
                  ? "👥 Barcha o'quvchilar"
                  : `📌 Guruh: ${selectedGroup}`}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateUz(selectedDate)} • {filteredStudents.length} o'quvchi
              </p>
            </div>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">O'quvchilar topilmadi</h3>
          </div>
        ) : (
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {filteredStudents.map((student) => {
              const status = normalizeStatus(getAttendanceStatus(student.id));
              return (
                <div
                  key={student.id}
                  className="p-4 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-medium text-white",
                        status === "present"
                          ? "bg-green-600"
                          : status === "late"
                            ? "bg-orange-600"
                            : status?.startsWith("absent")
                              ? "bg-red-600"
                              : "bg-muted"
                      )}
                    >
                      {student.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        <StudentProfileLink
                          studentId={student.id}
                          className="text-inherit hover:text-primary transition-colors"
                        >
                          {student.name}
                        </StudentProfileLink>
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          {student.group_name}
                        </p>
                        {status && (
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-semibold flex items-center space-x-1",
                              status === "present"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : status === "late"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            )}
                          >
                            {getStatusIcon(status)}
                            <span>{getStatusText(status)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant={status === "present" ? "default" : "outline"}
                      onClick={() => markAttendance(student.id, "present")}
                      className="w-9 h-9 p-0"
                      title="Keldi"
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={status === "late" ? "default" : "outline"}
                      onClick={() => markAttendance(student.id, "late")}
                      className="w-9 h-9 p-0"
                      title="Kechikdi"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        status?.startsWith("absent") ? "default" : "outline"
                      }
                      onClick={() => {
                        setShowReasonInput(false);
                        setAbsentReason("");
                        setShowAbsentDialog(student.id);
                      }}
                      className="w-9 h-9 p-0"
                      title="Kelmadi"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRewardDialog(student.id)}
                      className="w-9 h-9 p-0"
                      title="Mukofot/Jarima"
                    >
                      <Gift className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {showAbsentDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {students.find((s) => s.id === showAbsentDialog)?.name} -
                Kelmadi
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeAbsentDialog}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {!showReasonInput ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => handleAbsentWithoutReason(showAbsentDialog)}
                  variant="outline"
                  className="h-12"
                >
                  Sababsiz
                </Button>
                <Button
                  onClick={() => setShowReasonInput(true)}
                  variant="outline"
                  className="h-12"
                >
                  Sababli
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Sabab (majburiy)
                  </label>
                  <Input
                    value={absentReason}
                    onChange={(e) => setAbsentReason(e.target.value)}
                    placeholder="Sabab kiriting..."
                    autoFocus
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleAbsentWithReason(showAbsentDialog)}
                    className="flex-1"
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

      {showRewardDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border">
            <h3 className="text-lg font-semibold mb-4">
              Mukofot/Jarima berish
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setRewardType("reward")}
                  variant={rewardType === "reward" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" />
                  Mukofot
                </Button>
                <Button
                  onClick={() => setRewardType("penalty")}
                  variant={rewardType === "penalty" ? "default" : "outline"}
                  className="flex items-center justify-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Jarima
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium">Ball miqdori</label>
                <Input
                  type="number"
                  step="0.1"
                  value={rewardPoints}
                  onChange={(e) => setRewardPoints(e.target.value)}
                  placeholder="Masalan: 5"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => addReward(showRewardDialog)}
                  className="flex-1"
                >
                  Saqlash
                </Button>
                <Button
                  onClick={() => {
                    setShowRewardDialog(null);
                    setRewardPoints("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;
