import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { addDoc, collection, serverTimestamp, where, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/errorUtils";
import StudentProfileLink from "../StudentProfileLink";
import { Exam, Student, Group } from "./types";
import { Check, X } from "lucide-react";

interface QuickResultEntryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  exams: Exam[];
  students: Student[];
}

interface StudentScore {
  studentId: string;
  studentName: string;
  score: string;
  submitted: boolean;
}

export const QuickResultEntryDialog: React.FC<QuickResultEntryDialogProps> = ({
  isOpen,
  onOpenChange,
  teacherId,
  exams,
  students,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [scores, setScores] = useState<Record<string, StudentScore>>({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [groups, setGroups] = useState<Group[]>([]);
  const scoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const currentIndexRef = useRef<number>(0);

  // Load groups
  useEffect(() => {
    if (!teacherId) return;

    const loadGroups = async () => {
      try {
        const q = query(
          collection(db, "groups"),
          where("teacher_id", "==", teacherId),
          where("is_active", "==", true)
        );
        const snapshot = await getDocs(q);
        setGroups(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            name: doc.data().name,
          })) as Group[]
        );
      } catch (error) {
        logError("QuickResultEntryDialog:loadGroups", error);
      }
    };

    loadGroups();
  }, [teacherId]);

  // Initialize scores when exam changes
  useEffect(() => {
    if (selectedExamId) {
      const exam = exams.find((e) => e.id === selectedExamId);
      if (exam) {
        const newScores: Record<string, StudentScore> = {};
        students
          .filter((s) =>
            groupFilter === "all"
              ? exam.group_id === s.group_id
              : groupFilter === s.group_id
          )
          .forEach((student) => {
            newScores[student.id] = {
              studentId: student.id,
              studentName: student.name,
              score: "",
              submitted: false,
            };
          });
        setScores(newScores);
        currentIndexRef.current = 0;
      }
    }
  }, [selectedExamId, exams, students, groupFilter]);

  // Focus first input on dialog open
  useEffect(() => {
    if (isOpen && selectedExamId) {
      setTimeout(() => {
        const firstStudent = Object.values(scores)[0];
        if (firstStudent) {
          scoreInputRefs.current[firstStudent.studentId]?.focus();
        }
      }, 100);
    }
  }, [isOpen, selectedExamId, scores]);

  const handleScoreChange = (studentId: string, value: string) => {
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: value,
      },
    }));
  };

  const handleScoreKeyDown = (studentId: string, index: number) => (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (scores[studentId].score) {
        handleSubmitScore(studentId);
        const nextStudent = Object.values(scores)[index + 1];
        if (nextStudent) {
          setTimeout(() => {
            scoreInputRefs.current[nextStudent.studentId]?.focus();
          }, 50);
        }
      }
    } else if (e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      const nextStudent = Object.values(scores)[index + 1];
      if (nextStudent) {
        scoreInputRefs.current[nextStudent.studentId]?.focus();
      }
    } else if (e.key === "ArrowUp" || (e.shiftKey && e.key === "Tab")) {
      e.preventDefault();
      const prevStudent = Object.values(scores)[index - 1];
      if (prevStudent) {
        scoreInputRefs.current[prevStudent.studentId]?.focus();
      }
    }
  };

  const handleSubmitScore = async (studentId: string) => {
    const student = scores[studentId];
    if (!student.score || !selectedExamId) return;

    const score = parseFloat(student.score);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error("Baho 0-100 orasida bo'lishi kerak");
      return;
    }

    try {
      await addDoc(collection(db, "exam_results"), {
        exam_id: selectedExamId,
        student_id: studentId,
        student_name: student.studentName,
        score: score,
        teacher_id: teacherId,
        group_id: exams.find((e) => e.id === selectedExamId)?.group_id,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      setScores((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          score: "",
          submitted: true,
        },
      }));

      toast.success(`${student.studentName}: ${score} - Saqlandi`);
    } catch (error) {
      logError("QuickResultEntryDialog:submitScore", error);
      toast.error("Xatolik yuz berdi");
    }
  };

  const handleSaveAll = async () => {
    const unsubmittedScores = Object.values(scores).filter(
      (s) => s.score && !s.submitted
    );

    if (unsubmittedScores.length === 0) {
      toast.info("Hech qanday baho kiritilmagan");
      return;
    }

    setSaving(true);
    try {
      const batch = unsubmittedScores.map((student) =>
        addDoc(collection(db, "exam_results"), {
          exam_id: selectedExamId,
          student_id: student.studentId,
          student_name: student.studentName,
          score: parseFloat(student.score),
          teacher_id: teacherId,
          group_id: exams.find((e) => e.id === selectedExamId)?.group_id,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        })
      );

      await Promise.all(batch);

      toast.success(
        `${unsubmittedScores.length} ta baho saqlandi`
      );

      setScores((prev) => {
        const updated = { ...prev };
        unsubmittedScores.forEach((s) => {
          updated[s.studentId] = {
            ...updated[s.studentId],
            score: "",
            submitted: true,
          };
        });
        return updated;
      });
    } catch (error) {
      logError("QuickResultEntryDialog:saveAll", error);
      toast.error("Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const filteredStudents = Object.entries(scores)
    .filter(([_, s]) => s.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
    .map(([id, student]) => ({ id, ...student }));

  const submittedCount = Object.values(scores).filter((s) => s.submitted).length;
  const totalCount = Object.values(scores).length;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imtihon Natijalarini Kiritish</DialogTitle>
          <DialogDescription className="text-xs">
            Tez va qulay natija kiritish uchun mo'ljallangan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Exam Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-2 block">Imtihonni Tanlang</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Imtihonni tanlang..." />
                </SelectTrigger>
                <SelectContent>
                  {exams.slice(0, 20).map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.exam_name} ({new Date(exam.exam_date).toLocaleDateString("uz-UZ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Guruhni Filtrlar</Label>
              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Barcha o'quvchilar</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedExam && (
            <>
              {/* Search & Stats */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs mb-2 block">Qidirish</Label>
                  <Input
                    placeholder="O'quvchi nomini yozing..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.currentTarget.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Badge variant="outline" className="text-xs">
                  {submittedCount}/{totalCount}
                </Badge>
              </div>

              {/* Quick Tips */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <p className="text-xs text-blue-900 dark:text-blue-200">
                  <strong>Tez Maslahat:</strong> Baho kiriting → Enter (keyingi o'quvchiga) → Esc (orqaga)
                </p>
              </div>

              {/* Students Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead className="w-[200px] text-xs">O'quvchi</TableHead>
                      <TableHead className="text-xs">Baho (0-100)</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student, index) => (
                      <TableRow
                        key={student.id}
                        className={student.submitted ? "bg-green-50 dark:bg-green-950" : ""}
                      >
                        <TableCell className="text-sm">
                          <StudentProfileLink
                            studentId={student.id}
                            className="hover:underline"
                          >
                            {student.studentName}
                          </StudentProfileLink>
                        </TableCell>
                        <TableCell>
                          {student.submitted ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {student.score}
                              </Badge>
                              <span className="text-xs text-green-600">Saqlandi</span>
                            </div>
                          ) : (
                            <Input
                              ref={(el) => {
                                scoreInputRefs.current[student.id] = el;
                              }}
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max="100"
                              step="1"
                              placeholder="0"
                              value={student.score}
                              onChange={(e) =>
                                handleScoreChange(student.id, e.currentTarget.value)
                              }
                              onKeyDown={handleScoreKeyDown(student.id, index)}
                              className="h-8 text-sm w-24"
                              autoComplete="off"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {student.submitted ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <button
                              onClick={() => handleSubmitScore(student.id)}
                              disabled={!student.score}
                              className="text-primary hover:opacity-70 disabled:opacity-40"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Yopish
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveAll}
                  disabled={saving || submittedCount === totalCount}
                  className="gap-2"
                >
                  {saving ? "Saqlanmoqda..." : `Barchasini Saqlash (${Object.values(scores).filter((s) => s.score && !s.submitted).length})`}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
