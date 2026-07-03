"use client";

import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { OnboardingData, submitOnboarding, verifyEmailCode, resendOtpCode, AuthResult, getJobCategories, JobCategoryMeta, Address, AccountType } from "@/lib/api";
import { AddressPicker, isAddressComplete } from "@/components/ui/address-picker";
import { useToast } from "@/components/ui/toast";

type Step = "ROLE_SELECT" | "EMAIL_VERIFY" | "ACCOUNT_TYPE" | "PERSONAL" | "LOCATION_AVAILABILITY" | "EQUIPMENT" | "COMPLETED";

const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string; desc: string }[] = [
  { value: "INDIVIDUAL", label: "Individual", icon: "🧍", desc: "Just me, working solo" },
  { value: "TEAM",       label: "Team",       icon: "👥", desc: "A group of workers" },
  { value: "COMPANY",    label: "Company",    icon: "🏢", desc: "A registered company" },
  { value: "CREW",       label: "Crew",       icon: "🛠️", desc: "A working crew" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  email: string;
  authResult: AuthResult | null;
  isLogin?: boolean;
  showRoleSelect?: boolean;
  onComplete: () => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

const EDUCATION_OPTIONS = [
  "None",
  "Primary School",
  "High School",
  "Diploma / Certificate",
  "Bachelor's Degree",
  "Master's Degree or Higher",
];

const EQUIPMENT_SUGGESTIONS = [
  "Smartphone", "Laptop", "Internet Connection",
  "Safety Gear", "Vehicle", "Power Tools", "Camera", "Tablet",
];

const STEP_NUMBER: Partial<Record<Step, string>> = {
  PERSONAL: "Step 1",
  LOCATION_AVAILABILITY: "Step 2",
  EQUIPMENT: "Step 3",
};

function capitalize(str: string) {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function RegistrationWizard({ email, authResult, isLogin, showRoleSelect, onComplete }: Props) {
  const { error: toastError, success: toastSuccess } = useToast();
  const [step, setStep] = useState<Step>(showRoleSelect ? "ROLE_SELECT" : "EMAIL_VERIFY");
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"WORKER" | "EMPLOYER">(
    (authResult?.user?.role as "WORKER" | "EMPLOYER") || "WORKER"
  );

  const [verifyCode, setVerifyCode] = useState("");
  const [categories, setCategories] = useState<JobCategoryMeta[]>([]);
  const [catSearch, setCatSearch] = useState("");

  // Account identifier
  const [accountType, setAccountType] = useState<AccountType>("INDIVIDUAL");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [tin, setTin] = useState("");
  const memberRef = useRef<HTMLInputElement>(null);
  const isGroup = accountType !== "INDIVIDUAL";

  // Personal
  const [dob, setDob] = useState("");
  const [education, setEducation] = useState("");
  const [experience, setExperience] = useState("");

  // Location + Availability
  const [address, setAddress] = useState<Address | null>(null);
  const [availability, setAvailability] = useState<string[]>([]);

  // Equipment
  const [equipment, setEquipment] = useState<string[]>([]);
  const [equipInput, setEquipInput] = useState("");
  const equipRef = useRef<HTMLInputElement>(null);

  const DRAFT_KEY = `MpahMapu_draft_reg_${email}`;

  // Restore in-progress draft (runs before authResult effect so server data wins)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.dob)          setDob(d.dob);
      if (d.education)    setEducation(d.education);
      if (d.experience)   setExperience(d.experience);
      if (d.address)      setAddress(d.address);
      if (d.availability) setAvailability(d.availability);
      if (d.equipment)    setEquipment(d.equipment);
      if (d.accountType)  setAccountType(d.accountType);
      if (d.memberEmails) setMemberEmails(d.memberEmails);
      if (d.tin)          setTin(d.tin);
    } catch {}
  }, []);

  // Save draft on any field change
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        dob, education, experience, address, availability, equipment,
        accountType, memberEmails, tin,
      }));
    } catch {}
  }, [dob, education, experience, address, availability, equipment, accountType, memberEmails, tin]);

  // Calculate initial step and state
  useEffect(() => {
    if (authResult?.user) {
      const u = authResult.user;

      // Populate fields if they exist
      if (u.dob) setDob(u.dob);
      if (u.educationLevel) setEducation(u.educationLevel);
      if (u.experienceType) setExperience(u.experienceType);

      if (u.location && typeof u.location === "object" && (u.location as Address).country) {
        setAddress(u.location as Address);
      }

      if (u.availability && Array.isArray(u.availability)) {
        const shortDays = u.availability.map((fullDay: string) =>
          Object.keys(FULL_DAYS).find(key => FULL_DAYS[key] === fullDay) || fullDay
        );
        setAvailability(shortDays);
      }

      if (u.equipment && Array.isArray(u.equipment)) {
        setEquipment(u.equipment.map((e: any) => e.name));
      }

      if (u.accountType) setAccountType(u.accountType as AccountType);
      if (u.tin) setTin(u.tin);
      if (u.teamMembers && Array.isArray(u.teamMembers)) setMemberEmails(u.teamMembers);

      // Role select overrides everything — always start there when requested
      if (showRoleSelect) {
        setStep("ROLE_SELECT");
      } else if (!u.emailVerified && !isLogin) {
        setStep("EMAIL_VERIFY");
      } else if (!u.dob || !u.educationLevel || !u.experienceType) {
        setStep("ACCOUNT_TYPE");
        getJobCategories().then(setCategories).catch(console.error);
      } else if (!u.location || !u.availability || u.availability.length === 0) {
        setStep("LOCATION_AVAILABILITY");
        getJobCategories().then(setCategories).catch(console.error);
      } else if (!u.equipment || u.equipment.length === 0) {
        setStep("EQUIPMENT");
      }
    }
  }, [authResult]);

  const handleRoleSelectContinue = async () => {
    if (selectedRole === "EMPLOYER") {
      // Employers don't need personal/equipment details — submit role and finish
      await handleSubmit();
      return;
    }
    const u = authResult?.user;
    if (!u?.emailVerified && !isLogin) {
      setStep("EMAIL_VERIFY");
    } else {
      setStep("ACCOUNT_TYPE");
      getJobCategories().then(setCategories).catch(console.error);
    }
  };

  const toggleDay = (day: string) => {
    setAvailability((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const addEquipment = (value: string) => {
    const trimmed = capitalize(value.trim().replace(/,/g, ""));
    if (trimmed && !equipment.includes(trimmed)) {
      setEquipment((prev) => [...prev, trimmed]);
    }
    setEquipInput("");
  };

  const handleEquipKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEquipment(equipInput);
    } else if (e.key === "Backspace" && equipInput === "" && equipment.length > 0) {
      setEquipment((prev) => prev.slice(0, -1));
    }
  };

  const addMemberEmail = (value: string) => {
    const v = value.trim().replace(/,/g, "").toLowerCase();
    if (!v) { setMemberInput(""); return; }
    if (!EMAIL_RE.test(v)) {
      toastError("Enter a valid email address.", { title: "Invalid Email" });
      return;
    }
    if (!memberEmails.includes(v)) setMemberEmails((prev) => [...prev, v]);
    setMemberInput("");
  };

  const handleMemberKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addMemberEmail(memberInput);
    } else if (e.key === "Backspace" && memberInput === "" && memberEmails.length > 0) {
      setMemberEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleAccountTypeContinue = () => {
    setStep("PERSONAL");
    getJobCategories().then(setCategories).catch(console.error);
  };

  const handleVerifyEmail = async () => {
    if (!verifyCode || verifyCode.length < 4) {
      toastError("Please enter a valid code.", { title: "Verification Failed" });
      return;
    }
    setLoading(true);
    try {
      await verifyEmailCode(email, verifyCode);
      setStep("ACCOUNT_TYPE");
      // Load categories
      getJobCategories().then(setCategories).catch(console.error);
    } catch (e: any) {
      toastError(e?.response?.data?.message || "Invalid OTP code. Please try again.", { title: "Verification Failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setVerifyCode("");
    try {
      await resendOtpCode(email);
      toastSuccess("A new code has been sent to your email.", { title: "Code Sent" });
    } catch (e: any) {
      toastError(e?.response?.data?.message || "Failed to resend OTP. Please try again.", { title: "Resend Failed" });
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalSubmit = () => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      toastError("You must be at least 18 years old to register.", { title: "Age Restriction" });
      return;
    }
    setStep("LOCATION_AVAILABILITY");
  };

  const handleSubmit = async () => {
    setLoading(true);
    const payload: OnboardingData = {
      role: showRoleSelect ? selectedRole : undefined,
      dob,
      educationLevel: education,
      experienceType: experience,
      accountType,
      tin: isGroup && tin.trim() ? tin.trim() : undefined,
      teamMembers: isGroup ? memberEmails : [],
      location: address ?? { country: "Rwanda" },
      equipment: equipment.map((name) => ({ name, available: true })),
      availability: availability.map((d) => FULL_DAYS[d]),
    };
    try {
      const updatedUser = await submitOnboarding(payload, authResult?.accessToken || "");
      if (authResult) {
        authResult.user = updatedUser;
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setStep("COMPLETED");
      setTimeout(onComplete, 1500);
    } catch (e: any) {
      toastError(e?.response?.data?.message || "Failed to submit onboarding data.", { title: "Setup Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#2a2a2a] flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">
              {step === "ROLE_SELECT" && "How will you use MpahMapu?"}
              {step === "EMAIL_VERIFY" && "Verify your email"}
              {step === "ACCOUNT_TYPE" && "Who's registering?"}
              {step === "PERSONAL" && "About you"}
              {step === "LOCATION_AVAILABILITY" && "Where & when"}
              {step === "EQUIPMENT" && "Your equipment"}
              {step === "COMPLETED" && "All set!"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "ROLE_SELECT" && "Choose your account type to get started"}
              {step === "EMAIL_VERIFY" && `Enter the code we sent to ${email}`}
              {step === "ACCOUNT_TYPE" && "Register on your own or as a team"}
              {step === "PERSONAL" && "A few quick details about your background"}
              {step === "LOCATION_AVAILABILITY" && "Tell us where you're based and when you're free"}
              {step === "EQUIPMENT" && "List tools or devices you have access to"}
              {step === "COMPLETED" && "Taking you to your dashboard…"}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh] space-y-6">
          {/* ── Role Select ── */}
          {step === "ROLE_SELECT" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["WORKER", "EMPLOYER"] as const).map((r) => {
                  const active = selectedRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={`flex flex-col items-center justify-center gap-3 rounded-xl border p-5 transition-all ${
                        active
                          ? "bg-[#f97316]/10 border-[#f97316]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] hover:border-gray-500"
                      }`}
                    >
                      <span className="text-3xl">{r === "WORKER" ? "👷" : "🏢"}</span>
                      <div className="text-center">
                        <p className={`text-sm font-bold ${active ? "text-[#f97316]" : "text-white"}`}>
                          {r === "WORKER" ? "Find Work" : "Hire Workers"}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {r === "WORKER" ? "Browse & apply for jobs" : "Post jobs & hire talent"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleRoleSelectContinue}
                disabled={loading}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors mt-2 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Continue as {selectedRole === "WORKER" ? "Job Seeker" : "Employer"}
              </button>
            </div>
          )}

          {/* ── OTP ── */}
          {step === "EMAIL_VERIFY" && (
            <div className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors text-center tracking-[0.4em] font-mono"
                maxLength={6}
              />
              <button
                onClick={handleVerifyEmail}
                disabled={loading || verifyCode.length < 4}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Verify & Continue
              </button>
              <p className="text-center text-xs text-gray-600">
                Didn't receive it?{" "}
                <button
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-[#f97316] hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </p>
            </div>
          )}

          {/* ── Account identifier ── */}
          {step === "ACCOUNT_TYPE" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {ACCOUNT_TYPES.map((t) => {
                  const active = accountType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAccountType(t.value)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                        active ? "bg-[#f97316]/10 border-[#f97316]" : "bg-[#1a1a1a] border-[#2a2a2a] hover:border-gray-500"
                      }`}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <div>
                        <p className={`text-sm font-bold ${active ? "text-[#f97316]" : "text-white"}`}>{t.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isGroup && (
                <div className="space-y-4 border-t border-[#2a2a2a] pt-4">
                  {/* Member emails */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      Member emails
                      {memberEmails.length > 0 && (
                        <span className="text-gray-500 normal-case font-normal"> · {memberEmails.length} member{memberEmails.length > 1 ? "s" : ""}</span>
                      )}
                    </label>
                    <div
                      className="min-h-[64px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex flex-wrap gap-2 cursor-text focus-within:border-[#f97316] transition-colors"
                      onClick={() => memberRef.current?.focus()}
                    >
                      {memberEmails.map((m) => (
                        <span key={m} className="flex items-center gap-1 bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-medium px-2.5 py-1 rounded-lg">
                          {m}
                          <button
                            onClick={(e) => { e.stopPropagation(); setMemberEmails((prev) => prev.filter((i) => i !== m)); }}
                            className="hover:text-white transition-colors ml-0.5"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                      <input
                        ref={memberRef}
                        type="email"
                        value={memberInput}
                        onChange={(e) => setMemberInput(e.target.value)}
                        onKeyDown={handleMemberKeyDown}
                        onBlur={() => memberInput.trim() && addMemberEmail(memberInput)}
                        placeholder={memberEmails.length === 0 ? "Type an email and press Enter…" : ""}
                        className="flex-1 min-w-[160px] bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      We'll email each member that they've been added. They receive notifications only — no dashboard access — and can still register their own account later.
                    </p>
                  </div>

                  {/* Optional TIN */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      TIN number <span className="text-gray-600 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={tin}
                      onChange={(e) => setTin(e.target.value)}
                      placeholder="Tax ID — leave blank to skip"
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleAccountTypeContinue}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 1: Personal ── */}
          {step === "PERSONAL" && (
            <div className="space-y-4">
              {/* DOB */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              {/* Education — not applicable to companies */}
              {accountType !== "COMPANY" && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Education Level
                </label>
                <div className="flex flex-wrap gap-2">
                  {EDUCATION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setEducation(opt)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        education === opt
                          ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Experience */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Work Category
                </label>
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#f97316] transition-colors mb-3"
                />
                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto">
                  {categories
                    .filter((c) =>
                      c.displayName.toLowerCase().includes(catSearch.toLowerCase()) ||
                      (c.nameKinyarwanda && c.nameKinyarwanda.toLowerCase().includes(catSearch.toLowerCase()))
                    )
                    .map((opt) => (
                    <button
                      key={opt.slug}
                      onClick={() => setExperience(opt.slug)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all text-left ${
                        experience === opt.slug
                          ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      <div className="font-bold">{opt.displayName}</div>
                      {opt.nameKinyarwanda && <div className="text-[10px] opacity-70 mt-0.5">{opt.nameKinyarwanda}</div>}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <span className="text-xs text-gray-500">Loading categories...</span>
                  )}
                </div>
              </div>

              <button
                onClick={handlePersonalSubmit}
                disabled={!dob || (accountType !== "COMPANY" && !education) || !experience}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors mt-2"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 2: Location + Availability ── */}
          {step === "LOCATION_AVAILABILITY" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Your Location
                </label>
                <AddressPicker value={address} onChange={setAddress} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                  Weekly Availability
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map((day) => {
                    const active = availability.includes(day);
                    return (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`py-2 text-[11px] font-bold rounded-lg border transition-all ${
                          active
                            ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                            : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-gray-500"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                {availability.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-2">
                    {availability.length} day{availability.length > 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              <button
                onClick={() => setStep("EQUIPMENT")}
                disabled={!isAddressComplete(address) || availability.length === 0}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {/* ── Step 3: Equipment ── */}
          {step === "EQUIPMENT" && (
            <div className="space-y-4">
              {/* Tag input */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  Equipment & Tools
                </label>
                <div
                  className="min-h-[80px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 flex flex-wrap gap-2 cursor-text focus-within:border-[#f97316] transition-colors"
                  onClick={() => equipRef.current?.focus()}
                >
                  {equipment.map((item) => (
                    <span
                      key={item}
                      className="flex items-center gap-1 bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-medium px-2.5 py-1 rounded-lg"
                    >
                      {item}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEquipment((prev) => prev.filter((i) => i !== item));
                        }}
                        className="hover:text-white transition-colors ml-0.5"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <input
                    ref={equipRef}
                    value={equipInput}
                    onChange={(e) => setEquipInput(e.target.value)}
                    onKeyDown={handleEquipKeyDown}
                    onBlur={() => equipInput.trim() && addEquipment(equipInput)}
                    placeholder={equipment.length === 0 ? "Type and press Enter to add…" : ""}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Press <kbd className="bg-[#2a2a2a] px-1 rounded text-gray-400">Enter</kbd> or{" "}
                  <kbd className="bg-[#2a2a2a] px-1 rounded text-gray-400">,</kbd> to add each item
                </p>
              </div>

              {/* Quick suggestions */}
              <div>
                <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wide font-semibold">
                  Common suggestions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_SUGGESTIONS.filter((s) => !equipment.includes(s)).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEquipment((prev) => [...prev, s])}
                      className="px-2.5 py-1 text-xs text-gray-400 border border-[#2a2a2a] rounded-lg hover:border-gray-500 hover:text-gray-200 transition-colors bg-[#1a1a1a]"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                Complete Setup
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* ── Done ── */}
          {step === "COMPLETED" && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="text-white font-bold text-lg">You're all set!</h3>
              <p className="text-gray-500 text-xs mt-1">Setting up your dashboard…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}