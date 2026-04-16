import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const riskAlertSchema = z.object({
  id: z.string(),
  level: z.enum(["high", "medium", "low"]),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  affectedCount: z.number().int().min(0),
});

export const anomalySchema = z.object({
  metric: z.string(),
  current: z.number(),
  baseline: z.number(),
  deltaPct: z.number(),
  explanation: z.string(),
});

export const forecastPointSchema = z.object({
  date: isoDateSchema,
  value: z.number(),
});

export const forecastSchema = z.object({
  metric: z.enum(["attendance", "exam_score", "discipline"]),
  horizonDays: z.number().int().min(1),
  points: z.array(forecastPointSchema),
  confidence: z.number().min(0).max(1),
});

export const whatIfSchema = z.object({
  scenario: z.string(),
  expectedDeltaPct: z.number(),
  confidence: z.number().min(0).max(1),
  assumptions: z.string(),
});

export const interventionSchema = z.object({
  title: z.string(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  owner: z.enum(["teacher", "admin"]),
  dueInDays: z.number().int().min(1),
  expectedImpact: z.string(),
  steps: z.string(),
});

export const weeklyPlanItemSchema = z.object({
  day: z.string(),
  task: z.string(),
});

export const modelMetaSchema = z.object({
  provider: z.string(),
  model: z.string(),
  tokensIn: z.number().int().min(0),
  tokensOut: z.number().int().min(0),
});

export const comparisonSchema = z
  .object({
    previousRunId: z.string().optional(),
    attendanceDeltaPct: z.number().optional(),
    examDeltaPct: z.number().optional(),
    highRiskDelta: z.number().optional(),
    summary: z.string().optional(),
  })
  .optional();

export const modelOutputSchema = z.object({
  summary: z.string(),
  riskAlerts: z.array(riskAlertSchema),
  anomalies: z.array(anomalySchema),
  forecasts: z.array(forecastSchema),
  whatIf: z.array(whatIfSchema),
  interventions: z.array(interventionSchema),
  weeklyPlan: z.array(weeklyPlanItemSchema),
  comparison: comparisonSchema,
});

export const askOutputSchema = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
});

export const storedAnalyzeResponseSchema = z.object({
  runId: z.string(),
  status: z.enum(["ok", "cached"]),
  generatedAt: z.string(),
  language: z.literal("uz"),
  summary: z.string(),
  riskAlerts: z.array(riskAlertSchema),
  anomalies: z.array(anomalySchema),
  forecasts: z.array(forecastSchema),
  whatIf: z.array(whatIfSchema),
  interventions: z.array(interventionSchema),
  weeklyPlan: z.array(weeklyPlanItemSchema),
  modelMeta: modelMetaSchema,
  comparison: comparisonSchema,
});

