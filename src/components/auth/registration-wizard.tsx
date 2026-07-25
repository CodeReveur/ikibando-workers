"use client";

import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { OnboardingData, submitOnboarding, verifyEmailCode, resendOtpCode, AuthResult, getJobCategories, JobCategoryMeta, Address, AccountType } from "@/lib/api";
import { AddressPicker, isAddressComplete } from "@/components/ui/address-picker";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/lib/language-context";
import { BadgeSubmissionWizard } from "./badge-submission-wizard";

type Step = "ROLE_SELECT" | "EMAIL_VERIFY" | "ACCOUNT_TYPE" | "EMPLOYER_DETAILS" | "PERSONAL" | "LOCATION_AVAILABILITY" | "EQUIPMENT" | "BADGE_OFFER" | "COMPLETED";

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
  /**
   * Manual (email/password) signups run in "slide" mode: a continuous flow with
   * a progress bar (no step markers), sliding transitions, and a silent
   * per-step save to the server so nothing is lost and the account resumes where
   * it left off. Google signups keep the normal wizard (slideMode falsy).
   */
  slideMode?: boolean;
  onComplete: () => void;
}

/**
 * Canonical step order for the slide-mode progress bar. In slide mode email
 * verification happens near the END (at/after the location step) and the badge
 * offer is last, so the order here reflects that for a monotonic progress %.
 */
const PROGRESS_STEPS: Step[] = [
  "ROLE_SELECT", "ACCOUNT_TYPE", "EMPLOYER_DETAILS", "PERSONAL",
  "LOCATION_AVAILABILITY", "EQUIPMENT", "EMAIL_VERIFY", "BADGE_OFFER", "COMPLETED",
];

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

// Data-collection steps that are safe to resume a draft into (prerequisites -
// role selection and email verification - already satisfied).
const DATA_STEPS: Step[] = ["ACCOUNT_TYPE", "EMPLOYER_DETAILS", "PERSONAL", "LOCATION_AVAILABILITY", "EQUIPMENT"];

function capitalize(str: string) {
  return str
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function RegistrationWizard({ email, authResult, isLogin, showRoleSelect, slideMode, onComplete }: Props) {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  const [step, setStep] = useState<Step>(showRoleSelect ? "ROLE_SELECT" : "EMAIL_VERIFY");
  const [loading, setLoading] = useState(false);
  // Slide mode defers email verification to the end and offers a badge last.
  const [emailVerified, setEmailVerified] = useState<boolean>(!!authResult?.user?.emailVerified);
  const [showBadge, setShowBadge] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"WORKER" | "EMPLOYER">(
    (authResult?.user?.role as "WORKER" | "EMPLOYER") || "WORKER"
  );

  const ACCOUNT_TYPES_LOCALIZED = [
    { value: "INDIVIDUAL" as AccountType, label: t("onboarding.account_types.individual.label") || "Individual", icon: "🧍", desc: t("onboarding.account_types.individual.desc") || "Just me, working solo" },
    { value: "TEAM" as AccountType,       label: t("onboarding.account_types.team.label") || "Team",       icon: "👥", desc: t("onboarding.account_types.team.desc") || "A group of workers" },
    { value: "COMPANY" as AccountType,    label: t("onboarding.account_types.company.label") || "Company",    icon: "🏢", desc: t("onboarding.account_types.company.desc") || "A registered company" },
    { value: "CREW" as AccountType,       label: t("onboarding.account_types.crew.label") || "Crew",       icon: "🛠️", desc: t("onboarding.account_types.crew.desc") || "A working crew" },
  ];

  const DAYS_LOCALIZED = [
    { value: "Mon", label: t("common.days.mon") || "Mon" },
    { value: "Tue", label: t("common.days.tue") || "Tue" },
    { value: "Wed", label: t("common.days.wed") || "Wed" },
    { value: "Thu", label: t("common.days.thu") || "Thu" },
    { value: "Fri", label: t("common.days.fri") || "Fri" },
    { value: "Sat", label: t("common.days.sat") || "Sat" },
    { value: "Sun", label: t("common.days.sun") || "Sun" },
  ];

  const EDUCATION_OPTIONS_LOCALIZED = [
    t("onboarding.education.none") || "None",
    t("onboarding.education.primary") || "Primary School",
    t("onboarding.education.high_school") || "High School",
    t("onboarding.education.diploma") || "Diploma / Certificate",
    t("onboarding.education.bachelors") || "Bachelor's Degree",
    t("onboarding.education.masters") || "Master's Degree or Higher",
  ];

  const EQUIPMENT_SUGGESTIONS_LOCALIZED = [
    t("onboarding.equipment_suggestions.smartphone") || "Smartphone",
    t("onboarding.equipment_suggestions.laptop") || "Laptop",
    t("onboarding.equipment_suggestions.internet") || "Internet Connection",
    t("onboarding.equipment_suggestions.safety_gear") || "Safety Gear",
    t("onboarding.equipment_suggestions.vehicle") || "Vehicle",
    t("onboarding.equipment_suggestions.power_tools") || "Power Tools",
    t("onboarding.equipment_suggestions.camera") || "Camera",
    t("onboarding.equipment_suggestions.tablet") || "Tablet",
  ];

  const STEP_NUMBER_LOCALIZED: Record<string, string> = {
    PERSONAL: t("onboarding.steps.step1") || "Step 1",
    LOCATION_AVAILABILITY: t("onboarding.steps.step2") || "Step 2",
    EQUIPMENT: t("onboarding.steps.step3") || "Step 3",
  };

  const [verifyCode, setVerifyCode] = useState("");
  const [categories, setCategories] = useState<JobCategoryMeta[]>([]);
  const [catSearch, setCatSearch] = useState("");

  // Account identifier
  const [accountType, setAccountType] = useState<AccountType>("INDIVIDUAL");
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [memberInput, setMemberInput] = useState("");
  const [tin, setTin] = useState("");
  const memberRef = useRef<HTMLInputElement>(null);
  const isEmployer = selectedRole === "EMPLOYER";
  const isGroup = accountType !== "INDIVIDUAL";
  // Employers register only as a Company or Individual (no teams/crews).
  const typeOptions = isEmployer
    ? ACCOUNT_TYPES_LOCALIZED.filter((t) => t.value === "INDIVIDUAL" || t.value === "COMPANY")
    : ACCOUNT_TYPES_LOCALIZED;

  // Keep the account identifier valid when switching to the employer role.
  useEffect(() => {
    if (isEmployer && accountType !== "INDIVIDUAL" && accountType !== "COMPANY") {
      setAccountType("INDIVIDUAL");
    }
  }, [isEmployer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Personal
  const [dob, setDob] = useState("");
  const [education, setEducation] = useState("");
  // A worker can practise several fields - multiple categories may be selected.
  const [experiences, setExperiences] = useState<string[]>([]);
  const toggleExperience = (slug: string) =>
    setExperiences(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]);

  // Location + Availability
  const [address, setAddress] = useState<Address | null>(null);
  const [availability, setAvailability] = useState<string[]>([]);

  // Equipment
  const [equipment, setEquipment] = useState<string[]>([]);
  const [equipInput, setEquipInput] = useState("");
  const equipRef = useRef<HTMLInputElement>(null);

  const DRAFT_KEY = `MpahMapu_draft_reg_${email}`;

  // The step captured from a restored draft, applied by the authResult effect.
  const draftStepRef = useRef<Step | null>(null);
  // Blocks the autosave effect from writing until the draft has been restored,
  // so the initial (empty) render can't clobber a saved draft.
  const restoredRef = useRef(false);

  // Restore in-progress draft (runs before authResult effect so it can hand the
  // saved step over via draftStepRef)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.dob)          setDob(d.dob);
        if (d.education)    setEducation(d.education);
        if (Array.isArray(d.experiences)) setExperiences(d.experiences);
        else if (d.experience) setExperiences([d.experience]);
        if (d.address)      setAddress(d.address);
        if (d.availability) setAvailability(d.availability);
        if (d.equipment)    setEquipment(d.equipment);
        if (d.accountType)  setAccountType(d.accountType);
        if (d.memberEmails) setMemberEmails(d.memberEmails);
        if (d.tin)          setTin(d.tin);
        if (d.selectedRole) setSelectedRole(d.selectedRole);
        if (d.step && DATA_STEPS.includes(d.step)) draftStepRef.current = d.step;
      }
    } catch {}
    restoredRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The onboarding payload from the current state - used by the FINAL submit,
  // where defaults are fine because the user has walked every step.
  const buildPayload = (): OnboardingData => ({
    role: showRoleSelect ? selectedRole : undefined,
    dob,
    educationLevel: education,
    experienceType: experiences[0] ?? "",
    experienceTypes: experiences,
    accountType,
    tin: tin.trim() ? tin.trim() : undefined,
    teamMembers: !isEmployer && isGroup ? memberEmails : [],
    location: address ?? { country: "Rwanda" },
    equipment: equipment.map((name) => ({ name, available: true })),
    availability: availability.map((d) => FULL_DAYS[d]),
  });

  // Partial payload for the SILENT per-step saves: only fields the user actually
  // provided. Sending defaults (location {country}, equipment []) from the first
  // slide made a barely-started profile look complete server-side, so a returning
  // login jumped to the badge step instead of resuming at the missing step.
  const buildDraftPayload = (): OnboardingData => {
    const p: Record<string, unknown> = {};
    if (showRoleSelect && selectedRole) p.role = selectedRole;
    if (dob) p.dob = dob;
    if (education) p.educationLevel = education;
    if (experiences.length) {
      p.experienceType = experiences[0];
      p.experienceTypes = experiences;
    }
    if (accountType) p.accountType = accountType;
    if (tin.trim()) p.tin = tin.trim();
    if (!isEmployer && isGroup && memberEmails.length) p.teamMembers = memberEmails;
    if (address) p.location = address;
    if (equipment.length) p.equipment = equipment.map((name) => ({ name, available: true }));
    if (availability.length) p.availability = availability.map((d) => FULL_DAYS[d]);
    return p as unknown as OnboardingData;
  };

  // Silent per-step save to the server (slide mode only). Debounced so rapid
  // field edits don't spam the API. Only runs once we're past the first slide
  // (a real data-collection step) and a token is available.
  const silentSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-save the current data whenever a field changes or the user advances a
  // step, so nothing is lost between slides or across a reload.
  useEffect(() => {
    if (!restoredRef.current) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        dob, education, experiences, address, availability, equipment,
        accountType, memberEmails, tin, selectedRole, step,
      }));
    } catch {}

    // Server-side per-step save - resumes the account from where it left off,
    // even on another device. Skipped on the first slide(s) (role/verify).
    const token = authResult?.accessToken;
    if (slideMode && token && DATA_STEPS.includes(step)) {
      if (silentSaveRef.current) clearTimeout(silentSaveRef.current);
      silentSaveRef.current = setTimeout(() => {
        submitOnboarding(buildDraftPayload(), token, false).catch(() => { /* silent */ });
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dob, education, experiences, address, availability, equipment, accountType, memberEmails, tin, selectedRole, step]);

  // Calculate initial step and state
  useEffect(() => {
    if (authResult?.user) {
      const u = authResult.user;

      // Populate fields if they exist
      if (u.dob) setDob(u.dob);
      if (u.educationLevel) setEducation(u.educationLevel);
      if (u.experienceTypes && u.experienceTypes.length > 0) setExperiences(u.experienceTypes);
      else if (u.experienceType) setExperiences([u.experienceType]);

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

      // Role select overrides everything - always start there when requested
      let next: Step | null = null;
      if (showRoleSelect) {
        next = "ROLE_SELECT";
      } else if (!u.emailVerified && !isLogin) {
        next = "EMAIL_VERIFY";
      } else if (u.role === "EMPLOYER") {
        // Employer flow: identifier → location + service type + TIN
        next = !u.experienceType || !u.location ? "ACCOUNT_TYPE" : "EMPLOYER_DETAILS";
        getJobCategories().then(setCategories).catch(console.error);
      } else if (!u.dob || !u.educationLevel || !u.experienceType) {
        next = "ACCOUNT_TYPE";
        getJobCategories().then(setCategories).catch(console.error);
      } else if (!u.location || !u.availability || u.availability.length === 0) {
        next = "LOCATION_AVAILABILITY";
        getJobCategories().then(setCategories).catch(console.error);
      } else if (!u.equipment || u.equipment.length === 0) {
        next = "EQUIPMENT";
      }

      // Resume at the saved draft step, but never AHEAD of the first incomplete
      // step: if the server says dob is still missing, the wizard must show the
      // personal step, not a later one the local draft happened to be on.
      if (next && draftStepRef.current && DATA_STEPS.includes(next)) {
        const draft = draftStepRef.current;
        if (PROGRESS_STEPS.indexOf(draft) <= PROGRESS_STEPS.indexOf(next)) {
          next = draft;
        }
        getJobCategories().then(setCategories).catch(console.error);
      }
      if (next) setStep(next);
    }
  }, [authResult]);

  const handleRoleSelectContinue = async () => {
    const u = authResult?.user;
    // Slide mode collects everything first and verifies email near the end.
    if (!slideMode && !u?.emailVerified && !isLogin) {
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
      toastError(t("onboarding.group_fields.email_error"), { title: t("onboarding.group_fields.email_error_title") });
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
    setStep(isEmployer ? "EMPLOYER_DETAILS" : "PERSONAL");
    getJobCategories().then(setCategories).catch(console.error);
  };

  const handleVerifyEmail = async () => {
    if (!verifyCode || verifyCode.length < 4) {
      toastError(t("onboarding.otp.invalid_code_error"), { title: t("onboarding.otp.error_title") });
      return;
    }
    setLoading(true);
    try {
      await verifyEmailCode(email, verifyCode);
      setEmailVerified(true);
      // Slide mode verifies at the END, so finalise the account now. The normal
      // flow verifies early and continues collecting details.
      if (slideMode) {
        await finalizeOnboarding();
      } else {
        setStep("ACCOUNT_TYPE");
        getJobCategories().then(setCategories).catch(console.error);
      }
    } catch (e: any) {
      toastError(e?.response?.data?.message || t("onboarding.otp.invalid_code_error"), { title: t("onboarding.otp.error_title") });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setVerifyCode("");
    try {
      await resendOtpCode(email);
      toastSuccess(t("onboarding.otp.success_resend"), { title: t("onboarding.otp.success_resend_title") });
    } catch (e: any) {
      toastError(e?.response?.data?.message || t("onboarding.otp.resend_fail_generic"), { title: t("onboarding.otp.resend_fail_title") });
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
      toastError(t("onboarding.personal.age_restriction_error"), { title: t("onboarding.personal.age_restriction_title") });
      return;
    }
    setStep("LOCATION_AVAILABILITY");
  };

  // Triggered by the final button of the last data step. In slide mode, if the
  // email hasn't been verified yet, verify first (near the location/end); then
  // finalise. In the normal flow the email is already verified, so finalise now.
  const handleSubmit = async () => {
    if (slideMode && !emailVerified) {
      // Reached the end unverified → send a fresh code and verify now.
      resendOtpCode(email).catch(() => {});
      setStep("EMAIL_VERIFY");
      return;
    }
    await finalizeOnboarding();
  };

  // Complete onboarding (finalize=true). In slide mode a worker is then offered
  // the badge step; everyone else goes straight to the completed screen.
  const finalizeOnboarding = async () => {
    setLoading(true);
    // Cancel any pending silent save; this final call finalises the account.
    if (silentSaveRef.current) clearTimeout(silentSaveRef.current);
    try {
      const updatedUser = await submitOnboarding(buildPayload(), authResult?.accessToken || "");
      if (authResult) {
        authResult.user = updatedUser;
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      if (slideMode && !isEmployer) {
        setStep("BADGE_OFFER");
      } else {
        setStep("COMPLETED");
        setTimeout(onComplete, 1500);
      }
    } catch (e: any) {
      toastError(e?.response?.data?.message || t("onboarding.equipment.onboarding_fail_generic"), { title: t("onboarding.equipment.onboarding_fail_title") });
    } finally {
      setLoading(false);
    }
  };

  // Worker chose to generate their badge - hand off to the badge wizard.
  if (showBadge && authResult) {
    return <BadgeSubmissionWizard authResult={authResult} onComplete={onComplete} />;
  }

  // Slide-mode progress: a percentage across the canonical step order.
  const progressPct = Math.min(100, Math.round(((PROGRESS_STEPS.indexOf(step) + 1) / PROGRESS_STEPS.length) * 100));

  return (
    <div className={slideMode
      ? "fixed inset-0 z-50 bg-[#0d0d0d]"
      : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"}>

      {/* Slide mode scrolls an INNER div, not the fixed layer itself: mobile Safari
          often refuses touch-scrolling on a position:fixed element, which made tall
          steps (DOB / education) unreachable below the fold on phones. */}
      <div
        className={slideMode ? "h-full w-full overflow-y-auto" : "contents"}
        style={slideMode ? {
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          touchAction: "pan-y",
        } as React.CSSProperties : undefined}
      >

      {/* Slide mode: a full-width progress line pinned to the top of the page. */}
      {slideMode && (
        <div className="sticky top-0 left-0 h-1 w-full bg-[#1f1f1f] z-10">
          <div className="h-full bg-[#f97316] transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      <div className={slideMode
        ? "mx-auto w-full max-w-xl px-4 sm:px-6 pt-8 pb-14 flex flex-col"
        : "bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden"}>

        {/* Header */}
        <div className={slideMode
          ? "pb-5 flex items-start justify-between"
          : "px-6 pt-6 pb-4 border-b border-[#2a2a2a] flex items-start justify-between"}>
          <div>
            <span className="text-[10px] font-bold text-[#f97316] uppercase tracking-wider block mb-0.5">
              {slideMode ? `${progressPct}% complete` : STEP_NUMBER_LOCALIZED[step]}
            </span>
            <h2 className={`${slideMode ? "text-2xl" : "text-lg"} font-bold text-white leading-tight`}>
              {step === "ROLE_SELECT" && t("onboarding.headers.role_select_title")}
              {step === "EMAIL_VERIFY" && t("onboarding.headers.email_verify_title")}
              {step === "ACCOUNT_TYPE" && t("onboarding.headers.account_type_title")}
              {step === "EMPLOYER_DETAILS" && t("onboarding.headers.employer_details_title")}
              {step === "PERSONAL" && t("onboarding.headers.personal_title")}
              {step === "LOCATION_AVAILABILITY" && t("onboarding.headers.location_title")}
              {step === "EQUIPMENT" && t("onboarding.headers.equipment_title")}
              {step === "BADGE_OFFER" && (t("onboarding.headers.badge_offer_title") || "One last thing: your working badge")}
              {step === "COMPLETED" && t("onboarding.headers.completed_title")}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === "ROLE_SELECT" && t("onboarding.headers.role_select_subtitle")}
              {step === "EMAIL_VERIFY" && t("onboarding.headers.email_verify_subtitle", { email })}
              {step === "ACCOUNT_TYPE" && (isEmployer ? t("onboarding.headers.account_type_subtitle_employer") : t("onboarding.headers.account_type_subtitle_worker"))}
              {step === "EMPLOYER_DETAILS" && t("onboarding.headers.employer_details_subtitle")}
              {step === "PERSONAL" && t("onboarding.headers.personal_subtitle")}
              {step === "LOCATION_AVAILABILITY" && t("onboarding.headers.location_subtitle")}
              {step === "EQUIPMENT" && t("onboarding.headers.equipment_subtitle")}
              {step === "BADGE_OFFER" && (t("onboarding.headers.badge_offer_subtitle") || "A verified badge builds trust and gets you hired faster. You can also do it later.")}
              {step === "COMPLETED" && t("onboarding.headers.completed_subtitle")}
            </p>
          </div>
        </div>

        {/* Body - in slide mode each step animates in as the user advances. */}
        {slideMode && <style>{`@keyframes wizSlide{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}`}</style>}
        <div
          key={slideMode ? step : undefined}
          className={slideMode ? "space-y-6" : "p-6 overflow-y-auto max-h-[80vh] space-y-6"}
          style={slideMode ? { animation: "wizSlide .28s ease" } : undefined}
        >
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
                          {r === "WORKER" ? t("onboarding.roles.worker_label") : t("onboarding.roles.employer_label")}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {r === "WORKER" ? t("onboarding.roles.worker_desc") : t("onboarding.roles.employer_desc")}
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
                {t("onboarding.roles.continue_btn", { role: selectedRole === "WORKER" ? t("common.nav.job_seeker") || "Job Seeker" : t("common.nav.employer") || "Employer" })}
              </button>
            </div>
          )}

          {/* ── OTP ── */}
          {step === "EMAIL_VERIFY" && (
            <div className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder={t("onboarding.otp.placeholder")}
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
                {t("onboarding.otp.submit_btn")}
              </button>
              <p className="text-center text-xs text-gray-600">
                {t("onboarding.otp.resend_prompt")}{" "}
                <button
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-[#f97316] hover:underline disabled:opacity-50"
                >
                  {t("onboarding.otp.resend_link")}
                </button>
              </p>
            </div>
          )}

          {/* ── Account identifier ── */}
          {step === "ACCOUNT_TYPE" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {typeOptions.map((t) => {
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

              {!isEmployer && isGroup && (
                <div className="space-y-4 border-t border-[#2a2a2a] pt-4">
                  {/* Member emails */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      {t("onboarding.group_fields.member_emails_label")}
                      {memberEmails.length > 0 && (
                        <span className="text-gray-500 normal-case font-normal"> {t("onboarding.group_fields.members_count", { count: memberEmails.length, plural: memberEmails.length > 1 ? "s" : "" })}</span>
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
                        placeholder={memberEmails.length === 0 ? t("onboarding.group_fields.member_email_placeholder") : ""}
                        className="flex-1 min-w-[160px] bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      {t("onboarding.group_fields.member_email_hint")}
                    </p>
                  </div>

                  {/* Optional TIN */}
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                      {t("onboarding.group_fields.tin_label")} <span className="text-gray-600 normal-case font-normal">{t("onboarding.group_fields.tin_optional")}</span>
                    </label>
                    <input
                      type="text"
                      value={tin}
                      onChange={(e) => setTin(e.target.value)}
                      placeholder={t("onboarding.group_fields.tin_placeholder")}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleAccountTypeContinue}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                {t("common.buttons.continue")}
              </button>
            </div>
          )}

          {/* ── Employer: location + service type + TIN ── */}
          {step === "EMPLOYER_DETAILS" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.employer_details.location_label")}
                </label>
                <AddressPicker value={address} onChange={setAddress} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.employer_details.service_type_label")}
                </label>
                <input
                  type="text"
                  placeholder={t("onboarding.employer_details.service_search_placeholder")}
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
                      onClick={() => setExperiences([opt.slug])}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all text-left ${
                        experiences[0] === opt.slug
                          ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      <div className="font-bold">{opt.displayName}</div>
                      {opt.nameKinyarwanda && <div className="text-[10px] opacity-70 mt-0.5">{opt.nameKinyarwanda}</div>}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <span className="text-xs text-gray-500">{t("onboarding.employer_details.loading_services")}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.group_fields.tin_label")}{" "}
                  <span className="text-gray-600 normal-case font-normal">
                    {accountType === "COMPANY" ? t("onboarding.group_fields.tin_recommended") : t("onboarding.group_fields.tin_optional")}
                  </span>
                </label>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder={t("onboarding.group_fields.tin_placeholder")}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !isAddressComplete(address) || experiences.length === 0}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {t("onboarding.employer_details.submit_btn")}
              </button>
            </div>
          )}

          {/* ── Step 1: Personal ── */}
          {step === "PERSONAL" && (
            <div className="space-y-4">
              {/* DOB */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.personal.dob_label")}
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                  style={{ colorScheme: "dark" }}
                />
              </div>

              {/* Education - not applicable to companies */}
              {accountType !== "COMPANY" && (
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.personal.education_label")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {EDUCATION_OPTIONS_LOCALIZED.map((opt) => (
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

              {/* Experience - pick all the fields you work in */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.personal.category_label")}
                  <span className="ml-1 text-gray-600 normal-case font-normal">
                    {t("onboarding.personal.category_multi_hint") || "- select all that apply"}
                  </span>
                </label>
                <input
                  type="text"
                  placeholder={t("onboarding.personal.category_search_placeholder")}
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#f97316] transition-colors"
                />

                {/* Picked categories, in the order chosen - the first one is the primary. */}
                {experiences.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {experiences.map((slug, i) => {
                      const meta = categories.find((c) => c.slug === slug);
                      return (
                        <span
                          key={slug}
                          className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg text-[11px] font-semibold border ${
                            i === 0
                              ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                              : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-300"
                          }`}
                        >
                          {meta?.displayName ?? slug}
                          {i === 0 && (
                            <span className="text-[9px] uppercase tracking-wide opacity-75">
                              {t("onboarding.personal.category_primary") || "Primary"}
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label={`${t("common.buttons.cancel") || "Remove"} ${meta?.displayName ?? slug}`}
                            onClick={() => toggleExperience(slug)}
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[13px] leading-none opacity-70 hover:opacity-100 hover:bg-white/10"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {experiences.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                    {t("onboarding.personal.category_note")
                      || "All your categories are shown on your profile. The first one you pick is your primary category."}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto mt-3">
                  {categories
                    .filter((c) =>
                      c.displayName.toLowerCase().includes(catSearch.toLowerCase()) ||
                      (c.nameKinyarwanda && c.nameKinyarwanda.toLowerCase().includes(catSearch.toLowerCase()))
                    )
                    .map((opt) => (
                    <button
                      key={opt.slug}
                      onClick={() => toggleExperience(opt.slug)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all text-left ${
                        experiences.includes(opt.slug)
                          ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                          : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      <div className="font-bold">{opt.displayName}</div>
                      {opt.nameKinyarwanda && <div className="text-[10px] opacity-70 mt-0.5">{opt.nameKinyarwanda}</div>}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <span className="text-xs text-gray-500">{t("onboarding.personal.loading_categories")}</span>
                  )}
                </div>
                {experiences.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-2">
                    {experiences.length} {t("onboarding.personal.category_selected") || "selected"}
                  </p>
                )}
              </div>

              <button
                onClick={handlePersonalSubmit}
                disabled={!dob || (accountType !== "COMPANY" && !education) || experiences.length === 0}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors mt-2"
              >
                {t("common.buttons.continue") || "Continue"}
              </button>
            </div>
          )}

          {/* ── Step 2: Location + Availability ── */}
          {step === "LOCATION_AVAILABILITY" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.location_avail.location_label")}
                </label>
                <AddressPicker value={address} onChange={setAddress} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wide">
                  {t("onboarding.location_avail.avail_label")}
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_LOCALIZED.map((day) => {
                    const active = availability.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={`py-2 text-[11px] font-bold rounded-lg border transition-all ${
                          active
                            ? "bg-[#f97316]/20 border-[#f97316] text-[#f97316]"
                            : "bg-[#1a1a1a] border-[#2a2a2a] text-gray-500 hover:border-gray-500"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {availability.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-2">
                    {t("onboarding.location_avail.days_selected", { count: availability.length, plural: availability.length > 1 ? "s" : "" })}
                  </p>
                )}
              </div>

              <button
                onClick={() => setStep("EQUIPMENT")}
                disabled={!isAddressComplete(address) || availability.length === 0}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                {t("common.buttons.continue") || "Continue"}
              </button>
            </div>
          )}

          {/* ── Step 3: Equipment ── */}
          {step === "EQUIPMENT" && (
            <div className="space-y-4">
              {/* Tag input */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">
                  {t("onboarding.equipment.label")}
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
                    placeholder={equipment.length === 0 ? t("onboarding.equipment.placeholder") : ""}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  {t("onboarding.equipment.hint")}
                </p>
              </div>

              {/* Quick suggestions */}
              <div>
                <p className="text-[11px] text-gray-500 mb-2 uppercase tracking-wide font-semibold">
                  {t("onboarding.equipment.suggestions_title")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EQUIPMENT_SUGGESTIONS_LOCALIZED.filter((s) => !equipment.includes(s)).map((s) => (
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
                {t("onboarding.employer_details.submit_btn")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full text-xs text-gray-600 hover:text-gray-400 transition-colors py-1"
              >
                {t("onboarding.equipment.skip_btn")}
              </button>
            </div>
          )}

          {/* ── Done ── */}
          {/* ── Badge offer (last step, workers) ── */}
          {step === "BADGE_OFFER" && (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center gap-3 py-2">
                <div className="w-16 h-16 bg-[#f97316]/15 text-[#f97316] rounded-full flex items-center justify-center">
                  <span className="text-3xl">🪪</span>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">
                    {t("onboarding.badge_offer.question") || "Would you like to generate your working badge now?"}
                  </h3>
                  <p className="text-gray-500 text-xs mt-1 max-w-sm">
                    {t("onboarding.badge_offer.desc") || "Your badge verifies your identity so employers can hire you with confidence. It only takes a minute."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBadge(true)}
                className="w-full bg-[#f97316] hover:bg-[#ea6a0a] text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                {t("onboarding.badge_offer.generate") || "Generate my badge"}
              </button>
              <button
                onClick={onComplete}
                className="w-full bg-transparent hover:bg-[#1f1f1f] text-gray-400 text-sm font-semibold py-3 rounded-xl transition-colors border border-[#2a2a2a]"
              >
                {t("onboarding.badge_offer.skip") || "Skip for now"}
              </button>
            </div>
          )}

          {step === "COMPLETED" && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-16 h-16 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={30} />
              </div>
              <h3 className="text-white font-bold text-lg">{t("onboarding.completed.title")}</h3>
              <p className="text-gray-500 text-xs mt-1">{t("onboarding.completed.subtitle")}</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}