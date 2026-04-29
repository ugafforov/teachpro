/**
 * TeachPro CRM — Professional XLSX Report Generator
 * Uses the SAME formulas as studentScoreCalculator.ts
 * Sends multiple files to Telegram for complete backup
 */

import * as XLSX from "xlsx";
import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  calculateAllStudentScores,
  calculateGroupRankings,
  calculateDashboardStats,
  StudentWithScore,
  GroupRanking,
} from "./studentScoreCalculator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colW(widths: number[]): XLSX.ColInfo[] {
  return widths.map((wch) => ({ wch }));
}

async function fetchCol<T>(col: string, teacherId: string): Promise<T[]> {
  try {
    const q = query(collection(db as any, col), where("teacher_id", "==", teacherId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as T));
  } catch {
    return [];
  }
}

function monthLabel(ym: string): string {
  if (!ym || !ym.includes("-")) return ym;
  const [y, m] = ym.split("-");
  try {
    return new Date(Number(y), Number(m) - 1).toLocaleString("uz-UZ", { month: "long", year: "numeric" });
  } catch {
    return ym;
  }
}

// ─── FILE 1: Reyting va Umumiy Statistika ─────────────────────────────────────

async function buildRankingFile(teacherId: string): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  // 1. O'quvchilar reytingi (saytdagi formulalar bilan)
  const allStudents = await calculateAllStudentScores(teacherId);
  const sorted = [...allStudents].sort((a, b) => b.score.totalScore - a.score.totalScore);

  const rankRows: (string | number)[][] = [
    ["TeachPro CRM — O'QUVCHILAR REYTINGI"],
    [`Yaratilgan: ${new Date().toLocaleDateString("uz-UZ")}  |  Formula: totalScore = attendancePoints + (mukofot - jarima)`],
    [],
    ["#", "Ism", "Sinf/Guruh", "Umumiy ball", "Davomat balli", "Mukofot", "Jarima", "Baho o'rtacha",
     "Keldi", "Kech", "Kelmadi", "Sababsiz", "Jami darslar", "Davomat %", "Samaradorlik %"],
  ];

  sorted.forEach((s, i) => {
    const sc = s.score;
    rankRows.push([
      i + 1, s.name, s.group_name,
      Math.round(sc.totalScore * 10) / 10,
      sc.attendancePoints, sc.mukofotPoints, sc.jarimaPoints,
      Math.round(sc.bahoAverage * 10) / 10,
      sc.presentCount, sc.lateCount, sc.absentCount, sc.unexcusedAbsentCount,
      sc.totalClasses, `${sc.attendancePercentage}%`, `${sc.efficiency}%`,
    ]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(rankRows);
  ws1["!cols"] = colW([4, 26, 18, 12, 14, 10, 10, 14, 8, 8, 10, 10, 12, 12, 14]);
  XLSX.utils.book_append_sheet(wb, ws1, "Reyting");

  // 2. Guruhlar reytingi
  const groupRankings = await calculateGroupRankings(teacherId);
  const grRows: (string | number)[][] = [
    ["TeachPro CRM — GURUHLAR REYTINGI"],
    [`Yaratilgan: ${new Date().toLocaleDateString("uz-UZ")}`],
    [],
    ["O'rin", "Guruh nomi", "O'quvchilar", "Jami darslar", "Davomat %", "Kech kelish %", "Sababsiz %", "Samaradorlik %"],
  ];
  groupRankings.forEach((g) => {
    grRows.push([g.rank, g.groupName, g.totalStudents, g.totalClasses,
      `${g.attendancePercentage}%`, `${g.latePercentage}%`, `${g.absentPercentage}%`, `${g.efficiency}%`]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(grRows);
  ws2["!cols"] = colW([6, 22, 14, 14, 12, 14, 12, 16]);
  XLSX.utils.book_append_sheet(wb, ws2, "Guruh reytingi");

  // 3. Dashboard statistika + oylik tahlil
  const { stats, monthlyData } = await calculateDashboardStats(teacherId);
  const dashRows: (string | number)[][] = [
    ["TeachPro CRM — UMUMIY STATISTIKA"],
    [],
    ["Ko'rsatkich", "Qiymat"],
    ["Jami o'quvchilar", stats.totalStudents],
    ["Jami darslar (kun)", stats.totalClasses],
    ["O'rtacha davomat", `${stats.averageAttendance}%`],
    ["Eng faol o'quvchi", stats.topStudent ? `${stats.topStudent.name} (${stats.topStudent.score} ball)` : "—"],
    [],
    ["=== OYLIK TAHLIL ==="],
    ["Oy", "Darslar", "O'quvchilar", "Davomat %", "Kech %", "Sababsiz %", "Samaradorlik %"],
  ];
  monthlyData.forEach((m) => {
    dashRows.push([m.month, m.totalClasses, m.totalStudents,
      `${m.averageAttendance}%`, `${m.latePercentage ?? 0}%`, `${m.absentPercentage ?? 0}%`, `${m.efficiency ?? 0}%`]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(dashRows);
  ws3["!cols"] = colW([22, 12, 14, 12, 10, 12, 14]);
  XLSX.utils.book_append_sheet(wb, ws3, "Statistika");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ─── FILE 2: Davomat (har bir guruh alohida varaq) ────────────────────────────

async function buildAttendanceFile(teacherId: string): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  const groups = await fetchCol<any>("groups", teacherId);
  const archivedGroups = await fetchCol<any>("archived_groups", teacherId);
  const students = await fetchCol<any>("students", teacherId);
  const archivedStudents = await fetchCol<any>("archived_students", teacherId);
  const attendance = await fetchCol<any>("attendance_records", teacherId);
  const rewards = await fetchCol<any>("reward_penalty_history", teacherId);

  // Barcha o'quvchilar (aktiv + arxivlangan) — ID bo'yicha tezkor qidirish uchun
  const allStudents = [...students, ...archivedStudents];
  const studentById = new Map<string, any>(allStudents.map((s: any) => [s.id, s]));

  // Faqat Mukofot va Jarima (Baho tizimdan olib tashlangan)
  const filteredRewards = rewards.filter((r: any) => {
    const t = (r.type || "").toLowerCase();
    return t === "mukofot" || t === "jarima";
  });

  // ── Guruh nomidan birinchi raqamni topib o'sish tartibida saralash ────────
  // Misol: "1-Sinf" → 1, "10A" → 10, "Maktabga tayyorlov" → Infinity (oxiriga)
  const extractGroupNum = (name: string): number => {
    const m = name.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Infinity;
  };
  const sortGroups = (arr: any[]) =>
    [...arr].sort((a, b) => {
      const na = extractGroupNum(a.name);
      const nb = extractGroupNum(b.name);
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name, "uz");
    });

  const sortedGroups = sortGroups(groups);
  const sortedArchivedGroups = sortGroups(archivedGroups);

  // ── Guruhni varaqqa aylantiradigan yordamchi funksiya ────────────────────
  const processGroup = (group: any, isArchived: boolean) => {
    // Bu guruhga tegishli barcha o'quvchilar (aktiv + arxivlangan)
    const gStudents = allStudents.filter(
      (s: any) => s.group_id === group.id || s.group_name === group.name
    );
    if (!gStudents.length) return null;

    const gAtt = attendance.filter((a: any) =>
      gStudents.some((s: any) => s.id === a.student_id)
    );
    const classDatesSet = new Set(gAtt.map((a: any) => a.date));
    const allDates = [...classDatesSet].sort();
    const months = [...new Set(allDates.map((d: string) => d.slice(0, 7)))].sort();

    const statusLabel = isArchived ? " [ARXIVLANGAN]" : " [FAOL]";
    const rows: (string | number)[][] = [
      [`${group.name}${statusLabel} — Davomat va Mukofot/Jarima`],
      [`Fan: ${group.subject || "—"}  |  Jadval: ${group.schedule || "—"}  |  O'quvchilar: ${gStudents.length}`],
      ["Belgilar: K=Keldi, C=Kech, X=Sababsiz, S=Sababli  |  (+10)=Mukofot  (-5)=Jarima"],
      [],
    ];

    // ── Oy sarlavhasi ─────────────────────────────────────────────────────
    const monthRow: string[] = ["Ism", "Telefon", "Holat"];
    for (const m of months) {
      const cnt = allDates.filter((d: string) => d.startsWith(m)).length;
      monthRow.push(monthLabel(m));
      for (let i = 1; i < cnt; i++) monthRow.push("");
    }
    monthRow.push("Keldi", "Kech", "Kelmadi", "Davomat %", "Jami M", "Jami J", "Sof ball");
    rows.push(monthRow);

    // ── Sana sarlavhasi ───────────────────────────────────────────────────
    const dateRow: string[] = ["", "", ""];
    allDates.forEach((d: string) => dateRow.push(d.slice(8)));
    dateRow.push("", "", "", "", "", "", "");
    rows.push(dateRow);

    // ── O'quvchi satrlari ─────────────────────────────────────────────────
    for (const student of gStudents) {
      const studentLabel = student.is_active === false ? "[Arxiv]" : "[Faol]";
      const row: (string | number)[] = [
        student.name,
        student.phone || "—",
        studentLabel,
      ];
      let present = 0, late = 0, absent = 0;
      let totalMukofot = 0, totalJarima = 0;

      type DayReward = { mukofot: number; jarima: number };
      const dayRewardMap = new Map<string, DayReward>();

      filteredRewards
        .filter((r: any) => r.student_id === student.id)
        .forEach((r: any) => {
          if (!r.date) return;
          const t = (r.type || "").toLowerCase();
          const pts = Math.abs(Number(r.points ?? 0));
          const existing = dayRewardMap.get(r.date) ?? { mukofot: 0, jarima: 0 };
          if (t === "mukofot") { existing.mukofot += pts; totalMukofot += pts; }
          else if (t === "jarima") { existing.jarima += pts; totalJarima += pts; }
          dayRewardMap.set(r.date, existing);
        });

      // Davomat ustunlari (faqat dars kunlari)
      for (const date of allDates) {
        const rec = gAtt.find((a: any) => a.student_id === student.id && a.date === date);
        const reward = dayRewardMap.get(date);

        let statusChar = "—";
        if (rec) {
          if (rec.status === "present") { statusChar = "K"; present++; }
          else if (rec.status === "late") { statusChar = "C"; late++; }
          else if (rec.status === "absent_without_reason") { statusChar = "X"; absent++; }
          else if (rec.status === "absent_with_reason" || rec.status === "absent") { statusChar = "S"; absent++; }
        }

        if (reward && (reward.mukofot || reward.jarima)) {
          const parts: string[] = [];
          if (reward.mukofot) parts.push(`+${reward.mukofot}`);
          if (reward.jarima) parts.push(`-${reward.jarima}`);
          row.push(`${statusChar}(${parts.join("")})`);
        } else {
          row.push(statusChar);
        }
      }

      const total = present + late + absent;
      const pct = total ? Math.round(((present + late) / total) * 100) : 0;
      const netScore = totalMukofot - totalJarima;
      row.push(present, late, absent, `${pct}%`, totalMukofot || "—", totalJarima || "—", netScore || "—");
      rows.push(row);
    }

    // ── Jami qator ────────────────────────────────────────────────────────
    rows.push([]);
    const footerRow: (string | number)[] = ["JAMI (keldi)", "", ""];
    for (const date of allDates) {
      const cnt = gAtt.filter((a: any) => a.date === date && (a.status === "present" || a.status === "late")).length;
      footerRow.push(cnt);
    }
    footerRow.push("", "", "", "", "", "", "");
    rows.push(footerRow);

    // ── Darsdan tashqari mukofot/jarimalar ────────────────────────────────
    // O'quvchining shaxsiy davomat sanalaridan TASHQARI barcha mukofot/jarimalar
    const extraRows: (string | number)[][] = [];

    for (const student of gStudents) {
      const studentAttDates = new Set(
        gAtt.filter((a: any) => a.student_id === student.id).map((a: any) => a.date)
      );

      filteredRewards
        .filter((r: any) => r.student_id === student.id && r.date && !studentAttDates.has(r.date))
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .forEach((r: any) => {
          const t = (r.type || "").toLowerCase();
          extraRows.push([
            student.name,
            r.date,
            t === "mukofot" ? "Mukofot (+)" : "Jarima (-)",
            Math.abs(Number(r.points ?? 0)),
            r.reason || r.description || "—",
          ]);
        });
    }

    if (extraRows.length > 0) {
      rows.push([]);
      rows.push(["⚠️ DARSDAN TASHQARI BALLAR"]);
      rows.push(["O'quvchi", "Sana", "Turi", "Ball", "Izoh"]);
      extraRows.forEach((r) => rows.push(r));
    }

    return rows;
  };

  // ── Aktiv guruhlar (o'sish tartibida) ──────────────────────────────────────
  const activeProcessed: string[] = [];
  for (const group of sortedGroups) {
    const rows = processGroup(group, false);
    if (!rows) continue;
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const allDates = [...new Set(
      attendance.filter((a: any) => {
        const gs = allStudents.filter((s: any) => s.group_id === group.id || s.group_name === group.name);
        return gs.some((s: any) => s.id === a.student_id);
      }).map((a: any) => a.date)
    )];
    const cols: XLSX.ColInfo[] = [{ wch: 26 }, { wch: 10 }, { wch: 10 }];
    allDates.forEach(() => cols.push({ wch: 7 }));
    cols.push({ wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 });
    ws["!cols"] = cols;

    let sheetName = group.name.slice(0, 27);
    let counter = 2;
    while (wb.SheetNames.includes(sheetName)) {
      sheetName = `${group.name.slice(0, 24)}_${counter++}`;
    }
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    activeProcessed.push(group.name);
  }

  // ── Arxivlangan guruhlar (o'sish tartibida, oxirida) ───────────────────────
  for (const group of sortedArchivedGroups) {
    const rows = processGroup(group, true);
    if (!rows) continue;
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const allDates = [...new Set(
      attendance.filter((a: any) => {
        const gs = allStudents.filter((s: any) => s.group_id === group.id || s.group_name === group.name);
        return gs.some((s: any) => s.id === a.student_id);
      }).map((a: any) => a.date)
    )];
    const cols: XLSX.ColInfo[] = [{ wch: 26 }, { wch: 10 }, { wch: 10 }];
    allDates.forEach(() => cols.push({ wch: 7 }));
    cols.push({ wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 });
    ws["!cols"] = cols;

    // Arxivlangan guruhlar nomi oxirida [A] bilan
    let sheetName = `${group.name.slice(0, 24)}[A]`;
    let counter = 2;
    while (wb.SheetNames.includes(sheetName)) {
      sheetName = `${group.name.slice(0, 21)}[A]${counter++}`;
    }
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (wb.SheetNames.length === 0) {
    const empty = XLSX.utils.aoa_to_sheet([["Ma'lumot topilmadi"]]);
    XLSX.utils.book_append_sheet(wb, empty, "Bo'sh");
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ─── FILE 3: To'liq profil va xom ma'lumotlar (import uchun ham yaroqli) ──────

async function buildFullDataFile(teacherId: string): Promise<Blob> {
  const wb = XLSX.utils.book_new();

  const groups = await fetchCol<any>("groups", teacherId);
  const students = await fetchCol<any>("students", teacherId);
  const attendance = await fetchCol<any>("attendance_records", teacherId);
  const rewards = await fetchCol<any>("reward_penalty_history", teacherId);
  const exams = await fetchCol<any>("exams", teacherId);
  const examResults = await fetchCol<any>("exam_results", teacherId);
  const archivedStudents = await fetchCol<any>("archived_students", teacherId);
  const archivedGroups = await fetchCol<any>("archived_groups", teacherId);
  const groupNotes = await fetchCol<any>("group_notes", teacherId);

  // Barcha o'quvchilar (aktiv + arxivlangan) — ism qidirish uchun
  const allStudents = [...students, ...archivedStudents];
  const allGroups = [...groups, ...archivedGroups];

  // Sheet 1: Guruhlar (faol)
  const gRows: any[][] = [
    ["=== FAOL GURUHLAR ==="],
    ["ID", "Nomi", "Fan", "Jadval", "Oylik to'lov", "teacher_id", "is_active", "created_at"],
  ];
  groups.forEach((g: any) => {
    gRows.push([g.id, g.name, g.subject || "", g.schedule || "", g.monthly_fee || "", g.teacher_id, g.is_active ?? true, g.created_at?.seconds ? new Date(g.created_at.seconds * 1000).toISOString() : g.created_at || ""]);
  });
  const wsG = XLSX.utils.aoa_to_sheet(gRows);
  wsG["!cols"] = colW([24, 20, 16, 20, 12, 24, 8, 24]);
  XLSX.utils.book_append_sheet(wb, wsG, "Guruhlar");

  // Sheet 2: O'quvchilar (faol)
  const sRows: any[][] = [
    ["=== FAOL O'QUVCHILAR ==="],
    ["ID", "Ism", "Guruh ID", "Guruh nomi", "Telefon", "Ota-ona tel.", "Tug'ilgan", "Qo'shilgan", "Faol", "teacher_id", "created_at"],
  ];
  students.forEach((s: any) => {
    const grp = allGroups.find((g: any) => g.id === s.group_id);
    sRows.push([s.id, s.name, s.group_id || "", grp?.name || s.group_name || "", s.phone || "", s.parent_phone || "",
      s.birth_date || "", s.join_date || s.joined_date || "", "Ha", s.teacher_id, s.created_at?.seconds ? new Date(s.created_at.seconds * 1000).toISOString() : s.created_at || ""]);
  });
  const wsS = XLSX.utils.aoa_to_sheet(sRows);
  wsS["!cols"] = colW([24, 24, 24, 18, 14, 14, 14, 14, 6, 24, 24]);
  XLSX.utils.book_append_sheet(wb, wsS, "O'quvchilar");

  // Sheet 3: Arxivlangan guruhlar
  if (archivedGroups.length > 0) {
    const agRows: any[][] = [
      ["=== ARXIVLANGAN GURUHLAR ==="],
      ["ID", "Nomi", "Fan", "Jadval", "Oylik to'lov", "teacher_id", "Arxivlangan sana", "created_at"],
    ];
    archivedGroups.forEach((g: any) => {
      agRows.push([g.id, g.name, g.subject || "", g.schedule || "", g.monthly_fee || "", g.teacher_id,
        g.archived_at?.seconds ? new Date(g.archived_at.seconds * 1000).toISOString() : g.archived_at || "",
        g.created_at?.seconds ? new Date(g.created_at.seconds * 1000).toISOString() : g.created_at || ""]);
    });
    const wsAG = XLSX.utils.aoa_to_sheet(agRows);
    wsAG["!cols"] = colW([24, 20, 16, 20, 12, 24, 24, 24]);
    XLSX.utils.book_append_sheet(wb, wsAG, "Arxiv guruhlar");
  }

  // Sheet 4: Arxivlangan o'quvchilar
  if (archivedStudents.length > 0) {
    const asRows: any[][] = [
      ["=== ARXIVLANGAN O'QUVCHILAR ==="],
      ["ID", "Ism", "Guruh ID", "Guruh nomi", "Telefon", "Qo'shilgan", "Chiqib ketgan", "teacher_id"],
    ];
    archivedStudents.forEach((s: any) => {
      const grp = allGroups.find((g: any) => g.id === s.group_id);
      asRows.push([s.id, s.name, s.group_id || "", grp?.name || s.group_name || "", s.phone || "",
        s.join_date || s.joined_date || "",
        s.left_date || (s.archived_at?.seconds ? new Date(s.archived_at.seconds * 1000).toISOString().split("T")[0] : ""),
        s.teacher_id]);
    });
    const wsAS = XLSX.utils.aoa_to_sheet(asRows);
    wsAS["!cols"] = colW([24, 24, 24, 18, 14, 14, 14, 24]);
    XLSX.utils.book_append_sheet(wb, wsAS, "Arxiv o'quvchilar");
  }

  // Sheet 5: Davomat (xom)
  const aRows: any[][] = [
    ["=== DAVOMAT YOZUVLARI ==="],
    ["ID", "O'quvchi ID", "O'quvchi ismi", "Guruh", "Sana", "Holat", "teacher_id"],
  ];
  attendance.forEach((a: any) => {
    const st = allStudents.find((s: any) => s.id === a.student_id);
    const grp = allGroups.find((g: any) => g.id === (st?.group_id || a.group_id));
    aRows.push([a.id, a.student_id, st?.name || "—", grp?.name || st?.group_name || "", a.date, a.status, a.teacher_id]);
  });
  const wsA = XLSX.utils.aoa_to_sheet(aRows);
  wsA["!cols"] = colW([28, 24, 24, 18, 14, 22, 24]);
  XLSX.utils.book_append_sheet(wb, wsA, "Davomat xom");

  // Sheet 6: Mukofot/Jarima
  const rRows: any[][] = [
    ["=== MUKOFOT VA JARIMALAR ==="],
    ["ID", "O'quvchi ID", "O'quvchi ismi", "Turi", "Ball", "Sana", "Izoh", "teacher_id"],
  ];
  rewards.forEach((r: any) => {
    const st = allStudents.find((s: any) => s.id === r.student_id);
    rRows.push([r.id, r.student_id, st?.name || "—", r.type || "", r.points || 0, r.date || "", r.reason || r.description || "", r.teacher_id]);
  });
  const wsR = XLSX.utils.aoa_to_sheet(rRows);
  wsR["!cols"] = colW([24, 24, 24, 12, 8, 14, 30, 24]);
  XLSX.utils.book_append_sheet(wb, wsR, "Mukofot-Jarima");

  // Sheet 7: Imtihonlar
  const eRows: any[][] = [
    ["=== IMTIHONLAR ==="],
    ["ID", "Nomi", "Turi", "Sana", "Max ball", "teacher_id"],
  ];
  exams.forEach((e: any) => {
    eRows.push([e.id, e.exam_name || e.name || "", e.exam_type || "", e.date || "", e.max_score || "", e.teacher_id]);
  });
  const wsE = XLSX.utils.aoa_to_sheet(eRows);
  wsE["!cols"] = colW([24, 26, 16, 14, 10, 24]);
  XLSX.utils.book_append_sheet(wb, wsE, "Imtihonlar");

  // Sheet 8: Imtihon natijalari
  const erRows: any[][] = [
    ["=== IMTIHON NATIJALARI ==="],
    ["ID", "Imtihon ID", "O'quvchi ID", "O'quvchi ismi", "Ball", "Max ball", "Foiz", "teacher_id"],
  ];
  examResults.forEach((er: any) => {
    const st = allStudents.find((s: any) => s.id === er.student_id);
    erRows.push([er.id, er.exam_id, er.student_id, st?.name || er.student_name || "—", er.score || 0, er.max_score || "", er.percentage || "", er.teacher_id]);
  });
  const wsER = XLSX.utils.aoa_to_sheet(erRows);
  wsER["!cols"] = colW([24, 24, 24, 24, 10, 10, 10, 24]);
  XLSX.utils.book_append_sheet(wb, wsER, "Imtihon natijalari");

  // Sheet 9: Guruh eslatmalari
  if (groupNotes.length > 0) {
    const gnRows: any[][] = [
      ["=== GURUH ESLATMALARI ==="],
      ["ID", "Guruh nomi", "Matn", "Yaratilgan", "teacher_id"],
    ];
    groupNotes.forEach((n: any) => {
      gnRows.push([n.id, n.group_name || "", n.text || n.content || "", n.created_date || n.created_at || "", n.teacher_id]);
    });
    const wsGN = XLSX.utils.aoa_to_sheet(gnRows);
    wsGN["!cols"] = colW([24, 20, 40, 14, 24]);
    XLSX.utils.book_append_sheet(wb, wsGN, "Guruh eslatmalari");
  }

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ─── Telegram sender ──────────────────────────────────────────────────────────

async function sendFileToTelegram(blob: Blob, fileName: string, caption: string): Promise<void> {
  const token = "8731548222:AAHO9LivULWi9U1TSiHc7SqVP91EEKkjScs";
  const chatId = "5574039857";

  const fd = new FormData();
  fd.append("chat_id", chatId);
  fd.append("document", blob, fileName);
  fd.append("caption", caption);

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: fd });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Telegram: ${(err as any).description || resp.statusText}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateTeachProXLSX(teacherId: string): Promise<Blob> {
  return buildRankingFile(teacherId);
}

export async function sendFullReportToTelegram(teacherId: string): Promise<void> {
  const date = new Date().toLocaleDateString("uz-UZ").replace(/\//g, "-");

  const [rankingBlob, attendanceBlob, fullDataBlob] = await Promise.all([
    buildRankingFile(teacherId),
    buildAttendanceFile(teacherId),
    buildFullDataFile(teacherId),
  ]);

  await sendFileToTelegram(rankingBlob, `Reyting_${date}.xlsx`,
    `📊 1/3 — REYTING VA STATISTIKA\n📅 ${date}\n\n🏆 O'quvchilar reytingi (saytdagi formula bilan)\n🏫 Guruhlar reytingi\n📈 Oylik tahlil`);

  await sendFileToTelegram(attendanceBlob, `Davomat_${date}.xlsx`,
    `📋 2/3 — DAVOMAT JADVALLARI\n📅 ${date}\n\n📁 Har bir sinf/guruh uchun alohida varaq\n✓ Kunlik davomat (K/C/X/S belgilari)`);

  await sendFileToTelegram(fullDataBlob, `Zaxira_${date}.xlsx`,
    `💾 3/3 — TO'LIQ ZAXIRA (Import uchun)\n📅 ${date}\n\n👤 Barcha o'quvchilar profili\n📝 Xom davomat yozuvlari\n🎁 Mukofot/Jarimalar\n📝 Imtihonlar va natijalar`);
}
