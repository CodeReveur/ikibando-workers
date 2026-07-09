"use client";

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from "react";
import {
  User, Mail, Phone, Lock, Shield, Bell, Info,
  Eye, EyeOff, CheckCircle, XCircle, Smartphone,
  Copy, RefreshCw, AlertTriangle, ChevronRight,
  ToggleLeft, ToggleRight, MapPin, X as XIcon,
  Briefcase, Calendar, GraduationCap, Wrench, Clock, Globe,
} from "lucide-react";
import { useSession } from "@/components/dashboard/session-ctx";
import { PageLoader } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import {
  updateProfile,
  changePassword,
  setupTotp,
  enableTotp,
  disableTotp,
  submitOnboarding,
  getJobCategories,
  JobCategoryMeta,
  Address,
} from "@/lib/api";
import { AddressPicker, isAddressComplete } from "@/components/ui/address-picker";
import { BadgeSubmissionWizard } from "@/components/auth/badge-submission-wizard";

/* ── Types ────────────────────────────────────────────────────────────────── */

type Tab = "profile" | "security" | "notifications" | "account";

interface NotifPrefs {
  emailNewApplications: boolean;       // employer: new applications on their jobs
  emailJobAlerts: boolean;             // worker: new job postings matching profile
  emailApplicationUpdates: boolean;
  emailPaymentNotifications: boolean;
  emailLoginAlerts: boolean;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function getToken(): string {
  return localStorage.getItem("access_token") ?? "";
}

/** Full persisted user object (includes structured `location`/`address`). */
function readStoredUser(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveUserLocally(patch: Record<string, unknown>) {
  try {
    const raw = localStorage.getItem("user");
    const u = raw ? JSON.parse(raw) : {};
    localStorage.setItem("user", JSON.stringify({ ...u, ...patch }));
  } catch { /* ignore */ }
}

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem("MpahMapu_notif_prefs");
    if (raw) return { ...defaultNotifPrefs(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultNotifPrefs();
}

function defaultNotifPrefs(): NotifPrefs {
  return {
    emailNewApplications: true,
    emailJobAlerts: true,
    emailApplicationUpdates: true,
    emailPaymentNotifications: true,
    emailLoginAlerts: true,
  };
}

function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem("MpahMapu_notif_prefs", JSON.stringify(prefs));
}

/* ── Shared style primitives ──────────────────────────────────────────────── */

const card: React.CSSProperties = {
  background: "#111",
  border: "1px solid #1e1e1e",
  borderRadius: 14,
  overflow: "hidden",
  marginBottom: 16,
};

const cardHeader: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid #181818",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const cardHeaderLabel: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
};

const cardBody: React.CSSProperties = {
  padding: "20px",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#555",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginBottom: 7,
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  background: "#0d0d0d",
  border: "1px solid #222",
  borderRadius: 9,
  padding: "11px 14px 11px 38px",
  fontSize: 13,
  color: "#e0e0e0",
  outline: "none",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  transition: "border-color 0.12s",
};

const fieldInputNoPad: React.CSSProperties = {
  ...fieldInput,
  padding: "11px 38px",
};

const primaryBtn: React.CSSProperties = {
  background: "#f97316",
  color: "#fff",
  border: "none",
  borderRadius: 9,
  padding: "11px 24px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "background 0.15s, opacity 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "#888",
  border: "1px solid #2a2a2a",
  borderRadius: 9,
  padding: "11px 20px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "border-color 0.15s, color 0.15s",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
};

const dangerBtn: React.CSSProperties = {
  ...ghostBtn,
  color: "#ef4444",
  border: "1px solid #3a1a1a",
};

/* ── Tab navigation ────────────────────────────────────────────────────────── */

const TABS: { id: Tab; label: string; icon: React.FC<{ size?: number; color?: string }> }[] = [
  { id: "profile",       label: "Profile",       icon: User },
  { id: "security",      label: "Security",      icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account",       label: "Account",       icon: Info },
];

/* ── Main export ────────────────────────────────────────────────────────────── */

export function SettingsPage({ roleLabel }: { roleLabel: string }) {
  const session = useSession();
  const { success, error: toastError } = useToast();
  const [tab, setTab] = useState<Tab>("profile");
  const { t } = useLanguage();

  if (!session) return <PageLoader />;

  return (
    <div style={{ fontFamily: "inherit" }}>
      <style>{`
        .settings-container {
          display: flex;
          gap: 20px;
          align-items: flex-start;
        }
        .settings-sidebar {
          flex-shrink: 0;
          width: 190px;
        }
        .responsive-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .responsive-grid-220 {
          display: grid;
          grid-template-columns: 220px 1fr;
        }
        @media (max-width: 768px) {
          .settings-container {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }
          .settings-sidebar {
            width: 100% !important;
            position: static !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            padding: 6px !important;
          }
          .settings-sidebar button {
            justify-content: center;
            margin-bottom: 0 !important;
            white-space: nowrap;
            padding: 10px 16px !important;
          }
        }
        @media (max-width: 600px) {
          .responsive-grid-2 {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .responsive-grid-220 {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          .account-row {
            border-right: none !important;
          }
        }
        @media (max-width: 340px) {
          .settings-sidebar {
            grid-template-columns: 1fr !important;
          }
          .skills-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)) !important;
          }
          .schedule-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>

      {/* Page heading */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#e8e8e8", letterSpacing: "-0.4px" }}>
          {t("settings_page.title")}
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#444" }}>
          {t("settings_page.subtitle")}
        </p>
      </div>

      {/* Two-column layout: left nav + right content */}
      <div className="settings-container">

        {/* Left vertical nav */}
        <div className="settings-sidebar" style={{
          background: "#0e0e0e", border: "1px solid #1e1e1e",
          borderRadius: 12, padding: 6,
          position: "sticky", top: 0,
        }}>
          {TABS.map(tabItem => {
            const active = tab === tabItem.id;
            const Icon = tabItem.icon;
            return (
              <button
                key={tabItem.id}
                onClick={() => setTab(tabItem.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 14px", borderRadius: 8, border: "none",
                  background: active ? "#1e1e1e" : "transparent",
                  color: active ? "#f97316" : "#555",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s", textAlign: "left",
                  boxShadow: active ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
                  marginBottom: 2,
                }}
              >
                <Icon size={14} color={active ? "#f97316" : "#444"} />
                {t("settings_page.tabs." + tabItem.id)}
              </button>
            );
          })}
        </div>

        {/* Right content — fills remaining width */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {tab === "profile"       && <ProfileTab session={session} roleLabel={roleLabel} success={success} toastError={toastError} />}
          {tab === "security"      && <SecurityTab session={session} success={success} toastError={toastError} />}
          {tab === "notifications" && <NotificationsTab role={session.role} success={success} />}
          {tab === "account"       && <AccountTab session={session} roleLabel={roleLabel} />}
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROFILE TAB
═══════════════════════════════════════════════════════════════════════════ */

function ProfileTab({
  session, roleLabel, success, toastError,
}: {
  session: NonNullable<ReturnType<typeof useSession>>;
  roleLabel: string;
  success: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const { language, setLanguage, t } = useLanguage();
  const [name,    setName]    = useState(session.name  ?? "");
  const [phone,   setPhone]   = useState(session.phone ?? "");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const initials = name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  const handleSave = async () => {
    if (!name.trim()) { toastError("Name cannot be empty"); return; }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || undefined }, getToken());
      saveUserLocally({ name: name.trim(), phone: phone.trim() });
      setSaved(true);
      success("Profile updated successfully");
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update profile";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24, padding: "18px 20px", ...card }}>
        <div style={{
          width: 68, height: 68, borderRadius: "50%", flexShrink: 0,
          background: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 24, color: "#fff",
          boxShadow: "0 0 0 3px #111, 0 0 0 5px rgba(249,115,22,0.3)",
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#e0e0e0" }}>{name || "—"}</p>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#444" }}>{roleLabel} · {session.email}</p>
        </div>
        {session.emailVerified && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#22c55e",
            background: "#0d2010", border: "1px solid #1a4020",
            borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5,
          }}>
            <CheckCircle size={11} color="#22c55e" /> Verified
          </span>
        )}
      </div>

      {/* Editable fields */}
      <div style={card}>
        <div style={cardHeader}>
          <User size={14} color="#555" />
          <p style={cardHeaderLabel}>{t("settings_page.profile.title")}</p>
        </div>
        <div style={cardBody}>
          <div className="responsive-grid-2" style={{ gap: 16, marginBottom: 16 }}>

            <div>
              <label style={fieldLabel}>{t("settings_page.profile.full_name")}</label>
              <div style={{ position: "relative" }}>
                <User size={13} color="#444" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={fieldInput}
                  placeholder="Your full name"
                  onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222")}
                />
              </div>
            </div>

            <div>
              <label style={fieldLabel}>{t("settings_page.profile.phone_number")}</label>
              <div style={{ position: "relative" }}>
                <Phone size={13} color="#444" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={fieldInput}
                  placeholder="+250 7XX XXX XXX"
                  onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222")}
                />
              </div>
            </div>

          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={fieldLabel}>{t("settings_page.profile.email")}</label>
            <div style={{ position: "relative" }}>
              <Mail size={13} color="#444" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={session.email}
                disabled
                style={{ ...fieldInput, color: "#444", cursor: "not-allowed", borderColor: "#181818" }}
                title="Email cannot be changed"
              />
              <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#333", fontWeight: 600 }}>LOCKED</span>
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 11, color: "#333" }}>{t("settings_page.profile.email_hint")}</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}
          >
            {saved ? <><CheckCircle size={14} /> {t("settings_page.profile.saved")}</> : saving ? <><RefreshCw size={14} /> {t("settings_page.profile.saving")}</> : t("settings_page.profile.save_btn")}
          </button>
        </div>
      </div>

      {/* Language Preferences Card */}
      <div style={card}>
        <div style={cardHeader}>
          <Globe size={14} color="#555" />
          <p style={cardHeaderLabel}>{t("settings_page.language.title")}</p>
        </div>
        <div style={cardBody}>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#888", lineHeight: 1.5 }}>
            {t("settings_page.language.subtitle")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { code: "en", label: "English" },
              { code: "fr", label: "Français" },
              { code: "sw", label: "Kiswahili" },
              { code: "kinyy", label: "Kinyarwanda" },
            ].map(lang => {
              const active = language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code as any)}
                  style={{
                    padding: "10px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8,
                    border: `1px solid ${active ? "#f97316" : "#222"}`,
                    background: active ? "rgba(249,115,22,0.12)" : "#141414",
                    color: active ? "#f97316" : "#c0c0c0",
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                  }}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {session.role === "WORKER" && (
        <WorkerProfileSection success={success} toastError={toastError} />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORKER PROFILE SECTION (profile tab, workers only)
═══════════════════════════════════════════════════════════════════════════ */

const DAYS        = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};
const EDUCATION_OPTIONS = [
  "None", "Primary School", "High School",
  "Diploma / Certificate", "Bachelor's Degree", "Master's Degree or Higher",
];
const EQUIPMENT_SUGGESTIONS = [
  "Smartphone", "Laptop", "Internet Connection",
  "Safety Gear", "Vehicle", "Power Tools", "Camera", "Tablet",
];

function readWorkerFields() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw) as {
      dob?: string; educationLevel?: string; experienceType?: string;
      location?: { lat?: number; lng?: number; address?: string };
      equipment?: { name: string; available: boolean }[];
      availability?: string[];
    };
  } catch { return null; }
}

function WorkerProfileSection({
  success, toastError,
}: {
  success: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const { t } = useLanguage();
  const stored = readWorkerFields();

  const [dob,          setDob]          = useState(stored?.dob ?? "");
  const [education,    setEducation]    = useState(stored?.educationLevel ?? "");
  const [experience,   setExperience]   = useState(stored?.experienceType ?? "");
  const [categories,   setCategories]   = useState<JobCategoryMeta[]>([]);
  const [catSearch,    setCatSearch]    = useState("");
  const [address,      setAddress]      = useState<Address | null>(
    stored?.location && typeof stored.location === "object" && (stored.location as Address).country
      ? (stored.location as Address)
      : null
  );
  const [availability, setAvailability] = useState<string[]>(() => {
    const raw = stored?.availability ?? [];
    return raw.map(full => Object.keys(FULL_DAYS).find(k => FULL_DAYS[k] === full) ?? full);
  });
  const [equipment,    setEquipment]    = useState<string[]>(
    (stored?.equipment ?? []).map((e: { name: string }) => e.name)
  );
  const [equipInput,   setEquipInput]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const equipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getJobCategories().then(setCategories).catch(() => {});
  }, []);

  const toggleDay = (day: string) =>
    setAvailability(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);

  const addEquipItem = (val: string) => {
    const t = val.trim().replace(/,/g, "");
    if (t && !equipment.includes(t)) setEquipment(prev => [...prev, t]);
    setEquipInput("");
  };

  const equipKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addEquipItem(equipInput); }
    else if (e.key === "Backspace" && equipInput === "" && equipment.length > 0)
      setEquipment(prev => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (!dob)         { toastError("Date of birth is required"); return; }
    if (!education)   { toastError("Education level is required"); return; }
    if (!experience)  { toastError("Work category is required"); return; }
    if (!isAddressComplete(address)) { toastError("Complete your location"); return; }
    if (availability.length === 0) { toastError("Select at least one available day"); return; }

    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() - birthDate.getMonth() < 0 ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()))
      age--;
    if (age < 18) { toastError("You must be at least 18 years old"); return; }

    setSaving(true);
    try {
      const payload = {
        dob,
        educationLevel: education,
        experienceType: experience,
        location: address ?? { country: "Rwanda" },
        equipment: equipment.map(name => ({ name, available: true })),
        availability: availability.map(d => FULL_DAYS[d]),
      };
      const updated = await submitOnboarding(payload, getToken());
      saveUserLocally(updated);
      setSaved(true);
      success("Worker profile updated");
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update profile";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Personal details */}
      <div style={card}>
        <div style={cardHeader}>
          <Briefcase size={14} color="#555" />
          <p style={cardHeaderLabel}>{t("settings_page.worker_details.title")}</p>
        </div>
        <div style={{ ...cardBody, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* DOB + Education side by side */}
          <div className="responsive-grid-220" style={{ gap: 16 }}>
            <div>
              <label style={fieldLabel}><Calendar size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />{t("settings_page.worker_details.dob")}</label>
              <input
                type="date"
                value={dob}
                onChange={e => setDob(e.target.value)}
                style={{ ...fieldInput, padding: "11px 14px", colorScheme: "dark" as const }}
                onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "#222")}
              />
            </div>

            <div>
              <label style={fieldLabel}><GraduationCap size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />{t("settings_page.worker_details.education")}</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {EDUCATION_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setEducation(opt)}
                    style={{
                      padding: "7px 13px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                      border: `1px solid ${education === opt ? "#f97316" : "#222"}`,
                      background: education === opt ? "rgba(249,115,22,0.12)" : "#141414",
                      color: education === opt ? "#f97316" : "#666",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Work category */}
          <div>
            <label style={fieldLabel}><Briefcase size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />{t("settings_page.worker_details.category")}</label>
            <input
              type="text"
              placeholder={t("settings_page.worker_details.category_search_placeholder")}
              value={catSearch}
              onChange={e => setCatSearch(e.target.value)}
              style={{ ...fieldInput, padding: "9px 14px", marginBottom: 10 }}
              onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
              onBlur={e => (e.currentTarget.style.borderColor = "#222")}
            />
            <div className="skills-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
              {categories
                .filter(c =>
                  c.displayName.toLowerCase().includes(catSearch.toLowerCase()) ||
                  (c.nameKinyarwanda ?? "").toLowerCase().includes(catSearch.toLowerCase())
                )
                .map(c => (
                  <button
                    key={c.slug}
                    onClick={() => setExperience(c.slug)}
                    style={{
                      padding: "7px 13px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                      border: `1px solid ${experience === c.slug ? "#f97316" : "#222"}`,
                      background: experience === c.slug ? "rgba(249,115,22,0.12)" : "#141414",
                      color: experience === c.slug ? "#f97316" : "#666",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                      textAlign: "left" as const,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{c.displayName}</div>
                    {c.nameKinyarwanda && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>{c.nameKinyarwanda}</div>}
                  </button>
                ))}
              {categories.length === 0 && <span style={{ fontSize: 12, color: "#444" }}>Loading...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Location + Availability side by side */}
      <div style={card}>
        <div style={cardHeader}>
          <MapPin size={14} color="#555" />
          <p style={cardHeaderLabel}>{t("settings_page.worker_details.location_availability")}</p>
        </div>
        <div className="responsive-grid-2" style={{ ...cardBody, gap: 20 }}>

          {/* Left: structured address */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AddressPicker value={address} onChange={setAddress} />
          </div>

          {/* Right: availability */}
          <div>
            <label style={{ ...fieldLabel, marginBottom: 12 }}>
              <Clock size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
              {t("settings_page.worker_details.availability")}
            </label>
            <div className="schedule-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 14 }}>
              {DAYS.map(day => {
                const active = availability.includes(day);
                const dayLabel = t("common.days." + day.toLowerCase());
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: "10px 4px", fontSize: 11, fontWeight: 700, borderRadius: 8,
                      border: `1px solid ${active ? "#f97316" : "#222"}`,
                      background: active ? "rgba(249,115,22,0.12)" : "#141414",
                      color: active ? "#f97316" : "#555",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                    }}
                  >
                    {dayLabel ? dayLabel.substring(0, 3) : day}
                  </button>
                );
              })}
            </div>
            {availability.length > 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: "#555" }}>
                {availability.length} {availability.length === 1 ? "day" : "days"} selected:{" "}
                <span style={{ color: "#888" }}>{availability.map(d => t("common.days." + d.toLowerCase())).join(", ")}</span>
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: "#333" }}>{t("settings_page.worker_details.availability_hint")}</p>
            )}
          </div>

        </div>
      </div>

      {/* Equipment */}
      <div style={card}>
        <div style={cardHeader}>
          <Wrench size={14} color="#555" />
          <p style={cardHeaderLabel}>{t("settings_page.worker_details.equipment")}</p>
        </div>
        <div style={cardBody}>
          <div
            onClick={() => equipRef.current?.focus()}
            style={{
              minHeight: 80, background: "#0d0d0d", border: "1px solid #222",
              borderRadius: 9, padding: 12, display: "flex", flexWrap: "wrap", gap: 8,
              cursor: "text", marginBottom: 12,
            }}
          >
            {equipment.map(item => (
              <span
                key={item}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)",
                  color: "#f97316", fontSize: 12, fontWeight: 600,
                  padding: "4px 10px", borderRadius: 6,
                }}
              >
                {item}
                <button
                  onClick={e => { e.stopPropagation(); setEquipment(prev => prev.filter(i => i !== item)); }}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#f97316", display: "flex" }}
                >
                  <XIcon size={11} />
                </button>
              </span>
            ))}
            <input
              ref={equipRef}
              value={equipInput}
              onChange={e => setEquipInput(e.target.value)}
              onKeyDown={equipKeyDown}
              onBlur={() => equipInput.trim() && addEquipItem(equipInput)}
              placeholder={equipment.length === 0 ? t("settings_page.worker_details.equipment_placeholder") : ""}
              style={{ flex: 1, minWidth: 140, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "#e0e0e0", fontFamily: "inherit" }}
            />
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 11, color: "#444" }}>
            Press <kbd style={{ background: "#1e1e1e", padding: "1px 5px", borderRadius: 4, fontSize: 10, color: "#888" }}>Enter</kbd> or <kbd style={{ background: "#1e1e1e", padding: "1px 5px", borderRadius: 4, fontSize: 10, color: "#888" }}>,</kbd> to add each item
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {EQUIPMENT_SUGGESTIONS.filter(s => !equipment.includes(s)).map(s => (
              <button
                key={s}
                onClick={() => setEquipment(prev => [...prev, s])}
                style={{ ...ghostBtn, fontSize: 11, padding: "5px 11px" }}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save worker profile */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{ ...primaryBtn, marginBottom: 32, opacity: saving ? 0.6 : 1 }}
      >
        {saved ? <><CheckCircle size={14} /> {t("settings_page.profile.saved")}</> : saving ? <><RefreshCw size={14} /> {t("settings_page.profile.saving")}</> : t("settings_page.worker_details.save_worker_btn")}
      </button>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECURITY TAB
═══════════════════════════════════════════════════════════════════════════ */

function SecurityTab({
  session, success, toastError,
}: {
  session: NonNullable<ReturnType<typeof useSession>>;
  success: (m: string) => void;
  toastError: (m: string) => void;
}) {
  return (
    <>
      <PasswordSection success={success} toastError={toastError} />
      <TotpSection session={session} success={success} toastError={toastError} />
      <ActiveSessionsSection />
    </>
  );
}

/* ── Password change ──────────────────────────────────────────────────────── */

function PasswordSection({
  success, toastError,
}: {
  success: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const { t } = useLanguage();
  const [cur,      setCur]      = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const strength = passwordStrength(next);

  const handleSubmit = async () => {
    if (!cur || !next || !confirm) { toastError("All password fields are required"); return; }
    if (next !== confirm)           { toastError("New passwords do not match"); return; }
    if (next.length < 8)            { toastError("New password must be at least 8 characters"); return; }
    setSaving(true);
    try {
      await changePassword({ currentPassword: cur, newPassword: next }, getToken());
      success("Password changed successfully");
      setCur(""); setNext(""); setConfirm("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to change password";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={card}>
      <div style={cardHeader}>
        <Lock size={14} color="#555" />
        <p style={cardHeaderLabel}>{t("settings_page.security.password_title")}</p>
      </div>
      <div style={cardBody}>

        {/* Top row: current + new side by side */}
        <div className="responsive-grid-2" style={{ gap: 16, marginBottom: 16 }}>
          <div>
            <label style={fieldLabel}>{t("settings_page.security.cur_password")}</label>
            <div style={{ position: "relative" }}>
              <Lock size={13} color="#444" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type={showCur ? "text" : "password"}
                value={cur}
                onChange={e => setCur(e.target.value)}
                style={fieldInputNoPad}
                placeholder="••••••••"
                onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "#222")}
              />
              <button type="button" onClick={() => setShowCur(v => !v)}
                style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", padding: 0, display: "flex" }}>
                {showCur ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <a href="/forgot-password" style={{ fontSize: 11, color: "#f97316", textDecoration: "none", fontWeight: 600, display: "inline-block", marginTop: 6 }}>
              {t("titles.forgot_password").split(" | ")[0]}? <ChevronRight size={10} style={{ verticalAlign: "middle" }} />
            </a>
          </div>

          <div>
            <label style={fieldLabel}>{t("settings_page.security.new_password")}</label>
            <div style={{ position: "relative" }}>
              <Lock size={13} color="#444" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type={showNext ? "text" : "password"}
                value={next}
                onChange={e => setNext(e.target.value)}
                style={fieldInputNoPad}
                placeholder={t("settings_page.security.new_password_placeholder")}
                onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "#222")}
              />
              <button type="button" onClick={() => setShowNext(v => !v)}
                style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#444", padding: 0, display: "flex" }}>
                {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {next && (
              <div style={{ marginTop: 8, display: "flex", gap: 5, alignItems: "center" }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    height: 3, flex: 1, borderRadius: 99,
                    background: i <= strength.score ? strength.color : "#1e1e1e",
                    transition: "background 0.2s",
                  }} />
                ))}
                <span style={{ fontSize: 11, color: strength.color, fontWeight: 600, minWidth: 44 }}>{strength.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Confirm + button row */}
        <div className="responsive-grid-2" style={{ gap: 16, alignItems: "flex-end" }}>
          <div>
            <label style={fieldLabel}>{t("settings_page.security.confirm_password")}</label>
            <div style={{ position: "relative" }}>
              <Lock size={13} color="#444" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                style={fieldInputNoPad}
                placeholder={t("settings_page.security.confirm_password_placeholder")}
                onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "#222")}
              />
              {confirm && (
                <span style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
                  {next === confirm
                    ? <CheckCircle size={14} color="#22c55e" />
                    : <XCircle size={14} color="#ef4444" />}
                </span>
              )}
            </div>
          </div>
          <div>
            <button onClick={handleSubmit} disabled={saving} style={{ ...primaryBtn, width: "100%", justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
              {saving ? <><RefreshCw size={14} /> {t("settings_page.profile.saving")}</> : t("settings_page.profile.save_btn")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function passwordStrength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: "", color: "#333" };
  let s = 0;
  if (p.length >= 8)  s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  const map: [string, string][] = [["Weak", "#ef4444"], ["Fair", "#f59e0b"], ["Good", "#3b82f6"], ["Strong", "#22c55e"]];
  const [label, color] = map[s - 1] ?? ["Weak", "#ef4444"];
  return { score: Math.max(1, s), label, color };
}

/* ── TOTP / 2FA ───────────────────────────────────────────────────────────── */

type TotpPhase = "idle" | "setup" | "verify" | "disable";

function TotpSection({
  session, success, toastError,
}: {
  session: NonNullable<ReturnType<typeof useSession>>;
  success: (m: string) => void;
  toastError: (m: string) => void;
}) {
  const { t } = useLanguage();
  const [enabled,  setEnabled]  = useState(session.totpEnabled);
  const [phase,    setPhase]    = useState<TotpPhase>("idle");
  const [qrUri,    setQrUri]    = useState("");
  const [secret,   setSecret]   = useState("");
  const [code,     setCode]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [copied,   setCopied]   = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await setupTotp(getToken());
      setQrUri(res.qrCodeUri);
      setSecret(res.secret);
      setPhase("setup");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to start 2FA setup";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async () => {
    if (code.length !== 6) { toastError("Enter the 6-digit code from your authenticator app"); return; }
    setLoading(true);
    try {
      await enableTotp(code, getToken());
      saveUserLocally({ totpEnabled: true });
      setEnabled(true);
      setPhase("idle");
      setCode("");
      success("Two-factor authentication enabled");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Invalid code";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (code.length !== 6) { toastError("Enter the 6-digit code from your authenticator app"); return; }
    setLoading(true);
    try {
      await disableTotp(code, getToken());
      saveUserLocally({ totpEnabled: false });
      setEnabled(false);
      setPhase("idle");
      setCode("");
      success("Two-factor authentication disabled");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Invalid code";
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={card}>
      <div style={cardHeader}>
        <Smartphone size={14} color="#555" />
        <p style={cardHeaderLabel}>{t("settings_page.security.totp_title")}</p>
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 700,
          color: enabled ? "#22c55e" : "#555",
          background: enabled ? "#0d2010" : "#141414",
          border: `1px solid ${enabled ? "#1a4020" : "#222"}`,
          borderRadius: 20, padding: "3px 10px",
        }}>
          {enabled ? t("settings_page.security.totp_desc_enabled").substring(0,0) || "ENABLED" : t("settings_page.security.totp_desc_disabled").substring(0,0) || "DISABLED"}
        </span>
      </div>
      <div style={cardBody}>

        {/* Idle state */}
        {phase === "idle" && (
          <>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666", lineHeight: 1.6 }}>
              {enabled
                ? t("settings_page.security.totp_desc_enabled")
                : t("settings_page.security.totp_desc_disabled")}
            </p>
            {enabled ? (
              <button onClick={() => { setPhase("disable"); setCode(""); }} style={dangerBtn}>
                <XCircle size={14} /> {t("settings_page.security.totp_disable_btn")}
              </button>
            ) : (
              <button onClick={handleSetup} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>
                {loading ? <><RefreshCw size={14} /> {t("settings_page.profile.saving")}</> : <><Shield size={14} /> {t("settings_page.security.totp_enable_btn")}</>}
              </button>
            )}
          </>
        )}

        {/* Setup: show QR code */}
        {phase === "setup" && (
          <div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#666", lineHeight: 1.6 }}>
              {t("settings_page.security.totp_setup_desc")}
            </p>
            <div style={{
              background: "#fff", borderRadius: 12, padding: 12,
              display: "inline-block", marginBottom: 16,
              boxShadow: "0 0 0 1px #333",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUri} alt="2FA QR Code" style={{ display: "block", width: 180, height: 180 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "#444", fontWeight: 600 }}>
                {t("settings_page.security.totp_cant_scan") || "CAN'T SCAN? ENTER THIS KEY MANUALLY:"}
              </p>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#0d0d0d", border: "1px solid #222", borderRadius: 8, padding: "9px 12px",
              }}>
                <code style={{ flex: 1, fontSize: 12, color: "#e0e0e0", letterSpacing: "0.1em", fontFamily: "monospace", wordBreak: "break-all" }}>
                  {secret}
                </code>
                <button onClick={copySecret} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22c55e" : "#555", padding: 0, display: "flex" }}>
                  {copied ? <CheckCircle size={14} color="#22c55e" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>{t("settings_page.security.totp_code_label") || "Verification Code"}</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                style={{
                  ...fieldInput, padding: "13px 16px",
                  fontSize: 22, letterSpacing: "0.4em",
                  textAlign: "center", fontFamily: "monospace",
                }}
                placeholder={t("settings_page.security.totp_code_placeholder")}
                onFocus={e => (e.currentTarget.style.borderColor = "#f97316")}
                onBlur={e => (e.currentTarget.style.borderColor = "#222")}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleEnable} disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>
                {loading ? <><RefreshCw size={14} /> {t("settings_page.profile.saving")}</> : <><CheckCircle size={14} /> {t("settings_page.security.totp_verify_btn")}</>}
              </button>
              <button onClick={() => { setPhase("idle"); setCode(""); }} style={ghostBtn}>
                {t("settings_page.security.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        )}

        {/* Disable: confirm with current code */}
        {phase === "disable" && (
          <div>
            <div style={{
              background: "#1a0c0c", border: "1px solid #3a1a1a",
              borderRadius: 9, padding: "12px 14px", marginBottom: 16,
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <AlertTriangle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, color: "#c0603a", lineHeight: 1.6 }}>
                {t("settings_page.security.totp_disable_warning") || "Disabling 2FA makes your account less secure. Enter your current authenticator code to confirm."}
              </p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={fieldLabel}>{t("settings_page.security.totp_current_code_label") || "Current Authenticator Code"}</label>
              <input
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                style={{
                  ...fieldInput, padding: "13px 16px",
                  fontSize: 22, letterSpacing: "0.4em",
                  textAlign: "center", fontFamily: "monospace",
                }}
                placeholder={t("settings_page.security.totp_code_placeholder")}
                onFocus={e => (e.currentTarget.style.borderColor = "#ef4444")}
                onBlur={e => (e.currentTarget.style.borderColor = "#222")}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={handleDisable} disabled={loading} style={{ ...dangerBtn, background: "#ef44440d", opacity: loading ? 0.6 : 1 }}>
                {loading ? <><RefreshCw size={14} /> {t("settings_page.profile.saving")}</> : <><XCircle size={14} /> {t("settings_page.security.totp_disable_btn")}</>}
              </button>
              <button onClick={() => { setPhase("idle"); setCode(""); }} style={ghostBtn}>
                {t("settings_page.security.cancel") || "Cancel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Active sessions note ────────────────────────────────────────────────── */

function ActiveSessionsSection() {
  const { t } = useLanguage();
  return (
    <div style={card}>
      <div style={cardHeader}>
        <Info size={14} color="#555" />
        <p style={cardHeaderLabel}>{t("settings_page.security.active_sessions_title")}</p>
      </div>
      <div style={cardBody}>
        <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.6 }}>
          {t("settings_page.security.active_sessions_desc") || "Every time you sign in, a security alert is sent to your registered email address. This helps you detect unauthorized access to your account."}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   NOTIFICATIONS TAB
═══════════════════════════════════════════════════════════════════════════ */

function NotificationsTab({ role, success }: { role: string; success: (m: string) => void }) {
  const { t } = useLanguage();
  const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const isEmployer = role === "EMPLOYER";

  const toggle = useCallback((key: keyof NotifPrefs) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveNotifPrefs(next);
      success(t("settings_page.notifications.save_success") || "Preferences saved successfully");
      return next;
    });
  }, [success, t]);

  const workerItems: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: "emailJobAlerts",            label: t("settings_page.notifications.job_alerts") || "New Job Alerts",          desc: t("settings_page.notifications.job_alerts_desc") || "Notify me when new jobs matching my skills are posted" },
    { key: "emailApplicationUpdates",   label: t("settings_page.notifications.app_updates") || "Application Updates",     desc: t("settings_page.notifications.app_updates_desc") || "Email when my application status changes (accepted / rejected)" },
    { key: "emailPaymentNotifications", label: t("settings_page.notifications.payment") || "Payment Notifications",   desc: t("settings_page.notifications.payment_desc") || "Earning confirmations and wallet payouts" },
    { key: "emailLoginAlerts",          label: t("settings_page.notifications.login_alerts") || "Login Alerts",            desc: t("settings_page.notifications.login_alerts_desc") || "Security email when a new device signs in to my account" },
  ];

  const employerItems: { key: keyof NotifPrefs; label: string; desc: string }[] = [
    { key: "emailNewApplications",      label: t("settings_page.notifications.new_apps") || "New Applications",        desc: t("settings_page.notifications.new_apps_desc") || "Alert when a worker applies to one of my job postings" },
    { key: "emailApplicationUpdates",   label: t("settings_page.notifications.app_status") || "Application Status",      desc: t("settings_page.notifications.app_status_desc") || "Confirmation emails when I accept or reject applicants" },
    { key: "emailPaymentNotifications", label: t("settings_page.notifications.payment") || "Payment Notifications",   desc: t("settings_page.notifications.payment_employer_desc") || "Wallet top-ups, job payment holds, and releases" },
    { key: "emailLoginAlerts",          label: t("settings_page.notifications.login_alerts") || "Login Alerts",            desc: t("settings_page.notifications.login_alerts_desc") || "Security email when a new device signs in to my account" },
  ];

  const items = isEmployer ? employerItems : workerItems;

  return (
    <div style={card}>
      <div style={cardHeader}>
        <Bell size={14} color="#555" />
        <p style={cardHeaderLabel}>{t("settings_page.notifications.title")}</p>
      </div>
      <div style={{ padding: "8px 0" }}>
        {items.map((item, i) => (
          <div
            key={item.key}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: i < items.length - 1 ? "1px solid #161616" : "none",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#ccc" }}>{item.label}</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#444" }}>{item.desc}</p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, display: "flex" }}
            >
              {prefs[item.key]
                ? <ToggleRight size={32} color="#f97316" />
                : <ToggleLeft size={32} color="#333" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCOUNT TAB
═══════════════════════════════════════════════════════════════════════════ */

function AccountTab({
  session, roleLabel,
}: {
  session: NonNullable<ReturnType<typeof useSession>>;
  roleLabel: string;
}) {
  const { t, language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const isWorker = session.role === "WORKER";

  const profileUrl = isWorker
    ? (typeof window !== "undefined" ? `${window.location.origin}/browse/${session.id}` : `/browse/${session.id}`)
    : null;

  const dateLocaleMap: Record<string, string> = {
    rw: "rw-RW",
    kinyy: "rw-RW",
    sw: "sw-TZ",
    fr: "fr-FR",
    en: "en-US",
  };
  const currentLocale = dateLocaleMap[language] || "en-RW";

  const joinedDate = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString(currentLocale, { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const rows: { label: string; value: string }[] = [
    { label: t("settings_page.account.role"), value: roleLabel },
    { label: t("settings_page.profile.email"), value: session.email },
    { label: "Role", value: session.role },
    { label: t("settings_page.account.member_since"), value: joinedDate },
    { label: t("settings_page.account.status"), value: session.emailVerified ? t("settings_page.account.verified") : t("settings_page.account.not_verified") },
    { label: "2FA", value: session.totpEnabled ? "Enabled" : "Disabled" },
  ];

  const handleCopy = () => {
    if (!profileUrl) return;
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleShare = async () => {
    if (!profileUrl) return;
    if (navigator.share) {
      await navigator.share({ title: `${session.name} — MpahMapu`, url: profileUrl }).catch(() => {});
    } else {
      handleCopy();
    }
  };

  return (
    <>
      {/* Profile link card — workers only */}
      {isWorker && profileUrl && (
        <div style={card}>
          <div style={cardHeader}>
            <User size={14} color="#555" />
            <p style={cardHeaderLabel}>{t("settings_page.account.public_profile") || "Public Profile"}</p>
          </div>
          <div style={cardBody}>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              {t("settings_page.account.public_profile_desc") || "This is your public profile link. Employers can view your skills, location, and availability here."}
            </p>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#0d0d0d", border: "1px solid #222", borderRadius: 9,
              padding: "10px 14px", marginBottom: 14,
            }}>
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1, fontSize: 13, color: "#f97316", textDecoration: "none",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontFamily: "monospace",
                }}
              >
                {profileUrl}
              </a>
              <button
                onClick={handleCopy}
                title="Copy link"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: copied ? "#22c55e" : "#555", flexShrink: 0 }}
              >
                {copied ? <CheckCircle size={16} color="#22c55e" /> : <Copy size={16} />}
              </button>
              <button
                onClick={handleShare}
                title="Share profile"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: "#555", flexShrink: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ghostBtn, textDecoration: "none", fontSize: 12 }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                {t("settings_page.account.view_profile_btn") || "View Public Profile"}
              </a>
              <button
                onClick={handleCopy}
                style={{ ...primaryBtn, fontSize: 12, opacity: copied ? 1 : 1, background: copied ? "#22c55e" : "#f97316" }}
              >
                {copied ? <><CheckCircle size={13} /> {t("settings_page.profile.saved") || "Copied!"}</> : <><Copy size={13} /> {t("settings_page.account.copy_link_btn") || "Copy Link"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account info grid */}
      <div style={card}>
        <div style={cardHeader}>
          <Info size={14} color="#555" />
          <p style={cardHeaderLabel}>{t("settings_page.account.title")}</p>
        </div>
        <div className="responsive-grid-2" style={{ padding: "8px 0" }}>
          {rows.map((r, i) => (
            <div
              key={r.label}
              className="account-row"
              style={{
                display: "flex", flexDirection: "column", gap: 4,
                padding: "14px 20px",
                borderBottom: "1px solid #141414",
                borderRight: i % 2 === 0 ? "1px solid #141414" : "none",
              }}
            >
              <span style={{ fontSize: 11, color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Worker Badge card */}
      {isWorker && session.badgeId && session.badgeUrl && (
        <div style={card}>
          <div style={cardHeader}>
            <Shield size={14} color="#555" />
            <p style={cardHeaderLabel}>{t("settings_page.account.verification_badge_title")}</p>
          </div>
          <div style={{ ...cardBody, display: "flex", alignItems: "center", gap: 20 }}>
            {session.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.photoUrl} alt="Badge Photo" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(249,115,22,0.3)" }} />
            )}
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "#aaa" }}>
                {t("settings_page.account.badge_verified_id_prefix") || "Your verified worker badge ID is "} <strong style={{ color: "#f97316" }}>{session.badgeId}</strong>.
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#666" }}>
                {t("settings_page.account.badge_verified_hint") || "You can use this badge to identify yourself to employers."}
              </p>
              <a
                href={session.badgeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...primaryBtn, fontSize: 12, padding: "8px 16px" }}
              >
                View / Download PDF
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Worker Badge card (Missing) */}
      {isWorker && !session.badgeId && (
        <div style={card}>
          <div style={cardHeader}>
            <Shield size={14} color="#555" />
            <p style={cardHeaderLabel}>{t("settings_page.account.verification_badge_title")}</p>
          </div>
          <div style={{ ...cardBody, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#222", border: "2px dashed #444", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={24} color="#555" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "#aaa" }}>
                {t("settings_page.account.badge_not_verified_desc") || "You don't have a verified worker badge yet."}
              </p>
              <p style={{ margin: "0 0 14px", fontSize: 12, color: "#666" }}>
                {t("settings_page.account.badge_not_verified_hint") || "A badge helps you stand out and builds trust with employers."}
              </p>
              <button
                onClick={() => setShowWizard(true)}
                style={{ ...primaryBtn, fontSize: 12, padding: "8px 16px" }}
              >
                {t("settings_page.account.request_badge_btn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showWizard && (
        <BadgeSubmissionWizard
          authResult={{ user: { ...session, ...readStoredUser() } as any, accessToken: getToken(), refreshToken: "", tokenType: "Bearer", requires2fa: false }}
          onComplete={() => {
            setShowWizard(false);
            window.location.reload();
          }}
        />
      )}

      {/* Danger zone */}
      <div style={{ ...card, border: "1px solid #2a1111" }}>
        <div style={{ ...cardHeader, borderBottom: "1px solid #2a1111" }}>
          <AlertTriangle size={14} color="#ef4444" />
          <p style={{ ...cardHeaderLabel, color: "#7a2020" }}>{t("settings_page.account.danger_zone") || "Danger Zone"}</p>
        </div>
        <div style={cardBody}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#c0603a" }}>{t("settings_page.account.delete_account") || "Delete Account"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                {t("settings_page.account.delete_account_desc") || "Permanently deletes your account and all associated data. This cannot be undone."}
              </p>
            </div>
            <button
              disabled
              title="Account deletion is not yet available. Contact support."
              style={{ ...dangerBtn, opacity: 0.45, cursor: "not-allowed", whiteSpace: "nowrap" }}
            >
              <AlertTriangle size={13} /> {t("settings_page.account.delete_account") || "Delete Account"}
            </button>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "#3a3a3a" }}>
            {t("settings_page.account.delete_account_hint") || "To delete your account, please contact support at info@mpahmapu.com"}
          </p>
        </div>
      </div>
    </>
  );
}
