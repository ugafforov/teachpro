import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  analyzeInsightsRequestSchema,
  askInsightsRequestSchema,
} from "./contracts";
import {
  askAboutRun,
  cleanupExpiredAnalysis,
  runAiAnalysis,
} from "./analysisEngine";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const region = process.env.FUNCTION_REGION || "us-central1";

export const aiAnalyzeInsights = onCall(
  {
    region,
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Avval tizimga kiring");
    }

    const parsed = analyzeInsightsRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        parsed.error.issues[0]?.message ?? "Noto'g'ri so'rov",
      );
    }

    try {
      const response = await runAiAnalysis(db, request.auth.uid, parsed.data);
      return response;
    } catch (error) {
      logger.error("aiAnalyzeInsights failed", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "AI tahlilda ichki xatolik yuz berdi");
    }
  },
);

export const aiAskAboutInsights = onCall(
  {
    region,
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Avval tizimga kiring");
    }

    const parsed = askInsightsRequestSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        parsed.error.issues[0]?.message ?? "Noto'g'ri so'rov",
      );
    }

    try {
      const response = await askAboutRun(db, request.auth.uid, parsed.data);
      return response;
    } catch (error) {
      logger.error("aiAskAboutInsights failed", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "AI savol-javobda ichki xatolik yuz berdi");
    }
  },
);

export const aiCleanupExpired = onSchedule(
  {
    region,
    schedule: "every day 03:00",
    timeZone: "Asia/Tashkent",
    memory: "256MiB",
  },
  async () => {
    try {
      const result = await cleanupExpiredAnalysis(db);
      logger.info("AI cleanup completed", result);
    } catch (error) {
      logger.error("AI cleanup failed", error);
    }
  },
);
