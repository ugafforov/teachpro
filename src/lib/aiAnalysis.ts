import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import {
  AnalysisHistoryItem,
  AnalyzeInsightsRequest,
  AnalyzeInsightsResponse,
  AskInsightsRequest,
  AskInsightsResponse,
  ProjectChatRequest,
  ProjectChatResponse,
} from "@/types/aiAnalysis";

export const analyzeInsights = async (
  currentUserId: string,
  role: "teacher" | "admin",
  request: AnalyzeInsightsRequest,
): Promise<AnalyzeInsightsResponse> => {
  try {
    // Fetch actual database data for context
    let databaseContext = "";
    let hasData = false;

    if (request.scope === "global" || request.scope === "group") {
      try {
        // Fetch students data
        const studentsQuery = query(
          collection(db, "students"),
          where("teacher_id", "==", currentUserId),
          where("is_active", "==", true),
        );
        const studentsSnap = await getDocs(studentsQuery);
        const students = studentsSnap.docs.map(doc => doc.data());
        
        if (students.length > 0) {
          hasData = true;
          databaseContext += `\n📊 O'quvchilar soni: ${students.length}\n`;
          
          // Add sample student names
          databaseContext += `O'quvchilar: ${students.slice(0, 5).map(s => s.name).join(", ")}${students.length > 5 ? " va boshqalari" : ""}\n`;
        }

        // Fetch groups data
        const groupsQuery = query(
          collection(db, "groups"),
          where("teacher_id", "==", currentUserId),
          where("is_active", "==", true),
        );
        const groupsSnap = await getDocs(groupsQuery);
        const groups = groupsSnap.docs.map(doc => doc.data());
        
        if (groups.length > 0) {
          databaseContext += `📚 Guruhlar soni: ${groups.length}\n`;
          databaseContext += `Guruhlar: ${groups.map(g => g.name).join(", ")}\n`;
        }

        // Fetch attendance data for date range
        const attendanceQuery = query(
          collection(db, "attendance_records"),
          where("teacher_id", "==", currentUserId),
          where("date", ">=", request.dateFrom),
          where("date", "<=", request.dateTo),
        );
        const attendanceSnap = await getDocs(attendanceQuery);
        const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());
        const presentCount = attendanceRecords.filter(r => r.status === "present").length;
        const absentCount = attendanceRecords.filter(r => r.status === "absent" || r.status === "absent_without_reason").length;
        
        if (attendanceRecords.length > 0) {
          databaseContext += `📅 Davomat: ${presentCount} keldi, ${absentCount} kelmadi (${request.dateFrom} - ${request.dateTo})\n`;
        }

        // Fetch exam data
        const examsQuery = query(
          collection(db, "exams"),
          where("teacher_id", "==", currentUserId),
        );
        const examsSnap = await getDocs(examsQuery);
        const exams = examsSnap.docs.map(doc => doc.data());
        
        if (exams.length > 0) {
          databaseContext += `📝 Imtihonlar soni: ${exams.length}\n`;
        }
      } catch (error) {
        console.log("Database fetch error:", error);
        // Continue without database data
      }
    }

    // Build prompt with actual database data
    const prompt = `
TAHLIL: ${request.modules.join(", ")} (${request.dateFrom} - ${request.dateTo})

${hasData ? `HAQIQIY MA'LUMOTLAR (faqat quyidagilardan foydalaning):\n${databaseContext}` : "MA'LUMOTLAR YO'Q"}

MUHIM QOIDALAR (qat'iy rioya qiling):
- ${hasData ? "FAQAT yuqoridagi haqiqiy ma'lumotlardan foydalaning" : "Ma'lumotlar yo'q deb ayt"}
- YANGI ismlar yoki ma'lumotlar YO'Q - faqat berilganlardan foydalaning
- Agar ma'lumot yetarli bo'lmasa: "Ma'lumot yetarli emas" deb ayt
- Qisqa va aniq bo'ling
- Emoji qo'llang
- Jadval kerak bo'lsa markdown table formatida bering
- O'zbek tilida
`;

    const aiResponse = await callGeminiDirect(prompt);

    // Parse AI response (simplified - you may need to enhance this)
    const response: AnalyzeInsightsResponse = {
      runId: `run-${Date.now()}`,
      status: "ok",
      generatedAt: new Date().toISOString(),
      language: "uz",
      summary: aiResponse,
      riskAlerts: [],
      anomalies: [],
      forecasts: [],
      whatIf: [],
      interventions: [],
      weeklyPlan: [],
      modelMeta: {
        provider: "openrouter",
        model: "google/gemini-2.5-flash",
        tokensIn: 0,
        tokensOut: 0,
      },
    };

    return response;
  } catch (error) {
    logError('aiAnalysis.analyzeInsights', error);
    const { message } = sanitizeError(error, 'fetch');
    throw new Error(message);
  }
};

export const askInsights = async (
  currentUserId: string,
  role: "teacher" | "admin",
  request: AskInsightsRequest,
): Promise<AskInsightsResponse> => {
  try {
    // Fetch actual database data for context
    let databaseContext = "";
    let hasData = false;

    try {
      // Fetch students data
      const studentsQuery = query(
        collection(db, "students"),
        where("teacher_id", "==", currentUserId),
        where("is_active", "==", true),
      );
      const studentsSnap = await getDocs(studentsQuery);
      const students = studentsSnap.docs.map(doc => doc.data());
      
      if (students.length > 0) {
        hasData = true;
        databaseContext += `\n📊 O'quvchilar soni: ${students.length}\n`;
        databaseContext += `O'quvchilar: ${students.map(s => s.name).join(", ")}\n`;
      }

      // Fetch groups data
      const groupsQuery = query(
        collection(db, "groups"),
        where("teacher_id", "==", currentUserId),
        where("is_active", "==", true),
      );
      const groupsSnap = await getDocs(groupsQuery);
      const groups = groupsSnap.docs.map(doc => doc.data());
      
      if (groups.length > 0) {
        databaseContext += `📚 Guruhlar: ${groups.map(g => g.name).join(", ")}\n`;
      }

      // Fetch recent attendance
      const today = new Date().toISOString().split('T')[0];
      const attendanceQuery = query(
        collection(db, "attendance_records"),
        where("teacher_id", "==", currentUserId),
        where("date", "==", today),
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());
      const presentCount = attendanceRecords.filter(r => r.status === "present").length;
      
      if (attendanceRecords.length > 0) {
        databaseContext += `📅 Bugungi davomat: ${presentCount}/${attendanceRecords.length} keldi\n`;
      }
    } catch (error) {
      console.log("Database fetch error:", error);
      // Continue without database data
    }

    const prompt = `
SAVOL: ${request.question}

${hasData ? `HAQIQIY MA'LUMOTLAR (faqat quyidagilardan foydalaning):\n${databaseContext}` : "MA'LUMOTLAR YO'Q"}

MUHIM QOIDALAR (qat'iy rioya qiling):
- ${hasData ? "FAQAT yuqoridagi haqiqiy ma'lumotlardan foydalaning" : "Ma'lumotlar yo'q deb ayt"}
- YANGI ismlar yoki ma'lumotlar YO'Q - faqat berilganlardan foydalaning
- Agar ma'lumot yetarli bo'lmasa: "Ma'lumot yetarli emas" deb ayt
- Qisqa va aniq bo'ling
- Emoji qo'llang
- Jadval kerak bo'lsa markdown table formatida bering
- O'zbek tilida
`;

    const answer = await callGeminiDirect(prompt);

    const response: AskInsightsResponse = {
      answer,
      citations: [],
    };

    return response;
  } catch (error) {
    logError('aiAnalysis.askInsights', error);
    const { message } = sanitizeError(error, 'fetch');
    throw new Error(message);
  }
};

export const chatWithProjectInsights = async (
  currentUserId: string,
  role: "teacher" | "admin",
  request: ProjectChatRequest,
): Promise<ProjectChatResponse> => {
  const getLatestRunDocs = async () => {
    try {
      // Preferred query (fast path when composite index exists).
      const historyQuery = query(
        collection(db, "ai_analysis_runs"),
        where("createdBy", "==", currentUserId),
        orderBy("created_at", "desc"),
        limit(1),
      );
      const snapshot = await getDocs(historyQuery);
      return snapshot.docs;
    } catch (error) {
      const message = String((error as { message?: string })?.message ?? "").toLowerCase();
      const code = String((error as { code?: string })?.code ?? "");
      const isIndexError =
        code === "failed-precondition" ||
        code === "permission-denied" ||
        message.includes("requires an index") ||
        message.includes("index");

      if (!isIndexError) {
        throw error;
      }

      // Fallback query without orderBy to avoid blocking AI chat when index is missing.
      // We sort in memory and take the latest run.
      const fallbackQuery = query(
        collection(db, "ai_analysis_runs"),
        where("createdBy", "==", currentUserId),
      );
      const fallbackSnapshot = await getDocs(fallbackQuery);
      return [...fallbackSnapshot.docs].sort((a, b) => {
        const aDate = (a.data().created_at as { toDate?: () => Date } | undefined)?.toDate?.();
        const bDate = (b.data().created_at as { toDate?: () => Date } | undefined)?.toDate?.();
        return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
      }).slice(0, 1);
    }
  };

  const runDocs = await getLatestRunDocs();
  
  if (runDocs.length === 0) {
    throw new Error(
      "Avval ma'lumotlarni tahlil qiling. 'Tahlil' tugmasini bosib, keyin savol bering."
    );
  }

  const latestRun = runDocs[0];
  const runId = latestRun.id;

  // Use askInsights to get the answer
  const askResponse = await askInsights(currentUserId, role, {
    runId,
    question: request.prompt,
  });

  // Return response in the expected format
  const runData = latestRun.data() as { created_at?: { toDate?: () => Date } };
  const generatedAt = runData.created_at?.toDate?.().toISOString() || new Date().toISOString();

  return {
    runId,
    answer: askResponse.answer,
    citations: askResponse.citations,
    generatedAt,
    sourceStatus: "cached",
    sourceSummary: latestRun.data().summary as string || "",
    modelMeta: {
      provider: "firebase-functions",
      model: "gemini",
      tokensIn: 0,
      tokensOut: 0,
    },
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
    (a, b) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime(),
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
    getDocs(
      query(
        collection(db, "groups"),
        where("teacher_id", "==", teacherId),
        where("is_active", "==", true),
      ),
    ),
    getDocs(
      query(
        collection(db, "students"),
        where("teacher_id", "==", teacherId),
        where("is_active", "==", true),
      ),
    ),
    getDocs(query(collection(db, "exams"), where("teacher_id", "==", teacherId))),
  ]);

  return {
    groups: groupsSnap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        name: (docSnap.data().name as string) ?? docSnap.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    students: studentsSnap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        name: (docSnap.data().name as string) ?? docSnap.id,
        groupName: (docSnap.data().group_name as string | undefined) ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    exams: examsSnap.docs
      .map((docSnap) => ({
        id: docSnap.id,
        examName: (docSnap.data().exam_name as string) ?? docSnap.id,
        examDate: (docSnap.data().exam_date as string | undefined) ?? "",
      }))
      .sort((a, b) => a.examName.localeCompare(b.examName)),
  };
};
