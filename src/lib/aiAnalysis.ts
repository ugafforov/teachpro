import { httpsCallable } from "firebase/functions";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, functionsClient } from "@/lib/firebase";
import {
  AnalyzeInsightsRequest,
  AnalyzeInsightsResponse,
  AskInsightsRequest,
  AskInsightsResponse,
  AnalysisHistoryItem,
} from "@/types/aiAnalysis";

const analyzeCallable = httpsCallable<AnalyzeInsightsRequest, AnalyzeInsightsResponse>(
  functionsClient,
  "aiAnalyzeInsights",
);

const askCallable = httpsCallable<AskInsightsRequest, AskInsightsResponse>(
  functionsClient,
  "aiAskAboutInsights",
);

export const analyzeInsights = async (
  request: AnalyzeInsightsRequest,
): Promise<AnalyzeInsightsResponse> => {
  const result = await analyzeCallable(request);
  return result.data;
};

export const askInsights = async (
  request: AskInsightsRequest,
): Promise<AskInsightsResponse> => {
  const result = await askCallable(request);
  return result.data;
};

export const fetchAnalysisHistory = async (
  currentUserId: string,
): Promise<AnalysisHistoryItem[]> => {
  const historyQuery = query(
    collection(db, "ai_analysis_runs"),
    where("createdBy", "==", currentUserId),
  );

  const snap = await getDocs(historyQuery);
  const items: AnalysisHistoryItem[] = [];

  snap.docs.forEach((docSnap) => {
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
      .map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    students: studentsSnap.docs
      .map((d) => ({
        id: d.id,
        name: (d.data().name as string) ?? d.id,
        groupName: (d.data().group_name as string | undefined) ?? "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    exams: examsSnap.docs
      .map((d) => ({
        id: d.id,
        examName: (d.data().exam_name as string) ?? d.id,
        examDate: (d.data().exam_date as string | undefined) ?? "",
      }))
      .sort((a, b) => a.examName.localeCompare(b.examName)),
  };
};
