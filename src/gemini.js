// Minimal Gemini REST client (no SDK) with SSE streaming.
// The API key is sent only to Google's Generative Language API via header.

export const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function toError(res) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message || '';
  } catch {
    /* ignore */
  }
  const byStatus = {
    400: 'The request was rejected — your API key may be invalid.',
    401: 'Your API key was rejected.',
    403: 'This API key does not have access to the Gemini API.',
    404: `Model "${MODEL}" was not found for this API key.`,
    429: 'Rate limit or quota exceeded. Wait a moment and try again.',
  };
  const base = byStatus[res.status] || `Gemini API error (${res.status}).`;
  return new GeminiError(detail ? `${base} ${detail}` : base, res.status);
}

/** Lightweight check that a key works and the configured model is reachable. */
export async function verifyApiKey(apiKey) {
  const res = await fetch(`${BASE}/models/${encodeURIComponent(MODEL)}`, {
    headers: { 'x-goog-api-key': apiKey },
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

/**
 * Stream a chat completion.
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.system  system instruction
 * @param {{role:'user'|'model', text:string}[]} opts.history  full conversation incl. latest user turn
 * @param {(chunk:string)=>void} opts.onToken
 * @param {AbortSignal} [opts.signal]
 */
export async function streamChat({ apiKey, system, history, onToken, signal }) {
  const res = await fetch(`${BASE}/models/${encodeURIComponent(MODEL)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });
  if (!res.ok) throw await toError(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      if (json.error) throw new GeminiError(json.error.message || 'Stream error', json.error.code);
      const cand = json.candidates?.[0];
      const parts = cand?.content?.parts || [];
      for (const p of parts) {
        if (p.thought || typeof p.text !== 'string') continue; // skip thinking summaries
        full += p.text;
        onToken(p.text);
      }
      if (cand?.finishReason === 'SAFETY' && !full) {
        throw new GeminiError('The response was blocked by safety filters. Try rephrasing.');
      }
    }
  }
  return full;
}

export function buildSystemPrompt(role) {
  return `You are "Interview Coach", an expert interview-preparation assistant. The user is preparing to interview for the role below. Every answer must be contextualized to THIS role, its interview loop, and what hiring teams for it evaluate.

${role.context}

How to behave:
- Tailor every answer to the ${role.title} role. If the user asks something generic, connect it back to how it matters in a ${role.title} interview.
- If asked about a different role, briefly answer but note they are currently preparing for ${role.title} and suggest switching roles via the search bar for a fully tailored experience.
- Mock interviews: when the user asks for one, act as the interviewer. Ask ONE question at a time, wait for their answer, then give concise feedback (strengths, gaps, a stronger sample answer outline, and a 1–5 score against the role's bar) before asking the next question.
- Be concrete: frameworks, example answers, sample questions, checklists and pitfalls. Prefer specifics over platitudes.
- Use concise Markdown (short headings, bullet lists, code blocks for code). Keep responses focused; avoid walls of text.
- Be honest and encouraging. Never invent facts about specific companies' internal processes; describe common industry practice instead.
- Stay on topic (career / interview preparation for AI roles). Politely decline unrelated requests.`;
}
