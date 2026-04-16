
import { createHash } from "node:crypto";
import {
  CollectionReference,
  DocumentData,
  Firestore,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  AnalyzeInsightsRequest,
  AnalyzeInsightsResponse,
  AskInsightsRequest,
  AskInsightsResponse,
  analyzeInsightsResponseSchema,
  askInsightsResponseSchema,
} from "./contracts";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_QUERY_DOCS = 5000;
const MAX_POINTS = 4;
const RISK_ATTENDANCE_LOW = 70;
const RISK_ATTENDANCE_WARN = 85;
const RISK_EXAM_LOW = 60;
const RISK_EXAM_WARN = 75;

type Role = "teacher" | "admin";

type AttendanceRecord = {
  student_id?: string;
  teacher_id?: string;
  date?: string;
  status?: string;
};

type RewardRecord = {
  student_id?: string;
  teacher_id?: string;
  date?: string;
  type?: string;
  points?: number | string;
};

type StudentDoc = {
  id: string;
  teacher_id?: string;
  group_name?: string;
  name?: string;
  student_id?: string;
};

type GroupDoc = {
  id: string;
  teacher_id?: string;
  name?: string;
};

type ExamDoc = {
  id: string;
  teacher_id?: string;
  group_id?: string;
  exam_name?: string;
  exam_date?: string;
};

type ExamResultDoc = {
  exam_id?: string;
  student_id?: string;
  teacher_id?: string;
  score?: number | string;
};

type AggregatedData = {
  totalStudents: number;
  totalGroups: number;
  attendanceRate: number;
  examAverage: number;
  rewardEvents: number;
  penaltyEvents: number;
  sourceStats: {
    attendanceRecords: number;
    rewardRecords: number;
    exams: number;
    examResults: number;
  };
  students: Array<{
    token: string;
    groupToken: string;
    attendancePct: number;
    avgExamScore: number;
    penalties: number;
    rewards: number;
    riskLevel: "high" | "medium" | "low";
    riskScore: number;
  }>;
  studentIdToToken: Record<string, string>;
  groupIdToToken: Record<string, string>;
  trend: {
    attendance: Array<{ date: string; value: number }>;
    examScore: Array<{ date: string; value: number }>;
    discipline: Array<{ date: string; value: number }>;
  };
};

type ScopeContext = {
  teacherFilter?: string;
  groupId?: string;
  studentId?: string;
  examId?: string;
  subject?: string;
};

type ModelOutput = Omit<
  AnalyzeInsightsResponse,
  "runId" | "status" | "generatedAt" | "modelMeta" | "language"
>;

const modelOutputSchema = analyzeInsightsResponseSchema.omit({
  runId: true,
  status: true,
  generatedAt: true,
  modelMeta: true,
  language: true,
});

type JsonSchema = Record<string, unknown>;
type SupportedAiProvider = "openai" | "gemini";
type LlmJsonCallResult<T> = {
  parsed: T;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: SupportedAiProvider;
};

const jsonStringSchema = { type: "string" } as const;
const jsonNumberSchema = { type: "number" } as const;
const jsonIntegerSchema = { type: "integer" } as const;

function jsonArraySchema(items: JsonSchema): JsonSchema {
  return { type: "array", items };
}

function jsonObjectSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema {
  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

const modelOutputResponseJsonSchema = jsonObjectSchema(
  {
    summary: jsonStringSchema,
    riskAlerts: jsonArraySchema(
      jsonObjectSchema(
        {
          id: jsonStringSchema,
          level: { type: "string", enum: ["high", "medium", "low"] },
          reason: jsonStringSchema,
          confidence: jsonNumberSchema,
          affectedCount: jsonIntegerSchema,
        },
        ["id", "level", "reason", "confidence", "affectedCount"],
      ),
    ),
    anomalies: jsonArraySchema(
      jsonObjectSchema(
        {
          metric: jsonStringSchema,
          current: jsonNumberSchema,
          baseline: jsonNumberSchema,
          deltaPct: jsonNumberSchema,
          explanation: jsonStringSchema,
        },
        ["metric", "current", "baseline", "deltaPct", "explanation"],
      ),
    ),
    forecasts: jsonArraySchema(
      jsonObjectSchema(
        {
          metric: {
            type: "string",
            enum: ["attendance", "exam_score", "discipline"],
          },
          horizonDays: jsonIntegerSchema,
          points: jsonArraySchema(
            jsonObjectSchema(
              {
                date: jsonStringSchema,
                value: jsonNumberSchema,
              },
              ["date", "value"],
            ),
          ),
          confidence: jsonNumberSchema,
        },
        ["metric", "horizonDays", "points", "confidence"],
      ),
    ),
    whatIf: jsonArraySchema(
      jsonObjectSchema(
        {
          scenario: jsonStringSchema,
          expectedDeltaPct: jsonNumberSchema,
          confidence: jsonNumberSchema,
          assumptions: jsonStringSchema,
        },
        ["scenario", "expectedDeltaPct", "confidence", "assumptions"],
      ),
    ),
    interventions: jsonArraySchema(
      jsonObjectSchema(
        {
          title: jsonStringSchema,
          priority: { type: "integer", enum: [1, 2, 3] },
          owner: { type: "string", enum: ["teacher", "admin"] },
          dueInDays: jsonIntegerSchema,
          expectedImpact: jsonStringSchema,
          steps: jsonStringSchema,
        },
        ["title", "priority", "owner", "dueInDays", "expectedImpact", "steps"],
      ),
    ),
    weeklyPlan: jsonArraySchema(
      jsonObjectSchema(
        {
          day: jsonStringSchema,
          task: jsonStringSchema,
        },
        ["day", "task"],
      ),
    ),
    comparison: jsonObjectSchema({
      previousRunId: jsonStringSchema,
      attendanceDeltaPct: jsonNumberSchema,
      examDeltaPct: jsonNumberSchema,
      highRiskDelta: jsonNumberSchema,
      summary: jsonStringSchema,
    }),
  },
  [
    "summary",
    "riskAlerts",
    "anomalies",
    "forecasts",
    "whatIf",
    "interventions",
    "weeklyPlan",
  ],
);

const askInsightsResponseJsonSchema = jsonObjectSchema(
  {
    answer: jsonStringSchema,
    citations: jsonArraySchema(jsonStringSchema),
  },
  ["answer", "citations"],
);

function normalizeAiProviderName(rawProvider?: string): SupportedAiProvider {
  if (rawProvider === "gemini") {
    return "gemini";
  }
  return "openai";
}

function getSelectedProvider(): SupportedAiProvider {
  if (process.env.AI_PROVIDER) {
    return normalizeAiProviderName(process.env.AI_PROVIDER);
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return "gemini";
  }

  return "openai";
}

function getDefaultModelForProvider(provider: SupportedAiProvider): string {
  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
  }

  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function resolveModelName(
  provider: SupportedAiProvider,
  fallbackModel: string,
): string {
  if (process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }

  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || fallbackModel;
  }

  return process.env.OPENAI_MODEL || fallbackModel;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateSafe(input: string): Date {
  const dt = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) {
    throw new HttpsError("invalid-argument", `Noto'g'ri sana: ${input}`);
  }
  return dt;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeDateRange(dateFrom: string, dateTo: string): { from: Date; to: Date } {
  const from = parseDateSafe(dateFrom);
  const to = parseDateSafe(dateTo);
  if (from.getTime() > to.getTime()) {
    throw new HttpsError("invalid-argument", "dateFrom dateTo dan katta bo'lishi mumkin emas");
  }
  return { from, to };
}

function dateInRange(dateStr: string | undefined, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const dt = parseDateSafe(dateStr);
  return dt.getTime() >= from.getTime() && dt.getTime() <= to.getTime();
}

function listRecentDates(from: Date, to: Date, points = MAX_POINTS): string[] {
  if (points <= 0) return [];
  const totalDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
  const step = Math.max(1, Math.floor(totalDays / points));
  const dates: string[] = [];
  for (let i = points - 1; i >= 0; i -= 1) {
    const d = new Date(to.getTime() - i * step * 86400000);
    dates.push(toIsoDate(d));
  }
  return dates;
}

function hashKey(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function extractJsonBlock(rawText: string): string {
  const trimmed = rawText.trim();
  const fenced = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return fenced.slice(start, end + 1);
  }
  return fenced;
}

function levelByScore(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function computeRisk(attendancePct: number, examAvg: number, penalties: number, rewards: number): {
  score: number;
  level: "high" | "medium" | "low";
} {
  let score = 0;

  if (attendancePct < RISK_ATTENDANCE_LOW) score += 40;
  else if (attendancePct < RISK_ATTENDANCE_WARN) score += 20;

  if (examAvg > 0 && examAvg < RISK_EXAM_LOW) score += 35;
  else if (examAvg > 0 && examAvg < RISK_EXAM_WARN) score += 15;

  if (penalties > rewards) score += 15;
  if (attendancePct === 0) score += 10;

  return { score, level: levelByScore(score) };
}

function computeDeltaPct(current: number, baseline: number): number {
  if (baseline === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - baseline) / Math.abs(baseline)) * 100).toFixed(2));
}

function buildForecastPoints(
  metric: "attendance" | "exam_score" | "discipline",
  history: Array<{ date: string; value: number }>,
): Array<{ date: string; value: number }> {
  if (history.length === 0) return [];

  const last = history[history.length - 1]?.value ?? 0;
  const first = history[0]?.value ?? last;
  const slope = history.length > 1 ? (last - first) / (history.length - 1) : 0;

  const startDate = parseDateSafe(history[history.length - 1].date);
  const points: Array<{ date: string; value: number }> = [];

  for (let i = 1; i <= 4; i += 1) {
    const forecastDate = new Date(startDate.getTime() + i * 7 * 86400000);
    const nextValueRaw = last + slope * i;
    const nextValue =
      metric === "discipline"
        ? clamp(Number(nextValueRaw.toFixed(2)), 0, 200)
        : clamp(Number(nextValueRaw.toFixed(2)), 0, 100);

    points.push({
      date: toIsoDate(forecastDate),
      value: nextValue,
    });
  }

  return points;
}

function pickConfidence(dataVolume: number): number {
  if (dataVolume >= 300) return 0.84;
  if (dataVolume >= 120) return 0.74;
  if (dataVolume >= 40) return 0.64;
  return 0.52;
}

async function isAdminUser(db: Firestore, uid: string): Promise<boolean> {
  const adminDoc = await db.collection("admins").doc(uid).get();
  return adminDoc.exists;
}
async function getEntityDoc(
  db: Firestore,
  collectionName: string,
  entityId: string,
): Promise<QueryDocumentSnapshot<DocumentData> | null> {
  const docSnap = await db.collection(collectionName).doc(entityId).get();
  if (!docSnap.exists) return null;
  return docSnap as QueryDocumentSnapshot<DocumentData>;
}

async function resolveScopeContext(
  db: Firestore,
  role: Role,
  uid: string,
  request: AnalyzeInsightsRequest,
): Promise<ScopeContext> {
  const context: ScopeContext = {
    teacherFilter: role === "teacher" ? uid : undefined,
    subject: request.subject,
  };

  if (request.scope === "global") {
    return context;
  }

  if (!request.entityId) {
    throw new HttpsError("invalid-argument", "Ushbu scope uchun entityId majburiy");
  }

  if (request.scope === "group") {
    const groupDoc = await getEntityDoc(db, "groups", request.entityId);
    if (!groupDoc) {
      throw new HttpsError("not-found", "Guruh topilmadi");
    }
    const groupData = groupDoc.data() as GroupDoc;
    const teacherId = groupData.teacher_id;
    if (!teacherId) {
      throw new HttpsError("failed-precondition", "Guruhda teacher_id mavjud emas");
    }
    if (role === "teacher" && teacherId !== uid) {
      throw new HttpsError("permission-denied", "Bu guruh sizga tegishli emas");
    }
    context.teacherFilter = teacherId;
    context.groupId = request.entityId;
    return context;
  }

  if (request.scope === "student") {
    const studentDoc = await getEntityDoc(db, "students", request.entityId);
    if (!studentDoc) {
      throw new HttpsError("not-found", "O'quvchi topilmadi");
    }
    const studentData = studentDoc.data() as StudentDoc;
    const teacherId = studentData.teacher_id;
    if (!teacherId) {
      throw new HttpsError("failed-precondition", "O'quvchi teacher_id topilmadi");
    }
    if (role === "teacher" && teacherId !== uid) {
      throw new HttpsError("permission-denied", "Bu o'quvchi sizga tegishli emas");
    }
    context.teacherFilter = teacherId;
    context.studentId = request.entityId;
    return context;
  }

  const examDoc = await getEntityDoc(db, "exams", request.entityId);
  if (!examDoc) {
    throw new HttpsError("not-found", "Imtihon topilmadi");
  }
  const examData = examDoc.data() as ExamDoc;
  const teacherId = examData.teacher_id;
  if (!teacherId) {
    throw new HttpsError("failed-precondition", "Imtihonda teacher_id topilmadi");
  }
  if (role === "teacher" && teacherId !== uid) {
    throw new HttpsError("permission-denied", "Bu imtihon sizga tegishli emas");
  }
  context.teacherFilter = teacherId;
  context.examId = request.entityId;
  if (examData.group_id) {
    context.groupId = examData.group_id;
  }
  return context;
}

async function getDocsWithOptionalTeacher(
  db: Firestore,
  collectionName: string,
  teacherId?: string,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  let baseQuery: Query<DocumentData> = db.collection(collectionName);
  if (teacherId) {
    baseQuery = baseQuery.where("teacher_id", "==", teacherId);
  }

  const snapshot = await baseQuery.limit(MAX_QUERY_DOCS).get();
  return snapshot.docs;
}

function groupNameById(groups: GroupDoc[]): Record<string, string> {
  const map: Record<string, string> = {};
  groups.forEach((g) => {
    if (g.id && g.name) map[g.id] = g.name;
  });
  return map;
}

function buildToken(prefix: string, index: number, width = 3): string {
  return `${prefix}-${String(index + 1).padStart(width, "0")}`;
}

async function aggregateData(
  db: Firestore,
  request: AnalyzeInsightsRequest,
  context: ScopeContext,
): Promise<AggregatedData> {
  const { from, to } = normalizeDateRange(request.dateFrom, request.dateTo);

  const [groupSnaps, studentSnaps, attendanceSnaps, rewardSnaps, examSnaps, examResultSnaps] =
    await Promise.all([
      getDocsWithOptionalTeacher(db, "groups", context.teacherFilter),
      getDocsWithOptionalTeacher(db, "students", context.teacherFilter),
      getDocsWithOptionalTeacher(db, "attendance_records", context.teacherFilter),
      getDocsWithOptionalTeacher(db, "reward_penalty_history", context.teacherFilter),
      getDocsWithOptionalTeacher(db, "exams", context.teacherFilter),
      getDocsWithOptionalTeacher(db, "exam_results", context.teacherFilter),
    ]);

  const groupsRaw: GroupDoc[] = groupSnaps.map((d) => {
    const data = d.data() as Omit<GroupDoc, "id">;
    return { ...data, id: d.id };
  });
  const studentsRaw: StudentDoc[] = studentSnaps.map((d) => {
    const data = d.data() as Omit<StudentDoc, "id">;
    return { ...data, id: d.id };
  });
  const attendanceRaw: AttendanceRecord[] = attendanceSnaps.map((d) => d.data() as AttendanceRecord);
  const rewardsRaw: RewardRecord[] = rewardSnaps.map((d) => d.data() as RewardRecord);
  const examsRaw: ExamDoc[] = examSnaps.map((d) => {
    const data = d.data() as Omit<ExamDoc, "id">;
    return { ...data, id: d.id };
  });
  const examResultsRaw: ExamResultDoc[] = examResultSnaps.map((d) => d.data() as ExamResultDoc);

  const onlyActiveStudents = studentsRaw.filter((s) => s.id && s.teacher_id);
  const groupsMapById = groupNameById(groupsRaw);

  let students = onlyActiveStudents;
  if (context.studentId) {
    students = students.filter((s) => s.id === context.studentId);
  } else if (context.groupId) {
    const targetGroupName = groupsMapById[context.groupId];
    students = students.filter((s) => s.group_name === targetGroupName);
  }

  const studentIdSet = new Set(students.map((s) => s.id));

  let exams = examsRaw;
  if (request.subject) {
    const normalizedSubject = request.subject.toLowerCase();
    exams = exams.filter((e) => (e.exam_name ?? "").toLowerCase().includes(normalizedSubject));
  }
  if (context.examId) {
    exams = exams.filter((e) => e.id === context.examId);
  }
  if (context.groupId) {
    exams = exams.filter((e) => e.group_id === context.groupId);
  }

  const examIdSet = new Set(exams.map((e) => e.id));

  const attendance = attendanceRaw.filter(
    (a) => studentIdSet.has(a.student_id ?? "") && dateInRange(a.date, from, to),
  );
  const rewards = rewardsRaw.filter(
    (r) => studentIdSet.has(r.student_id ?? "") && dateInRange(r.date, from, to),
  );
  const examResults = examResultsRaw.filter(
    (r) =>
      studentIdSet.has(r.student_id ?? "") &&
      examIdSet.has(r.exam_id ?? "") &&
      exams.some((e) => e.id === r.exam_id && dateInRange(e.exam_date, from, to)),
  );
  const uniqueGroupNames = Array.from(new Set(students.map((s) => s.group_name ?? "").filter(Boolean)));
  const groupTokenMap = new Map<string, string>();
  uniqueGroupNames.forEach((groupName, idx) => {
    groupTokenMap.set(groupName, buildToken("G", idx, 2));
  });

  const studentTokenMap = new Map<string, string>();
  students.forEach((student, idx) => {
    studentTokenMap.set(student.id, buildToken("S", idx, 3));
  });

  const attendanceByStudent = new Map<string, AttendanceRecord[]>();
  attendance.forEach((record) => {
    const studentId = record.student_id;
    if (!studentId) return;
    const list = attendanceByStudent.get(studentId) ?? [];
    list.push(record);
    attendanceByStudent.set(studentId, list);
  });

  const rewardsByStudent = new Map<string, RewardRecord[]>();
  rewards.forEach((record) => {
    const studentId = record.student_id;
    if (!studentId) return;
    const list = rewardsByStudent.get(studentId) ?? [];
    list.push(record);
    rewardsByStudent.set(studentId, list);
  });

  const examByStudent = new Map<string, ExamResultDoc[]>();
  examResults.forEach((result) => {
    const studentId = result.student_id;
    if (!studentId) return;
    const list = examByStudent.get(studentId) ?? [];
    list.push(result);
    examByStudent.set(studentId, list);
  });

  const attendancePresentOrLate = attendance.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const attendanceRate = attendance.length
    ? Number(((attendancePresentOrLate / attendance.length) * 100).toFixed(2))
    : 0;

  const examAverage = examResults.length
    ? Number((examResults.reduce((sum, e) => sum + toNumber(e.score), 0) / examResults.length).toFixed(2))
    : 0;

  const rewardEvents = rewards.filter((r) => r.type === "Mukofot").length;
  const penaltyEvents = rewards.filter((r) => r.type === "Jarima").length;

  const studentsSummary = students.map((student) => {
    const studentAttendance = attendanceByStudent.get(student.id) ?? [];
    const studentRewards = rewardsByStudent.get(student.id) ?? [];
    const studentExamResults = examByStudent.get(student.id) ?? [];

    const presentOrLate = studentAttendance.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length;
    const attendancePct = studentAttendance.length
      ? Number(((presentOrLate / studentAttendance.length) * 100).toFixed(2))
      : 0;

    const avgExamScore = studentExamResults.length
      ? Number(
          (
            studentExamResults.reduce((sum, row) => sum + toNumber(row.score), 0) /
            studentExamResults.length
          ).toFixed(2),
        )
      : 0;

    const penalties = studentRewards
      .filter((r) => r.type === "Jarima")
      .reduce((sum, r) => sum + toNumber(r.points), 0);
    const rewardsPoints = studentRewards
      .filter((r) => r.type === "Mukofot")
      .reduce((sum, r) => sum + toNumber(r.points), 0);

    const risk = computeRisk(attendancePct, avgExamScore, penalties, rewardsPoints);

    return {
      token: studentTokenMap.get(student.id) ?? "S-000",
      groupToken: groupTokenMap.get(student.group_name ?? "") ?? "G-00",
      attendancePct,
      avgExamScore,
      penalties,
      rewards: rewardsPoints,
      riskLevel: risk.level,
      riskScore: risk.score,
    };
  });

  const timeline = listRecentDates(from, to, MAX_POINTS);

  const attendanceTrend = timeline.map((d) => {
    const records = attendance.filter((r) => r.date === d);
    const positive = records.filter((r) => r.status === "present" || r.status === "late").length;
    const ratio = records.length ? Number(((positive / records.length) * 100).toFixed(2)) : 0;
    return { date: d, value: ratio };
  });

  const examDateById = new Map(exams.map((e) => [e.id, e.exam_date ?? ""] as const));
  const examTrend = timeline.map((d) => {
    const rows = examResults.filter((r) => examDateById.get(r.exam_id ?? "") === d);
    const value = rows.length
      ? Number((rows.reduce((sum, row) => sum + toNumber(row.score), 0) / rows.length).toFixed(2))
      : 0;
    return { date: d, value };
  });

  const disciplineTrend = timeline.map((d) => {
    const dayPenalties = rewards.filter((r) => r.date === d && r.type === "Jarima").length;
    return { date: d, value: Number(dayPenalties.toFixed(2)) };
  });

  const studentIdToToken: Record<string, string> = {};
  studentTokenMap.forEach((token, id) => {
    studentIdToToken[id] = token;
  });

  const groupIdToToken: Record<string, string> = {};
  groupsRaw.forEach((group) => {
    if (!group.id || !group.name) return;
    const token = groupTokenMap.get(group.name);
    if (token) {
      groupIdToToken[group.id] = token;
    }
  });

  return {
    totalStudents: students.length,
    totalGroups: uniqueGroupNames.length,
    attendanceRate,
    examAverage,
    rewardEvents,
    penaltyEvents,
    sourceStats: {
      attendanceRecords: attendance.length,
      rewardRecords: rewards.length,
      exams: exams.length,
      examResults: examResults.length,
    },
    students: studentsSummary,
    studentIdToToken,
    groupIdToToken,
    trend: {
      attendance: attendanceTrend,
      examScore: examTrend,
      discipline: disciplineTrend,
    },
  };
}

function buildHeuristicOutput(aggregated: AggregatedData): ModelOutput {
  const sortedByRisk = [...aggregated.students].sort((a, b) => b.riskScore - a.riskScore);
  const highRiskStudents = sortedByRisk.filter((s) => s.riskLevel === "high");
  const mediumRiskStudents = sortedByRisk.filter((s) => s.riskLevel === "medium");

  const riskAlerts = [
    {
      id: "risk-high",
      level: "high" as const,
      reason: `${highRiskStudents.length} ta o'quvchida yuqori xavf signali bor (davomat yoki imtihon natijasi pasaygan).`,
      confidence: pickConfidence(aggregated.sourceStats.attendanceRecords + aggregated.sourceStats.examResults),
      affectedCount: highRiskStudents.length,
    },
    {
      id: "risk-medium",
      level: "medium" as const,
      reason: `${mediumRiskStudents.length} ta o'quvchida o'rtacha xavf kuzatilmoqda, monitoringni kuchaytirish tavsiya etiladi.`,
      confidence: pickConfidence(aggregated.sourceStats.attendanceRecords),
      affectedCount: mediumRiskStudents.length,
    },
  ].filter((item) => item.affectedCount > 0);
  const attendanceBaseline = aggregated.trend.attendance[0]?.value ?? aggregated.attendanceRate;
  const examBaseline = aggregated.trend.examScore[0]?.value ?? aggregated.examAverage;
  const disciplineBaseline = aggregated.trend.discipline[0]?.value ?? 0;

  const anomalies = [
    {
      metric: "attendance",
      current: aggregated.attendanceRate,
      baseline: attendanceBaseline,
      deltaPct: computeDeltaPct(aggregated.attendanceRate, attendanceBaseline),
      explanation: "Davomat trendi bazaviy davrga nisbatan sezilarli o'zgargan bo'lishi mumkin.",
    },
    {
      metric: "exam_score",
      current: aggregated.examAverage,
      baseline: examBaseline,
      deltaPct: computeDeltaPct(aggregated.examAverage, examBaseline),
      explanation: "Imtihon natijalaridagi siljish o'qitish strategiyasini qayta ko'rib chiqishni talab qilishi mumkin.",
    },
    {
      metric: "discipline",
      current: aggregated.penaltyEvents,
      baseline: disciplineBaseline,
      deltaPct: computeDeltaPct(aggregated.penaltyEvents, disciplineBaseline),
      explanation: "Intizom bo'yicha ogohlantiruvchi holatlar soni o'sishi operativ chora talab qiladi.",
    },
  ];

  const forecastAttendance = buildForecastPoints("attendance", aggregated.trend.attendance);
  const forecastExam = buildForecastPoints("exam_score", aggregated.trend.examScore);
  const forecastDiscipline = buildForecastPoints("discipline", aggregated.trend.discipline);

  const forecasts = [
    {
      metric: "attendance" as const,
      horizonDays: 28,
      points: forecastAttendance,
      confidence: pickConfidence(aggregated.sourceStats.attendanceRecords),
    },
    {
      metric: "exam_score" as const,
      horizonDays: 28,
      points: forecastExam,
      confidence: pickConfidence(aggregated.sourceStats.examResults),
    },
    {
      metric: "discipline" as const,
      horizonDays: 28,
      points: forecastDiscipline,
      confidence: pickConfidence(aggregated.sourceStats.rewardRecords),
    },
  ];

  const whatIf = [
    {
      scenario: "Davomatni 10% oshirish",
      expectedDeltaPct: 6.5,
      confidence: 0.69,
      assumptions: "Dars qoldirishlar kamayadi va darsda faol qatnashish oshadi.",
    },
    {
      scenario: "Uyga vazifa topshirishni 20% oshirish",
      expectedDeltaPct: 8.2,
      confidence: 0.66,
      assumptions: "Muntazam topshiriq bajarish imtihon natijasiga ijobiy ta'sir ko'rsatadi.",
    },
    {
      scenario: "Jarimalarni 30% kamaytirish",
      expectedDeltaPct: 4.1,
      confidence: 0.62,
      assumptions: "Intizom bo'yicha profilaktik suhbatlar muntazam olib boriladi.",
    },
  ];

  const interventions = [
    {
      title: "Yuqori xavfdagi o'quvchilar bilan 1:1 reja",
      priority: 1 as const,
      owner: "teacher" as const,
      dueInDays: 3,
      expectedImpact: "Davomat va baholarda tezkor ijobiy siljish",
      steps: "S-*** tokenli o'quvchilar bilan haftalik individual uchrashuv va mini-maqsadlar belgilang.",
    },
    {
      title: "Past natijali mavzular bo'yicha qayta dars",
      priority: 2 as const,
      owner: "teacher" as const,
      dueInDays: 7,
      expectedImpact: "Imtihon o'rtacha ballining tiklanishi",
      steps: "Eng ko'p xato qilingan bo'limlar uchun qisqa intensiv blok dars tashkil qiling.",
    },
    {
      title: "Intizom monitoring dashboardi",
      priority: 3 as const,
      owner: "admin" as const,
      dueInDays: 10,
      expectedImpact: "Jarima trendining pasayishi",
      steps: "Jarima sabablari bo'yicha kategoriya kesimida haftalik nazoratni yo'lga qo'ying.",
    },
  ];

  const weeklyPlan = [
    { day: "Dushanba", task: "Yuqori xavf signalidagi o'quvchilar bilan individual suhbat" },
    { day: "Seshanba", task: "Qayta dars va mustahkamlash mashg'uloti" },
    { day: "Chorshanba", task: "What-if senariy bo'yicha kichik tajriba" },
    { day: "Payshanba", task: "Oraliq natijalarni tekshirish va qayta rejalash" },
    { day: "Juma", task: "Haftalik hisobot va keyingi haftaga aniq action-plan" },
  ];

  const summary = `Joriy davrda ${aggregated.totalStudents} ta o'quvchi tahlil qilindi. O'rtacha davomat ${aggregated.attendanceRate.toFixed(
    1,
  )}% va imtihon o'rtacha bali ${aggregated.examAverage.toFixed(1)} ni tashkil qildi.`;

  return {
    summary,
    riskAlerts,
    anomalies,
    forecasts,
    whatIf,
    interventions,
    weeklyPlan,
    comparison: undefined,
  };
}

function buildPrompt(request: AnalyzeInsightsRequest, aggregated: AggregatedData): string {
  const payload = {
    scope: request.scope,
    entityId: request.entityId ?? null,
    subject: request.subject ?? null,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    modules: request.modules,
    aggregated,
  };

  return [
    "Siz TeachPro tizimi uchun AI tahlilchi yordamchisiz.",
    "Faqat Uzbek tilida javob bering.",
    "Kirishdagi tokenlar anonymized, ismlar yo'q. Tokenlarni saqlang.",
    "Javobni faqat JSON formatida qaytaring.",
    "Quyidagi strukturaga qat'iy rioya qiling: summary, riskAlerts, anomalies, forecasts, whatIf, interventions, weeklyPlan.",
    "Har bir confidence 0..1 oralig'ida bo'lsin.",
    "Keraksiz matn, markdown yoki izoh yozmang.",
    "Data:",
    JSON.stringify(payload),
  ].join("\n");
}

function buildAskPrompt(question: string, runData: AnalyzeInsightsResponse): string {
  return [
    "Siz TeachPro AI tahlil yordamchisiz.",
    "Faqat Uzbek tilida qisqa va aniq javob bering.",
    "Sizga run konteksi beriladi, raw bazani taxmin qilmang.",
    "Javobni faqat JSON formatida qaytaring: {\"answer\": string, \"citations\": string[] }.",
    "Question:",
    question,
    "RunContext:",
    JSON.stringify({
      summary: runData.summary,
      riskAlerts: runData.riskAlerts,
      anomalies: runData.anomalies,
      forecasts: runData.forecasts,
      interventions: runData.interventions,
      weeklyPlan: runData.weeklyPlan,
    }),
  ].join("\n");
}

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string | { value?: string };
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
};

type GeminiGenerateContentPayload = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  error?: {
    message?: string;
  };
};

function extractOpenAIOutputText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  payload.output?.forEach((item) => {
    item.content?.forEach((part) => {
      if (part.type !== "output_text" && part.type !== "text") return;
      if (typeof part.text === "string" && part.text.trim()) {
        chunks.push(part.text);
      } else if (part.text && typeof part.text === "object" && typeof part.text.value === "string") {
        chunks.push(part.text.value);
      }
    });
  });

  return chunks.join("\n").trim();
}

function extractGeminiOutputText(payload: GeminiGenerateContentPayload): string {
  const chunks: string[] = [];

  payload.candidates?.forEach((candidate) => {
    candidate.content?.parts?.forEach((part) => {
      if (typeof part.text === "string" && part.text.trim()) {
        chunks.push(part.text);
      }
    });
  });

  return chunks.join("\n").trim();
}

async function callOpenAIJson<T>(
  prompt: string,
  fallbackModel: string,
): Promise<LlmJsonCallResult<T>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY topilmadi. Functions environment variables ga API key kiriting yoki Firebase Secrets ishlating.");
  }

  if (apiKey.length < 10) {
    throw new Error("OPENAI_API_KEY noto'g'ri formatda. API keyni tekshiring.");
  }

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = resolveModelName("openai", fallbackModel);

  const httpResponse = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.2,
      max_output_tokens: 8192,
    }),
  });

  const rawBody = await httpResponse.text();
  if (!httpResponse.ok) {
    const errMsg = rawBody.slice(0, 500);
    throw new Error(`OpenAI API xatolik (${httpResponse.status}): ${errMsg}`);
  }

  const payload = JSON.parse(rawBody) as OpenAIResponsesPayload;
  if (payload.error?.message) {
    throw new Error(`OpenAI API xatolik: ${payload.error.message}`);
  }

  const text = extractOpenAIOutputText(payload);
  if (!text) {
    throw new Error("OpenAI javobidan matn topilmadi");
  }

  const rawJson = extractJsonBlock(text);
  const parsed = JSON.parse(rawJson) as T;
  const tokensIn = payload.usage?.input_tokens ?? 0;
  const tokensOut = payload.usage?.output_tokens ?? 0;

  return { parsed, tokensIn, tokensOut, model, provider: "openai" };
}

async function callGeminiJson<T>(
  prompt: string,
  fallbackModel: string,
  responseJsonSchema?: JsonSchema,
): Promise<LlmJsonCallResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY topilmadi. Google AI Studio key ni Functions environment variables ga kiriting yoki Firebase Secrets ishlating.",
    );
  }

  if (apiKey.length < 10) {
    throw new Error("GEMINI_API_KEY noto'g'ri formatda. API keyni tekshiring.");
  }

  const baseUrl = (
    process.env.GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/+$/, "");
  const model = resolveModelName("gemini", fallbackModel);

  const makeRequestBody = (includeSchema: boolean) =>
    JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        ...(includeSchema && responseJsonSchema
          ? { responseJsonSchema }
          : {}),
      },
    });

  const doRequest = async (includeSchema: boolean) =>
    fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: makeRequestBody(includeSchema),
    });

  let httpResponse = await doRequest(Boolean(responseJsonSchema));
  let rawBody = await httpResponse.text();

  if (!httpResponse.ok && responseJsonSchema) {
    httpResponse = await doRequest(false);
    rawBody = await httpResponse.text();
  }

  if (!httpResponse.ok) {
    const errMsg = rawBody.slice(0, 500);
    throw new Error(`Gemini API xatolik (${httpResponse.status}): ${errMsg}`);
  }

  const payload = JSON.parse(rawBody) as GeminiGenerateContentPayload;
  if (payload.error?.message) {
    throw new Error(`Gemini API xatolik: ${payload.error.message}`);
  }

  if (payload.promptFeedback?.blockReason) {
    throw new Error(
      `Gemini javobi bloklandi: ${payload.promptFeedback.blockReason}${payload.promptFeedback.blockReasonMessage ? ` - ${payload.promptFeedback.blockReasonMessage}` : ""}`,
    );
  }

  const text = extractGeminiOutputText(payload);
  if (!text) {
    throw new Error("Gemini javobidan matn topilmadi");
  }

  const rawJson = extractJsonBlock(text);
  const parsed = JSON.parse(rawJson) as T;
  const tokensIn = payload.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = payload.usageMetadata?.candidatesTokenCount ?? 0;

  return { parsed, tokensIn, tokensOut, model, provider: "gemini" };
}

async function callJsonModel<T>(
  prompt: string,
  fallbackModel: string,
  responseJsonSchema?: JsonSchema,
): Promise<LlmJsonCallResult<T>> {
  const provider = getSelectedProvider();

  if (provider === "gemini") {
    return callGeminiJson<T>(prompt, fallbackModel, responseJsonSchema);
  }

  return callOpenAIJson<T>(prompt, fallbackModel);
}

function makeCacheKey(uid: string, role: Role, request: AnalyzeInsightsRequest): string {
  const stable = {
    uid,
    role,
    scope: request.scope,
    entityId: request.entityId ?? null,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    locale: request.locale,
    subject: request.subject ?? null,
    modules: [...request.modules].sort(),
  };
  return hashKey(stable);
}

async function fetchPreviousRun(
  db: Firestore,
  uid: string,
  scope: string,
  entityId?: string,
): Promise<{ id: string; response: AnalyzeInsightsResponse } | null> {
  const runsSnap = await db
    .collection("ai_analysis_runs")
    .where("createdBy", "==", uid)
    .where("scope", "==", scope)
    .limit(30)
    .get();

  const docs = runsSnap.docs
    .map((d) => {
      const data = d.data() as {
        entityId?: string;
        generatedAt?: Timestamp;
        response?: AnalyzeInsightsResponse;
      };
      return {
        id: d.id,
        entityId: data.entityId,
        generatedAt: data.generatedAt,
        response: data.response,
      };
    })
    .filter((row) => {
      if (entityId === undefined) return true;
      return row.entityId === entityId;
    })
    .sort((a, b) => {
      const aTime = ((a.generatedAt as Timestamp | undefined)?.toDate() ?? new Date(0)).getTime();
      const bTime = ((b.generatedAt as Timestamp | undefined)?.toDate() ?? new Date(0)).getTime();
      return bTime - aTime;
    });

  const candidate = docs[0];
  if (!candidate) return null;

  const response = candidate.response as AnalyzeInsightsResponse | undefined;
  if (!response) return null;

  return { id: candidate.id, response };
}

function attachComparison(
  current: AnalyzeInsightsResponse,
  previous: { id: string; response: AnalyzeInsightsResponse } | null,
): AnalyzeInsightsResponse {
  if (!previous) {
    return current;
  }

  const prevHighRisk = previous.response.riskAlerts
    .filter((r) => r.level === "high")
    .reduce((sum, r) => sum + r.affectedCount, 0);
  const currHighRisk = current.riskAlerts
    .filter((r) => r.level === "high")
    .reduce((sum, r) => sum + r.affectedCount, 0);

  const prevAttendance =
    previous.response.anomalies.find((a) => a.metric === "attendance")?.current ?? 0;
  const currAttendance = current.anomalies.find((a) => a.metric === "attendance")?.current ?? 0;

  const prevExam =
    previous.response.anomalies.find((a) => a.metric === "exam_score")?.current ?? 0;
  const currExam = current.anomalies.find((a) => a.metric === "exam_score")?.current ?? 0;

  const attendanceDeltaPct = computeDeltaPct(currAttendance, prevAttendance);
  const examDeltaPct = computeDeltaPct(currExam, prevExam);
  const highRiskDelta = currHighRisk - prevHighRisk;

  const comparisonSummary =
    highRiskDelta > 0
      ? `Oldingi run bilan solishtirganda yuqori xavf ${highRiskDelta} taga oshgan.`
      : highRiskDelta < 0
        ? `Oldingi run bilan solishtirganda yuqori xavf ${Math.abs(highRiskDelta)} taga kamaygan.`
        : "Oldingi run bilan yuqori xavf ko'rsatkichi deyarli bir xil.";

  return {
    ...current,
    comparison: {
      previousRunId: previous.id,
      attendanceDeltaPct,
      examDeltaPct,
      highRiskDelta,
      summary: comparisonSummary,
    },
  };
}

function toRunSafeResponse(
  response: ModelOutput,
  runId: string,
  status: "ok" | "cached",
  providerName: string,
  modelName: string,
  tokensIn: number,
  tokensOut: number,
): AnalyzeInsightsResponse {
  const validated = modelOutputSchema.parse(response);
  return {
    runId,
    status,
    generatedAt: new Date().toISOString(),
    language: "uz",
    summary: validated.summary,
    riskAlerts: validated.riskAlerts,
    anomalies: validated.anomalies,
    forecasts: validated.forecasts,
    whatIf: validated.whatIf,
    interventions: validated.interventions,
    weeklyPlan: validated.weeklyPlan,
    modelMeta: {
      provider: providerName,
      model: modelName,
      tokensIn,
      tokensOut,
    },
    comparison: validated.comparison,
  };
}

function parseTimestamp(value: unknown): Timestamp | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  return null;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date || value instanceof Timestamp) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    Object.entries(input).forEach(([key, val]) => {
      if (val === undefined) return;
      output[key] = stripUndefinedDeep(val);
    });
    return output as T;
  }

  return value;
}

async function readCache(
  db: Firestore,
  cacheKey: string,
): Promise<AnalyzeInsightsResponse | null> {
  const cacheDoc = await db.collection("ai_analysis_cache").doc(cacheKey).get();
  if (!cacheDoc.exists) return null;

  const data = cacheDoc.data() as {
    response?: AnalyzeInsightsResponse;
    expiresAt?: Timestamp;
  };

  const expiresAt = parseTimestamp(data.expiresAt);
  if (!expiresAt) return null;
  if (expiresAt.toDate().getTime() < Date.now()) return null;

  if (!data.response) return null;

  const validated = analyzeInsightsResponseSchema.safeParse(data.response);
  if (!validated.success) {
    return null;
  }

  return {
    ...validated.data,
    status: "cached",
  };
}
async function writeRunAndCache(
  db: Firestore,
  uid: string,
  role: Role,
  request: AnalyzeInsightsRequest,
  response: AnalyzeInsightsResponse,
  cacheKey: string,
  tokenMap: { students: Record<string, string>; groups: Record<string, string> },
  sourceStats: AggregatedData["sourceStats"],
): Promise<void> {
  const now = new Date();
  const expiresAt = Timestamp.fromDate(new Date(now.getTime() + RETENTION_MS));
  const cacheExpiresAt = Timestamp.fromDate(new Date(now.getTime() + CACHE_TTL_MS));
  const safeResponse = stripUndefinedDeep(response);

  const runRef = db.collection("ai_analysis_runs").doc(response.runId);
  await runRef.set({
    createdBy: uid,
    role,
    scope: request.scope,
    entityId: request.entityId ?? null,
    subject: request.subject ?? null,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    modules: request.modules,
    generatedAt: Timestamp.fromDate(now),
    expiresAt,
    response: safeResponse,
    summary: safeResponse.summary,
    riskHighCount: safeResponse.riskAlerts
      .filter((r) => r.level === "high")
      .reduce((sum, r) => sum + r.affectedCount, 0),
    tokenMap,
    sourceStats,
  });

  await db.collection("ai_analysis_cache").doc(cacheKey).set({
    createdBy: uid,
    scope: request.scope,
    entityId: request.entityId ?? null,
    subject: request.subject ?? null,
    createdAt: Timestamp.fromDate(now),
    expiresAt: cacheExpiresAt,
    runId: response.runId,
    response: safeResponse,
  });
}

export async function runAiAnalysis(
  db: Firestore,
  uid: string,
  request: AnalyzeInsightsRequest,
): Promise<AnalyzeInsightsResponse> {
  const admin = await isAdminUser(db, uid);
  const role: Role = admin ? "admin" : "teacher";

  const scopeContext = await resolveScopeContext(db, role, uid, request);
  const cacheKey = makeCacheKey(uid, role, request);

  if (!request.forceRefresh) {
    const cached = await readCache(db, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const runId = db.collection("ai_analysis_runs").doc().id;

  const aggregated = await aggregateData(db, request, scopeContext);

  const tokenMap = {
    students: aggregated.studentIdToToken,
    groups: aggregated.groupIdToToken,
  };

  const heuristic = buildHeuristicOutput(aggregated);

  let responseCore: ModelOutput = heuristic;
  const selectedProvider = getSelectedProvider();
  const fallbackModel = getDefaultModelForProvider(selectedProvider);
  let providerName: SupportedAiProvider = selectedProvider;
  let modelName = resolveModelName(selectedProvider, fallbackModel);
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    const prompt = buildPrompt(request, aggregated);
    const llm = await callJsonModel<ModelOutput>(
      prompt,
      fallbackModel,
      modelOutputResponseJsonSchema,
    );
    const parsed = modelOutputSchema.safeParse(llm.parsed);
    if (parsed.success) {
      responseCore = parsed.data;
      providerName = llm.provider;
      modelName = llm.model;
      tokensIn = llm.tokensIn;
      tokensOut = llm.tokensOut;
    }
  } catch (error) {
    // Log error but continue with heuristic fallback to keep user flow stable
    console.error("[AI Analysis] LLM call failed, using heuristic fallback:", error instanceof Error ? error.message : String(error));
  }

  let response = toRunSafeResponse(responseCore, runId, "ok", providerName, modelName, tokensIn, tokensOut);

  const previous = await fetchPreviousRun(db, uid, request.scope, request.entityId);
  response = attachComparison(response, previous);

  await writeRunAndCache(db, uid, role, request, response, cacheKey, tokenMap, aggregated.sourceStats);

  return response;
}

function fallbackAskAnswer(question: string, runResponse: AnalyzeInsightsResponse): AskInsightsResponse {
  const lowered = question.toLowerCase();

  if (lowered.includes("xulosa") || lowered.includes("summary")) {
    return {
      answer: runResponse.summary,
      citations: ["summary"],
    };
  }

  if (lowered.includes("xavf") || lowered.includes("risk")) {
    const high = runResponse.riskAlerts
      .filter((r) => r.level === "high")
      .reduce((sum, item) => sum + item.affectedCount, 0);
    return {
      answer: `Hozirgi run bo'yicha yuqori xavf ostida taxminan ${high} ta o'quvchi bor. Eng ustuvor chorani intervensiya bo'limidan boshlang.`,
      citations: ["riskAlerts", "interventions"],
    };
  }

  return {
    answer: "Savolingiz bo'yicha asosiy tavsiya: yuqori xavf signallarini birinchi navbatda yopib, haftalik rejadagi topshiriqlarni ketma-ket bajaring.",
    citations: ["summary", "weeklyPlan"],
  };
}

export async function askAboutRun(
  db: Firestore,
  uid: string,
  request: AskInsightsRequest,
): Promise<AskInsightsResponse> {
  const admin = await isAdminUser(db, uid);
  const runDoc = await db.collection("ai_analysis_runs").doc(request.runId).get();

  if (!runDoc.exists) {
    throw new HttpsError("not-found", "Run topilmadi");
  }

  const runData = runDoc.data() as { createdBy?: string; response?: AnalyzeInsightsResponse };

  if (!admin && runData.createdBy !== uid) {
    throw new HttpsError("permission-denied", "Bu run uchun ruxsat yo'q");
  }

  const response = runData.response;
  if (!response) {
    throw new HttpsError("failed-precondition", "Run response mavjud emas");
  }

  try {
    const selectedProvider = getSelectedProvider();
    const fallbackModel = getDefaultModelForProvider(selectedProvider);
    const prompt = buildAskPrompt(request.question, response);
    const llm = await callJsonModel<AskInsightsResponse>(
      prompt,
      fallbackModel,
      askInsightsResponseJsonSchema,
    );
    const parsed = askInsightsResponseSchema.safeParse(llm.parsed);
    if (parsed.success) {
      return parsed.data;
    }
  } catch (error) {
    // Log error but continue with fallback
    console.error("[AI Analysis] Ask about run LLM call failed, using fallback:", error instanceof Error ? error.message : String(error));
  }

  return fallbackAskAnswer(request.question, response);
}

async function cleanupCollection(
  collectionRef: CollectionReference<DocumentData>,
  now: Timestamp,
): Promise<number> {
  const docs = await collectionRef.where("expiresAt", "<", now).limit(500).get();
  if (docs.empty) return 0;

  let removed = 0;
  const batch = collectionRef.firestore.batch();
  docs.docs.forEach((doc) => {
    batch.delete(doc.ref);
    removed += 1;
  });
  await batch.commit();

  if (docs.size === 500) {
    removed += await cleanupCollection(collectionRef, now);
  }

  return removed;
}

export async function cleanupExpiredAnalysis(db: Firestore): Promise<{
  runsDeleted: number;
  cacheDeleted: number;
  feedbackDeleted: number;
}> {
  const now = Timestamp.now();

  const [runsDeleted, cacheDeleted, feedbackDeleted] = await Promise.all([
    cleanupCollection(db.collection("ai_analysis_runs"), now),
    cleanupCollection(db.collection("ai_analysis_cache"), now),
    cleanupCollection(db.collection("ai_analysis_feedback"), now),
  ]);

  return { runsDeleted, cacheDeleted, feedbackDeleted };
}
