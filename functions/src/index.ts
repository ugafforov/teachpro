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
import { runGCPBackup } from "./backupEngine";
import { sendWeeklyReport } from "./reportEngine";

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

// OpenRouter AI Proxy - Frontend'dan kelgan so'rovni OpenRouter API ga yuborish
export const aiOpenRouterProxy = onCall(
  {
    region,
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Avval tizimga kiring");
    }

    const { prompt, model = "google/gemini-2.5-flash" } = request.data;
    
    if (!prompt || typeof prompt !== "string") {
      throw new HttpsError("invalid-argument", "Prompt kiritilishi kerak");
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      logger.error("OPENROUTER_API_KEY is not set");
      throw new HttpsError("internal", "API kalit sozlanmagan");
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://teachpro.uz",
          "X-Title": "TeachPro CRM",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "Siz TeachPro CRM uchun qisqa, tushunarli javob beruvchi AI assistantsiz. Emoji va jadval formatida bering. O'zbek tilida.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("OpenRouter API error:", errorText);
        throw new HttpsError("internal", "AI API xatolik: " + response.status);
      }

      const data: any = await response.json();
      const answer = data.choices?.[0]?.message?.content || "Javob topilmadi";
      
      return { answer };
    } catch (error) {
      logger.error("aiOpenRouterProxy failed", error);
      throw new HttpsError("internal", "AI so'rovida xatolik yuz berdi");
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

export const automatedGCPBackup = onSchedule(
  {
    region,
    schedule: "every day 03:00",
    timeZone: "Asia/Tashkent",
    memory: "256MiB",
  },
  async () => {
    await runGCPBackup();
  }
);

export const weeklyReportJob = onSchedule(
  {
    region,
    schedule: "every sunday 09:00",
    timeZone: "Asia/Tashkent",
    memory: "256MiB",
  },
  async () => {
    await sendWeeklyReport();
  }
);
