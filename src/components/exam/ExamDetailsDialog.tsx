import React from "react";
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
import { Edit2, Download, FileSpreadsheet } from "lucide-react";
import StudentProfileLink from "../StudentProfileLink";
import { ExamResult } from "./types";

interface ExamDetailsDialogProps {
  showExamDetailsDialog: boolean;
  setShowExamDetailsDialog: (show: boolean) => void;
  loadingExamDetails: boolean;
  examDetailsData: ExamResult[];
  attendanceOnExamDate: Map<string, string>;
  exportExamDetails: (format: "excel" | "pdf") => void;
  setEditingResult: (res: { id: string; studentName: string; currentScore: number } | null) => void;
  setEditScore: (val: string) => void;
  setEditReason: (val: string) => void;
}

export const ExamDetailsDialog: React.FC<ExamDetailsDialogProps> = ({
  showExamDetailsDialog,
  setShowExamDetailsDialog,
  loadingExamDetails,
  examDetailsData,
  attendanceOnExamDate,
  exportExamDetails,
  setEditingResult,
  setEditScore,
  setEditReason,
}) => {
  return (
    <Dialog
      open={showExamDetailsDialog}
      onOpenChange={(open) => setShowExamDetailsDialog(open)}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 bg-white dark:bg-zinc-950">
        <DialogHeader className="mb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <DialogTitle className="text-xl">Imtihon natijalari</DialogTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExamDetails("excel")}
                disabled={loadingExamDetails || examDetailsData.length === 0}
                className="h-9 text-xs sm:text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 dark:hover:bg-green-500/20 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportExamDetails("pdf")}
                disabled={loadingExamDetails || examDetailsData.length === 0}
                className="h-9 text-xs sm:text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loadingExamDetails ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : examDetailsData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
            Natijalar topilmadi
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <Table className="min-w-[600px]">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableRow className="border-zinc-200 dark:border-zinc-800">
                  <TableHead className="pl-4 font-semibold">O'quvchi</TableHead>
                  <TableHead className="w-[100px] font-semibold">Ball</TableHead>
                  <TableHead className="font-semibold">Izoh</TableHead>
                  <TableHead className="w-[80px] pr-4 text-center font-semibold">Amallar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examDetailsData.map((result) => {
                  const attendanceStatus = attendanceOnExamDate.get(
                    result.student_id,
                  );
                  const wasAbsent =
                    attendanceStatus === "absent_with_reason" ||
                    attendanceStatus === "absent_without_reason";
                  const hasNoResult = result.id.toString().startsWith("temp_");

                  return (
                    <TableRow
                      key={result.id}
                      className={`border-zinc-100 dark:border-zinc-800 transition-colors ${wasAbsent || hasNoResult ? "bg-muted/30 hover:bg-muted/50" : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50"}`}
                    >
                      <TableCell className="pl-4">
                        {result.student_id ? (
                          <StudentProfileLink
                            studentId={result.student_id}
                            className="text-foreground hover:text-primary transition-colors font-medium"
                          >
                            {result.student_name}
                            {wasAbsent && (
                              <span className="ml-2 text-destructive text-xs font-normal">
                                (Kelmagan)
                              </span>
                            )}
                            {hasNoResult && !wasAbsent && (
                              <span className="ml-2 text-orange-500 text-xs font-normal">
                                (Natija yo'q)
                              </span>
                            )}
                          </StudentProfileLink>
                        ) : (
                          <span className="font-medium text-foreground">
                            {result.student_name}
                            {wasAbsent && (
                              <span className="ml-2 text-destructive text-xs font-normal">
                                (Kelmagan)
                              </span>
                            )}
                            {hasNoResult && !wasAbsent && (
                              <span className="ml-2 text-orange-500 text-xs font-normal">
                                (Natija yo'q)
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center justify-center min-w-[3rem] px-2.5 py-1 rounded-md text-sm font-semibold shadow-sm ${
                            wasAbsent
                              ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                              : result.score >= 90
                                ? "bg-green-100 text-green-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                : result.score >= 70
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                                  : result.score >= 50
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-amber-500/20 dark:text-amber-300"
                                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {wasAbsent ? "Kelmadi" : result.score}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {result.notes || <span className="opacity-50">-</span>}
                      </TableCell>
                      <TableCell className="pr-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                          onClick={() => {
                            setEditingResult({
                              id: result.id,
                              studentName: result.student_name,
                              currentScore: result.score,
                            });
                            setEditScore(result.score.toString());
                            setEditReason(result.notes || "");
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
