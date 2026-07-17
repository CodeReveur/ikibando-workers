/**
 * ToolRegistry — the agent's single gateway to backend capabilities.
 *
 * Responsibilities:
 *  - hold the set of available tools
 *  - render a compact schema block for the system prompt
 *  - validate every call's arguments (zod) before running
 *  - enforce auth + role permissions (never unrestricted execution)
 */
import type { Role } from "../types";
import { log } from "../logger";
import type { Tool, ToolContext, ToolResult } from "./types";

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): this {
    if (this.tools.has(tool.name)) log.warn(`Tool "${tool.name}" re-registered`);
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** Tools the given role is allowed to see/use (auth-gated ones need a token). */
  available(ctx: ToolContext): Tool[] {
    return [...this.tools.values()].filter(t => {
      if (t.requiresAuth && !ctx.token) return false;
      if (t.roles && t.roles.length && !t.roles.includes(ctx.role)) return false;
      return true;
    });
  }

  /** Compact, model-readable catalogue for prompt injection. */
  describe(ctx: ToolContext): string {
    const lines = this.available(ctx).map(t => {
      const ps = t.params
        .map(p => `${p.name}:${p.type}${p.required ? "" : "?"}`)
        .join(", ");
      return `- ${t.name}(${ps}) — ${t.description}`;
    });
    return lines.join("\n");
  }

  /**
   * Validate and execute a tool call. All failure modes are captured as
   * ToolResult (ok:false) — the caller never has to try/catch.
   */
  async execute(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, summary: `Unknown tool "${name}".`, error: "unknown_tool" };

    if (tool.requiresAuth && !ctx.token) {
      return { ok: false, summary: "That needs the user to be signed in.", error: "auth_required" };
    }
    if (tool.roles && tool.roles.length && !tool.roles.includes(ctx.role as Role)) {
      return { ok: false, summary: "That action isn't available for this account type.", error: "forbidden" };
    }

    const parsed = tool.schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const msg = parsed.error.issues.map(i => `${i.path.join(".") || "arg"}: ${i.message}`).join("; ");
      return { ok: false, summary: `Invalid arguments (${msg}).`, error: "invalid_args" };
    }

    try {
      const started = Date.now();
      const result = await tool.execute(parsed.data, ctx);
      log.debug(`tool ${name} ran`, { ms: Date.now() - started, ok: result.ok });
      return result;
    } catch (e) {
      log.error(`tool ${name} threw`, { message: (e as Error)?.message });
      return { ok: false, summary: "That lookup failed. Please try again.", error: "execution_error" };
    }
  }

  get size(): number {
    return this.tools.size;
  }

  names(): string[] {
    return [...this.tools.keys()];
  }
}
