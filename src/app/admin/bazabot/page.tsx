"use client";

/**
 * BazaBot analytics dashboard.
 *
 * Renders the live snapshot from GET /api/bazabot/analytics: turn volume,
 * source + intent distribution, tool usage/failures, knowledge success rate,
 * fallback + escalation rates and average latency. If the endpoint is protected
 * with BAZABOT_ANALYTICS_TOKEN, a token field appears.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Activity, Wrench, BookOpen, Gauge, AlertTriangle } from "lucide-react";

interface Snapshot {
  totalTurns: number;
  bySource: Record<string, number>;
  byIntent: Record<string, number>;
  toolCalls: Record<string, number>;
  toolFailures: Record<string, number>;
  knowledge: { hits: number; misses: number; successRate: number };
  fallbackRate: number;
  escalationRate: number;
  avgLatencyMs: number;
}

const card: React.CSSProperties = {
  background: "#121212", border: "1px solid #232323", borderRadius: 14, padding: 18,
};
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Bars({ data, color = "#f97316" }: { data: Record<string, number>; color?: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  if (!entries.length) return <p style={{ color: "#666", fontSize: 12 }}>No data yet.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 130, fontSize: 11.5, color: "#bbb", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
          <div style={{ flex: 1, background: "#1e1e1e", borderRadius: 6, height: 16, overflow: "hidden" }}>
            <div style={{ width: `${(v / max) * 100}%`, height: "100%", background: color, borderRadius: 6 }} />
          </div>
          <span style={{ width: 34, fontSize: 11.5, color: "#eee" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f97316" }}>{icon}
        <span style={{ fontSize: 11.5, color: "#9a9a9a", fontWeight: 600 }}>{label}</span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, color: "#fff" }}>{value}</p>
      {sub && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#777" }}>{sub}</p>}
    </div>
  );
}

export default function BazaBotAnalyticsPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [token, setToken] = useState("");
  const [needsToken, setNeedsToken] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/bazabot/analytics", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) { setNeedsToken(true); setError("This dashboard is protected. Enter the analytics token."); return; }
      if (!res.ok) { setError(`Failed to load (${res.status}).`); return; }
      setData(await res.json());
      setNeedsToken(false);
    } catch {
      setError("Could not reach the analytics endpoint.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#eee", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <Activity size={22} color="#f97316" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>BazaBot Analytics</h1>
          <button onClick={load} disabled={loading} style={{ marginLeft: "auto", background: "#181818", border: "1px solid #2a2a2a", color: "#eee", borderRadius: 10, padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>

        {needsToken && (
          <div style={{ ...card, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <input value={token} onChange={e => setToken(e.target.value)} placeholder="Analytics token"
              style={{ flex: 1, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 12 }} />
            <button onClick={load} style={{ background: "#f97316", border: "none", color: "#fff", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Unlock</button>
          </div>
        )}

        {error && !data && (
          <div style={{ ...card, color: "#f7b267", display: "flex", gap: 8, alignItems: "center" }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 18 }}>
              <Stat icon={<Activity size={15} />} label="Total turns" value={String(data.totalTurns)} />
              <Stat icon={<Gauge size={15} />} label="Avg latency" value={`${data.avgLatencyMs} ms`} />
              <Stat icon={<BookOpen size={15} />} label="Knowledge hit rate" value={pct(data.knowledge.successRate)} sub={`${data.knowledge.hits} hits / ${data.knowledge.misses} misses`} />
              <Stat icon={<AlertTriangle size={15} />} label="Fallback rate" value={pct(data.fallbackRate)} />
              <Stat icon={<AlertTriangle size={15} />} label="Escalation rate" value={pct(data.escalationRate)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              <div style={card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Activity size={14} color="#f97316" /> Intent distribution</h3>
                <Bars data={data.byIntent} />
              </div>
              <div style={card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><BookOpen size={14} color="#0ea5e9" /> Answer source</h3>
                <Bars data={data.bySource} color="#0ea5e9" />
              </div>
              <div style={card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Wrench size={14} color="#8b5cf6" /> Tool usage</h3>
                <Bars data={data.toolCalls} color="#8b5cf6" />
              </div>
              <div style={card}>
                <h3 style={{ margin: "0 0 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} color="#ef4444" /> Tool failures</h3>
                <Bars data={data.toolFailures} color="#ef4444" />
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`.spin { animation: bb-spin 1s linear infinite; } @keyframes bb-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
