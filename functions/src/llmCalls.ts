import {
  AnalyzeInsightsRequest,
  AnalyzeInsightsResponse,
  AskInsightsRequest,
  AskInsightsResponse,
  analyzeInsightsResponseSchema,
  askInsightsResponseSchema,
  modelOutputSchema,
  modelOutputResponseJsonSchema,
  askInsightsResponseJsonSchema,
  JsonSchema,
} from "./contracts";

type SupportedAiProvider = "openai" | "gemini";

interface OpenAIResponsesPayload {
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
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  error?: {
    message?: string;
  };
}

interface GeminiGenerateContentPayload {
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
}

interface LlmJsonCallResult<T> {
  parsed: T;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: SupportedAiProvider;
}

function normalizeAiProviderName(provider: string): SupportedAiProvider {
  const p = provider.toLowerCase();
  if (p === "gemini" || p === "google") return "gemini";
  return "openai";
}

function getSelectedProvider(): SupportedAiProvider {
  const provider = process.env.AI_PROVIDER;
  if (!provider) {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "gemini" : "openai";
  }
  return normalizeAiProviderName(provider);
}

function getDefaultModelForProvider(provider: SupportedAiProvider): string {
  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
  }
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function resolveModelName(provider: SupportedAiProvider, fallbackModel: string): string {
  if (process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }
  if (provider === "gemini") {
    return process.env.GEMINI_MODEL || fallbackModel;
  }
  return process.env.OPENAI_MODEL || fallbackModel;
}

function extractJsonBlock(text: string): string {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) return jsonMatch[1].trim();

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0].trim();

  return text.trim();
}

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

export async function callOpenAIJson<T>(
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

export async function callGeminiJson<T>(
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

export async function callJsonModel<T>(
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

export {
  getSelectedProvider,
  getDefaultModelForProvider,
  resolveModelName,
};
