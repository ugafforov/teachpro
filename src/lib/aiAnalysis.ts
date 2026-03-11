import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import {
  askAboutStoredRun,
  chatWithProjectContext,
  runClientAiAnalysis,
} from "@/lib/aiAnalysisEngine";
import { db } from "@/lib/firebase";
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
): Promise<AnalyzeInsightsResponse> =>
  runClientAiAnalysis(currentUserId, role, request);

export const askInsights = async (
  currentUserId: string,
  role: "teacher" | "admin",
  request: AskInsightsRequest,
): Promise<AskInsightsResponse> =>
  askAboutStoredRun(currentUserId, role, request);

export const chatWithProjectInsights = async (
  currentUserId: string,
  role: "teacher" | "admin",
  request: ProjectChatRequest,
): Promise<ProjectChatResponse> =>
  chatWithProjectContext(currentUserId, role, request);

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
    createdAt: new Date(),
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
