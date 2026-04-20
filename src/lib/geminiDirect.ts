/**
 * AI API call - dev da to'g'ridan-to'g'ri OpenRouter, prod da Vercel proxy
 */

const isDev = import.meta.env.DEV;
const VERCEL_API_URL = "/api/ai";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || "google/gemini-2.5-flash";

export async function callGeminiDirect(prompt: string): Promise<string> {
  // Dev muhitida to'g'ridan-to'g'ri OpenRouter API ga murojaat
  if (isDev && OPENROUTER_KEY) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "HTTP-Referer": "https://teachpro.vercel.app",
        "X-Title": "TeachPro CRM",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: "Siz TeachPro CRM uchun qisqa, tushunarli javob beruvchi AI assistantsiz. Emoji va jadval formatida bering. O'zbek tilida.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Javob topilmadi";
  }

  // Production da Vercel proxy orqali
  const response = await fetch(VERCEL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.answer || "Javob topilmadi";
}
