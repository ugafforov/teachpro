import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { BookOpen, Filter, Plus, Search, SquarePen } from "lucide-react";

import { db } from "@/lib/firebase";
import { logError } from "@/lib/errorUtils";
import { examSchema, formatValidationError } from "@/lib/validations";
import { formatDateUz, getTashkentToday } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StudentProfileLink from "./StudentProfileLink";
import { Exam, ExamType, Group, Student } from "./exam/types";
import { z } from "zod";

interface ExamStudioProps {
  teacherId: string;
}

type ScoreState = { id?: string; score: string };

const ExamStudio: React.FC<ExamStudioProps> = ({ teacherId }) => {
  const scoreRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [groups, setGroups] = useState<Group[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [createGroupId, setCreateGroupId] = useState("");
  const [createTypeId, setCreateTypeId] = useState("");
  const [customName, setCustomName] = useState("");
  const [createDate, setCreateDate] = useState(getTashkentToday());
  const [creating, setCreating] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceStudents, setWorkspaceStudents] = useState<Student[]>([]);
  const [workspaceAttendance, setWorkspaceAttendance] = useState<Map<string, string>>(new Map());
  const [workspaceScores, setWorkspaceScores] = useState<Record<string, ScoreState>>({});
  const [saving, setSaving] = useState(false);

  const groupNameById = useMemo(() => new Map(groups.map((group) => [group.id, group.name] as const)), [groups]);
  const examTypeNameById = useMemo(() => new Map(examTypes.map((type) => [type.id, type.name] as const)), [examTypes]);
  const selectedExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId) ?? null, [exams, selectedExamId]);
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (searchQuery && !exam.exam_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterGroup !== "all" && exam.group_id !== filterGroup) return false;
      return true;
    });
  }, [exams, filterGroup, searchQuery]);

  useEffect(() => {
    if (!teacherId) return;

    const unsubscribers = [
      onSnapshot(query(collection(db, "groups"), where("teacher_id", "==", teacherId), where("is_active", "==", true)), (snapshot) => {
        setGroups(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Group));
      }, (error) => logError("ExamStudio:groups", error)),
      onSnapshot(query(collection(db, "exam_types"), where("teacher_id", "==", teacherId)), (snapshot) => {
        setExamTypes(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as ExamType));
      }, (error) => logError("ExamStudio:types", error)),
      onSnapshot(query(collection(db, "exams"), where("teacher_id", "==", teacherId)), (snapshot) => {
        setExams(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Exam).sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime()));
      }, (error) => logError("ExamStudio:exams", error)),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [teacherId]);

  useEffect(() => {
    if (groups.length && !createGroupId) setCreateGroupId(groups[0].id);
  }, [createGroupId, groups]);

  useEffect(() => {
    if (examTypes.length && !createTypeId) setCreateTypeId(examTypes[0].id);
  }, [createTypeId, examTypes]);

  useEffect(() => {
    if (!exams.length) {
      setSelectedExamId("");
      return;
    }
    if (!selectedExamId || !exams.some((exam) => exam.id === selectedExamId)) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);

  useEffect(() => {
    const exam = selectedExam;
    if (!exam) {
      setWorkspaceStudents([]);
      setWorkspaceAttendance(new Map());
      setWorkspaceScores({});
      setWorkspaceLoading(false);
      return;
    }

    let cancelled = false;
    setWorkspaceLoading(true);

    (async () => {
      try {
        const [studentsSnap, attendanceSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, "students"), where("teacher_id", "==", teacherId), where("group_id", "==", exam.group_id), where("is_active", "==", true))),
          getDocs(query(collection(db, "attendance_records"), where("teacher_id", "==", teacherId), where("date", "==", exam.exam_date))),
          getDocs(query(collection(db, "exam_results"), where("teacher_id", "==", teacherId), where("exam_id", "==", exam.id))),
        ]);

        const students = studentsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Student).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        const attendance = new Map<string, string>();
        attendanceSnap.docs.forEach((entry) => {
          const data = entry.data() as { student_id?: string; status?: string };
          if (data.student_id) attendance.set(data.student_id, data.status ?? "");
        });

        const scores: Record<string, ScoreState> = {};
        resultsSnap.docs.forEach((entry) => {
          const data = entry.data() as { student_id?: string; score?: number };
          if (!data.student_id) return;
          scores[data.student_id] = { id: entry.id, score: typeof data.score === "number" && Number.isFinite(data.score) ? String(data.score) : "" };
        });
        students.forEach((student) => {
          if (!scores[student.id]) scores[student.id] = { score: "" };
        });

        if (cancelled) return;
        setWorkspaceStudents(students);
        setWorkspaceAttendance(attendance);
        setWorkspaceScores(scores);
      } catch (error) {
        if (!cancelled) {
          logError("ExamStudio:workspace", error);
          toast.error("Ma'lumotlarni yuklashda xatolik yuz berdi");
        }
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedExam, teacherId]);

  useEffect(() => {
    if (!workspaceStudents.length) return;
    const first = workspaceStudents[0];
    const timer = window.setTimeout(() => {
      scoreRefs.current[first.id]?.focus();
      scoreRefs.current[first.id]?.select?.();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [workspaceStudents]);

  const createExam = async () => {
    if (creating) return;
    const examName = customName.trim() || examTypeNameById.get(createTypeId) || "";

    try {
      examSchema.parse({ exam_name: examName, exam_date: createDate, group_id: createGroupId });
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
      if (error instanceof z.ZodError) toast.error(formatValidationError(error));
      return;
    }

    setCreating(true);
    try {
      let examTypeId = createTypeId;
      if (customName.trim()) {
        const typeDoc = await addDoc(collection(db, "exam_types"), {
          teacher_id: teacherId,
          name: customName.trim(),
          created_at: serverTimestamp(),
        });
        examTypeId = typeDoc.id;
        setCreateTypeId(typeDoc.id);
      }

      const examDoc = await addDoc(collection(db, "exams"), {
        teacher_id: teacherId,
        group_id: createGroupId,
        exam_type_id: examTypeId,
        exam_name: examName,
        exam_date: createDate,
        created_at: serverTimestamp(),
      });

      setSelectedExamId(examDoc.id);
      setCustomName("");
      toast.success("Imtihon yaratildi");
    } catch (error) {
      logError("ExamStudio:create", error);
      toast.error("Imtihon yaratishda xatolik yuz berdi");
    } finally {
      setCreating(false);
    }
  };

  const handleScoreChange = (studentId: string, value: string) => {
    setWorkspaceScores((current) => ({ ...current, [studentId]: { id: current[studentId]?.id, score: value } }));
  };

  const handleScoreKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const nextIndex = event.shiftKey ? index - 1 : index + 1;
    const nextStudent = workspaceStudents[nextIndex];
    if (!nextStudent) return;
    scoreRefs.current[nextStudent.id]?.focus();
    scoreRefs.current[nextStudent.id]?.select?.();
  };

  const saveResults = async () => {
    if (!selectedExam || saving) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);

      workspaceStudents.forEach((student) => {
        const raw = workspaceScores[student.id]?.score?.trim() ?? "";
        const status = workspaceAttendance.get(student.id);
        if (raw === "" && status !== "absent_with_reason" && status !== "absent_without_reason") return;

        const parsed = raw === "" ? 0 : Number(raw);
        if (!Number.isFinite(parsed)) return;

        const payload = {
          teacher_id: teacherId,
          exam_id: selectedExam.id,
          student_id: student.id,
          score: parsed,
          student_name: student.name || "",
          group_name: student.group_name || groupNameById.get(selectedExam.group_id) || "",
          notes: status === "absent_with_reason" || status === "absent_without_reason" ? "Qatnashmadi" : "",
          updated_at: serverTimestamp(),
        };

        const existingId = workspaceScores[student.id]?.id;
        if (existingId) {
          batch.update(doc(db, "exam_results", existingId), payload);
        } else {
          const ref = doc(collection(db, "exam_results"));
          batch.set(ref, { ...payload, created_at: serverTimestamp() });
        }
      });

      await batch.commit();
      toast.success("Natijalar saqlandi");
    } catch (error) {
      logError("ExamStudio:save", error);
      toast.error("Natijalarni saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Imtihonlar</p>
          <h1 className="text-xl font-semibold tracking-tight">Imtihon boshqaruvi</h1>
          <p className="text-sm text-muted-foreground">Yaratish, tanlash va natija kiritish.</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card id="exam-create-panel" className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-4 w-4" />
                Yangi imtihon
              </CardTitle>
              <CardDescription>Qisqa forma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Guruh</Label>
                <Select value={createGroupId} onValueChange={setCreateGroupId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Guruh" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Imtihon turi</Label>
                <Select
                  value={createTypeId}
                  onValueChange={(value) => {
                    setCreateTypeId(value);
                    setCustomName("");
                  }}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Tur" />
                  </SelectTrigger>
                  <SelectContent>
                    {examTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Yangi nom</Label>
                <Input
                  value={customName}
                  onChange={(event) => {
                    setCustomName(event.target.value);
                    if (event.target.value.trim()) setCreateTypeId("");
                  }}
                  placeholder="Masalan: Oraliq nazorat"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Sana</Label>
                <Input type="date" value={createDate} onChange={(event) => setCreateDate(event.target.value)} className="h-10" />
              </div>
              <Button
                onClick={createExam}
                disabled={creating || !createGroupId || (!createTypeId && !customName.trim()) || !createDate}
                className="w-full"
              >
                {creating ? "Yaratilmoqda..." : "Yaratish va ochish"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-4 w-4" />
                Imtihonlar
              </CardTitle>
              <CardDescription>Qisqa ro'yxat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Imtihon nomi"
                  className="h-10 pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={filterGroup} onValueChange={setFilterGroup}>
                  <SelectTrigger className="h-10 w-[180px]">
                    <SelectValue placeholder="Guruh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha guruhlar</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterGroup("all");
                  }}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Tozalash
                </Button>
              </div>

              {filteredExams.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Imtihon topilmadi.
                </div>
              ) : (
                <ScrollArea className="h-[460px] pr-2">
                  <div className="space-y-2">
                    {filteredExams.map((exam) => {
                      const active = exam.id === selectedExamId;
                      const groupName = groupNameById.get(exam.group_id) || "Noma'lum guruh";
                      return (
                        <button
                          key={exam.id}
                          onClick={() => setSelectedExamId(exam.id)}
                          className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                            active ? "border-primary/40 bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="rounded-full">
                                {groupName}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                {formatDateUz(exam.exam_date)}
                              </Badge>
                            </div>
                            <p className="mt-1 truncate font-medium">{exam.exam_name}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SquarePen className="h-4 w-4" />
              Natija kiritish
            </CardTitle>
            <CardDescription>Tanlangan imtihon uchun ballarni kiriting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedExam ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Imtihon tanlang.
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{groupNameById.get(selectedExam.group_id) || "Guruh"}</p>
                  <h3 className="text-xl font-semibold">{selectedExam.exam_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDateUz(selectedExam.exam_date)} - {workspaceStudents.length} o'quvchi
                  </p>
                </div>
                <Separator />

                {workspaceLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : workspaceStudents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Bu imtihon uchun faol o'quvchi topilmadi.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-hidden rounded-xl border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">O'quvchi</TableHead>
                            <TableHead>Holat</TableHead>
                            <TableHead className="w-[120px] pr-4">Ball</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {workspaceStudents.map((student, index) => {
                            const status = workspaceAttendance.get(student.id);
                            const label =
                              status === "present"
                                ? "Keldi"
                                : status === "late"
                                  ? "Kechikdi"
                                  : status === "absent_with_reason"
                                    ? "Sababli yo'q"
                                    : status === "absent_without_reason"
                                      ? "Sababsiz yo'q"
                                      : "";
                            const score = workspaceScores[student.id]?.score ?? "";

                            return (
                              <TableRow key={student.id}>
                                <TableCell className="pl-4">
                                  <StudentProfileLink studentId={student.id} className="font-medium">
                                    {student.name}
                                  </StudentProfileLink>
                                </TableCell>
                                <TableCell>
                                  {label ? (
                                    <Badge variant="outline" className="rounded-full">
                                      {label}
                                    </Badge>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Ma'lumot yo'q</span>
                                  )}
                                </TableCell>
                                <TableCell className="pr-4">
                                  <Input
                                    ref={(el) => {
                                      scoreRefs.current[student.id] = el;
                                    }}
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={score}
                                    onChange={(e) => handleScoreChange(student.id, e.target.value)}
                                    onKeyDown={handleScoreKeyDown(index)}
                                    placeholder="Ball"
                                    className="h-9 text-right"
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={saveResults} disabled={saving}>
                        {saving ? "Saqlanmoqda..." : "Saqlash"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default ExamStudio;
