import { z } from "zod";

export const analysisScopeSchema = z.enum(["global", "group", "student", "exam"]);
export const insightModuleSchema = z.enum([
  "summary",
  "risk",
  "anomaly",
  "forecast",
  "what_if",
  "intervention",
]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const analyzeInsightsRequestSchema = z.object({
  scope: analysisScopeSchema,
  entityId: z.string().min(1).optional(),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
  modules: z.array(insightModuleSchema).min(1).default([
    "summary",
    "risk",
    "anomaly",
    "forecast",
    "what_if",
    "intervention",
  ]),
  forceRefresh: z.boolean().optional().default(false),
  locale: z.literal("uz").optional().default("uz"),
  subject: z.string().trim().max(120).optional(),
});

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

export const analyzeInsightsResponseSchema = z.object({
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

export const askInsightsRequestSchema = z.object({
  runId: z.string().min(1),
  question: z.string().trim().min(2).max(1000),
});

export const askInsightsResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(z.string()),
});

// Model output schema (without runtime metadata)
export const modelOutputSchema = analyzeInsightsResponseSchema.omit({
  runId: true,
  status: true,
  generatedAt: true,
  modelMeta: true,
  language: true,
});

// JSON schema for Gemini structured output
export type JsonSchema = Record<string, unknown>;
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

export const modelOutputResponseJsonSchema = jsonObjectSchema(
  {
    summary: jsonStringSchema,
    riskAlerts: jsonArraySchema(
      jsonObjectSchema(
        {
          id: jsonStringSchema,
          level: jsonStringSchema,
          reason: jsonStringSchema,
          confidence: jsonNumberSchema,
          affectedCount: jsonIntegerSchema,
        },
        ["id", "level", "reason", "confidence", "affectedCount"]
      )
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
        ["metric", "current", "baseline", "deltaPct", "explanation"]
      )
    ),
    forecasts: jsonArraySchema(
      jsonObjectSchema(
        {
          metric: jsonStringSchema,
          horizonDays: jsonIntegerSchema,
          points: jsonArraySchema(
            jsonObjectSchema(
              { date: jsonStringSchema, value: jsonNumberSchema },
              ["date", "value"]
            )
          ),
          confidence: jsonNumberSchema,
        },
        ["metric", "horizonDays", "points", "confidence"]
      )
    ),
    whatIf: jsonArraySchema(
      jsonObjectSchema(
        {
          scenario: jsonStringSchema,
          expectedDeltaPct: jsonNumberSchema,
          confidence: jsonNumberSchema,
          assumptions: jsonStringSchema,
        },
        ["scenario", "expectedDeltaPct", "confidence", "assumptions"]
      )
    ),
    interventions: jsonArraySchema(
      jsonObjectSchema(
        {
          title: jsonStringSchema,
          priority: jsonIntegerSchema,
          owner: jsonStringSchema,
          dueInDays: jsonIntegerSchema,
          expectedImpact: jsonStringSchema,
          steps: jsonStringSchema,
        },
        ["title", "priority", "owner", "dueInDays", "expectedImpact", "steps"]
      )
    ),
    weeklyPlan: jsonArraySchema(
      jsonObjectSchema(
        { day: jsonStringSchema, task: jsonStringSchema },
        ["day", "task"]
      )
    ),
  },
  ["summary", "riskAlerts", "anomalies", "forecasts", "whatIf", "interventions", "weeklyPlan"]
);

export const askInsightsResponseJsonSchema = jsonObjectSchema(
  {
    answer: jsonStringSchema,
    citations: jsonArraySchema(jsonStringSchema),
  },
  ["answer", "citations"]
);

export type AnalysisScope = z.infer<typeof analysisScopeSchema>;
export type InsightModule = z.infer<typeof insightModuleSchema>;
export type AnalyzeInsightsRequest = z.infer<typeof analyzeInsightsRequestSchema>;
export type AnalyzeInsightsResponse = z.infer<typeof analyzeInsightsResponseSchema>;
export type AskInsightsRequest = z.infer<typeof askInsightsRequestSchema>;
export type AskInsightsResponse = z.infer<typeof askInsightsResponseSchema>;
