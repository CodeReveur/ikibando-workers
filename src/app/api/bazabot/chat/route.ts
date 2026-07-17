/**
 * POST /api/bazabot/chat
 *
 * The agent endpoint. Runs one turn through the BazaBot agent (AI mode with tool
 * calling + true token streaming, or the rule-engine fallback) and forwards the
 * result as Server-Sent Events:
 *
 *   event: status   → { text }          // "Searching jobs…", live thinking state
 *   event: action   → { explanation }   // a tool the agent ran (user-safe)
 *   event: delta    → { text }          // incremental answer tokens
 *   event: done     → { AgentMeta }     // source, intent, suggestions, escalate…
 *   event: error    → { message }
 *
 * Auth: the client passes the user's access token in the body; it is used only
 * to authorise backend tool calls and is never logged or persisted.
 */
import { runAgentStream, type AgentRequest } from "@/lib/bazabot";
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
function frame(event: string, data: unknown): Uint8Array {
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
      const emit = (event: string, data: unknown) => {
        try { controller.enqueue(frame(event, data)); } catch { /* client gone */ }
      };
      try {
        const meta = await runAgentStream(req, emit);
        emit("done", meta);
      } catch (e) {
        emit("error", { message: "Something went wrong. Please try again." });
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
