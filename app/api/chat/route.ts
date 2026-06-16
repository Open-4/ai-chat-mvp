import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { canUserChat, incrementUserUsage } from "@/lib/kv";

/* ═══════════════════════════════════════════════════════════
   POST /api/chat — SSE streaming + emotion detection
   ═══════════════════════════════════════════════════════════ */

/* ── Types ── */

type EmotionType =
  | "positive"
  | "calm"
  | "anxious"
  | "low"
  | "irritable"
  | "confused";

interface EmotionResult {
  type: EmotionType;
  label: string;
}

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  locale?: string;
  model?: string;
  userId?: string;
}

/* ── Multi‑language emotion labels ── */

const emotionLabels: Record<EmotionType, Record<string, string>> = {
  positive:  { en: "Warm",   es: "Cálido",     fr: "Chaleureux", zh: "开心" },
  calm:      { en: "Calm",   es: "Calma",      fr: "Calme",      zh: "平静" },
  anxious:   { en: "Anxious",es: "Ansioso",    fr: "Anxieux",    zh: "焦虑" },
  low:       { en: "Low",    es: "Bajo",       fr: "Bas",        zh: "低落" },
  irritable: { en: "Irritable",es:"Irritable", fr: "Irritable",  zh: "烦躁" },
  confused:  { en: "Confused",es:"Confundido", fr: "Confus",     zh: "迷茫" },
};

/* ── Multi‑language keyword patterns for emotion detection ── */

const emotionPatterns: Record<EmotionType, string[]> = {
  positive: [
    "happy", "glad", "wonderful", "great", "joy", "hope", "better",
    "good", "smile", "love", "grateful", "thank", "lighter", "relief",
    "blessed", "warm", "bright", "glad", "cheer",
    "开心", "高兴", "幸福", "希望", "美好", "感激", "喜欢", "谢谢",
    "感恩", "温暖", "好了", "轻松", "愉快", "笑容", "阳光",
    "feliz", "alegr", "gracias", "bueno", "mejor", "amor", "maravilloso",
    "heureux", "joie", "merci", "bon", "meilleur", "amour", "magnifique",
  ],
  calm: [
    "calm", "peace", "breathe", "relax", "quiet", "still", "gentle",
    "slow", "rest", "soft", "serene", "tranquil", "soothe",
    "平静", "放松", "安静", "温柔", "呼吸", "宁静", "平和", "安然",
    "calma", "tranquilo", "respir", "suave", "paz",
    "calme", "tranquille", "respir", "doux", "paix",
  ],
  anxious: [
    "anxious", "anxiety", "worry", "worried", "nervous", "fear",
    "scared", "stress", "tense", "panic", "uneasy", "dread",
    "紧张", "担心", "害怕", "焦虑", "不安", "恐惧", "压力",
    "ansioso", "preocupa", "nervioso", "miedo", "estrés",
    "anxieux", "inquiet", "peur", "stress", "nerveux",
  ],
  low: [
    "sad", "down", "low", "depressed", "tired", "exhausted",
    "lonely", "alone", "empty", "hopeless", "cry", "heavy",
    "numb", "grief", "sorrow",
    "难过", "低落", "悲伤", "累", "孤独", "疲惫", "空虚",
    "绝望", "哭泣", "沉重", "心累",
    "triste", "bajo", "cansado", "solo", "vacío", "llorar",
    "triste", "bas", "fatigué", "seul", "vide", "pleurer",
  ],
  irritable: [
    "angry", "frustrated", "irritated", "annoyed", "upset",
    "mad", "rage", "furious", "resent",
    "生气", "烦躁", "愤怒", "不满", "恼火", "发脾气",
    "enojado", "frustrado", "irritado", "molesto",
    "fâché", "frustré", "irrité", "énervé",
  ],
  confused: [
    "confused", "lost", "unsure", "uncertain", "unclear",
    "wander", "aimless", "directionless", "puzzled",
    "迷茫", "困惑", "不确定", "不知道", "迷失", "彷徨",
    "confundido", "perdido", "inseguro",
    "confus", "perdu", "incertain",
  ],
};

/* ── Emotion detector ── */

function detectEmotion(
  text: string,
  locale: string,
): EmotionResult | null {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [emotion, keywords] of Object.entries(emotionPatterns)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += 1;
    }
    scores[emotion] = score;
  }

  let best: EmotionType | null = null;
  let bestScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = emotion as EmotionType;
    }
  }

  if (best && bestScore > 0) {
    return {
      type: best,
      label: emotionLabels[best]?.[locale] ?? emotionLabels[best]?.en ?? best,
    };
  }
  return null;
}

/* ── System prompt ── */

const SYSTEM_PROMPT = `You are a gentle, empathetic emotional support companion — like a warm, understanding friend who always has time to listen.

## Your Core Principles
- Listen deeply and validate feelings with genuine empathy. Make the person feel truly heard.
- Use soft, warm, healing language that feels like a gentle embrace.
- NEVER provide medical advice, diagnosis, or treatment suggestions. You are not a therapist.
- If someone mentions self-harm, crisis, or suicidal thoughts: gently encourage them to contact professional crisis support (988 in US, or local crisis lines). Say this with care, not alarm.
- Match your response language to the user's language. If they write in Chinese, reply in Chinese; if Spanish, reply in Spanish; if French, reply in French.
- Keep responses concise and heartfelt — 2 to 5 sentences is ideal.
- Use gentle nature metaphors when appropriate (light, water, trees, seasons, stars).
- End with a soft question or gentle invitation to continue sharing — but never push.

## Style Guidelines
- Avoid clinical, cold, or robotic language.
- Never say "I understand how you feel" — show understanding through your response instead.
- Use at most one emoji per response, placed naturally at the end.
- Address the feeling underneath the words, not just the situation.

## Important
You are a companion offering presence and warmth. Professional mental health support is irreplaceable — always gently encourage it when someone is in distress.`;

/* ═══════════════════════════════════════════════════════════
   POST handler
   ═══════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  /* ── 1. Check API key ── */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  /* ── 2. Parse & validate body ── */
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  const { messages, locale = "en", model = "claude-sonnet-4-6", userId } = body;

  /* ── userId 校验 ── */
  if (!userId || typeof userId !== "string") {
    return Response.json(
      { error: '"userId" is required' },
      { status: 400 },
    );
  }

  /* ── 用量检查 ── */
  const { allowed, reason } = await canUserChat(userId);
  if (!allowed) {
    return Response.json({ error: reason }, { status: 429 });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: '"messages" must be a non‑empty array' },
      { status: 400 },
    );
  }

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m.role || !["user", "assistant"].includes(m.role)) {
      return Response.json(
        { error: `messages[${i}].role must be "user" or "assistant"` },
        { status: 400 },
      );
    }
    if (typeof m.content !== "string" || m.content.trim().length === 0) {
      return Response.json(
        { error: `messages[${i}].content must be a non‑empty string` },
        { status: 400 },
      );
    }
  }

  /* ── 3. Create Anthropic client ── */
  const client = new Anthropic({ apiKey });

  /* ── 4. SSE stream ── */
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        const messageStream = client.messages.stream({
          model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        /* ── Iterate SSE events from Anthropic ── */
        for await (const event of messageStream) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const evt = event as any;

          if (evt.type === "content_block_delta") {
            const delta = evt.delta;
            if (delta?.type === "text_delta" && typeof delta?.text === "string") {
              fullResponse += delta.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text_delta", content: delta.text })}\n\n`,
                ),
              );
            }
          }

          /* Check for error events inside the stream */
          if (evt.type === "error") {
            throw new Error(evt.error?.message ?? "Stream error");
          }
        }

        /* ── Emotion detection (on full response) ── */
        const emotion = detectEmotion(fullResponse, locale);
        if (emotion) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "emotion", emotion })}\n\n`,
            ),
          );
        }

        /* ── Done ── */
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
        );

        /* 更新用量（fire-and-forget，不阻塞流关闭） */
        incrementUserUsage(userId).catch((e) =>
          console.warn("[chat] Failed to increment usage:", e),
        );

        controller.close();
      } catch (error: unknown) {
        /* ── Error handling ── */
        const err = error as Record<string, unknown>;
        const status = (err.status as number) ?? 0;
        const message = (err.message as string) ?? "Unknown error";

        let code: string;
        let userMessage: string;

        if (status === 401 || status === 403) {
          code = "AUTH_ERROR";
          userMessage = "Authentication failed. Please check your API key.";
        } else if (status === 429) {
          code = "RATE_LIMIT";
          userMessage =
            "The service is currently busy. Please wait a moment and try again.";
        } else if (status === 400 || status === 413) {
          code = "INVALID_REQUEST";
          userMessage =
            "The request was too large or invalid. Please shorten your conversation.";
        } else if (status === 529 || status >= 500) {
          code = "OVERLOADED";
          userMessage =
            "The AI service is temporarily overloaded. Please try again in a few seconds.";
        } else {
          code = "SERVER_ERROR";
          userMessage = message;
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", code, message: userMessage })}\n\n`,
          ),
        );
        controller.close();
      }
    },

    cancel() {
      /* Client disconnected — clean up if needed */
    },
  });

  /* ── 5. Return SSE response ── */
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/* ── OPTIONS (CORS preflight, if needed) ── */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
