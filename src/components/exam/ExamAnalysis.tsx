import React, { useState, useEffect, useMemo, useCallback } from "react";
import { logError } from "@/lib/errorUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Download, FileSpreadsheet } from "lucide-react";
import { formatDateUz, getTashkentToday } from "@/lib/utils";
import StudentProfileLink from "../StudentProfileLink";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Exam, Group, AnalysisRow } from "./types";

interface ExamAnalysisProps {
  teacherId: string;
  exams: Exam[];
  groups: Group[];
}

const sanitizeFileName = (name: string) => {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

export const ExamAnalysis: React.FC<ExamAnalysisProps> = ({
  teacherId,
  exams,
  groups,
}) => {
  const [selectedExamName, setSelectedExamName] = useState<string>("");
  const [selectedAnalysisGroup, setSelectedAnalysisGroup] =
    useState<string>("all");
  const [analysisData, setAnalysisData] = useState<
    Record<string, AnalysisRow[]>
  >({});
  const [loading, setLoading] = useState(false);

  const uniqueExamNames = useMemo(() => {
    return [...new Set(exams.map((e) => e.exam_name))].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [exams]);

  const allDates = useMemo(() => {
    const set = new Set<string>();
    Object.values(analysisData).forEach((rows) => {
      rows.forEach((r) => {
        if (r.examDate) set.add(r.examDate);
      });
    });
    return [...set].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );
  }, [analysisData]);

  const fetchAnalysisData = useCallback(async () => {
    if (!selectedExamName) {
      setAnalysisData({});
      return;
    }

    setLoading(true);
    try {
      let examsQ = query(
        collection(db, "exams"),
        where("teacher_id", "==", teacherId),
        where("exam_name", "==", selectedExamName),
      );

      if (selectedAnalysisGroup && selectedAnalysisGroup !== "all") {
        examsQ = query(examsQ, where("group_id", "==", selectedAnalysisGroup));
      }

      const examsSnap = await getDocs(examsQ);
      const examIds = examsSnap.docs.map((d) => d.id);
      const examIdToDate = new Map(
        examsSnap.docs.map((d) => {
          const data = d.data() as { exam_date?: string };
          return [d.id, data.exam_date ?? ""] as const;
        }),
      );

      if (examIds.length === 0) {
        setAnalysisData({});
        return;
      }

      const examIdChunks = chunkArray(examIds, 10);
      const resultsSnaps = await Promise.all(
        examIdChunks.map((ids) => {
          const resultsQ = query(
            collection(db, "exam_results"),
            where("teacher_id", "==", teacherId),
            where("exam_id", "in", ids),
          );
          return getDocs(resultsQ);
        }),
      );

      const grouped: Record<string, AnalysisRow[]> = {};
      resultsSnaps
        .flatMap((s) => s.docs)
        .forEach((docSnap) => {
          const data = docSnap.data() as {
            student_id?: string;
            student_name?: string;
            group_name?: string;
            exam_id?: string;
            score?: number;
          };

          const studentId = data.student_id;
          if (!studentId) return;

          if (!grouped[studentId]) grouped[studentId] = [];
          grouped[studentId].push({
            studentName: data.student_name ?? "",
            groupName: data.group_name ?? "",
            examDate: data.exam_id
              ? (examIdToDate.get(data.exam_id) ?? "")
              : "",
            score: data.score ?? 0,
          });
        });

      Object.keys(grouped).forEach((studentId) => {
        grouped[studentId].sort(
          (a, b) =>
            new Date(a.examDate).getTime() - new Date(b.examDate).getTime(),
        );
      });

      setAnalysisData(grouped);
    } catch (error) {
      logError("ExamManager:fetchAnalysis", error);
      setAnalysisData({});
    } finally {
      setLoading(false);
    }
  }, [selectedExamName, selectedAnalysisGroup, teacherId]);

  useEffect(() => {
    void fetchAnalysisData();
  }, [fetchAnalysisData]);

  const exportAnalysis = (format: "excel" | "pdf") => {
    if (!selectedExamName || Object.keys(analysisData).length === 0) return;

    const selectedGroupName =
      selectedAnalysisGroup === "all"
        ? "Barcha guruhlar"
        : groups.find((g) => g.id === selectedAnalysisGroup)?.name || "";

    const fileBase = sanitizeFileName(`${selectedExamName}_tahlil`);
    const title = `${selectedExamName} - Natijalar tahlili`;

    const headers = [
      "O'quvchi",
      "Guruh",
      ...allDates.map((d) => formatDateUz(d, "short")),
      "O'rtacha",
    ];

    const rows = Object.values(analysisData)
      .map((results) => {
        const avgScore =
          results.reduce((sum, r) => sum + r.score, 0) / results.length;
        const scoresByDate = new Map(
          results.map((r) => [r.examDate, r.score] as const),
        );

        return [
          results[0]?.studentName || "",
          results[0]?.groupName || "",
          ...allDates.map((d) => {
            const score = scoresByDate.get(d);
            return score === undefined ? "" : String(score);
          }),
          avgScore.toFixed(1),
        ];
      })
      .sort((a, b) => Number(b[b.length - 1]) - Number(a[a.length - 1]));

    const exportedAt = formatDateUz(getTashkentToday());

    if (format === "excel") {
      const metaRows: (string | number)[][] = [
        [title],
        ["Guruh:", selectedGroupName],
        ["Export sanasi:", exportedAt],
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet([...metaRows, headers, ...rows]);
      const wb = XLSX.utils.book_new();

      interface WorksheetProperties {
        "!cols"?: Array<{ wch: number }>;
        "!merges"?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
      }

      const totalCols = headers.length;
      const worksheetProps = ws as WorksheetProperties;
      
      if (totalCols > 1) {
        worksheetProps["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
        ];
      }

      worksheetProps["!cols"] = Array.from({ length: totalCols }, (_, idx) => {
        if (idx === 0) return { wch: 24 };
        if (idx === 1) return { wch: 16 };
        return { wch: 10 };
      });

      XLSX.utils.book_append_sheet(wb, ws, "Analysis");
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(title, 14, 14);

    doc.setFontSize(10);
    doc.text(`Guruh: ${selectedGroupName}`, 14, 22);
    doc.text(`Export sanasi: ${exportedAt}`, 14, 28);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`${fileBase}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Imtihon turi</Label>
          <Select value={selectedExamName} onValueChange={setSelectedExamName}>
            <SelectTrigger className="w-full bg-white dark:bg-zinc-950">
              <SelectValue placeholder="Imtihon turini tanlang" />
            </SelectTrigger>
            <SelectContent>
              {uniqueExamNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Guruh (ixtiyoriy)</Label>
          <Select
            value={selectedAnalysisGroup}
            onValueChange={setSelectedAnalysisGroup}
          >
            <SelectTrigger className="w-full bg-white dark:bg-zinc-950">
              <SelectValue placeholder="Barcha guruhlar" />
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
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {!loading &&
        selectedExamName &&
        Object.keys(analysisData).length === 0 && (
          <Card className="p-12 text-center border-dashed bg-muted/20">
            <p className="text-muted-foreground">Tahlil uchun natijalar topilmadi</p>
          </Card>
        )}

      {!loading && selectedExamName && Object.keys(analysisData).length > 0 && (
        <Card className="overflow-hidden shadow-sm border-zinc-200 dark:border-zinc-800">
          <div className="p-4 sm:p-6 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-lg font-semibold tracking-tight">
                {selectedExamName} - Natijalar tahlili
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAnalysis("excel")}
                  className="h-9 text-xs sm:text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20 dark:hover:bg-green-500/20 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportAnalysis("pdf")}
                  className="h-9 text-xs sm:text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 dark:hover:bg-red-500/20 transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50">
                <TableRow className="border-zinc-100 dark:border-zinc-800">
                  <TableHead className="w-[200px] pl-4 sm:pl-6 font-semibold">O'quvchi</TableHead>
                  <TableHead className="min-w-[120px] font-semibold">Guruh</TableHead>
                  {allDates.map((date) => (
                    <TableHead key={date} className="text-center min-w-[90px] font-semibold">
                      {formatDateUz(date, "short")}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[90px] pr-4 sm:pr-6 font-semibold">
                    O'rtacha
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(analysisData)
                  .sort(([, aRes], [, bRes]) => {
                    const aAvg =
                      aRes.reduce((sum, r) => sum + r.score, 0) / aRes.length;
                    const bAvg =
                      bRes.reduce((sum, r) => sum + r.score, 0) / bRes.length;
                    return bAvg - aAvg;
                  })
                  .map(([studentId, results]) => {
                    const avgScore = (
                      results.reduce((sum, r) => sum + r.score, 0) /
                      results.length
                    ).toFixed(1);
                    const scoresByDate = new Map(
                      results.map((r) => [r.examDate, r.score]),
                    );
                    return (
                      <TableRow key={studentId} className="border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <TableCell className="font-medium pl-4 sm:pl-6">
                          <StudentProfileLink
                            studentId={studentId}
                            className="text-foreground hover:text-primary transition-colors font-medium"
                          >
                            {results[0]?.studentName}
                          </StudentProfileLink>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {results[0]?.groupName}
                        </TableCell>
                        {allDates.map((date) => {
                          const score = scoresByDate.get(date);
                          return (
                            <TableCell
                              key={`${studentId}-${date}`}
                              className="text-center p-3"
                            >
                              {score !== undefined ? (
                                <span
                                  className={`inline-flex items-center justify-center min-w-[2.5rem] px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${
                                    score >= 90
                                      ? "bg-green-100 text-green-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                                      : score >= 70
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                                        : score >= 50
                                          ? "bg-yellow-100 text-yellow-700 dark:bg-amber-500/20 dark:text-amber-300"
                                          : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                                  }`}
                                >
                                  {score}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50 text-sm">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center font-bold text-primary pr-4 sm:pr-6 text-[15px]">
                          {avgScore}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
};
