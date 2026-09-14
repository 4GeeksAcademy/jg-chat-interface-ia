import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "qwen/qwen3.8-27b"; // Most efficient: 25 tok, no thinking, 122ms

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Groq Free Tier limits: RPM=30, RPD=1k, TPM=5k, TPD=150k
// Qwen3.6 reasoning tokens count toward completion but are stripped from output
const MAX_COMPLETION_TOKENS = 400;
const MAX_HISTORY_MESSAGES = 10; // keep prompt lean for 5k TPM

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    // Only send the last N messages to keep prompt tokens within limits
    const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);

    const startTime = Date.now();

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: "Eres un asistente útil y amable. Responde en español." }, ...recentMessages],
        temperature: 0.7,
        max_tokens: MAX_COMPLETION_TOKENS,
      }),
    });

    const elapsed = Date.now() - startTime;

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const raw = choice?.message?.content ?? "";
    // Strip <think>...</think> blocks — Qwen reasoning models output thinking in tags
    let content = raw.trim();
    if (content.includes("<think>")) {
      const afterThink = content.split("</think>").pop() ?? "";
      // If no closing tag exists, response was truncated mid-thinking → empty
      content = content.includes("</think>") ? afterThink.trim() : "";
    }

    return NextResponse.json({
      content,
      usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: data.model ?? MODEL,
      responseTime: elapsed,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
