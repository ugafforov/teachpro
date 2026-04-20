import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logError } from "./errorUtils";
import { sanitizeError } from "./errorUtils";
import { callGeminiDirect } from "./geminiDirect";
import { calculateAllStudentScores } from "./studentScoreCalculator";
import {
  AnalysisHistoryItem,
  AnalyzeInsightsRequest,
  AnalyzeInsightsResponse,
  AskInsightsRequest,
  AskInsightsResponse,
  ProjectChatRequest,
  ProjectChatResponse,
} from "@/types/aiAnalysis";

/** Firestore dan barcha kerakli ma'lumotlarni olib, AI uchun context tayyorlaydi */
async function buildDatabaseContext(teacherId: string): Promise<string> {
  let ctx = "";

  // 1. Hisoblangan ballar va davomat (calculateAllStudentScores ishlatiladi)
  const studentsWithScores = await calculateAllStudentScores(teacherId, undefined, "all");

  if (studentsWithScores.length === 0) {
    return "";
  }

  const sorted = [...studentsWithScores].sort((a, b) => b.score.totalScore - a.score.totalScore);

  ctx += `📊 Jami o'quvchilar: ${sorted.length}\n\n`;
  ctx += `O'quvchilar reytingi (ball bo'yicha):\n`;
  ctx += `| # | Ism | Guruh | Ball | Davomat | Keldi | Kelmadi |\n`;
  ctx += `|---|-----|-------|------|---------|-------|--------|\n`;
  sorted.forEach((s, i) => {
    ctx += `| ${i + 1} | ${s.name} | ${s.group_name || "—"} | ${s.score.totalScore.toFixed(1)} | ${s.score.attendancePercentage}% | ${s.score.presentCount} | ${s.score.absentCount} |\n`;
  });

  // 2. Guruhlar statistikasi
  const groupStats = new Map<string, { students: number; totalScore: number; totalAttendance: number }>();
  sorted.forEach(s => {
    const g = s.group_name || "Nomalum";
    if (!groupStats.has(g)) groupStats.set(g, { students: 0, totalScore: 0, totalAttendance: 0 });
    const gs = groupStats.get(g)!;
    gs.students++;
    gs.totalScore += s.score.totalScore;
    gs.totalAttendance += s.score.attendancePercentage;
  });

  ctx += `\n📚 Guruhlar statistikasi:\n`;
  ctx += `| Guruh | O'quvchilar | O'rtacha ball | O'rtacha davomat |\n`;
  ctx += `|-------|-------------|---------------|------------------|\n`;
  groupStats.forEach((gs, name) => {
    ctx += `| ${name} | ${gs.students} | ${(gs.totalScore / gs.students).toFixed(1)} | ${Math.round(gs.totalAttendance / gs.students)}% |\n`;
  });

  // 3. Imtihonlar
  const examsSnap = await getDocs(query(collection(db, "exams"), where("teacher_id", "==", teacherId)));
  const exams = examsSnap.docs.map(d => d.data());
  if (exams.length > 0) {
    ctx += `\n� Imtihonlar (${exams.length} ta):\n`;
    exams.slice(-10).forEach(e => {
      ctx += `  - ${e.exam_name} | Sana: ${e.exam_date} | Guruh: ${e.group_name || "—"}\n`;
    });

    // Imtihon natijalari
    const resultsSnap = await getDocs(query(collection(db, "exam_results"), where("teacher_id", "==", teacherId)));
    const results = resultsSnap.docs.map(d => d.data());
    if (results.length > 0) {
      const scores = results.map(r => Number(r.score || 0)).filter(s => s > 0);
      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        ctx += `\n📊 Imtihon natijalari: O'rtacha: ${avg.toFixed(1)}, Eng yuqori: ${max}, Eng past: ${min}\n`;
      }
    }
  }

  // 4. So'nggi 30 kun davomat
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const attSnap = await getDocs(query(
    collection(db, "attendance_records"),
    where("teacher_id", "==", teacherId),
    where("date", ">=", thirtyDaysAgo),
    where("date", "<=", today),
  ));
  const attRecords = attSnap.docs.map(d => d.data());
  if (attRecords.length > 0) {
    const present = attRecords.filter(r => r.status === "present").length;
    const late = attRecords.filter(r => r.status === "late").length;
    const absent = attRecords.filter(r => r.status === "absent_without_reason" || r.status === "absent").length;
    ctx += `\n📅 So'nggi 30 kun davomat: ${present} keldi, ${late} kech keldi, ${absent} kelmadi\n`;
  }

  // 5. Mukofot/Jarima
  const rewardsSnap = await getDocs(query(collection(db, "reward_penalty_history"), where("teacher_id", "==", teacherId)));
  const rewards = rewardsSnap.docs.map(d => d.data());
  if (rewards.length > 0) {
    const mukofot = rewards.filter(r => r.type === "Mukofot").length;
    const jarima = rewards.filter(r => r.type === "Jarima").length;
    ctx += `\n🏆 Mukofot: ${mukofot} ta, Jarima: ${jarima} ta\n`;
  }

  return ctx;
}

export const analyzeInsights = async (
  currentUserId: string,
  _role: "teacher" | "admin",
  request: AnalyzeInsightsRequest,
): Promise<AnalyzeInsightsResponse> => {
  try {
    const databaseContext = await buildDatabaseContext(currentUserId);

    if (!databaseContext) {
      return {
        runId: `run-${Date.now()}`,
        status: "ok",
        generatedAt: new Date().toISOString(),
        language: "uz",
        summary: "📊 Ma'lumotlar yo'q. Avval o'quvchilar qo'shing.",
        riskAlerts: [], anomalies: [], forecasts: [], whatIf: [], interventions: [], weeklyPlan: [],
        modelMeta: { provider: "openrouter", model: "google/gemini-2.5-flash", tokensIn: 0, tokensOut: 0 },
      };
    }

    const prompt = `Siz TeachPro CRM AI yordamchisisiz. Quyidagi haqiqiy ma'lumotlar asosida tahlil qiling.

TAHLIL TURI: ${request.modules.join(", ")}
DAVR: ${request.dateFrom} — ${request.dateTo}

MA'LUMOTLAR:
${databaseContext}

JAVOB FORMATI (qat'iy):
- Oddiy matn ishlat, ** * # ## kabi belgilar ISHLATMA
- Emoji faqat ma'noli joylarda ishlat: 🏆 reyting/yutuq, 📊 statistika/tahlil, ✅ yaxshi natija, ⚠️ ogohlantirish, ❌ muammo, 📅 sana/davr, 👤 o'quvchi, 👥 guruh, 📝 imtihon
- Har jumlaga emoji qo'yma, faqat kerakli joylarda
- Jadval kerak bo'lsa | Ustun | Ustun | formatida ber
- Ro'yxat uchun 1. 2. 3. yoki mos emoji ishlat
- O'zbek tilida, qisqa va aniq
- Ortiqcha so'z va iboralar ISHLATMA`;

    const aiResponse = await callGeminiDirect(prompt);

    return {
      runId: `run-${Date.now()}`,
      status: "ok",
      generatedAt: new Date().toISOString(),
      language: "uz",
      summary: aiResponse,
      riskAlerts: [], anomalies: [], forecasts: [], whatIf: [], interventions: [], weeklyPlan: [],
      modelMeta: { provider: "openrouter", model: "google/gemini-2.5-flash", tokensIn: 0, tokensOut: 0 },
    };
  } catch (error) {
    logError("aiAnalysis.analyzeInsights", error);
    const { message } = sanitizeError(error, "fetch");
    throw new Error(message);
  }
};

export const askInsights = async (
  currentUserId: string,
  _role: "teacher" | "admin",
  request: AskInsightsRequest,
): Promise<AskInsightsResponse> => {
  try {
    const databaseContext = await buildDatabaseContext(currentUserId);

    if (!databaseContext) {
      return {
        answer: "📊 Hozircha ma'lumotlar yo'q. Avval o'quvchilar qo'shing.",
        citations: [],
      };
    }

    const prompt = `Siz TeachPro CRM AI yordamchisisiz. Quyidagi haqiqiy ma'lumotlar asosida savolga javob bering.

SAVOL: ${request.question}

MA'LUMOTLAR:
${databaseContext}

JAVOB FORMATI (qat'iy):
- Oddiy matn ishlat, ** * # ## kabi belgilar ISHLATMA
- Emoji faqat ma'noli joylarda ishlat: 🏆 reyting/yutuq, 📊 statistika/tahlil, ✅ yaxshi natija, ⚠️ ogohlantirish, ❌ muammo, 📅 sana/davr, 👤 o'quvchi, 👥 guruh, 📝 imtihon
- Har jumlaga emoji qo'yma, faqat kerakli joylarda
- Jadval kerak bo'lsa | Ustun | Ustun | formatida ber
- Ro'yxat uchun 1. 2. 3. yoki mos emoji ishlat
- O'zbek tilida, qisqa va aniq
- Ortiqcha so'z va iboralar ISHLATMA`;

    const answer = await callGeminiDirect(prompt);
    return { answer, citations: [] };
  } catch (error) {
    logError("aiAnalysis.askInsights", error);
    const { message } = sanitizeError(error, "fetch");
    throw new Error(message);
  }
};

export const chatWithProjectInsights = async (
  currentUserId: string,
  role: "teacher" | "admin",
  request: ProjectChatRequest,
): Promise<ProjectChatResponse> => {
  const runId = `run-${Date.now()}`;

  const askResponse = await askInsights(currentUserId, role, {
    runId,
    question: request.prompt,
  });

  return {
    runId,
    answer: askResponse.answer,
    citations: askResponse.citations,
    generatedAt: new Date().toISOString(),
    sourceStatus: "ok",
    sourceSummary: "",
    modelMeta: { provider: "openrouter", model: "google/gemini-2.5-flash", tokensIn: 0, tokensOut: 0 },
  };
};

export const fetchAnalysisHistory = async (
  currentUserId: string,
): Promise<AnalysisHistoryItem[]> => {
  const historyQuery = query(
    collection(db, "ai_analysis_runs"),
    where("createdBy", "==", currentUserId),
  );

  const snapshot = await getDocs(historyQuery);
  const items: AnalysisHistoryItem[] = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const response = data.response as AnalyzeInsightsResponse | undefined;
    if (!response) return;

    const generatedAtValue = data.generatedAt as { toDate?: () => Date } | undefined;
    const generatedAt =
      generatedAtValue?.toDate?.().toISOString() ??
      response.generatedAt ??
      new Date(0).toISOString();

    items.push({
      id: docSnap.id,
      generatedAt,
      scope: (data.scope as AnalysisHistoryItem["scope"]) ?? "global",
      entityId: (data.entityId as string | undefined) ?? undefined,
      summary: (data.summary as string) ?? response.summary ?? "",
      response,
    });
  });

  return items.sort(
    (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
  );
};

export const deleteAnalysisRun = async (runId: string): Promise<void> => {
  await deleteDoc(doc(db, "ai_analysis_runs", runId));
};

export const submitAnalysisFeedback = async (
  runId: string,
  createdBy: string,
  feedback: "helpful" | "not_helpful",
): Promise<void> => {
  await addDoc(collection(db, "ai_analysis_feedback"), {
    runId,
    createdBy,
    feedback,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    created_at: serverTimestamp(),
  });
};

export const fetchTeacherEntitiesForFilters = async (teacherId: string) => {
  const [groupsSnap, studentsSnap, examsSnap] = await Promise.all([
    getDocs(query(collection(db, "groups"), where("teacher_id", "==", teacherId), where("is_active", "==", true))),
    getDocs(query(collection(db, "students"), where("teacher_id", "==", teacherId), where("is_active", "==", true))),
    getDocs(query(collection(db, "exams"), where("teacher_id", "==", teacherId))),
  ]);

  return {
    groups: groupsSnap.docs
      .map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    students: studentsSnap.docs
      .map(d => ({ id: d.id, name: (d.data().name as string) ?? d.id, groupName: (d.data().group_name as string) ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    exams: examsSnap.docs
      .map(d => ({ id: d.id, examName: (d.data().exam_name as string) ?? d.id, examDate: (d.data().exam_date as string) ?? "" }))
      .sort((a, b) => a.examName.localeCompare(b.examName)),
  };
};
