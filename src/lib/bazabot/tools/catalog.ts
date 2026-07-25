/**
 * Concrete tool catalogue. Each tool is a thin, validated wrapper over the
 * existing web API layer (`@/lib/api`) or another platform source, so BazaBot
 * orchestrates the real backend instead of inventing answers.
 *
 * Summaries are deliberately compact and free of internal identifiers - they are
 * what the model reasons over and must never leak API names or raw JSON to users.
 */
import { z } from "zod";
import * as api from "@/lib/api";
import type { Tool, ToolContext, ToolResult } from "./types";
import type { ResultCard } from "../types";

/** Injected dependencies so tools stay decoupled from heavy modules. */
export interface CatalogDeps {
  /** Semantic/keyword knowledge search, wired by the agent. */
  searchKnowledge?: (query: string, limit?: number) => Promise<Array<{ title: string; text: string; score: number }>>;
}

const ok = (summary: string, data?: unknown, cards?: ResultCard[]): ToolResult => ({ ok: true, summary, data, cards });
const fail = (summary: string, error = "error"): ToolResult => ({ ok: false, summary, error });

/** Format an RWF amount compactly, e.g. 18000 → "18,000 RWF". */
function rwf(v: unknown): string | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return `${n.toLocaleString("en-US")} RWF`;
}

/** Defensive field read for loosely-typed DTOs. */
function field(obj: unknown, ...keys: string[]): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = (obj as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return undefined;
}

export function buildCatalog(deps: CatalogDeps = {}): Tool[] {
  const tools: Tool[] = [
    // ── Search: jobs ─────────────────────────────────────────────────────────
    {
      name: "searchJobs",
      description: "Find open jobs in the marketplace. Filter by category, district or urgency.",
      params: [
        { name: "category", type: "string", required: false, description: "e.g. Cleaning, Security, Events" },
        { name: "district", type: "string", required: false, description: "Rwandan district, e.g. Kigali, Gasabo" },
        { name: "urgency", type: "string", required: false, description: "e.g. urgent" },
      ],
      schema: z.object({
        category: z.string().trim().max(60).optional(),
        district: z.string().trim().max(60).optional(),
        urgency: z.string().trim().max(30).optional(),
      }),
      requiresAuth: false,
      explain: "I searched available jobs",
      async execute(a): Promise<ToolResult> {
        const page = await api.getJobs({ category: a.category, district: a.district, urgency: a.urgency, size: 6 });
        const items = page?.content ?? [];
        if (!items.length) return ok("No open jobs matched those filters.", [], []);
        const cards: ResultCard[] = items.map(j => {
          const id = field(j, "id") ?? "";
          const title = field(j, "title", "category") ?? "Job";
          const cat = field(j, "category", "categoryName");
          const district = field(j, "district");
          return {
            kind: "job" as const, id, title,
            subtitle: [cat, district].filter(Boolean).join(" · ") || undefined,
            meta: rwf(field(j, "workerPayout", "totalAmount", "ratePerHour")),
            url: `/jobs/${id}`, cta: "View job",
          };
        }).filter(c => c.id);
        return ok(
          `Found ${page.totalElements ?? items.length} matching job(s): ` +
            cards.map(c => `${c.title}${c.subtitle ? ` (${c.subtitle})` : ""}`).join("; "),
          cards, cards,
        );
      },
    },

    // ── Search: workers ──────────────────────────────────────────────────────
    {
      name: "searchWorkers",
      description: "Find available verified workers, optionally filtered by service category.",
      params: [{ name: "category", type: "string", required: false, description: "Service category, e.g. Cleaning" }],
      schema: z.object({ category: z.string().trim().max(60).optional() }),
      requiresAuth: false,
      explain: "I searched available workers",
      async execute(a): Promise<ToolResult> {
        const page = await api.getWorkers({ category: a.category, size: 6 });
        const items = page?.content ?? [];
        if (!items.length) return ok("No workers matched that category.", [], []);
        const cards: ResultCard[] = items.map(w => {
          const id = field(w, "id") ?? "";
          const name = field(w, "name") ?? "Worker";
          const cat = field(w, "categoryName", "category", "experienceType");
          const loc = field(w, "district", "locationShort");
          const rating = field(w, "rating");
          return {
            kind: "worker" as const, id, title: name,
            subtitle: [cat, loc].filter(Boolean).join(" · ") || undefined,
            meta: rating ? `${rating}★` : (field(w, "completedJobs") ? `${field(w, "completedJobs")} jobs` : undefined),
            url: `/browse/${id}`, cta: "View profile",
          };
        }).filter(c => c.id);
        return ok(
          `Found ${page.totalElements ?? items.length} worker(s): ` +
            cards.map(c => `${c.title}${c.meta ? ` (${c.meta})` : ""}`).join("; "),
          cards, cards,
        );
      },
    },

    // ── Search: employers (derived from open jobs) ───────────────────────────
    {
      name: "searchEmployers",
      description: "Find active employers who are currently hiring, optionally by category or district.",
      params: [
        { name: "category", type: "string", required: false, description: "Service category" },
        { name: "district", type: "string", required: false, description: "Rwandan district" },
      ],
      schema: z.object({
        category: z.string().trim().max(60).optional(),
        district: z.string().trim().max(60).optional(),
      }),
      requiresAuth: false,
      explain: "I looked up active employers",
      async execute(a): Promise<ToolResult> {
        // The platform doesn't expose a public employer directory, so surface
        // the employers behind currently-open jobs - the ones actually hiring.
        const page = await api.getJobs({ category: a.category, district: a.district, size: 15 });
        const items = page?.content ?? [];
        const seen = new Map<string, { name: string; rating?: string; jobs: number }>();
        for (const j of items) {
          const name = field(j, "employerName");
          if (!name) continue;
          const prev = seen.get(name);
          seen.set(name, {
            name,
            rating: field(j, "employerRatingAvg") ?? prev?.rating,
            jobs: (prev?.jobs ?? 0) + 1,
          });
        }
        const employers = [...seen.values()].sort((x, y) => y.jobs - x.jobs).slice(0, 6);
        if (!employers.length) return ok("No employers are actively hiring for those filters right now.", []);
        return ok(`Employers currently hiring: ` +
          employers.map(e => `${e.name}${e.rating ? ` (${e.rating}★)` : ""}`).join("; "), employers);
      },
    },

    // ── Search: service categories ───────────────────────────────────────────
    {
      name: "searchCategories",
      description: "List the service categories the platform supports (cleaning, security, events, …).",
      params: [{ name: "query", type: "string", required: false, description: "Optional filter text" }],
      schema: z.object({ query: z.string().trim().max(60).optional() }),
      requiresAuth: false,
      explain: "I checked the service categories",
      async execute(a): Promise<ToolResult> {
        const cats = await api.getJobCategories();
        const names = (cats ?? []).map(c => field(c, "label", "name", "title") ?? "").filter(Boolean);
        const filtered = a.query ? names.filter(n => n.toLowerCase().includes(a.query!.toLowerCase())) : names;
        if (!filtered.length) return ok("No matching categories.", []);
        return ok(`Categories: ${filtered.slice(0, 20).join(", ")}.`, filtered);
      },
    },

    // ── Locations (from the bundled `rwanda` dataset) ────────────────────────
    {
      name: "searchLocations",
      description: "List Rwandan provinces and districts the platform operates in.",
      params: [{ name: "query", type: "string", required: false, description: "Filter by name" }],
      schema: z.object({ query: z.string().trim().max(60).optional() }),
      requiresAuth: false,
      explain: "I looked up service locations",
      async execute(a): Promise<ToolResult> {
        // `rwanda` is already a project dependency.
        const rw = await import("rwanda");
        const provinces: string[] = (rw as any).Provinces?.() ?? [];
        const districts: string[] = (rw as any).Districts?.() ?? [];
        const all = [...provinces, ...districts];
        const filtered = a.query ? all.filter(n => n.toLowerCase().includes(a.query!.toLowerCase())) : all;
        return ok(`Locations: ${filtered.slice(0, 25).join(", ")}.`, { provinces, districtsSample: districts.slice(0, 30) });
      },
    },

    // ── Wallet ───────────────────────────────────────────────────────────────
    {
      name: "getWallet",
      description: "Get the signed-in user's wallet balance and escrow holdings.",
      params: [],
      schema: z.object({}),
      requiresAuth: true,
      explain: "I checked your wallet",
      async execute(_a, ctx: ToolContext): Promise<ToolResult> {
        const w = await api.getWallet(ctx.token!);
        const bal = field(w, "balance", "available", "balanceRwf");
        const escrow = field(w, "escrow", "held", "escrowRwf");
        return ok(`Wallet balance: ${bal ?? "0"} RWF${escrow ? `, held in escrow: ${escrow} RWF` : ""}.`, w);
      },
    },
    {
      name: "getTransactions",
      description: "List the user's recent wallet transactions (top-ups, payouts, fees).",
      params: [],
      schema: z.object({}),
      requiresAuth: true,
      explain: "I reviewed your transaction history",
      async execute(_a, ctx: ToolContext): Promise<ToolResult> {
        const txns = await api.getWalletTransactions(ctx.token!);
        const list = (txns ?? []).slice(0, 5).map(t => ({
          type: field(t, "type", "kind", "direction"),
          amount: field(t, "amount", "amountRwf"),
          status: field(t, "status"),
          date: field(t, "createdAt", "date"),
        }));
        if (!list.length) return ok("No transactions yet.", []);
        return ok(`Last ${list.length} transaction(s): ` +
          list.map(t => `${t.type ?? "txn"} ${t.amount ?? ""} (${t.status ?? "-"})`).join("; "), list);
      },
    },

    // ── Notifications ────────────────────────────────────────────────────────
    {
      name: "getNotifications",
      description: "Get the user's recent notifications and alerts.",
      params: [],
      schema: z.object({}),
      requiresAuth: true,
      explain: "I checked your notifications",
      async execute(_a, ctx: ToolContext): Promise<ToolResult> {
        const page = await api.getNotifications(ctx.token!, 0, 5);
        const items = page?.content ?? [];
        if (!items.length) return ok("No new notifications.", []);
        const brief = items.map(n => field(n, "title", "message", "body")).filter(Boolean);
        return ok(`${page.totalElements ?? items.length} notification(s). Recent: ${brief.slice(0, 3).join("; ")}`, brief);
      },
    },

    // ── Bookings (role-aware) ────────────────────────────────────────────────
    {
      name: "searchBookings",
      description: "List the user's own jobs (employer) or job applications (worker).",
      params: [{ name: "status", type: "string", required: false, description: "Optional status filter" }],
      schema: z.object({ status: z.string().trim().max(30).optional() }),
      requiresAuth: true,
      explain: "I looked up your jobs",
      async execute(a, ctx: ToolContext): Promise<ToolResult> {
        if (ctx.role === "seeker") {
          const apps = await api.getMyApplications(ctx.token!);
          const list = (apps ?? []).filter(x => !a.status || field(x, "status")?.toLowerCase() === a.status!.toLowerCase());
          if (!list.length) return ok("You have no applications yet.", []);
          return ok(`You have ${list.length} application(s): ` +
            list.slice(0, 5).map(x => `${field(x, "jobTitle", "title") ?? "Job"} - ${field(x, "status") ?? "pending"}`).join("; "), list.slice(0, 5));
        }
        const jobs = await api.getMyJobs(ctx.token!);
        const list = (jobs ?? []).filter(x => !a.status || field(x, "status")?.toLowerCase() === a.status!.toLowerCase());
        if (!list.length) return ok("You have not posted any jobs yet.", []);
        return ok(`You have ${list.length} job(s): ` +
          list.slice(0, 5).map(x => `${field(x, "title", "category") ?? "Job"} - ${field(x, "status") ?? "open"}`).join("; "), list.slice(0, 5));
      },
    },

    // ── Profile ──────────────────────────────────────────────────────────────
    {
      name: "getProfile",
      description: "Get the signed-in user's profile details.",
      params: [],
      schema: z.object({}),
      requiresAuth: true,
      explain: "I looked at your profile",
      async execute(_a, ctx: ToolContext): Promise<ToolResult> {
        const p = await api.getProfile(ctx.token!);
        return ok(`Profile - name: ${field(p, "name") ?? "-"}, role: ${field(p, "role") ?? "-"}, ` +
          `verified: ${field(p, "approved") ?? "no"}, completion: ${field(p, "profileCompletion") ?? "?"}%.`, {
          name: field(p, "name"), role: field(p, "role"), approved: (p as any)?.approved,
          profileCompletion: (p as any)?.profileCompletion, badgeSubmitted: (p as any)?.badgeSubmitted,
        });
      },
    },
    {
      name: "updateProfile",
      description: "Update a limited set of the user's own profile fields (phone, name).",
      params: [
        { name: "name", type: "string", required: false, description: "New display name" },
        { name: "phone", type: "string", required: false, description: "New phone number" },
      ],
      schema: z.object({
        name: z.string().trim().min(2).max(80).optional(),
        phone: z.string().trim().min(7).max(20).optional(),
      }).refine(v => v.name || v.phone, { message: "Provide at least one field to update" }),
      requiresAuth: true,
      explain: "I updated your profile",
      async execute(a, ctx: ToolContext): Promise<ToolResult> {
        await api.updateProfile(a as any, ctx.token!);
        return ok("Profile updated successfully.");
      },
    },

    // ── Verification ─────────────────────────────────────────────────────────
    {
      name: "checkVerification",
      description: "Check the user's verification/approval status, or verify a worker badge id.",
      params: [{ name: "badgeId", type: "string", required: false, description: "A badge id to verify publicly" }],
      schema: z.object({ badgeId: z.string().trim().max(40).optional() }),
      requiresAuth: false,
      explain: "I checked verification status",
      async execute(a, ctx: ToolContext): Promise<ToolResult> {
        if (a.badgeId) {
          const v = await api.verifyBadge(a.badgeId);
          return ok(v?.valid
            ? `Badge ${a.badgeId} is valid - ${v.name ?? "worker"}, ${v.category ?? "verified"}, ${v.completedJobs ?? 0} jobs done.`
            : `Badge ${a.badgeId} could not be verified.`, v);
        }
        if (!ctx.token) return fail("Sign in to check your own verification, or provide a badge id.", "auth_required");
        const p = await api.getProfile(ctx.token);
        const approved = (p as any)?.approved;
        const submitted = (p as any)?.badgeSubmitted;
        return ok(approved ? "Your account is verified." :
          submitted ? "Your verification is submitted and under review." :
          "Your account is not yet verified - submit your badge to get verified.", { approved, submitted });
      },
    },

    // ── Pricing / fees ───────────────────────────────────────────────────────
    {
      name: "getPricing",
      description: "Get current platform fees: worker commission, employer service fee, cancellation penalty.",
      params: [],
      schema: z.object({}),
      requiresAuth: false,
      explain: "I checked the current fees",
      async execute(): Promise<ToolResult> {
        const p = await api.getPricingConfig().catch(() => api.DEFAULT_PRICING);
        return ok(`Worker commission: ${Math.round(p.workerCommissionRate * 100)}%, ` +
          `employer service fee: ${Math.round(p.employerServiceFeeRate * 100)}%, ` +
          `late-cancel penalty: ${Math.round(p.cancellationPenaltyRate * 100)}%.`, p);
      },
    },
  ];

  // ── Knowledge / FAQ / Help (injected searcher) ─────────────────────────────
  if (deps.searchKnowledge) {
    const knowledgeTool = (name: string, description: string, explain: string): Tool => ({
      name,
      description,
      params: [{ name: "query", type: "string", required: true, description: "What to look up" }],
      schema: z.object({ query: z.string().trim().min(2).max(200) }),
      requiresAuth: false,
      explain,
      async execute(a): Promise<ToolResult> {
        const hits = await deps.searchKnowledge!(a.query, 3);
        if (!hits.length) return ok("Nothing relevant found in the help content.", []);
        return ok(hits.map(h => `${h.title}: ${h.text}`).join("\n\n"), hits);
      },
    });
    tools.push(
      knowledgeTool("searchKnowledge", "Search platform documentation, policies and guides for an answer.", "I searched the help center"),
      knowledgeTool("searchFAQ", "Search frequently-asked questions for a direct answer.", "I checked the FAQ"),
      knowledgeTool("searchHelp", "Search help articles and how-to guides.", "I searched the help articles"),
    );
  }

  return tools;
}
