import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Archive } from "lucide-react";
import { formatDateUz } from "@/lib/utils";
import { Exam } from "./types";

interface ExamListProps {
  groupedExams: Record<string, Exam[]>;
  monthKeys: string[];
  filteredExams: Exam[];
  visibleExams: Exam[];
  hasMoreExams: boolean;
  loadMoreRef: React.MutableRefObject<HTMLDivElement | null>;
  groupNameById: Map<string, string>;
  getMonthName: (monthKey: string) => string;
  fetchExamDetails: (examId: string) => void;
  handleAction: (examId: string, examName: string) => void;
}

export const ExamList: React.FC<ExamListProps> = ({
  groupedExams,
  monthKeys,
  filteredExams,
  visibleExams,
  hasMoreExams,
  loadMoreRef,
  groupNameById,
  getMonthName,
  fetchExamDetails,
  handleAction,
}) => {
  return (
    <div className="space-y-6">
      {monthKeys.map((monthKey) => {
        const monthExams = groupedExams[monthKey] || [];
        return (
          <div key={monthKey} className="space-y-3">
            <h3 className="text-sm font-semibold capitalize text-muted-foreground pl-1 sticky top-0 bg-background/95 backdrop-blur z-10 py-2">
              {getMonthName(monthKey)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {monthExams.map((exam) => (
                <Card
                  key={exam.id}
                  className="group hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/60 dark:border-l-primary/40 flex flex-col h-full bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-4">
                    <div className="space-y-1 overflow-hidden pr-2">
                      <CardTitle
                        className="text-base font-semibold truncate leading-tight group-hover:text-primary transition-colors"
                        title={exam.exam_name}
                      >
                        {exam.exam_name}
                      </CardTitle>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {formatDateUz(exam.exam_date)}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {groupNameById.get(exam.group_id) || "-"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 mt-auto flex flex-col gap-3">
                    <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800/50 my-1" />
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchExamDetails(exam.id)}
                        className="h-8 px-2 -ml-2 text-sm text-primary hover:text-primary hover:bg-primary/5"
                      >
                        <FileText className="h-4 w-4 mr-1.5" /> Natijalar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAction(exam.id, exam.exam_name)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/50 transition-colors"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {filteredExams.length === 0 && (
        <Card className="p-12 text-center border-dashed bg-muted/20">
          <p className="text-muted-foreground">Imtihonlar topilmadi</p>
        </Card>
      )}

      {filteredExams.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-sm text-muted-foreground">
            Ko'rsatilmoqda: <span className="font-medium text-foreground">{Math.min(visibleExams.length, filteredExams.length)}</span> /{" "}
            {filteredExams.length}
          </div>
          {hasMoreExams && (
            <div className="text-sm text-muted-foreground animate-pulse">
              Pastga tushsangiz avtomatik yuklanadi...
            </div>
          )}
        </div>
      )}

      {hasMoreExams && (
        <div
          ref={loadMoreRef}
          className="flex items-center justify-center py-6"
        >
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};
