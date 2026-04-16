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
import { functionsClient, db } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { logError } from "./errorUtils";
import { sanitizeError } from "./errorUtils";
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
  if (!functionsClient) {
    throw new Error("Firebase Functions is not initialized. Please check your configuration.");
  }

  try {
    const aiAnalyzeInsights = httpsCallable(functionsClient, 'aiAnalyzeInsights');
    const result = await aiAnalyzeInsights(request);
    return result.data as AnalyzeInsightsResponse;
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
  if (!functionsClient) {
    throw new Error("Firebase Functions is not initialized. Please check your configuration.");
  }

  try {
    const aiAskAboutInsights = httpsCallable(functionsClient, 'aiAskAboutInsights');
    const result = await aiAskAboutInsights(request);
    return result.data as AskInsightsResponse;
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
  // Get the latest analysis run for this user
  const historyQuery = query(
    collection(db, "ai_analysis_runs"),
    where("createdBy", "==", currentUserId),
    orderBy("created_at", "desc"),
    limit(1)
  );

  const snapshot = await getDocs(historyQuery);
  
  if (snapshot.empty) {
    throw new Error(
      "Avval ma'lumotlarni tahlil qiling. 'Tahlil' tugmasini bosib, keyin savol bering."
    );
  }

  const latestRun = snapshot.docs[0];
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
