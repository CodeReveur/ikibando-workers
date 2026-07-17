"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell, Briefcase, CheckCircle, XCircle, Wallet, Gift,
  AlertTriangle, Sparkles, ArrowRight, Loader2,
} from "lucide-react";
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, notificationHref,
  type NotificationDto,
} from "@/lib/api";
import { SectionHead, PageLoader } from "@/components/dashboard/ui";
import { useLanguage } from "@/lib/language-context";

const PAGE_SIZE = 20;

/** Icon + colour per notification type, so the list is scannable at a glance. */
function styleFor(type: string): { icon: typeof Bell; color: string } {
  switch (type) {
    case "JOB_MATCH":            return { icon: Briefcase,     color: "#f97316" };
    case "APPLICATION_RECEIVED": return { icon: Briefcase,     color: "#60a5fa" };
    case "APPLICATION_ACCEPTED": return { icon: CheckCircle,   color: "#22c55e" };
    case "APPLICATION_REJECTED": return { icon: XCircle,       color: "#ef4444" };
    case "JOB_COMPLETED":        return { icon: CheckCircle,   color: "#22c55e" };
    case "PAYMENT_HELD":         return { icon: Wallet,        color: "#a78bfa" };
    case "PAYMENT_RELEASED":     return { icon: Gift,          color: "#22c55e" };
    case "DISPUTE_OPENED":
    case "DISPUTE_RESOLVED":     return { icon: AlertTriangle, color: "#f59e0b" };
    default:                     return { icon: Sparkles,      color: "#f97316" };
  }
}

/**
 * The full notification history. The bell only ever shows the newest few and clips the body —
 * this is where a notification can be read in full, and older ones are still reachable.
 */
export function NotificationsPage({ role }: { role: "seeker" | "owner" }) {
  const { t, language } = useLanguage();
  const [items, setItems]   = useState<NotificationDto[]>([]);
  const [page, setPage]     = useState(0);
  const [last, setLast]     = useState(true);
  const [loading, setLoading]   = useState(true);
  const [loadingMore, setMore]  = useState(false);

  const localeMap: Record<string, string> = { rw: "rw-RW", kinyy: "rw-RW", sw: "sw-TZ", fr: "fr-FR", en: "en-US" };
  const locale = localeMap[language] || "en-RW";

  const load = useCallback(async (p: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }
    p === 0 ? setLoading(true) : setMore(true);
    try {
      const res = await getNotifications(token, p, PAGE_SIZE);
      setItems(prev => (p === 0 ? res.content : [...prev, ...res.content]));
      setLast(p + 1 >= (res.totalPages ?? 1));
      setPage(p);
    } catch {
      if (p === 0) setItems([]);
    } finally {
      setLoading(false);
      setMore(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load]);

  const unread = items.filter(n => !n.read).length;

  const openOne = async (n: NotificationDto) => {
    if (!n.read) {
      const token = localStorage.getItem("access_token");
      if (token) {
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
        markNotificationRead(n.id, token).catch(() => {});
      }
    }
  };

  const readAll = async () => {
    const token = localStorage.getItem("access_token");
    if (!token || unread === 0) return;
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    markAllNotificationsRead(token).catch(() => {});
  };

  /**
   * Where this notification points: an explicit url wins, else the job it refers to.
   * The url is reduced to a same-origin path so a stale absolute URL (built from the wrong host)
   * can't send the click to a dead page or the login screen.
   */
  const linkFor = (n: NotificationDto): string | undefined => {
    if (n.data?.url) return notificationHref(n.data.url);
    if (n.data?.jobId) return `/${role}/jobs/${n.data.jobId}`;
    return undefined;
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <SectionHead
        title={t("common.nav.notifications") || "Notifications"}
        action={unread > 0 ? (
          <button onClick={readAll} style={{
            background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 12, fontWeight: 700, color: "#f97316",
          }}>
            {t("notifications.mark_all_read") || "Mark all as read"}
          </button>
        ) : undefined}
      />

      {items.length === 0 ? (
        <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
          <Bell size={26} color="#2e2e2e" style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 13, color: "#4a4a4a" }}>
            {t("notifications.no_new") || "No notifications yet"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#333" }}>
            {t("notifications.empty_desc") || "Job alerts, payments and updates will show up here."}
          </p>
        </div>
      ) : (
        <div style={{ background: "#131313", border: "1px solid #1c1c1c", borderRadius: 14, overflow: "hidden" }}>
          {items.map((n, i) => {
            const { icon: Icon, color } = styleFor(n.type);
            const href = linkFor(n);
            const body = (
              <>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: `${color}1a`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={17} color={color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {!n.read && <span style={{ width: 6, height: 6, borderRadius: 99, background: "#f97316", flexShrink: 0 }} />}
                    <p style={{ margin: 0, fontSize: 13, fontWeight: n.read ? 600 : 800, color: n.read ? "#c0c0c0" : "#f0f0f0" }}>
                      {n.title}
                    </p>
                  </div>
                  {/* Full body — no clipping. The bell truncates; this page is where you read it. */}
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#8a8a8a", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {n.body}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: "#444" }}>
                      {new Date(n.createdAt).toLocaleString(locale, {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {href && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#f97316" }}>
                        {t("seeker_jobs.track_link") || "View"} <ArrowRight size={11} />
                      </span>
                    )}
                  </div>
                </div>
              </>
            );

            const rowStyle: React.CSSProperties = {
              display: "flex", gap: 12, padding: "16px 18px", textDecoration: "none",
              borderBottom: i < items.length - 1 ? "1px solid #181818" : "none",
              background: n.read ? "transparent" : "rgba(249,115,22,0.03)",
            };

            return href ? (
              <a key={n.id} href={href} onClick={() => openOne(n)} style={rowStyle} className="sk-card">{body}</a>
            ) : (
              <div key={n.id} onClick={() => openOne(n)} style={{ ...rowStyle, cursor: n.read ? "default" : "pointer" }}>{body}</div>
            );
          })}
        </div>
      )}

      {!last && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={() => load(page + 1)} disabled={loadingMore} style={{
            background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 9,
            padding: "10px 20px", fontSize: 12, fontWeight: 700, color: "#ccc",
            cursor: loadingMore ? "not-allowed" : "pointer", fontFamily: "inherit",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {loadingMore && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
            {t("common.buttons.more") || "Load more"}
          </button>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  );
}
