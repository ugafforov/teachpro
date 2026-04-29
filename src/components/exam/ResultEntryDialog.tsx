import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import StudentProfileLink from "../StudentProfileLink";
import { Student } from "./types";

interface ResultEntryDialogProps {
  showResultsDialog: boolean;
  setShowResultsDialog: (show: boolean) => void;
  students: Student[];
  attendanceOnExamDate: Map<string, string>;
  examResults: Record<string, string>;
  setExamResults: (results: Record<string, string>) => void;
  saveExamResults: () => void;
  savingResults: boolean;
  setScoreInputRef: (studentId: string) => (el: HTMLInputElement | null) => void;
  handleScoreKeyDown: (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const ResultEntryDialog: React.FC<ResultEntryDialogProps> = ({
  showResultsDialog,
  setShowResultsDialog,
  students,
  attendanceOnExamDate,
  examResults,
  setExamResults,
  saveExamResults,
  savingResults,
  setScoreInputRef,
  handleScoreKeyDown,
}) => {
  return (
    <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 bg-white dark:bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-xl">Imtihon natijalarini kiriting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <Table className="min-w-[400px]">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableRow className="border-zinc-200 dark:border-zinc-800">
                  <TableHead className="pl-4 font-semibold">O'quvchi</TableHead>
                  <TableHead className="w-[150px] pr-4 font-semibold">Ball</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, idx) => {
                  const attendanceStatus = attendanceOnExamDate.get(student.id);
                  const wasAbsent =
                    attendanceStatus === "absent_with_reason" ||
                    attendanceStatus === "absent_without_reason";

                  return (
                    <TableRow
                      key={student.id}
                      className={`border-zinc-100 dark:border-zinc-800 ${wasAbsent ? "bg-muted/30" : ""}`}
                    >
                      <TableCell className="pl-4">
                        <StudentProfileLink
                          studentId={student.id}
                          className="text-foreground hover:text-primary transition-colors font-medium"
                        >
                          {student.name}
                          {wasAbsent && (
                            <span className="ml-2 text-destructive text-xs sm:text-sm font-normal">
                              (Kelmagan)
                            </span>
                          )}
                        </StudentProfileLink>
                      </TableCell>
                      <TableCell className="pr-4">
                        {wasAbsent ? (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs sm:text-sm whitespace-nowrap">
                              Qatnashmadi
                            </span>
                            <Input
                              ref={setScoreInputRef(student.id)}
                              type="number"
                              inputMode="decimal"
                              enterKeyHint="next"
                              min={0}
                              max={100}
                              step={1}
                              value={examResults[student.id] || ""}
                              onKeyDown={handleScoreKeyDown(idx)}
                              onChange={(e) =>
                                setExamResults({
                                  ...examResults,
                                  [student.id]: e.target.value,
                                })
                              }
                              placeholder="Ball"
                              className="w-20 h-8 text-sm border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary"
                            />
                          </div>
                        ) : (
                          <Input
                            ref={setScoreInputRef(student.id)}
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            min={0}
                            max={100}
                            step={1}
                            value={examResults[student.id] || ""}
                            onKeyDown={handleScoreKeyDown(idx)}
                            onChange={(e) =>
                              setExamResults({
                                ...examResults,
                                [student.id]: e.target.value,
                              })
                            }
                            placeholder="Ball"
                            className="h-9 border-zinc-200 dark:border-zinc-800 focus-visible:ring-primary"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Button
            onClick={saveExamResults}
            className="w-full h-10 font-medium"
            disabled={savingResults}
          >
            {savingResults ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Saqlanmoqda...
              </span>
            ) : (
              "Saqlash"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
