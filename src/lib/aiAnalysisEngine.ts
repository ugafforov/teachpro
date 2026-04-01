import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { db } from "@/lib/firebase";
import {
  AnalyzeInsightsRequest,
  AnalyzeInsightsResponse,
  AskInsightsRequest,
  AskInsightsResponse,
  InsightModule,
  ProjectChatMessage,
  ProjectChatRequest,
  ProjectChatResponse,
} from "@/types/aiAnalysis";
import {
  askOutputResponseSchema,
  askOutputSchema,
  modelOutputResponseSchema,
  modelOutputSchema,
  storedAnalyzeResponseSchema,
} from "@/lib/aiAnalysisSchemas";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_QUERY_DOCS = 10000; // Increased limit
const MAX_POINTS = 4;
const ALL_TIME_CHAT_START_DATE = "2000-01-01";

// Increased Context Limits for better coverage
const MAX_CHAT_STUDENT_CONTEXT = 300; 
const MAX_CHAT_GROUP_CONTEXT = 100;
const MAX_CHAT_EXAM_CONTEXT = 100;
const RISK_ATTENDANCE_LOW = 70;
const RISK_ATTENDANCE_WARN = 85;
const RISK_EXAM_LOW = 60;
const RISK_EXAM_WARN = 75;
const PRESENT_POINTS = 1;
const LATE_POINTS = 0.5;
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY;
const AI_MODEL = import.meta.env.VITE_AI_MODEL || "stepfun/step-3.5-flash:free";
const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || "https://openrouter.ai/api/v1";

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

type GroupNoteDoc = {
  id: string;
  teacher_id?: string;
  group_id?: string;
  title?: string;
  note?: string;
  content?: string;
  text?: string;
};

type ExamTypeDoc = {
  id: string;
  teacher_id?: string;
  name?: string;
  title?: string;
};

type AuditLogDoc = {
  id: string;
  teacher_id?: string;
  action?: string;
};

type StudentDoc = {
  id: string;
  teacher_id?: string;
  group_name?: string;
  name?: string;
  student_id?: string;
  is_active?: boolean;
  join_date?: string;
  leave_date?: string | null;
  created_at?: Timestamp | string;
};

type GroupDoc = {
  id: string;
  teacher_id?: string;
  name?: string;
  is_active?: boolean;
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

type ProjectChatContext = {
  dateFrom: string;
  dateTo: string;
  totals: {
    students: number;
    groups: number;
    exams: number;
    attendanceRecords: number;
    examResults: number;
    rewardRecords: number;
  };
  students: Array<{
    id: string;
    name: string;
    groupName: string;
    joinDate: string;
    leaveDate: string | null;
    overallRank: number;
    groupRank: number;
    classDates: string[];
    attendanceRecords: Array<{
      date: string;
      status: string;
    }>;
    attendanceSessions: number;
    totalClasses: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    attendancePct: number;
    attendancePoints: number;
    examCount: number;
    avgExamScore: number;
    bahoAverage: number;
    bahoCount: number;
    recentExams: Array<{
      examName: string;
      examDate: string;
      score: number;
    }>;
    rewardEventCount: number;
    penaltyEventCount: number;
    penalties: number;
    rewards: number;
    jarimaPoints: number;
    mukofotPoints: number;
    totalScore: number;
    riskLevel: "high" | "medium" | "low";
    riskScore: number;
  }>;
  groups: Array<{
    id: string;
    name: string;
    studentCount: number;
    avgAttendance: number;
    avgExamScore: number;
    avgTotalScore: number;
    avgBahoAverage: number;
  }>;
  exams: Array<{
    id: string;
    examName: string;
    examDate: string;
    groupName: string;
    avgScore: number;
    resultCount: number;
  }>;
  notes: Array<{
    groupName: string;
    summary: string;
  }>;
  examTypes: string[];
  archives: {
    students: number;
    groups: number;
    exams: number;
  };
  deleted: {
    students: number;
    groups: number;
    exams: number;
    attendance: number;
    rewards: number;
    examResults: number;
    studentScores: number;
  };
  auditSummary: {
    exports: number;
    imports: number;
    failedImports: number;
  };
  appKnowledge: {
    modules: Array<{
      id: string;
      name: string;
      purpose: string;
      capabilities: string[];
    }>;
    collections: string[];
    guidance: string[];
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

type StoredRunRow = {
  id: string;
  scope?: string;
  entityId?: string | null;
  subject?: string | null;
  dateFrom?: string;
  dateTo?: string;
  modules?: InsightModule[];
  requestFingerprint?: string;
  generatedAt?: Timestamp | null;
  response?: AnalyzeInsightsResponse;
};

type LlmJsonCallResult<T> = {
  parsed: T;
  tokensIn: number;
  tokensOut: number;
  model: string;
};

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

function parseDateSafe(input: string): Date {
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Noto'g'ri sana: ${input}`);
  }
  return date;
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

function normalizeDateRange(dateFrom: string, dateTo: string) {
  const from = parseDateSafe(dateFrom);
  const to = parseDateSafe(dateTo);

  if (from.getTime() > to.getTime()) {
    throw new Error("dateFrom dateTo dan katta bo'lishi mumkin emas");
  }

  return { from, to };
}

function dateInRange(dateStr: string | undefined, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  const date = parseDateSafe(dateStr);
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

function maxIsoDate(left: string, right: string): string {
  return left >= right ? left : right;
}

function minIsoDate(left: string, right: string): string {
  return left <= right ? left : right;
}

function timestampLikeToIsoDate(value: Timestamp | string | undefined | null): string | null {
  if (!value) return null;

  if (value instanceof Timestamp) {
    return toIsoDate(value.toDate());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toIsoDate(parsed);
    }
  }

  return null;
}

function resolveStudentStartDate(student: StudentDoc): string {
  return (
    timestampLikeToIsoDate(student.join_date ?? null) ??
    timestampLikeToIsoDate(student.created_at ?? null) ??
    ALL_TIME_CHAT_START_DATE
  );
}

function resolveStudentEndDate(student: StudentDoc, fallbackDateTo: string): string {
  return timestampLikeToIsoDate(student.leave_date ?? null) ?? fallbackDateTo;
}

function extractQuestionDate(question: string): string | null {
  const isoMatch = question.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const localMatch = question.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function describeAttendanceStatus(status: string | undefined): string {
  switch (status) {
    case "present":
      return "qatnashgan";
    case "late":
      return "kechikib qatnashgan";
    case "absent_with_reason":
      return "sababli kelmagan";
    case "absent_without_reason":
      return "sababsiz kelmagan";
    case "absent":
      return "kelmagan";
    default:
      return "davomat holati noma'lum";
  }
}

function compareStudentsForRanking(
  left: ProjectChatContext["students"][number],
  right: ProjectChatContext["students"][number],
) {
  if (right.totalScore !== left.totalScore) {
    return right.totalScore - left.totalScore;
  }

  if (right.attendancePoints !== left.attendancePoints) {
    return right.attendancePoints - left.attendancePoints;
  }

  if (right.mukofotPoints !== left.mukofotPoints) {
    return right.mukofotPoints - left.mukofotPoints;
  }

  return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
}

function formatStudentReference(student: ProjectChatContext["students"][number]) {
  return `${student.name} (${student.groupName})`;
}

function listRecentDates(from: Date, to: Date, points = MAX_POINTS): string[] {
  if (points <= 0) return [];

  const totalDays = Math.max(
    1,
    Math.floor((to.getTime() - from.getTime()) / 86400000) + 1,
  );
  const step = Math.max(1, Math.floor(totalDays / points));
  const dates: string[] = [];

  for (let i = points - 1; i >= 0; i -= 1) {
    const date = new Date(to.getTime() - i * step * 86400000);
    dates.push(toIsoDate(date));
  }

  return dates;
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
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function computeRisk(attendancePct: number, examAvg: number, penalties: number, rewards: number) {
  let score = 0;

  if (attendancePct < RISK_ATTENDANCE_LOW) score += 40;
  else if (attendancePct < RISK_ATTENDANCE_WARN) score += 20;

  if (examAvg > 0 && examAvg < RISK_EXAM_LOW) score += 35;
  else if (examAvg > 0 && examAvg < RISK_EXAM_WARN) score += 15;

  if (penalties > rewards) score += 15;
  if (attendancePct === 0) score += 10;

  return {
    score,
    level: levelByScore(score),
  };
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
) {
  if (history.length === 0) return [];

  const last = history[history.length - 1]?.value ?? 0;
  const first = history[0]?.value ?? last;
  const slope = history.length > 1 ? (last - first) / (history.length - 1) : 0;
  const startDate = parseDateSafe(history[history.length - 1]?.date ?? toIsoDate(new Date()));
  const points: Array<{ date: string; value: number }> = [];

  for (let i = 1; i <= 4; i += 1) {
    const forecastDate = new Date(startDate.getTime() + i * 7 * 86400000);
    const nextValueRaw = last + slope * i;
    const nextValue =
      metric === "discipline"
        ? clamp(nextValueRaw, 0, 1000)
        : clamp(nextValueRaw, 0, 100);

    points.push({
      date: toIsoDate(forecastDate),
      value: Number(nextValue.toFixed(2)),
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

function groupNameById(groups: GroupDoc[]): Record<string, string> {
  const map: Record<string, string> = {};

  groups.forEach((group) => {
    if (group.id && group.name) {
      map[group.id] = group.name;
    }
  });

  return map;
}

function buildToken(prefix: string, index: number, width = 3): string {
  return `${prefix}-${String(index + 1).padStart(width, "0")}`;
}

function normalizeLookupText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function formatMetricValue(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function toMarkdownTable(headers: string[], rows: Array<Array<string | number>>) {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separatorLine = `| ${headers.map(() => "---").join(" | ")} |`;
  const rowLines = rows.map((row) => `| ${row.map((cell) => String(cell)).join(" | ")} |`);

  return [headerLine, separatorLine, ...rowLines].join("\n");
}

const APP_KNOWLEDGE_MODULES: ProjectChatContext["appKnowledge"]["modules"] = [
  {
    id: "overview",
    name: "Umumiy ko'rinish",
    purpose: "O'qituvchi yoki admin uchun asosiy KPI va statistik ko'rinish.",
    capabilities: [
      "o'quvchilar soni",
      "davomat trendi",
      "o'rtacha imtihon natijalari",
      "eng faol o'quvchi yoki guruh",
    ],
  },
  {
    id: "groups",
    name: "Guruhlar",
    purpose: "Guruh yaratish, tahrirlash, arxivlash va guruh kesimidagi monitoring.",
    capabilities: [
      "guruh qo'shish",
      "guruh o'quvchilari",
      "guruh davomat jurnali",
      "guruh ichidagi notes",
    ],
  },
  {
    id: "students",
    name: "O'quvchilar",
    purpose: "O'quvchi profillari, filtering va boshqaruv.",
    capabilities: [
      "o'quvchi qo'shish",
      "o'quvchi profili",
      "davomat va reward/penalty",
      "arxivlash yoki o'chirish",
    ],
  },
  {
    id: "exams",
    name: "Imtihonlar",
    purpose: "Imtihon yaratish, exam types, natijalar va tahlil.",
    capabilities: [
      "imtihon ochish",
      "exam type boshqaruvi",
      "natija kiritish",
      "imtihon kesimidagi ko'rsatkichlar",
    ],
  },
  {
    id: "rankings",
    name: "Reyting",
    purpose: "O'quvchi va guruhlar reytingi.",
    capabilities: [
      "student ranking",
      "group ranking",
      "faollik va ball bo'yicha saralash",
    ],
  },
  {
    id: "ai-analysis",
    name: "AI tahlil",
    purpose: "TeachPro ichidagi ma'lumotlar asosida AI hisobot va savol-javob.",
    capabilities: [
      "statistik tahlil",
      "risk va anomaliya topish",
      "ro'yxat va kesimlar",
      "tavsiyalar ishlab chiqish",
    ],
  },
  {
    id: "archive",
    name: "Arxiv",
    purpose: "Arxivlangan o'quvchi, guruh va imtihonlarni ko'rish va qayta tiklash.",
    capabilities: [
      "archived students",
      "archived groups",
      "archived exams",
      "restore yoki delete",
    ],
  },
  {
    id: "data",
    name: "Ma'lumotlar",
    purpose: "Import, export, validation va backup bilan ishlash.",
    capabilities: [
      "data export",
      "data import",
      "checksum validation",
      "audit logs",
    ],
  },
];

const APP_KNOWLEDGE_GUIDANCE = [
  "AI foydalanuvchining roliga mos ko'rinadigan ma'lumot bilan ishlaydi.",
  "Teacher uchun odatda faqat o'ziga tegishli teacher_id ma'lumotlari ko'rinadi.",
  "Admin uchun kolleksiyalar bo'yicha kengroq umumiy ko'rinish mavjud.",
  "AI doim tahlil, statistika, kesim va amaliy tavsiyaga ustuvorlik beradi.",
];

function extractLookupTerms(question: string): string[] {
  const quotedTerms = Array.from(
    question.matchAll(/["“](.+?)["”]|'(.+?)'/g),
    (match) => normalizeLookupText(match[1] ?? match[2] ?? ""),
  ).filter(Boolean);

  const stopwords = new Set([
    "haqida",
    "malumot",
    "ber",
    "chiqar",
    "shakllantir",
    "qilib",
    "kerak",
    "bolsa",
    "iltimos",
    "men",
    "menga",
    "shu",
    "faqat",
    "royxat",
    "royhat",
    "list",
    "oquvchi",
    "oquvchilar",
    "student",
    "guruh",
    "guruhi",
    "sinf",
    "davomat",
    "imtihon",
    "ball",
    "baho",
    "xavf",
    "risk",
    "kim",
    "qaysi",
    "nechta",
    "soni",
    "qancha",
    "jami",
    "va",
    "ham",
    "uchun",
  ]);

  const plainTerms = normalizeLookupText(question)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !stopwords.has(term));

  return Array.from(new Set([...quotedTerms, ...plainTerms]));
}

function normalizeModules(modules: InsightModule[]) {
  return [...modules].sort();
}

function getDefaultChatAnalysisRequest(forceRefresh = false): AnalyzeInsightsRequest {
  const dateTo = toIsoDate(new Date());
  const dateFrom = ALL_TIME_CHAT_START_DATE;

  return {
    scope: "global",
    dateFrom,
    dateTo,
    modules: ["summary", "risk", "anomaly", "forecast", "what_if", "intervention"],
    locale: "uz",
    forceRefresh,
  };
}

function buildRequestFingerprint(request: AnalyzeInsightsRequest): string {
  return JSON.stringify({
    scope: request.scope,
    entityId: request.entityId ?? null,
    subject: request.subject ?? null,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    modules: normalizeModules(request.modules),
    locale: request.locale ?? "uz",
  });
}

function parseTimestamp(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (value instanceof Date || value instanceof Timestamp) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    Object.entries(input).forEach(([key, entry]) => {
      if (entry === undefined) return;
      output[key] = stripUndefinedDeep(entry);
    });

    return output as T;
  }

  return value;
}

function sameRequest(
  run: StoredRunRow,
  request: AnalyzeInsightsRequest,
  requestFingerprint: string,
) {
  if (run.requestFingerprint) {
    return run.requestFingerprint === requestFingerprint;
  }

  const normalizedRunSubject = (run.subject ?? null) || null;
  const normalizedRequestSubject = request.subject ?? null;
  const runModules = normalizeModules(run.modules ?? []);
  const requestModules = normalizeModules(request.modules);

  return (
    run.scope === request.scope &&
    (run.entityId ?? null) === (request.entityId ?? null) &&
    normalizedRunSubject === normalizedRequestSubject &&
    run.dateFrom === request.dateFrom &&
    run.dateTo === request.dateTo &&
    JSON.stringify(runModules) === JSON.stringify(requestModules)
  );
}

async function getEntityDoc<T>(collectionName: string, entityId: string) {
  const snapshot = await getDoc(doc(db, collectionName, entityId));
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as T),
  } as T & { id: string };
}

async function getDocsWithOptionalTeacher<T extends { id: string }>(
  collectionName: string,
  teacherId?: string,
) {
  const constraints = teacherId ? [where("teacher_id", "==", teacherId)] : [];
  const snapshot = await getDocs(
    query(collection(db, collectionName), ...constraints, limit(MAX_QUERY_DOCS)),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as Omit<T, "id">),
  })) as T[];
}

async function listRunsForUser(uid: string): Promise<StoredRunRow[]> {
  const snapshot = await getDocs(
    query(collection(db, "ai_analysis_runs"), where("createdBy", "==", uid)),
  );

  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;

    return {
      id: item.id,
      scope: data.scope as string | undefined,
      entityId: (data.entityId as string | null | undefined) ?? null,
      subject: (data.subject as string | null | undefined) ?? null,
      dateFrom: data.dateFrom as string | undefined,
      dateTo: data.dateTo as string | undefined,
      modules: (data.modules as InsightModule[] | undefined) ?? undefined,
      requestFingerprint: data.requestFingerprint as string | undefined,
      generatedAt: parseTimestamp(data.generatedAt),
      response: data.response as AnalyzeInsightsResponse | undefined,
    };
  });
}

function sortRunsByGeneratedAt(rows: StoredRunRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = (a.generatedAt?.toDate() ?? new Date(0)).getTime();
    const bTime = (b.generatedAt?.toDate() ?? new Date(0)).getTime();
    return bTime - aTime;
  });
}

function findCachedRun(
  rows: StoredRunRow[],
  request: AnalyzeInsightsRequest,
  requestFingerprint: string,
) {
  const now = Date.now();
  const candidate = sortRunsByGeneratedAt(rows).find((row) => {
    if (!sameRequest(row, request, requestFingerprint)) {
      return false;
    }

    const generatedAt = row.generatedAt?.toDate().getTime() ?? 0;
    return now - generatedAt <= CACHE_TTL_MS;
  });

  if (!candidate?.response) {
    return null;
  }

  const parsed = storedAnalyzeResponseSchema.safeParse(candidate.response);
  if (!parsed.success) {
    return null;
  }

  return {
    ...(parsed.data as AnalyzeInsightsResponse),
    status: "cached" as const,
  };
}

function findPreviousRun(
  rows: StoredRunRow[],
  scope: string,
  entityId?: string,
): { id: string; response: AnalyzeInsightsResponse } | null {
  const candidate = sortRunsByGeneratedAt(rows).find((row) => {
    if (row.scope !== scope) return false;
    if (entityId !== undefined) {
      return row.entityId === entityId && Boolean(row.response);
    }
    return Boolean(row.response);
  });

  if (!candidate?.response) {
    return null;
  }

  return {
    id: candidate.id,
    response: candidate.response,
  };
}

async function resolveScopeContext(
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
    throw new Error("Ushbu scope uchun entityId majburiy");
  }

  if (request.scope === "group") {
    const groupDoc = await getEntityDoc<GroupDoc>("groups", request.entityId);
    if (!groupDoc) {
      throw new Error("Guruh topilmadi");
    }

    if (!groupDoc.teacher_id) {
      throw new Error("Guruhda teacher_id mavjud emas");
    }

    if (role === "teacher" && groupDoc.teacher_id !== uid) {
      throw new Error("Bu guruh sizga tegishli emas");
    }

    context.teacherFilter = groupDoc.teacher_id;
    context.groupId = request.entityId;
    return context;
  }

  if (request.scope === "student") {
    const studentDoc = await getEntityDoc<StudentDoc>("students", request.entityId);
    if (!studentDoc) {
      throw new Error("O'quvchi topilmadi");
    }

    if (!studentDoc.teacher_id) {
      throw new Error("O'quvchi teacher_id topilmadi");
    }

    if (role === "teacher" && studentDoc.teacher_id !== uid) {
      throw new Error("Bu o'quvchi sizga tegishli emas");
    }

    context.teacherFilter = studentDoc.teacher_id;
    context.studentId = request.entityId;
    return context;
  }

  const examDoc = await getEntityDoc<ExamDoc>("exams", request.entityId);
  if (!examDoc) {
    throw new Error("Imtihon topilmadi");
  }

  if (!examDoc.teacher_id) {
    throw new Error("Imtihonda teacher_id topilmadi");
  }

  if (role === "teacher" && examDoc.teacher_id !== uid) {
    throw new Error("Bu imtihon sizga tegishli emas");
  }

  context.teacherFilter = examDoc.teacher_id;
  context.examId = request.entityId;
  if (examDoc.group_id) {
    context.groupId = examDoc.group_id;
  }

  return context;
}

async function aggregateData(
  request: AnalyzeInsightsRequest,
  context: ScopeContext,
): Promise<AggregatedData> {
  const { from, to } = normalizeDateRange(request.dateFrom, request.dateTo);

  const [groupsRaw, studentsRaw, attendanceRaw, rewardsRaw, examsRaw, examResultsRaw] =
    await Promise.all([
      getDocsWithOptionalTeacher<GroupDoc>("groups", context.teacherFilter),
      getDocsWithOptionalTeacher<StudentDoc>("students", context.teacherFilter),
      getDocsWithOptionalTeacher<AttendanceRecord & { id: string }>(
        "attendance_records",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<RewardRecord & { id: string }>(
        "reward_penalty_history",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<ExamDoc>("exams", context.teacherFilter),
      getDocsWithOptionalTeacher<ExamResultDoc & { id: string }>(
        "exam_results",
        context.teacherFilter,
      ),
    ]);

  const groupsMapById = groupNameById(groupsRaw.filter((group) => group.name));
  let students = studentsRaw.filter(
    (student) => student.id && student.teacher_id && student.is_active !== false,
  );

  if (context.studentId) {
    students = students.filter((student) => student.id === context.studentId);
  } else if (context.groupId) {
    const targetGroupName = groupsMapById[context.groupId];
    students = students.filter((student) => student.group_name === targetGroupName);
  }

  const studentIdSet = new Set(students.map((student) => student.id));

  let exams = examsRaw.filter((exam) => Boolean(exam.id));
  if (request.subject) {
    const normalizedSubject = request.subject.toLowerCase();
    exams = exams.filter((exam) =>
      (exam.exam_name ?? "").toLowerCase().includes(normalizedSubject),
    );
  }
  if (context.examId) {
    exams = exams.filter((exam) => exam.id === context.examId);
  }
  if (context.groupId) {
    exams = exams.filter((exam) => exam.group_id === context.groupId);
  }

  const examIdSet = new Set(exams.map((exam) => exam.id));
  const attendance = attendanceRaw.filter(
    (record) =>
      studentIdSet.has(record.student_id ?? "") && dateInRange(record.date, from, to),
  );
  const rewards = rewardsRaw.filter(
    (record) =>
      studentIdSet.has(record.student_id ?? "") && dateInRange(record.date, from, to),
  );
  const examResults = examResultsRaw.filter(
    (row) =>
      studentIdSet.has(row.student_id ?? "") &&
      examIdSet.has(row.exam_id ?? "") &&
      exams.some(
        (exam) => exam.id === row.exam_id && dateInRange(exam.exam_date, from, to),
      ),
  );

  const uniqueGroupNames = Array.from(
    new Set(students.map((student) => student.group_name ?? "").filter(Boolean)),
  );
  const groupTokenMap = new Map<string, string>();
  uniqueGroupNames.forEach((groupName, index) => {
    groupTokenMap.set(groupName, buildToken("G", index, 2));
  });

  const studentTokenMap = new Map<string, string>();
  students.forEach((student, index) => {
    studentTokenMap.set(student.id, buildToken("S", index, 3));
  });

  const attendanceByStudent = new Map<string, AttendanceRecord[]>();
  attendance.forEach((record) => {
    const studentId = record.student_id;
    if (!studentId) return;
    const rows = attendanceByStudent.get(studentId) ?? [];
    rows.push(record);
    attendanceByStudent.set(studentId, rows);
  });

  const rewardsByStudent = new Map<string, RewardRecord[]>();
  rewards.forEach((record) => {
    const studentId = record.student_id;
    if (!studentId) return;
    const rows = rewardsByStudent.get(studentId) ?? [];
    rows.push(record);
    rewardsByStudent.set(studentId, rows);
  });

  const examByStudent = new Map<string, ExamResultDoc[]>();
  examResults.forEach((row) => {
    const studentId = row.student_id;
    if (!studentId) return;
    const rows = examByStudent.get(studentId) ?? [];
    rows.push(row);
    examByStudent.set(studentId, rows);
  });

  const attendancePresentOrLate = attendance.filter(
    (record) => record.status === "present" || record.status === "late",
  ).length;
  const attendanceRate = attendance.length
    ? Number(((attendancePresentOrLate / attendance.length) * 100).toFixed(2))
    : 0;

  const examAverage = examResults.length
    ? Number(
        (
          examResults.reduce((sum, row) => sum + toNumber(row.score), 0) /
          examResults.length
        ).toFixed(2),
      )
    : 0;

  const rewardEvents = rewards.filter((row) => row.type === "Mukofot").length;
  const penaltyEvents = rewards.filter((row) => row.type === "Jarima").length;

  const studentsSummary = students.map((student) => {
    const studentAttendance = attendanceByStudent.get(student.id) ?? [];
    const studentRewards = rewardsByStudent.get(student.id) ?? [];
    const studentExamResults = examByStudent.get(student.id) ?? [];

    const presentOrLate = studentAttendance.filter(
      (row) => row.status === "present" || row.status === "late",
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
      .filter((row) => row.type === "Jarima")
      .reduce((sum, row) => sum + toNumber(row.points), 0);
    const rewardsPoints = studentRewards
      .filter((row) => row.type === "Mukofot")
      .reduce((sum, row) => sum + toNumber(row.points), 0);

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
  const attendanceTrend = timeline.map((date) => {
    const rows = attendance.filter((record) => record.date === date);
    const positive = rows.filter(
      (record) => record.status === "present" || record.status === "late",
    ).length;
    const value = rows.length
      ? Number(((positive / rows.length) * 100).toFixed(2))
      : 0;

    return { date, value };
  });

  const examDateById = new Map(exams.map((exam) => [exam.id, exam.exam_date ?? ""] as const));
  const examTrend = timeline.map((date) => {
    const rows = examResults.filter((row) => examDateById.get(row.exam_id ?? "") === date);
    const value = rows.length
      ? Number(
          (rows.reduce((sum, row) => sum + toNumber(row.score), 0) / rows.length).toFixed(
            2,
          ),
        )
      : 0;

    return { date, value };
  });

  const disciplineTrend = timeline.map((date) => {
    const dayPenalties = rewards.filter(
      (row) => row.date === date && row.type === "Jarima",
    ).length;

    return {
      date,
      value: Number(dayPenalties.toFixed(2)),
    };
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

async function buildProjectChatContext(
  request: AnalyzeInsightsRequest,
  context: ScopeContext,
): Promise<ProjectChatContext> {
  const { from, to } = normalizeDateRange(request.dateFrom, request.dateTo);
  const dateFromIso = request.dateFrom;
  const dateToIso = request.dateTo;

  const [
    groupsRaw,
    studentsRaw,
    attendanceRaw,
    rewardsRaw,
    examsRaw,
    examResultsRaw,
    groupNotesRaw,
    examTypesRaw,
    archivedStudentsRaw,
    archivedGroupsRaw,
    archivedExamsRaw,
    deletedStudentsRaw,
    deletedGroupsRaw,
    deletedExamsRaw,
    deletedAttendanceRaw,
    deletedRewardsRaw,
    deletedExamResultsRaw,
    deletedStudentScoresRaw,
    auditLogsRaw,
  ] =
    await Promise.all([
      getDocsWithOptionalTeacher<GroupDoc>("groups", context.teacherFilter),
      getDocsWithOptionalTeacher<StudentDoc>("students", context.teacherFilter),
      getDocsWithOptionalTeacher<AttendanceRecord & { id: string }>(
        "attendance_records",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<RewardRecord & { id: string }>(
        "reward_penalty_history",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<ExamDoc>("exams", context.teacherFilter),
      getDocsWithOptionalTeacher<ExamResultDoc & { id: string }>(
        "exam_results",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<GroupNoteDoc>("group_notes", context.teacherFilter),
      getDocsWithOptionalTeacher<ExamTypeDoc>("exam_types", undefined),
      getDocsWithOptionalTeacher<{ id: string }>("archived_students", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>("archived_groups", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>("archived_exams", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>("deleted_students", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>("deleted_groups", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>("deleted_exams", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>(
        "deleted_attendance_records",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<{ id: string }>(
        "deleted_reward_penalty_history",
        context.teacherFilter,
      ),
      getDocsWithOptionalTeacher<{ id: string }>("deleted_exam_results", context.teacherFilter),
      getDocsWithOptionalTeacher<{ id: string }>("deleted_student_scores", context.teacherFilter),
      getDocsWithOptionalTeacher<AuditLogDoc>("audit_logs", context.teacherFilter),
    ]);

  const groups = groupsRaw.filter((group) => group.id && group.name && group.is_active !== false);
  const groupsMapById = groupNameById(groups);
  const allActiveStudents = studentsRaw.filter(
    (student) => student.id && student.name && student.teacher_id && student.is_active !== false,
  );
  const allActiveStudentsMap = new Map(
    allActiveStudents.map((student) => [student.id, student] as const),
  );
  let students = allActiveStudents;

  if (context.studentId) {
    students = students.filter((student) => student.id === context.studentId);
  } else if (context.groupId) {
    const targetGroupName = groupsMapById[context.groupId];
    students = students.filter((student) => student.group_name === targetGroupName);
  }

  const studentIdSet = new Set(students.map((student) => student.id));

  let exams = examsRaw.filter((exam) => Boolean(exam.id));
  if (request.subject) {
    const normalizedSubject = normalizeLookupText(request.subject);
    exams = exams.filter((exam) =>
      normalizeLookupText(exam.exam_name ?? "").includes(normalizedSubject),
    );
  }
  if (context.examId) {
    exams = exams.filter((exam) => exam.id === context.examId);
  }
  if (context.groupId) {
    exams = exams.filter((exam) => exam.group_id === context.groupId);
  }

  const examIdSet = new Set(exams.map((exam) => exam.id));
  const allVisibleStudentIds = new Set(allActiveStudents.map((student) => student.id));
  const attendance = attendanceRaw.filter(
    (record) =>
      studentIdSet.has(record.student_id ?? "") && dateInRange(record.date, from, to),
  );
  const attendanceInRange = attendanceRaw.filter(
    (record) =>
      allVisibleStudentIds.has(record.student_id ?? "") && dateInRange(record.date, from, to),
  );
  const rewards = rewardsRaw.filter(
    (record) =>
      studentIdSet.has(record.student_id ?? "") && dateInRange(record.date, from, to),
  );
  const examResults = examResultsRaw.filter(
    (row) =>
      studentIdSet.has(row.student_id ?? "") &&
      examIdSet.has(row.exam_id ?? "") &&
      exams.some(
        (exam) => exam.id === row.exam_id && dateInRange(exam.exam_date, from, to),
      ),
  );

  const attendanceByStudent = new Map<string, AttendanceRecord[]>();
  attendance.forEach((record) => {
    const studentId = record.student_id;
    if (!studentId) return;
    const rows = attendanceByStudent.get(studentId) ?? [];
    rows.push(record);
    attendanceByStudent.set(studentId, rows);
  });

  const rewardsByStudent = new Map<string, RewardRecord[]>();
  rewards.forEach((record) => {
    const studentId = record.student_id;
    if (!studentId) return;
    const rows = rewardsByStudent.get(studentId) ?? [];
    rows.push(record);
    rewardsByStudent.set(studentId, rows);
  });

  const groupClassDates = new Map<string, Set<string>>();
  attendanceInRange.forEach((record) => {
    const student = allActiveStudentsMap.get(record.student_id ?? "");
    const groupName = student?.group_name;
    if (!groupName || !record.date) return;
    const dates = groupClassDates.get(groupName) ?? new Set<string>();
    dates.add(record.date);
    groupClassDates.set(groupName, dates);
  });

  const examByStudent = new Map<string, ExamResultDoc[]>();
  examResults.forEach((row) => {
    const studentId = row.student_id;
    if (!studentId) return;
    const rows = examByStudent.get(studentId) ?? [];
    rows.push(row);
    examByStudent.set(studentId, rows);
  });

  const examMapById = new Map(exams.map((exam) => [exam.id, exam] as const));

  const rawStudentSummaries = students
    .map((student) => {
      const studentAttendance = attendanceByStudent.get(student.id) ?? [];
      const joinDate = resolveStudentStartDate(student);
      const leaveDate = timestampLikeToIsoDate(student.leave_date ?? null);
      const effectiveStartDate = maxIsoDate(dateFromIso, joinDate);
      const effectiveEndDate = minIsoDate(dateToIso, resolveStudentEndDate(student, dateToIso));

      const boundedAttendance = studentAttendance.filter(
        (row) =>
          (row.date ?? "") >= effectiveStartDate && (row.date ?? "") <= effectiveEndDate,
      );
      const studentRewards = (rewardsByStudent.get(student.id) ?? []).filter(
        (row) =>
          (row.date ?? "") >= effectiveStartDate && (row.date ?? "") <= effectiveEndDate,
      );
      const studentExamResults = (examByStudent.get(student.id) ?? []).filter((row) => {
        const exam = examMapById.get(row.exam_id ?? "");
        const examDate = exam?.exam_date ?? "";
        return examDate >= effectiveStartDate && examDate <= effectiveEndDate;
      });
      const relevantClassDates = Array.from(groupClassDates.get(student.group_name ?? "") ?? [])
        .filter((date) => date >= effectiveStartDate && date <= effectiveEndDate)
        .sort();
      const totalClasses = relevantClassDates.length;

      const presentCount = boundedAttendance.filter((row) => row.status === "present").length;
      const lateCount = boundedAttendance.filter((row) => row.status === "late").length;
      const explicitAbsentCount = boundedAttendance.filter((row) =>
        ["absent", "absent_with_reason", "absent_without_reason"].includes(row.status ?? ""),
      ).length;
      const absentCount = Math.max(explicitAbsentCount, totalClasses - presentCount - lateCount);
      const attendancePct = totalClasses
        ? Number((((presentCount + lateCount) / totalClasses) * 100).toFixed(2))
        : 0;
      const attendancePoints = Number(
        (presentCount * PRESENT_POINTS + lateCount * LATE_POINTS).toFixed(2),
      );

      const avgExamScore = studentExamResults.length
        ? Number(
            (
              studentExamResults.reduce((sum, row) => sum + toNumber(row.score), 0) /
              studentExamResults.length
            ).toFixed(2),
          )
        : 0;

      const penalties = Number(
        studentRewards
          .filter((row) => row.type === "Jarima")
          .reduce((sum, row) => sum + toNumber(row.points), 0)
          .toFixed(2),
      );
      const rewardsPoints = Number(
        studentRewards
          .filter((row) => row.type === "Mukofot")
          .reduce((sum, row) => sum + toNumber(row.points), 0)
          .toFixed(2),
      );
      const bahoRows = studentRewards.filter((row) => row.type === "Baho");
      const bahoCount = bahoRows.length;
      const bahoScore = bahoRows.reduce((sum, row) => sum + toNumber(row.points), 0);
      const bahoAverage = bahoCount ? Number((bahoScore / bahoCount).toFixed(2)) : 0;
      const totalScore = Number((attendancePoints + rewardsPoints - penalties).toFixed(2));
      const riskBasisScore = avgExamScore > 0 ? avgExamScore : bahoAverage;
      const risk = computeRisk(attendancePct, riskBasisScore, penalties, rewardsPoints);
      const recentExams = studentExamResults
        .map((row) => {
          const exam = examMapById.get(row.exam_id ?? "");
          return {
            examName: exam?.exam_name ?? row.exam_id ?? "Imtihon",
            examDate: exam?.exam_date ?? "",
            score: toNumber(row.score),
          };
        })
        .sort((a, b) => (b.examDate ?? "").localeCompare(a.examDate ?? ""))
        .slice(0, 5);

      return {
        id: student.id,
        name: student.name ?? student.id,
        groupName: student.group_name ?? "Guruhsiz",
        joinDate,
        leaveDate,
        overallRank: 0,
        groupRank: 0,
        classDates: relevantClassDates,
        attendanceRecords: boundedAttendance
          .filter((row) => Boolean(row.date))
          .map((row) => ({
            date: row.date ?? "",
            status: row.status ?? "",
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        attendanceSessions: boundedAttendance.length,
        totalClasses,
        presentCount,
        lateCount,
        absentCount,
        attendancePct,
        attendancePoints,
        examCount: studentExamResults.length,
        avgExamScore,
        bahoAverage,
        bahoCount,
        recentExams,
        rewardEventCount: studentRewards.filter((row) => row.type === "Mukofot").length,
        penaltyEventCount: studentRewards.filter((row) => row.type === "Jarima").length,
        penalties,
        rewards: rewardsPoints,
        jarimaPoints: penalties,
        mukofotPoints: rewardsPoints,
        totalScore,
        riskLevel: risk.level,
        riskScore: risk.score,
      };
    });

  const overallRankMap = new Map(
    [...rawStudentSummaries]
      .sort(compareStudentsForRanking)
      .map((student, index) => [student.id, index + 1] as const),
  );

  const groupRankMap = new Map<string, Map<string, number>>();
  const rawGroupedStudents = new Map<string, typeof rawStudentSummaries>();
  rawStudentSummaries.forEach((student) => {
    const rows = rawGroupedStudents.get(student.groupName) ?? [];
    rows.push(student);
    rawGroupedStudents.set(student.groupName, rows);
  });
  rawGroupedStudents.forEach((groupStudents, groupName) => {
    groupRankMap.set(
      groupName,
      new Map(
        [...groupStudents]
          .sort(compareStudentsForRanking)
          .map((student, index) => [student.id, index + 1] as const),
      ),
    );
  });

  const studentSummaries = rawStudentSummaries
    .map((student) => ({
      ...student,
      overallRank: overallRankMap.get(student.id) ?? 0,
      groupRank: groupRankMap.get(student.groupName)?.get(student.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const groupedStudents = new Map<string, typeof studentSummaries>();
  studentSummaries.forEach((student) => {
    const rows = groupedStudents.get(student.groupName) ?? [];
    rows.push(student);
    groupedStudents.set(student.groupName, rows);
  });

  const groupSummaries = Array.from(groupedStudents.entries())
    .map(([groupName, groupStudents]) => {
      const matchingGroup = groups.find((group) => group.name === groupName);
      const avgAttendance = groupStudents.length
        ? Number(
            (
              groupStudents.reduce((sum, student) => sum + student.attendancePct, 0) /
              groupStudents.length
            ).toFixed(2),
          )
        : 0;
      const examEligible = groupStudents.filter((student) => student.avgExamScore > 0);
      const avgExamScore = examEligible.length
        ? Number(
            (
              examEligible.reduce((sum, student) => sum + student.avgExamScore, 0) /
              examEligible.length
            ).toFixed(2),
          )
        : 0;
      const avgTotalScore = groupStudents.length
        ? Number(
            (
              groupStudents.reduce((sum, student) => sum + student.totalScore, 0) /
              groupStudents.length
            ).toFixed(2),
          )
        : 0;
      const bahoEligible = groupStudents.filter((student) => student.bahoCount > 0);
      const avgBahoAverage = bahoEligible.length
        ? Number(
            (
              bahoEligible.reduce((sum, student) => sum + student.bahoAverage, 0) /
              bahoEligible.length
            ).toFixed(2),
          )
        : 0;

      return {
        id: matchingGroup?.id ?? groupName,
        name: groupName,
        studentCount: groupStudents.length,
        avgAttendance,
        avgExamScore,
        avgTotalScore,
        avgBahoAverage,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const examResultsByExam = new Map<string, ExamResultDoc[]>();
  examResults.forEach((row) => {
    const examId = row.exam_id;
    if (!examId) return;
    const rows = examResultsByExam.get(examId) ?? [];
    rows.push(row);
    examResultsByExam.set(examId, rows);
  });

  const examSummaries = exams
    .map((exam) => {
      const rows = examResultsByExam.get(exam.id) ?? [];
      const avgScore = rows.length
        ? Number(
            (rows.reduce((sum, row) => sum + toNumber(row.score), 0) / rows.length).toFixed(
              2,
            ),
          )
        : 0;

      return {
        id: exam.id,
        examName: exam.exam_name ?? exam.id,
        examDate: exam.exam_date ?? "",
        groupName: groupsMapById[exam.group_id ?? ""] ?? "",
        avgScore,
        resultCount: rows.length,
      };
    })
    .sort((a, b) => {
      const byDate = (b.examDate ?? "").localeCompare(a.examDate ?? "");
      if (byDate !== 0) return byDate;
      return a.examName.localeCompare(b.examName, undefined, { sensitivity: "base" });
    });

  const noteSummaries = groupNotesRaw
    .map((note) => {
      const groupName = groupsMapById[note.group_id ?? ""] ?? "";
      const rawText =
        note.title ?? note.note ?? note.content ?? note.text ?? "";
      const summary = rawText.replace(/\s+/g, " ").trim().slice(0, 180);

      return {
        groupName: groupName || "Noma'lum guruh",
        summary,
      };
    })
    .filter((note) => note.summary.length > 0)
    .slice(0, 20);

  const examTypes = Array.from(
    new Set(
      examTypesRaw
        .map((type) => type.name ?? type.title ?? "")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const auditSummary = auditLogsRaw.reduce(
    (acc, log) => {
      if (log.action === "export") acc.exports += 1;
      if (log.action === "import") acc.imports += 1;
      if (log.action === "import_failed") acc.failedImports += 1;
      return acc;
    },
    { exports: 0, imports: 0, failedImports: 0 },
  );

  return {
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    totals: {
      students: studentSummaries.length,
      groups: groupSummaries.length,
      exams: examSummaries.length,
      attendanceRecords: attendance.length,
      examResults: examResults.length,
      rewardRecords: rewards.length,
    },
    students: studentSummaries,
    groups: groupSummaries,
    exams: examSummaries,
    notes: noteSummaries,
    examTypes,
    archives: {
      students: archivedStudentsRaw.length,
      groups: archivedGroupsRaw.length,
      exams: archivedExamsRaw.length,
    },
    deleted: {
      students: deletedStudentsRaw.length,
      groups: deletedGroupsRaw.length,
      exams: deletedExamsRaw.length,
      attendance: deletedAttendanceRaw.length,
      rewards: deletedRewardsRaw.length,
      examResults: deletedExamResultsRaw.length,
      studentScores: deletedStudentScoresRaw.length,
    },
    auditSummary,
    appKnowledge: {
      modules: APP_KNOWLEDGE_MODULES,
      collections: [
        "teachers",
        "admins",
        "groups",
        "students",
        "attendance_records",
        "reward_penalty_history",
        "group_notes",
        "exams",
        "exam_results",
        "exam_types",
        "archived_students",
        "archived_groups",
        "archived_exams",
        "deleted_students",
        "deleted_groups",
        "deleted_exams",
        "deleted_attendance_records",
        "deleted_reward_penalty_history",
        "deleted_exam_results",
        "deleted_student_scores",
        "audit_logs",
      ],
      guidance: APP_KNOWLEDGE_GUIDANCE,
    },
  };
}

function buildHeuristicOutput(aggregated: AggregatedData): ModelOutput {
  const sortedByRisk = [...aggregated.students].sort((a, b) => b.riskScore - a.riskScore);
  const highRiskStudents = sortedByRisk.filter((student) => student.riskLevel === "high");
  const mediumRiskStudents = sortedByRisk.filter(
    (student) => student.riskLevel === "medium",
  );

  const riskAlerts = [
    {
      id: "risk-high",
      level: "high" as const,
      reason: `${highRiskStudents.length} ta o'quvchida yuqori xavf signali bor (davomat yoki imtihon natijasi pasaygan).`,
      confidence: pickConfidence(
        aggregated.sourceStats.attendanceRecords + aggregated.sourceStats.examResults,
      ),
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
      explanation:
        "Imtihon natijalaridagi siljish o'qitish strategiyasini qayta ko'rib chiqishni talab qilishi mumkin.",
    },
    {
      metric: "discipline",
      current: aggregated.penaltyEvents,
      baseline: disciplineBaseline,
      deltaPct: computeDeltaPct(aggregated.penaltyEvents, disciplineBaseline),
      explanation:
        "Intizom bo'yicha ogohlantiruvchi holatlar soni o'sishi operativ chora talab qiladi.",
    },
  ];

  const forecasts = [
    {
      metric: "attendance" as const,
      horizonDays: 28,
      points: buildForecastPoints("attendance", aggregated.trend.attendance),
      confidence: pickConfidence(aggregated.sourceStats.attendanceRecords),
    },
    {
      metric: "exam_score" as const,
      horizonDays: 28,
      points: buildForecastPoints("exam_score", aggregated.trend.examScore),
      confidence: pickConfidence(aggregated.sourceStats.examResults),
    },
    {
      metric: "discipline" as const,
      horizonDays: 28,
      points: buildForecastPoints("discipline", aggregated.trend.discipline),
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
      steps:
        "S-*** tokenli o'quvchilar bilan haftalik individual uchrashuv va mini-maqsadlar belgilang.",
    },
    {
      title: "Past natijali mavzular bo'yicha qayta dars",
      priority: 2 as const,
      owner: "teacher" as const,
      dueInDays: 7,
      expectedImpact: "Imtihon o'rtacha ballining tiklanishi",
      steps:
        "Eng ko'p xato qilingan bo'limlar uchun qisqa intensiv blok dars tashkil qiling.",
    },
    {
      title: "Intizom monitoring dashboardi",
      priority: 3 as const,
      owner: "admin" as const,
      dueInDays: 10,
      expectedImpact: "Jarima trendining pasayishi",
      steps:
        "Jarima sabablari bo'yicha kategoriya kesimida haftalik nazoratni yo'lga qo'ying.",
    },
  ];

  const weeklyPlan = [
    {
      day: "Dushanba",
      task: "Yuqori xavf signalidagi o'quvchilar bilan individual suhbat",
    },
    { day: "Seshanba", task: "Qayta dars va mustahkamlash mashg'uloti" },
    { day: "Chorshanba", task: "What-if senariy bo'yicha kichik tajriba" },
    {
      day: "Payshanba",
      task: "Oraliq natijalarni tekshirish va qayta rejalash",
    },
    {
      day: "Juma",
      task: "Haftalik hisobot va keyingi haftaga aniq action-plan",
    },
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

function buildPrompt(request: AnalyzeInsightsRequest, aggregated: AggregatedData) {
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
    "Siz TeachPro ta'lim platformasi uchun o'ta malakali ma'lumotlar tahlilchisi (Data Analyst) va strategik maslahatchisiz.",
    "Maqsadingiz: O'qituvchilar va administratorlarga o'quv jarayonini yaxshilash, muammolarni oldindan aniqlash va aniq, amaliy tavsiyalar berishda yordam berish.",
    "Quyidagi qoidalarga qat'iy rioya qiling:",
    "1. Faqat O'zbek tilida, professional va dalillarga tayangan holda javob bering.",
    "2. Ma'lumotlardagi yashirin trendlarni va anomaliyalarni toping. Masalan, davomatning birdan tushib ketishi yoki ma'lum bir guruhdagi o'zlashtirish pasayishi.",
    "3. Tavsiyalaringiz 'S-***' ko'rinishidagi tokenlar orqali aniq o'quvchilarga yo'naltirilgan bo'lsin.",
    "4. Forecast bo'limida statistik trendlardan kelib chiqib, kelgusi 4 hafta uchun ehtimoliy natijalarni bashorat qiling.",
    "5. Interventions bo'limida shunchaki umumiy gaplar emas, balki aniq 'action-plan' (harakatlar rejasi) taqdim eting.",
    "6. Javobni FAQAT JSON formatida qaytaring. Hech qanday qo'shimcha matn yoki markdown belgilari bo'lmasin.",
    "Data:",
    JSON.stringify(payload),
  ].join("\n");
}

function normalizeConversationForPrompt(
  conversation: ProjectChatMessage[] = [],
): ProjectChatMessage[] {
  return conversation
    .filter(
      (entry) =>
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string" &&
        entry.content.trim().length > 0,
    )
    .slice(-6)
    .map((entry) => ({
      role: entry.role,
      content: entry.content.trim(),
    }));
}

function buildAskPrompt(
  question: string,
  runData: AnalyzeInsightsResponse,
  conversation: ProjectChatMessage[] = [],
) {
  const recentConversation = normalizeConversationForPrompt(conversation);

  return [
    "Siz TeachPro platformasining o'ta aqlli va yordamga tayyor AI assistantisiz.",
    "Faqat O'zbek tilida, xushmuomala, professional va tushunarli javob bering.",
    "Sizda o'quvchilarning davomati, baholari, imtihonlari va intizomi bo'yicha tahliliy ma'lumotlar bor.",
    "Javob berishda quyidagilarga e'tibor bering:",
    "1. Savolga berilgan kontekst (runData) va suhbat tarixiga (recentConversation) asoslanib, aniq faktlar bilan javob bering.",
    "2. Har doim ## Xulosa, ## Asosiy Statistikalar, ## Tahlil, ## Tavsiyalar bo'limlarini ishlating.",
    "3. Statistikalar bo'limida kamida bitta markdown jadval ishlating. Jadvalda ma'lumotlarni tartib bilan ko'rsating.",
    "4. Tavsiyalar qismini o'qituvchi uchun amaliy va foydali qiling.",
    "5. Agar foydalanuvchi ma'lumot topa olmasa yoki noto'g'ri savol bersa, ehtiyotkorlik bilan to'g'rilang va yordam taklif qiling.",
    "6. Javobni faqat JSON formatida qaytaring: {\"answer\": string, \"citations\": string[] }.",
    "RecentConversation:",
    JSON.stringify(recentConversation),
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

function buildProjectChatPrompt(
  question: string,
  runData: AnalyzeInsightsResponse,
  projectContext: ProjectChatContext,
  conversation: ProjectChatMessage[] = [],
) {
  const recentConversation = normalizeConversationForPrompt(conversation);

  return [
    "Siz TeachPro platformasining barcha ma'lumotlariga (Guruhlar, O'quvchilar, Imtihonlar, Davomat, Arxiv) ega bo'lgan o'ta kuchli va strategik AI assistantisiz.",
    "Faqat O'zbek tilida, xushmuomala, lekin o'ta aniq (data-driven) javob bering.",
    "Sizning vazifangiz - o'qituvchiga o'z o'quvchilari va guruhlari bo'yicha har qanday murakkab savollarga javob berish va tahlil qilish.",
    "Muhim qoidalar:",
    "1. Berilgan ProjectContext ichida real o'quvchilar ismlari, guruhlar nomlari va barcha statistikalar bor. Savolga javob berishda aynan shu ma'lumotlardan foydalaning.",
    "2. Agar savol 'reyting', 'ball' yoki 'kim eng yaxshi' haqida bo'lsa, 'attendancePoints + mukofotPoints - jarimaPoints' formulasiga ko'ra o'zingiz hisoblab bering.",
    "3. Agar savol biror o'quvchi yoki guruh haqida bo'lsa, uning davomati, baholari va trendini taqqoslang.",
    "4. Javobingizda markdown jadvallar, qalin (bold) yozuvlar va aniq punktlardan (bullet points) foydalaning.",
    "5. Har bir javobingiz o'qituvchi uchun qiymatli bo'lsin: masalan, 'Ushbu o'quvchining davomati 5% ga tushib ketgan, u bilan gaplashib olish tavsiya etiladi'.",
    "6. Javobni faqat JSON formatida qaytaring: {\"answer\": string, \"citations\": string[] }.",
    "RecentConversation:",
    JSON.stringify(recentConversation),
    "Question:",
    question,
    "AnalysisSummary:",
    JSON.stringify({
      summary: runData.summary,
      riskAlerts: runData.riskAlerts,
      anomalies: runData.anomalies,
      forecasts: runData.forecasts,
      interventions: runData.interventions,
    }),
    "ProjectContext:",
    JSON.stringify({
      dateFrom: projectContext.dateFrom,
      dateTo: projectContext.dateTo,
      totals: projectContext.totals,
      groups: projectContext.groups.slice(0, MAX_CHAT_GROUP_CONTEXT).map((group) => ({
        id: group.id,
        name: group.name,
        studentCount: group.studentCount,
        avgAttendance: group.avgAttendance,
        avgExamScore: group.avgExamScore,
        avgTotalScore: group.avgTotalScore,
        avgBahoAverage: group.avgBahoAverage,
      })),
      students: projectContext.students.slice(0, MAX_CHAT_STUDENT_CONTEXT).map((student) => ({
        id: student.id,
        name: student.name,
        groupName: student.groupName,
        joinDate: student.joinDate,
        leaveDate: student.leaveDate,
        overallRank: student.overallRank,
        groupRank: student.groupRank,
        totalClasses: student.totalClasses,
        attendancePct: student.attendancePct,
        attendancePoints: student.attendancePoints,
        examCount: student.examCount,
        avgExamScore: student.avgExamScore,
        bahoAverage: student.bahoAverage,
        rewardEventCount: student.rewardEventCount,
        mukofotPoints: student.mukofotPoints,
        penaltyEventCount: student.penaltyEventCount,
        jarimaPoints: student.jarimaPoints,
        totalScore: student.totalScore,
        riskLevel: student.riskLevel,
      })),
      exams: projectContext.exams.slice(0, MAX_CHAT_EXAM_CONTEXT),
      notes: projectContext.notes.slice(0, 20),
      examTypes: projectContext.examTypes,
      archives: projectContext.archives,
      deleted: projectContext.deleted,
      auditSummary: projectContext.auditSummary,
      appKnowledge: projectContext.appKnowledge,
    }),
  ].join("\n");
}

function findMentionedGroup(
  normalizedQuestion: string,
  projectContext: ProjectChatContext,
) {
  return projectContext.groups.find((group) =>
    normalizeLookupText(normalizedQuestion).includes(normalizeLookupText(group.name)),
  );
}

function findStudentMatches(
  question: string,
  projectContext: ProjectChatContext,
): ProjectChatContext["students"] {
  const normalizedQuestion = normalizeLookupText(question);
  const lookupTerms = extractLookupTerms(question);

  const scored = projectContext.students
    .map((student) => {
      const normalizedName = normalizeLookupText(student.name);
      let score = 0;

      if (normalizedQuestion.includes(normalizedName)) {
        score += 100;
      }

      lookupTerms.forEach((term) => {
        if (normalizedName === term) {
          score += 90;
        } else if (normalizedName.includes(term)) {
          score += 28;
        } else if (term.includes(normalizedName) && normalizedName.length >= 4) {
          score += 18;
        }
      });

      const matchedTerms = lookupTerms.filter((term) => normalizedName.includes(term)).length;
      score += matchedTerms * 6;

      return { student, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return [];
  }

  const topScore = scored[0]?.score ?? 0;
  return scored
    .filter((entry) => entry.score >= Math.max(28, topScore - 12))
    .map((entry) => entry.student);
}

function inferStudentFromConversation(
  conversation: ProjectChatMessage[] = [],
  projectContext: ProjectChatContext,
): ProjectChatContext["students"][number] | null {
  const recentMessages = [...conversation].reverse();

  for (const message of recentMessages) {
    if (message.role !== "user") continue;
    const matches = findStudentMatches(message.content, projectContext);
    if (matches.length === 1) {
      return matches[0];
    }
  }

  for (const message of recentMessages) {
    const matches = findStudentMatches(message.content, projectContext);
    if (matches.length === 1) {
      return matches[0];
    }
  }

  return null;
}

function resolveStudentMatches(
  question: string,
  projectContext: ProjectChatContext,
  conversation: ProjectChatMessage[] = [],
): ProjectChatContext["students"] {
  const directMatches = findStudentMatches(question, projectContext);
  if (directMatches.length > 0) {
    return directMatches;
  }

  const normalizedQuestion = normalizeLookupText(question);
  const shouldUseConversationContext = includesAny(normalizedQuestion, [
    "oquvchi",
    "uning",
    "unda",
    "unga",
    "shu",
    "qoshilgan",
    "reyting",
    "orin",
    "sinfida",
    "guruhida",
    "davomat",
    "ball",
    "baho",
    "imtihon",
    "xavf",
    "mukofot",
    "jarima",
  ]);

  if (!shouldUseConversationContext) {
    return [];
  }

  const inferredStudent = inferStudentFromConversation(conversation, projectContext);
  return inferredStudent ? [inferredStudent] : [];
}

function formatStudentDetails(
  student: ProjectChatContext["students"][number],
): AskInsightsResponse {
  return {
    answer: [
      `${formatStudentReference(student)} bo'yicha qisqa ma'lumot: u ${student.joinDate} kuni tizimga qo'shilgan.`,
      `Hozir jami reyting balli ${formatMetricValue(student.totalScore)}. ${student.groupName} guruhida ${student.groupRank}-o'rinda, umumiy reytingda ${student.overallRank}-o'rinda turibdi.`,
      student.totalClasses > 0
        ? `Davomat ${student.attendancePct.toFixed(1)}%: ${student.totalClasses} ta darsdan ${student.presentCount} ta qatnashgan, ${student.lateCount} ta kechikkan, ${student.absentCount} ta kelmagan.`
        : "Davomat ma'lumoti mavjud emas.",
      `Davomat balli ${formatMetricValue(student.attendancePoints)}, mukofot ${formatMetricValue(student.mukofotPoints)}, jarima ${formatMetricValue(student.jarimaPoints)}.${student.bahoCount > 0 ? ` Baho o'rtachasi ${formatMetricValue(student.bahoAverage)}.` : ""}`,
      student.examCount > 0
        ? `So'nggi ${student.examCount} ta imtihon bo'yicha o'rtacha natija ${formatMetricValue(student.avgExamScore)}.`
        : "Imtihon natijasi hozircha kiritilmagan.",
    ].join("\n\n"),
    citations: ["students", "attendance_records", "reward_penalty_history", "exam_results"],
  };
}

function formatStudentJoinDate(
  student: ProjectChatContext["students"][number],
): AskInsightsResponse {
  return {
    answer: [
      `${formatStudentReference(student)} ${student.joinDate} kuni tizimga qo'shilgan.`,
      student.leaveDate
        ? `Chiqish sanasi ${student.leaveDate} deb ko'rsatilgan.`
        : "Hozircha faol o'quvchi sifatida turibdi.",
    ].join(" "),
    citations: ["students"],
  };
}

function formatStudentRank(
  student: ProjectChatContext["students"][number],
  scope: "group" | "overall" | "both",
): AskInsightsResponse {
  const parts: string[] = [];

  if (scope === "group" || scope === "both") {
    parts.push(`${student.name} ${student.groupName} guruhida ${student.groupRank}-o'rinda turibdi.`);
  }

  if (scope === "overall" || scope === "both") {
    parts.push(`Umumiy reytingda esa ${student.overallRank}-o'rinda.`);
  }

  parts.push(
    `Jami reyting balli ${formatMetricValue(student.totalScore)} bo'lib, bu ${formatMetricValue(student.attendancePoints)} davomat balli, ${formatMetricValue(student.mukofotPoints)} mukofot va ${formatMetricValue(student.jarimaPoints)} jarima asosida hisoblangan.`,
  );

  return {
    answer: parts.join(" "),
    citations: ["students", "attendance_records", "reward_penalty_history"],
  };
}

function formatStudentAttendanceOnDate(
  student: ProjectChatContext["students"][number],
  targetDate: string,
): AskInsightsResponse {
  const attendanceRecord = student.attendanceRecords.find((row) => row.date === targetDate);
  const hadClassOnDate = student.classDates.includes(targetDate);
  const status = attendanceRecord?.status ?? (hadClassOnDate ? "absent" : "no_class");

  const verdict =
    status === "present"
      ? "Ha, o'quvchi darsga qatnashgan."
      : status === "late"
        ? "Ha, lekin o'quvchi kechikib qatnashgan."
        : status === "no_class"
          ? "Bu sana bo'yicha dars yozuvi topilmadi."
          : `Yo'q, o'quvchi ${describeAttendanceStatus(status)}.`;

  const statsTable = toMarkdownTable(
    ["Ko'rsatkich", "Qiymat"],
    [
      ["O'quvchi", student.name],
      ["Guruh", student.groupName],
      ["Sana", targetDate],
      ["Holat", status === "no_class" ? "Dars topilmadi" : describeAttendanceStatus(status)],
      ["Davomat balli", formatMetricValue(student.attendancePoints)],
      ["Jami reyting ball", formatMetricValue(student.totalScore)],
    ],
  );

  return {
    answer: [
      `${formatStudentReference(student)} uchun ${targetDate} sanasidagi holat: ${verdict}`,
      hadClassOnDate
        ? `${targetDate} kuni ${student.groupName} guruhi uchun dars yozuvi bor va holat "${describeAttendanceStatus(status)}" deb qayd etilgan.`
        : `${targetDate} sanasi uchun ${student.groupName} guruhi bo'yicha dars yoki davomat yozuvi topilmadi.`,
      statsTable,
    ].join("\n\n"),
    citations: ["attendance_records", "students"],
  };
}

function formatStudentMatchChoices(
  matches: ProjectChatContext["students"],
): AskInsightsResponse {
  const table = toMarkdownTable(
    ["#", "O'quvchi", "Guruh", "Jami ball", "Davomat", "Baho", "Risk"],
    matches.slice(0, 5).map((student, index) => [
      index + 1,
      student.name,
      student.groupName,
      formatMetricValue(student.totalScore),
      `${student.attendancePct.toFixed(1)}%`,
      formatMetricValue(student.bahoAverage || student.avgExamScore),
      student.riskLevel,
    ]),
  );

  return {
    answer: [
      "## Xulosa",
      "Bir nechta mos o'quvchi topildi. Kerakli o'quvchini aniqlashtiring.",
      "",
      "## Asosiy Statistikalar",
      table,
    ].join("\n"),
    citations: ["students"],
  };
}

function formatStudentRoster(
  students: ProjectChatContext["students"],
  groupName?: string,
): AskInsightsResponse {
  if (students.length === 0) {
    return {
      answer: groupName
        ? `${groupName} guruhi uchun faol o'quvchi topilmadi.`
        : "Faol o'quvchilar topilmadi.",
      citations: ["students"],
    };
  }

  const table = toMarkdownTable(
    ["#", "O'quvchi", "Guruh", "Jami ball", "Davomat balli", "Mukofot", "Jarima", "Baho", "Risk"],
    students.map((student, index) => [
      index + 1,
      student.name,
      student.groupName || "-",
      formatMetricValue(student.totalScore),
      formatMetricValue(student.attendancePoints),
      formatMetricValue(student.mukofotPoints),
      formatMetricValue(student.jarimaPoints),
      formatMetricValue(student.bahoAverage || student.avgExamScore),
      student.riskLevel,
    ]),
  );

  return {
    answer: [
      "## Xulosa",
      `${groupName ? `${groupName} guruhi` : "Joriy kontekst"} bo'yicha ${students.length} ta faol o'quvchi topildi.`,
      "",
      "## Asosiy Statistikalar",
      table,
      "",
      "## Tahlil",
      "Jadvalda o'quvchi bo'yicha jami reyting balli, davomat balli, mukofot, jarima, baho va xavf darajasi ko'rsatilgan.",
    ].join("\n"),
    citations: ["students", "attendance_records", "reward_penalty_history"],
  };
}

function formatGroupRoster(groups: ProjectChatContext["groups"]): AskInsightsResponse {
  if (groups.length === 0) {
    return {
      answer: "Faol guruhlar topilmadi.",
      citations: ["groups"],
    };
  }

  const table = toMarkdownTable(
    ["#", "Guruh", "O'quvchilar soni", "O'rtacha davomat", "O'rtacha reyting", "O'rtacha baho"],
    groups.map((group, index) => [
      index + 1,
      group.name,
      group.studentCount,
      `${group.avgAttendance.toFixed(1)}%`,
      formatMetricValue(group.avgTotalScore),
      formatMetricValue(group.avgBahoAverage || group.avgExamScore),
    ]),
  );

  return {
    answer: [
      "## Xulosa",
      `${groups.length} ta guruh bo'yicha kesim tayyorlandi.`,
      "",
      "## Asosiy Statistikalar",
      table,
      "",
      "## Tahlil",
      "Jadval har bir guruh bo'yicha o'quvchilar soni, o'rtacha davomat, reyting va baho ko'rsatkichlarini ko'rsatadi.",
    ].join("\n"),
    citations: ["groups", "students", "attendance_records", "reward_penalty_history"],
  };
}

function formatExamRoster(exams: ProjectChatContext["exams"]): AskInsightsResponse {
  if (exams.length === 0) {
    return {
      answer: "Mos imtihonlar topilmadi.",
      citations: ["exams"],
    };
  }

  const table = toMarkdownTable(
    ["#", "Imtihon", "Sana", "Guruh", "O'rtacha ball", "Natijalar soni"],
    exams.map((exam, index) => [
      index + 1,
      exam.examName,
      exam.examDate || "-",
      exam.groupName || "-",
      formatMetricValue(exam.avgScore),
      exam.resultCount,
    ]),
  );

  return {
    answer: [
      "## Xulosa",
      `${exams.length} ta imtihon bo'yicha ma'lumot topildi.`,
      "",
      "## Asosiy Statistikalar",
      table,
      "",
      "## Tahlil",
      "Jadvalda imtihon nomi, sana, guruh, o'rtacha ball va natijalar soni jamlangan.",
    ].join("\n"),
    citations: ["exams"],
  };
}

function formatRiskRoster(
  students: ProjectChatContext["students"],
  label: string,
): AskInsightsResponse {
  if (students.length === 0) {
    return {
      answer: `${label} bo'yicha o'quvchilar topilmadi.`,
      citations: ["students", "riskAlerts"],
    };
  }

  const table = toMarkdownTable(
    ["#", "O'quvchi", "Guruh", "Jami ball", "Davomat", "Baho", "Risk"],
    students.map((student, index) => [
      index + 1,
      student.name,
      student.groupName,
      formatMetricValue(student.totalScore),
      `${student.attendancePct.toFixed(1)}%`,
      formatMetricValue(student.bahoAverage || student.avgExamScore),
      student.riskLevel,
    ]),
  );

  return {
    answer: [
      "## Xulosa",
      `${label} bo'yicha ${students.length} ta o'quvchi topildi.`,
      "",
      "## Asosiy Statistikalar",
      table,
      "",
      "## Tahlil",
      "Jadvalda xavf, davomat va imtihon natijalari kesimida ustuvor o'quvchilar ko'rsatilgan.",
    ].join("\n"),
    citations: ["students", "riskAlerts"],
  };
}

function formatModuleKnowledge(
  modules: ProjectChatContext["appKnowledge"]["modules"],
): AskInsightsResponse {
  const table = toMarkdownTable(
    ["Modul", "Vazifa", "Asosiy imkoniyatlar"],
    modules.map((module) => [
      module.name,
      module.purpose,
      module.capabilities.join(", "),
    ]),
  );

  return {
    answer: [
      "## Xulosa",
      "TeachPro frontend modullari bo'yicha umumiy knowledge tayyorlandi.",
      "",
      "## Asosiy Statistikalar",
      table,
      "",
      "## Tavsiyalar",
      "- Savolni aniq modul nomi bilan bersangiz, AI yanada aniq yo'l-yo'riq beradi.",
    ].join("\n"),
    citations: ["appKnowledge"],
  };
}

function formatSingleModuleKnowledge(
  module: ProjectChatContext["appKnowledge"]["modules"][number],
): AskInsightsResponse {
  const table = toMarkdownTable(
    ["Ko'rsatkich", "Qiymat"],
    [
      ["Modul", module.name],
      ["Vazifa", module.purpose],
      ["Imkoniyatlar", module.capabilities.join(", ")],
    ],
  );

  return {
    answer: [
      "## Xulosa",
      `${module.name} moduli bo'yicha ma'lumot tayyorlandi.`,
      "",
      "## Asosiy Statistikalar",
      table,
      "",
      "## Tavsiyalar",
      "- Agar bu modul bo'yicha aniq ish jarayoni kerak bo'lsa, konkret savol bering.",
    ].join("\n"),
    citations: ["appKnowledge"],
  };
}

function resolveDeterministicProjectAnswer(
  question: string,
  projectContext: ProjectChatContext,
  conversation: ProjectChatMessage[] = [],
): AskInsightsResponse | null {
  const normalizedQuestion = normalizeLookupText(question);
  const mentionedGroup = findMentionedGroup(normalizedQuestion, projectContext);
  const scopedStudents = mentionedGroup
    ? projectContext.students.filter((student) => student.groupName === mentionedGroup.name)
    : projectContext.students;
  const scopedExams = mentionedGroup
    ? projectContext.exams.filter((exam) => exam.groupName === mentionedGroup.name)
    : projectContext.exams;
  const scopedContext = {
    ...projectContext,
    students: scopedStudents,
  };
  const matchedModule = projectContext.appKnowledge.modules.find((module) =>
    normalizedQuestion.includes(normalizeLookupText(module.name)) ||
    normalizedQuestion.includes(normalizeLookupText(module.id)),
  );
  const studentMatches = resolveStudentMatches(question, scopedContext, conversation);
  const hasQuotedLookup = /["“].+?["”]|'[^']+'/.test(question);

  const asksAboutFrontend =
    includesAny(normalizedQuestion, ["frontend", "sayt", "platforma", "modul", "sahifa"]) &&
    includesAny(normalizedQuestion, ["qanday", "nima", "imkoniyat", "qayer", "ishlaydi"]);

  if (
    includesAny(normalizedQuestion, ["salom", "assalom", "hello", "hi"]) &&
    normalizedQuestion.length < 10
  ) {
    return {
      answer: "Assalomu alaykum! Men TeachPro AI assistantiman. Sizga o'quvchilar tahlili, davomat yoki imtihon natijalari bo'yicha qanday yordam bera olaman?",
      citations: ["greeting"],
    };
  }

  if (matchedModule && asksAboutFrontend) {
    return formatSingleModuleKnowledge(matchedModule);
  }

  if (
    asksAboutFrontend &&
    includesAny(normalizedQuestion, ["barcha", "hamma", "royxat", "list"])
  ) {
    return formatModuleKnowledge(projectContext.appKnowledge.modules);
  }

  const asksForStudentList =
    includesAny(normalizedQuestion, ["oquvchi", "oquvchilar", "student"]) &&
    includesAny(normalizedQuestion, [
      "royxat",
      "royhat",
      "list",
      "roster",
      "shakllantir",
      "chiqar",
      "korsat",
      "top",
      "yaxshi",
      "yuqori",
    ]);

  const requestedDate = extractQuestionDate(question);
  
  // If user asks for a list, prioritize it over single student details
  if (asksForStudentList) {
    const isTopRequest = includesAny(normalizedQuestion, ["top", "eng yaxshi", "eng yuqori", "birinchi"]);
    let listToFormat = scopedStudents;
    
    if (isTopRequest) {
      listToFormat = [...scopedStudents]
        .sort(compareStudentsForRanking)
        .slice(0, 10);
      return formatStudentRoster(listToFormat, mentionedGroup?.name ? `${mentionedGroup.name} (Top 10)` : "Umumiy (Top 10)");
    }
    
    return formatStudentRoster(scopedStudents, mentionedGroup?.name);
  }

  const asksForAttendanceOnDate =
    Boolean(requestedDate) &&
    studentMatches.length > 0 &&
    includesAny(normalizedQuestion, [
      "darsga",
      "kelgan",
      "kelganmi",
      "qatnash",
      "davomat",
      "kechik",
      "kelmagan",
    ]);

  if (asksForAttendanceOnDate) {
    if (studentMatches.length === 1 && requestedDate) {
      return formatStudentAttendanceOnDate(studentMatches[0], requestedDate);
    }

    return formatStudentMatchChoices(studentMatches);
  }

  const asksForJoinDate =
    studentMatches.length > 0 &&
    includesAny(normalizedQuestion, ["qoshilgan", "qabul qilingan", "join", "added"]);

  if (asksForJoinDate) {
    if (studentMatches.length === 1) {
      return formatStudentJoinDate(studentMatches[0]);
    }

    return formatStudentMatchChoices(studentMatches);
  }

  const asksForRank =
    studentMatches.length > 0 &&
    includesAny(normalizedQuestion, ["reyting", "orin", "orinda", "nechanchi", "o'rin"]);

  if (asksForRank) {
    if (studentMatches.length === 1) {
      const rankScope = includesAny(normalizedQuestion, ["sinfida", "guruhida", "sinf", "guruh"])
        ? "group"
        : includesAny(normalizedQuestion, ["umumiy", "barcha", "hamma", "overall"])
          ? "overall"
          : "both";

      return formatStudentRank(studentMatches[0], rankScope);
    }

    return formatStudentMatchChoices(studentMatches);
  }

  const asksForStudentDetails =
    studentMatches.length > 0 &&
    !includesAny(normalizedQuestion, ["royxat", "royhat", "list", "shakllantir", "chiqar"]);

  if (asksForStudentDetails) {
    if (studentMatches.length === 1) {
      return formatStudentDetails(studentMatches[0]);
    }

    return formatStudentMatchChoices(studentMatches);
  }

  if (hasQuotedLookup && studentMatches.length === 0 && normalizedQuestion.includes("oquvchi")) {
    const lookupTerms = extractLookupTerms(question);
    return {
      answer: [
        "## Xulosa",
        `"${lookupTerms[0] ?? "So'ralgan o'quvchi"}" bo'yicha mos o'quvchi topilmadi.`,
        "",
        "## Tavsiya",
        "O'quvchi ism-familiyasini to'liqroq yozing yoki guruh nomi bilan aniqlashtiring.",
      ].join("\n"),
      citations: ["students"],
    };
  }

  const asksForGroupList =
    includesAny(normalizedQuestion, ["guruh", "sinf"]) &&
    includesAny(normalizedQuestion, ["royxat", "royhat", "list", "shakllantir", "chiqar"]);

  if (asksForGroupList) {
    return formatGroupRoster(projectContext.groups);
  }

  const asksForExamList =
    includesAny(normalizedQuestion, ["imtihon", "exam", "nazorat"]) &&
    includesAny(normalizedQuestion, ["royxat", "royhat", "list", "shakllantir", "chiqar"]);

  if (asksForExamList) {
    return formatExamRoster(scopedExams);
  }

  const asksForStudentCount =
    includesAny(normalizedQuestion, ["oquvchi", "oquvchilar", "student"]) &&
    includesAny(normalizedQuestion, ["nechta", "soni", "qancha", "jami"]);

  if (asksForStudentCount) {
    const countTable = toMarkdownTable(
      ["Kesim", "Faol o'quvchilar soni"],
      [[mentionedGroup ? mentionedGroup.name : "Joriy kontekst", mentionedGroup ? scopedStudents.length : projectContext.totals.students]],
    );
    return {
      answer: [
        "## Xulosa",
        mentionedGroup
          ? `${mentionedGroup.name} guruhidagi faol o'quvchilar soni hisoblandi.`
          : "Joriy kontekstdagi faol o'quvchilar soni hisoblandi.",
        "",
        "## Asosiy Statistikalar",
        countTable,
      ].join("\n"),
      citations: ["students"],
    };
  }

  const asksForHighRiskStudents =
    includesAny(normalizedQuestion, ["xavf", "risk"]) &&
    includesAny(normalizedQuestion, ["kim", "qaysi", "royxat", "oquvchi", "student"]);

  if (asksForHighRiskStudents) {
    const highRiskStudents = scopedStudents
      .filter((student) => student.riskLevel === "high")
      .sort((a, b) => b.riskScore - a.riskScore);

    return formatRiskRoster(highRiskStudents, "Yuqori xavfdagi o'quvchilar");
  }

  const asksForLowAttendance =
    includesAny(normalizedQuestion, ["davomat"]) &&
    includesAny(normalizedQuestion, ["past", "kam", "yomon", "pas"]) &&
    includesAny(normalizedQuestion, ["oquvchi", "student", "kim", "qaysi"]);

  if (asksForLowAttendance) {
    const lowAttendance = scopedStudents
      .filter((student) => student.attendancePct > 0 && student.attendancePct < RISK_ATTENDANCE_WARN)
      .sort((a, b) => a.attendancePct - b.attendancePct);

    return formatRiskRoster(lowAttendance, "Davomati past o'quvchilar");
  }

  return null;
}

async function callAiJson<T>(
  prompt: string,
  _responseSchema: unknown,
  validator: z.ZodTypeAny,
): Promise<LlmJsonCallResult<T>> {
  if (!AI_API_KEY) {
    console.error("AI_API_KEY is missing");
    throw new Error("AI API kaliti topilmadi (.env faylini tekshiring)");
  }

  try {
    console.log("Calling AI API with model:", AI_MODEL);
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
        "X-Title": "TeachPro AI Assistant",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: "Siz TeachPro tizimining o'ta aqlli va tajribali AI assistantisiz. " +
                     "Faqat JSON formatida javob bering. Javobingizni har doim berilgan schema bo'yicha shakllantiring.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API Error Response:", errorText);
      throw new Error(`AI API xatoligi: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const rawText = result.choices[0]?.message?.content ?? "{}";
    
    // JSONni qidirib topish va tozalash
    const jsonStr = extractJsonBlock(rawText);
    const parsedData = JSON.parse(jsonStr);
    
    const parsed = validator.parse(parsedData) as T;

    return {
      parsed,
      tokensIn: result.usage?.prompt_tokens ?? 0,
      tokensOut: result.usage?.completion_tokens ?? 0,
      model: result.model || AI_MODEL,
    };
  } catch (err) {
    console.error("callAiJson error:", err);
    throw err;
  }
}

function attachComparison(
  current: AnalyzeInsightsResponse,
  previous: { id: string; response: AnalyzeInsightsResponse } | null,
): AnalyzeInsightsResponse {
  if (!previous) {
    return current;
  }

  const prevHighRisk = previous.response.riskAlerts
    .filter((item) => item.level === "high")
    .reduce((sum, item) => sum + item.affectedCount, 0);
  const currHighRisk = current.riskAlerts
    .filter((item) => item.level === "high")
    .reduce((sum, item) => sum + item.affectedCount, 0);

  const prevAttendance =
    previous.response.anomalies.find((item) => item.metric === "attendance")?.current ?? 0;
  const currAttendance =
    current.anomalies.find((item) => item.metric === "attendance")?.current ?? 0;

  const prevExam =
    previous.response.anomalies.find((item) => item.metric === "exam_score")?.current ?? 0;
  const currExam =
    current.anomalies.find((item) => item.metric === "exam_score")?.current ?? 0;

  const attendanceDeltaPct = computeDeltaPct(currAttendance, prevAttendance);
  const examDeltaPct = computeDeltaPct(currExam, prevExam);
  const highRiskDelta = currHighRisk - prevHighRisk;

  const summary =
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
      summary,
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
  const validated = modelOutputSchema.parse(response) as ModelOutput;

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

async function writeRun(
  uid: string,
  role: Role,
  request: AnalyzeInsightsRequest,
  requestFingerprint: string,
  response: AnalyzeInsightsResponse,
  tokenMap: { students: Record<string, string>; groups: Record<string, string> },
  sourceStats: AggregatedData["sourceStats"],
) {
  const now = new Date();
  const expiresAt = Timestamp.fromDate(new Date(now.getTime() + RETENTION_MS));
  const safeResponse = stripUndefinedDeep(response);

  await setDoc(doc(collection(db, "ai_analysis_runs"), response.runId), {
    createdBy: uid,
    role,
    scope: request.scope,
    entityId: request.entityId ?? null,
    subject: request.subject ?? null,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    modules: normalizeModules(request.modules),
    requestFingerprint,
    generatedAt: Timestamp.fromDate(now),
    expiresAt,
    response: safeResponse,
    summary: safeResponse.summary,
    riskHighCount: safeResponse.riskAlerts
      .filter((item) => item.level === "high")
      .reduce((sum, item) => sum + item.affectedCount, 0),
    tokenMap,
    sourceStats,
  });
}

function fallbackAskAnswer(
  question: string,
  runResponse: AnalyzeInsightsResponse,
): AskInsightsResponse {
  const lowered = question.toLowerCase();

  if (lowered.includes("xulosa") || lowered.includes("summary")) {
    return {
      answer: [
        "## Xulosa",
        runResponse.summary,
      ].join("\n"),
      citations: ["summary"],
    };
  }

  if (lowered.includes("xavf") || lowered.includes("risk")) {
    const highRiskCount = runResponse.riskAlerts
      .filter((item) => item.level === "high")
      .reduce((sum, item) => sum + item.affectedCount, 0);

    return {
      answer: [
        "## Xulosa",
        `Hozirgi run bo'yicha yuqori xavf ostida taxminan ${highRiskCount} ta o'quvchi bor.`,
        "",
        "## Tavsiyalar",
        "- Eng ustuvor chorani intervensiya bo'limidan boshlang.",
        "- Yuqori xavfdagi o'quvchilarni alohida monitoringga oling.",
      ].join("\n"),
      citations: ["riskAlerts", "interventions"],
    };
  }

  return {
    answer: [
      "## Xulosa",
      "Savolingiz bo'yicha umumiy tahlil natijasi tayyorlandi.",
      "",
      "## Tavsiyalar",
      "- Yuqori xavf signallarini birinchi navbatda yoping.",
      "- Haftalik rejadagi topshiriqlarni ketma-ket bajaring.",
    ].join("\n"),
    citations: ["summary", "weeklyPlan"],
  };
}

async function answerFromRunData(
  question: string,
  runResponse: AnalyzeInsightsResponse,
  conversation: ProjectChatMessage[] = [],
): Promise<AskInsightsResponse> {
  try {
    const prompt = buildAskPrompt(question, runResponse, conversation);
    const llm = await callAiJson<AskInsightsResponse>(
      prompt,
      askOutputResponseSchema,
      askOutputSchema,
    );
    return llm.parsed;
  } catch {
    return fallbackAskAnswer(question, runResponse);
  }
}

async function answerFromProjectData(
  question: string,
  runResponse: AnalyzeInsightsResponse,
  projectContext: ProjectChatContext,
  conversation: ProjectChatMessage[] = [],
): Promise<AskInsightsResponse> {
  const deterministicAnswer = resolveDeterministicProjectAnswer(
    question,
    projectContext,
    conversation,
  );
  if (deterministicAnswer) {
    return deterministicAnswer;
  }

  try {
    const prompt = buildProjectChatPrompt(
      question,
      runResponse,
      projectContext,
      conversation,
    );
    const llm = await callAiJson<AskInsightsResponse>(
      prompt,
      askOutputResponseSchema,
      askOutputSchema,
    );
    return llm.parsed;
  } catch {
    return fallbackAskAnswer(question, runResponse);
  }
}

export async function runClientAiAnalysis(
  uid: string,
  role: Role,
  request: AnalyzeInsightsRequest,
): Promise<AnalyzeInsightsResponse> {
  const requestFingerprint = buildRequestFingerprint(request);
  const priorRuns = await listRunsForUser(uid);

  if (!request.forceRefresh) {
    const cached = findCachedRun(priorRuns, request, requestFingerprint);
    if (cached) {
      return cached;
    }
  }

  const scopeContext = await resolveScopeContext(role, uid, request);
  
  // Aggregate data and build heuristic output first (fast path)
  const aggregated = await aggregateData(request, scopeContext);
  const heuristic = buildHeuristicOutput(aggregated);
  const tokenMap = {
    students: aggregated.studentIdToToken,
    groups: aggregated.groupIdToToken,
  };

  let responseCore: ModelOutput = heuristic;
  let providerName = "heuristic";
  let modelName = "fallback-local";
  let tokensIn = 0;
  let tokensOut = 0;

  // We skip calling LLM for initial analysis to speed up chat response
  // Chat will use the aggregated data directly
  // This is a massive optimization for "speed" request
  
  const runId = doc(collection(db, "ai_analysis_runs")).id;

  let response = toRunSafeResponse(
    responseCore,
    runId,
    "ok",
    providerName,
    modelName,
    tokensIn,
    tokensOut,
  );

  // Background write to cache (don't await)
  writeRun(
    uid,
    role,
    request,
    requestFingerprint,
    response,
    tokenMap,
    aggregated.sourceStats,
  ).catch(err => console.error("Background write failed", err));

  return response;
}

export async function askAboutStoredRun(
  uid: string,
  role: Role,
  request: AskInsightsRequest,
): Promise<AskInsightsResponse> {
  const snapshot = await getDoc(doc(db, "ai_analysis_runs", request.runId));
  if (!snapshot.exists()) {
    throw new Error("Run topilmadi");
  }

  const data = snapshot.data() as {
    createdBy?: string;
    response?: unknown;
  };

  if (role !== "admin" && data.createdBy !== uid) {
    throw new Error("Bu run uchun ruxsat yo'q");
  }

  const parsedRun = storedAnalyzeResponseSchema.safeParse(data.response);
  const fullRun = parsedRun.success
    ? (parsedRun.data as AnalyzeInsightsResponse)
    : analyzeStoredRun(data.response, request.runId);

  if (!fullRun) {
    throw new Error("Run response mavjud emas");
  }

  return answerFromRunData(request.question, fullRun);
}

export async function chatWithProjectContext(
  uid: string,
  role: Role,
  request: ProjectChatRequest,
): Promise<ProjectChatResponse> {
  const analysisRequest = getDefaultChatAnalysisRequest(Boolean(request.forceRefresh));
  
  // Parallel execution of heavy tasks
  const [run, scopeContext] = await Promise.all([
    runClientAiAnalysis(uid, role, analysisRequest),
    resolveScopeContext(role, uid, analysisRequest)
  ]);

  const projectContext = await buildProjectChatContext(analysisRequest, scopeContext);
  
  // Prune project context to send only necessary data to AI
  // We use slightly larger limits now since the user requested "full knowledge"
  const prunedContext = {
    ...projectContext,
    students: projectContext.students.slice(0, MAX_CHAT_STUDENT_CONTEXT), 
    exams: projectContext.exams.slice(0, MAX_CHAT_EXAM_CONTEXT),      
  };

  const askResponse = await answerFromProjectData(
    request.prompt,
    run,
    prunedContext,
    request.conversation ?? [],
  );

  return {
    runId: run.runId,
    answer: askResponse.answer,
    citations: askResponse.citations,
    generatedAt: new Date().toISOString(),
    sourceStatus: run.status,
    sourceSummary: run.summary,
    modelMeta: run.modelMeta,
  };
}

function analyzeStoredRun(
  value: unknown,
  runId: string,
): AnalyzeInsightsResponse | null {
  const parsedModelOutput = modelOutputSchema.safeParse(value);
  if (!parsedModelOutput.success) {
    return null;
  }

  return toRunSafeResponse(
    parsedModelOutput.data as ModelOutput,
    runId,
    "ok",
    "unknown",
    "unknown",
    0,
    0,
  );
}
