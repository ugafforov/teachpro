export type AnalysisScope = "global" | "group" | "student" | "exam";
export type InsightModule = "summary" | "risk" | "anomaly" | "forecast" | "what_if" | "intervention";

export interface AnalyzeInsightsRequest {
  scope: AnalysisScope;
  entityId?: string;
  dateFrom: string;
  dateTo: string;
  modules: InsightModule[];
  forceRefresh?: boolean;
  locale?: "uz";
  subject?: string;
}

export interface RiskAlert {
  id: string;
  level: "high" | "medium" | "low";
  reason: string;
  confidence: number;
  affectedCount: number;
}

export interface Anomaly {
  metric: string;
  current: number;
  baseline: number;
  deltaPct: number;
  explanation: string;
}

export interface ForecastPoint {
  date: string;
  value: number;
}

export interface Forecast {
  metric: "attendance" | "exam_score" | "discipline";
  horizonDays: number;
  points: ForecastPoint[];
  confidence: number;
}

export interface WhatIfScenario {
  scenario: string;
  expectedDeltaPct: number;
  confidence: number;
  assumptions: string;
}

export interface Intervention {
  title: string;
  priority: 1 | 2 | 3;
  owner: "teacher" | "admin";
  dueInDays: number;
  expectedImpact: string;
  steps: string;
}

export interface WeeklyPlanItem {
  day: string;
  task: string;
}

export interface ModelMeta {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AnalysisComparison {
  previousRunId?: string;
  attendanceDeltaPct?: number;
  examDeltaPct?: number;
  highRiskDelta?: number;
  summary?: string;
}

export interface AnalyzeInsightsResponse {
  runId: string;
  status: "ok" | "cached";
  generatedAt: string;
  language: "uz";
  summary: string;
  riskAlerts: RiskAlert[];
  anomalies: Anomaly[];
  forecasts: Forecast[];
  whatIf: WhatIfScenario[];
  interventions: Intervention[];
  weeklyPlan: WeeklyPlanItem[];
  modelMeta: ModelMeta;
  comparison?: AnalysisComparison;
}

export interface AskInsightsRequest {
  runId: string;
  question: string;
}

export interface AskInsightsResponse {
  answer: string;
  citations: string[];
}

export interface ProjectChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProjectChatRequest {
  prompt: string;
  conversation?: ProjectChatMessage[];
  forceRefresh?: boolean;
}

export interface ProjectChatResponse {
  runId: string;
  answer: string;
  citations: string[];
  generatedAt: string;
  sourceStatus: AnalyzeInsightsResponse["status"];
  sourceSummary: string;
  modelMeta: ModelMeta;
}

export interface AnalysisHistoryItem {
  id: string;
  generatedAt: string;
  scope: AnalysisScope;
  entityId?: string;
  summary: string;
  response: AnalyzeInsightsResponse;
}
