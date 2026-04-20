import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, model = 'google/gemini-2.5-flash' } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://teachpro.vercel.app',
        'X-Title': 'TeachPro CRM',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Siz TeachPro CRM uchun qisqa, tushunarli javob beruvchi AI assistantsiz. Emoji va jadval formatida bering. O\'zbek tilida.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return res.status(response.status).json({ error: 'AI API error' });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'Javob topilmadi';

    return res.status(200).json({ answer });
  } catch (error) {
    console.error('AI proxy error:', error);
    return res.status(500).json({ error: 'AI request failed' });
  }
}
