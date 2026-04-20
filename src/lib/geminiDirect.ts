/**
 * Vercel backend proxy orqali OpenRouter API call
 * API kalit Vercel'da saqlanadi (xavfsiz)
 */

const VERCEL_API_URL = "https://teachpro.vercel.app/api/ai";

export async function callGeminiDirect(prompt: string): Promise<string> {
  try {
    const response = await fetch(VERCEL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.answer || "Javob topilmadi";
  } catch (error) {
    console.error("AI proxy call error:", error);
    throw error;
  }
}
