/**
 * POST /api/bazabot/chat
 *
 * The agent endpoint. Runs one turn through the BazaBot agent (AI mode with tool
 * calling, or the rule-engine fallback) and streams the result back as
 * Server-Sent Events so the UI can render a live typing effect:
 *
 *   event: status   → { text }        // "Searching…", shown while tools run
 *   event: delta    → { text }        // incremental reply text
 *   event: done     → { AgentResult meta minus the reply body }
 *   event: error    → { message }
 *
 * Auth: the client passes the user's access token in the body; it is used only
 * to authorise backend tool calls and is never logged or persisted.
 */
import { runAgent, type AgentRequest } from "@/lib/bazabot";
import type { ChatMessage, Lang, Role } from "@/lib/bazabot/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  message?: string;
  token?: string;
  role?: Role;
  userName?: string;
  sessionId?: string;
  page?: string;
  language?: Lang;
  userId?: string;
  history?: ChatMessage[];
}

const enc = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message ?? "").toString();
  if (!message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const req: AgentRequest = {
    message,
    history: Array.isArray(body.history) ? body.history.slice(-12) : undefined,
    context: {
      token: body.token,
      role: (["owner", "seeker", "public"].includes(body.role as string) ? body.role : "public") as Role,
      userName: body.userName,
      sessionId: body.sessionId || "anon",
      page: body.page,
      language: (["en", "fr", "sw", "kinyy"].includes(body.language as string) ? body.language : "en") as Lang,
      userId: body.userId,
    },
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = () => { try { controller.close(); } catch { /* already closed */ } };
      try {
        controller.enqueue(sse("status", { text: "Thinking…" }));

        const result = await runAgent(req);

        // Stream the reply in small chunks for a live typing feel. (True
        // token-level streaming from the model is a future enhancement — the
        // multi-step tool loop resolves the full reply first.)
        const words = result.reply.split(/(\s+)/);
        let buffer = "";
        for (const w of words) {
          buffer += w;
          if (buffer.length >= 12) {
            controller.enqueue(sse("delta", { text: buffer }));
            buffer = "";
            // Small yield so chunks flush progressively.
            await new Promise(r => setTimeout(r, 15));
          }
        }
        if (buffer) controller.enqueue(sse("delta", { text: buffer }));

        controller.enqueue(sse("done", {
          source: result.source,
          intent: result.intent,
          lang: result.lang,
          actions: result.actions,
          suggestions: result.suggestions,
          escalate: result.escalate,
          latencyMs: result.latencyMs,
        }));
      } catch (e) {
        controller.enqueue(sse("error", { message: "Something went wrong. Please try again." }));
        // Server-side visibility without leaking to the client.
        console.error("[bazabot:route] chat failed", (e as Error)?.message);
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
