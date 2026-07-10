import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088";

/**
 * Extract the most useful error string from an Axios error.
 * Handles both AppException (message at root) and @Valid errors
 * (field-level messages in data.data object).
 */
export function apiError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const body = (e as any)?.response?.data;
  if (!body) return fallback;
  // Validation errors: { message: "Validation failed", data: { field: "msg" } }
  if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
    const msgs = Object.values(body.data as Record<string, string>).filter(Boolean);
    if (msgs.length) return msgs.join(" · ");
  }
  return body.message || fallback;
}

const http = axios.create({ baseURL: BASE, withCredentials: false });

// ── Token refresh interceptor ─────────────────────────────────────────────────
let _refreshing = false;
let _queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function drainQueue(err: unknown, token?: string) {
  _queue.forEach(p => (err ? p.reject(err) : p.resolve(token!)));
  _queue = [];
}

http.interceptors.response.use(
  r => r,
  async error => {
    const orig = error.config;
    if (error.response?.status !== 401 || orig._retry || typeof window === "undefined") {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return Promise.reject(error);

    if (_refreshing) {
      return new Promise<string>((resolve, reject) => _queue.push({ resolve, reject }))
        .then(token => { orig.headers["Authorization"] = `Bearer ${token}`; return http(orig); });
    }

    orig._retry  = true;
    _refreshing  = true;

    try {
      const { data } = await http.post("/api/auth/refresh", { refreshToken });
      const newAccess: string = data.data.accessToken;
      localStorage.setItem("access_token", newAccess);
      if (data.data.refreshToken) localStorage.setItem("refresh_token", data.data.refreshToken);
      drainQueue(null, newAccess);
      _refreshing = false;
      orig.headers["Authorization"] = `Bearer ${newAccess}`;
      return http(orig);
    } catch (refreshErr) {
      drainQueue(refreshErr);
      _refreshing = false;
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      try { sessionStorage.setItem("auth_redirect", window.location.href); } catch {}
      window.location.href = "/signin";
      return Promise.reject(refreshErr);
    }
  }
);

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  requires2fa: boolean;
  requiresEmailVerification?: boolean;
  requires2faSetup?: boolean;
  secret?: string;
  qrCodeUri?: string;
  tempToken?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    totpEnabled: boolean;
    emailVerified: boolean;
    onboardingCompleted: boolean;
    defaultAutoRelease?: boolean;
    accountStatus?: string;
    profileCompletion?: number;
    approvalEligible?: boolean;
    approved?: boolean;
    rating?: number | null;
    ratingCount?: number | null;
    dob?: string;
    educationLevel?: string;
    experienceType?: string;
    accountType?: string;
    tin?: string | null;
    teamMembers?: string[] | null;
    location?: Address | null;
    equipment?: any;
    availability?: any;
    badgeSubmitted?: boolean;
    photoUrl?: string;
    nationalId?: string;
    legalName?: string;
    badgeId?: string;
    badgeUrl?: string;
    address?: any;
    createdAt: string;
  };
}

export async function registerWithEmail(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "WORKER" | "EMPLOYER";
  referralCode?: string;
}): Promise<AuthResult> {
  const { data } = await http.post("/api/auth/register", payload);
  return data.data;
}

export interface ReferralItem {
  name: string;
  status: "PENDING" | "REWARDED";
  rewardAmountRwf: number;
  createdAt: string;
  rewardedAt: string | null;
}

export interface ReferralSummary {
  code: string;
  rewardPerReferral: number;
  invited: number;
  rewarded: number;
  pending: number;
  totalEarned: number;
  items: ReferralItem[];
}

export async function getMyReferral(token: string): Promise<ReferralSummary> {
  const { data } = await http.get("/api/referrals/me", { headers: authHeader(token) });
  return data.data;
}

export async function loginWithEmail(payload: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const { data } = await http.post("/api/auth/login", payload);
  return data.data;
}

/** Completes a TOTP login using the short-lived tempToken from a requires2fa response. */
export async function authenticate2fa(tempToken: string, code: string): Promise<AuthResult> {
  const { data } = await http.post("/api/auth/2fa/authenticate", { tempToken, code });
  return data.data;
}

export async function loginWithGoogle(
  accessToken: string,
  role?: "WORKER" | "EMPLOYER"
): Promise<AuthResult> {
  const { data } = await http.post("/api/auth/oauth/google", {
    token: accessToken,
    role: role ?? null,
  });
  return data.data;
}

export async function loginWithFacebook(
  accessToken: string,
  role?: "WORKER" | "EMPLOYER"
): Promise<AuthResult> {
  const { data } = await http.post("/api/auth/oauth/facebook", {
    token: accessToken,
    role: role ?? null,
  });
  return data.data;
}

/**
 * Structured address. For Rwanda the cascading admin divisions are filled in;
 * for other countries the universal fields (state/city/street) are used.
 * `label` is a human-readable one-line summary for display.
 */
export interface Address {
  country: string;
  // Rwanda
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  // Universal
  state?: string;
  city?: string;
  street?: string;
  label?: string;
}

export type AccountType = "INDIVIDUAL" | "TEAM" | "COMPANY" | "CREW";

export interface OnboardingData {
  role?: string;
  dob: string;
  educationLevel: string;
  experienceType: string;
  /** Account identifier. Team/Company/Crew may carry members + TIN. */
  accountType?: AccountType;
  tin?: string;
  teamMembers?: string[];
  location: Address;
  equipment: { name: string; available: boolean }[];
  availability: string[];
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  await http.post("/api/auth/verify-email", { email, code });
}

export async function resendOtpCode(email: string): Promise<void> {
  await http.post("/api/auth/resend-otp", { email });
}

export async function forgotPassword(email: string): Promise<void> {
  await http.post("/api/auth/forgot-password", { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await http.post("/api/auth/reset-password", { token, newPassword });
}

export interface GuestAccountCheck {
  emailIsWorker: boolean;
  phoneIsWorker: boolean;
  /** True when the email or phone already belongs to a worker (seeker) account. */
  isWorker: boolean;
}

/**
 * Check whether guest contact details already belong to a worker account. The guest post-job /
 * hire flows call this after the details are entered and block the summary step when isWorker.
 */
export async function checkGuestAccount(payload: { email: string; phone?: string }): Promise<GuestAccountCheck> {
  const { data } = await http.post("/api/auth/account-check", payload);
  return data.data;
}

export async function getProfile(token: string): Promise<AuthResult["user"]> {
  const { data } = await http.get("/api/users/me", { headers: authHeader(token) });
  return data.data;
}

export async function updateProfile(
  payload: { name?: string; phone?: string; defaultAutoRelease?: boolean },
  token: string,
): Promise<AuthResult["user"]> {
  const { data } = await http.patch("/api/users/me", payload, { headers: authHeader(token) });
  return data.data;
}

export async function changePassword(
  payload: { currentPassword: string; newPassword: string },
  token: string,
): Promise<void> {
  await http.post("/api/users/me/password", payload, { headers: authHeader(token) });
}

export async function setupTotp(token: string): Promise<{ secret: string; qrCodeUri: string }> {
  const { data } = await http.post("/api/auth/2fa/setup", {}, { headers: authHeader(token) });
  return data.data;
}

export async function enableTotp(code: string, token: string): Promise<void> {
  await http.post("/api/auth/2fa/enable", { code }, { headers: authHeader(token) });
}

export async function disableTotp(code: string, token: string): Promise<void> {
  await http.post("/api/auth/2fa/disable", { code }, { headers: authHeader(token) });
}

export async function submitOnboarding(data: OnboardingData, token: string): Promise<any> {
  const { data: res } = await http.post("/api/users/onboarding", data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return res.data;
}

export interface BadgeSubmissionData {
  photoUrl?: string;
  nationalId?: string;
  legalName?: string;
  address?: any;
}

export async function submitBadge(data: BadgeSubmissionData, token: string): Promise<any> {
  const { data: res } = await http.post("/api/users/me/badge", data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

export async function uploadFile(file: File, token: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await http.post("/api/files/upload", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data"
    }
  });
  return data.url;
}

export interface JobCategoryMeta {
  slug: string;
  displayName: string;
  nameKinyarwanda: string | null;
  description: string | null;
  iconUrl: string | null;
  typicalRateMin: number | null;
  typicalRateMax: number | null;
}

export async function getJobCategories(): Promise<JobCategoryMeta[]> {
  const { data } = await http.get("/api/jobs/categories");
  return data.data;
}

// ── Payment modes ─────────────────────────────────────────────────────────────
export type PaymentMode =
  | "HOURLY" | "CUSTOM_HOURS" | "DAILY" | "CUSTOM_DAYS"
  | "WEEKLY" | "MONTHLY" | "CUSTOM_MONTHS" | "YEARLY";

export type PaymentRequestStatus =
  | "PENDING" | "APPROVED" | "AUTO_APPROVED" | "DECLINED" | "DISPUTED" | "CANCELLED";

/** One billable period in a job's installment schedule. */
export interface SchedulePeriod {
  index: number;
  unlockAt: string;
  amountRwf: number;
  /** LOCKED, AVAILABLE, PENDING, APPROVED, AUTO_APPROVED, DECLINED, DISPUTED, CANCELLED, PAID. */
  state: string;
  requestable: boolean;
  requestId: string | null;
}

export interface PaymentScheduleDto {
  jobId: string;
  paymentMode: PaymentMode;
  paymentPeriods: number;
  paymentInterval: number;
  directRelease: boolean;
  startTime: string | null;
  workerPayoutTotal: number;
  releasedTotal: number;
  periods: SchedulePeriod[];
}

export interface PaymentRequestDto {
  id: string;
  jobId: string;
  jobTitle: string;
  workerId: string;
  workerName: string;
  employerId: string;
  employerName: string;
  periodIndex: number;
  totalPeriods: number;
  amountRwf: number;
  status: PaymentRequestStatus;
  directRelease: boolean;
  unlockAt: string;
  requestedAt: string;
  expiresAt: string | null;
  decidedAt: string | null;
  declineReason: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export interface ActivityLogDto {
  id: string;
  jobId: string | null;
  actorId: string | null;
  actorName: string;
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export async function getPaymentSchedule(jobId: string, token: string): Promise<PaymentScheduleDto> {
  const { data } = await http.get(`/api/jobs/${jobId}/payment-schedule`, { headers: authHeader(token) });
  return data.data;
}

export async function getJobActivity(jobId: string, token: string): Promise<ActivityLogDto[]> {
  const { data } = await http.get(`/api/jobs/${jobId}/activity`, { headers: authHeader(token) });
  return data.data;
}

/** Worker: request payment for a completed period. */
export async function requestPeriodPayment(jobId: string, periodIndex: number, token: string): Promise<PaymentRequestDto> {
  const { data } = await http.post("/api/payment-requests", { jobId, periodIndex }, { headers: authHeader(token) });
  return data.data;
}

/** Employer: pending payment requests to act on (feeds the navbar approval modal). */
export async function getIncomingPaymentRequests(token: string): Promise<PaymentRequestDto[]> {
  const { data } = await http.get("/api/payment-requests/incoming", { headers: authHeader(token) });
  return data.data;
}

/** Worker: my payment requests across all jobs. */
export async function getMyPaymentRequests(token: string): Promise<PaymentRequestDto[]> {
  const { data } = await http.get("/api/payment-requests/mine", { headers: authHeader(token) });
  return data.data;
}

export async function approvePaymentRequest(id: string, token: string): Promise<PaymentRequestDto> {
  const { data } = await http.post(`/api/payment-requests/${id}/approve`, {}, { headers: authHeader(token) });
  return data.data;
}

export async function declinePaymentRequest(id: string, reason: string, token: string): Promise<PaymentRequestDto> {
  const { data } = await http.post(`/api/payment-requests/${id}/decline`, { reason }, { headers: authHeader(token) });
  return data.data;
}

/** Either party: raise a complaint that freezes the money until an agent resolves it. */
export async function disputePaymentRequest(id: string, reason: string, token: string): Promise<PaymentRequestDto> {
  const { data } = await http.post(`/api/payment-requests/${id}/dispute`, { reason }, { headers: authHeader(token) });
  return data.data;
}

// ── Shared pagination wrapper ─────────────────────────────────────────────────
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ── Domain DTOs ───────────────────────────────────────────────────────────────
export interface JobDto {
  id: string;
  employerId: string;
  employerName: string;
  /** Employer's overall reputation (1–5); real reviews = employerRatingCount − 1. */
  employerRatingAvg: number | null;
  employerRatingCount: number | null;
  title: string;
  description: string | null;
  requirements: string | null;
  category: string;
  province: string | null;
  district: string;
  sector: string | null;
  cell: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  locationNotes: string | null;
  /** Street / avenue of the job site — used for precise navigation. */
  street: string | null;
  /** House / plot number at the street. */
  houseNumber: string | null;
  /** Free-form resolved address (from map pin), if any. */
  address: string | null;
  ratePerHour: number;
  rateType: string;
  paymentMode: PaymentMode;
  paymentPeriods: number;
  paymentInterval: number;
  directRelease: boolean;
  headcount: number;
  urgency: "IMMEDIATE" | "SAME_DAY" | "SCHEDULED";
  status: string;
  startTime: string | null;
  durationHours: number;
  totalAmount: number | null;
  /** Worker commission rate applied to this job (fraction, e.g. 0.20). */
  platformFeeRate: number | null;
  /** Commission deducted from the worker's gross earnings (RWF). */
  platformFee: number | null;
  /** Net the worker takes home — public "all charges covered" price (RWF). */
  workerPayout: number | null;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  completionNotes: string | null;
  /** True once all positions are filled — no new applications accepted. */
  applicationsClosed: boolean;
  filledAt: string | null;
  /** Live counts on detail/owner views (null on the public feed list). */
  acceptedCount: number | null;
  pendingCount: number | null;
  workerVerified: boolean;
  workerFeedbackOption: string | null;
  workerFeedbackText: string | null;
  workerRating: number | null;
  employerFeedbackOption: string | null;
  employerFeedbackText: string | null;
  employerRating: number | null;
}

export interface WorkerProfileDto {
  id: string;
  name: string;
  experienceType: string | null;
  categoryName: string | null;
  educationLevel: string | null;
  /** Plain locality (e.g. "Kicukiro") — used for filtering/proximity. */
  district: string | null;
  /** Compact address for cards, e.g. "Kicukiro, Rwanda". */
  locationShort: string | null;
  /** Full address for detail pages, e.g. "Byimana, Karama, Kanombe, Kicukiro, Kigali, Rwanda". */
  locationFull: string | null;
  availability: string[];
  equipment: string[];
  /** Average rating (1–5). Seeded at 5.0; real reviews = ratingCount − 1. */
  rating: number | null;
  ratingCount: number | null;
  memberSince: string;
}

export interface ApplicationDto {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCategory: string;
  jobDistrict: string;
  jobRatePerHour: number;
  workerId: string;
  workerName: string;
  workerDistrict: string | null;
  /** Applicant's average rating; real reviews = workerRatingCount − 1. */
  workerRating: number | null;
  workerRatingCount: number | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
  appliedVia: "SELF_APPLY" | "HIRE_NOW";
  bestFit: string | null;
  responseNote: string | null;
  employerViewed: boolean;
  createdAt: string;
  respondedAt: string | null;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86_400_000);
}

// ── Wallet ───────────────────────────────────────────────────────────────────
export interface WalletDto {
  balance: number;
  totalSpent: number;
  totalHeld: number;
  totalReleased: number;
}

export interface PaymentDto {
  type: "PAYMENT" | "TOPUP" | "WITHDRAWAL";
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  amountRwf: number;
  platformFeeRwf: number | null;
  workerPayoutRwf: number | null;
  status: "PENDING" | "HELD" | "RELEASED" | "REFUNDED" | "FAILED" | "SUCCESS";
  method: string;
  phoneNumber: string | null;
  notes: string | null;
  heldAt: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
}

export async function getWallet(token: string): Promise<WalletDto> {
  const { data } = await http.get("/api/wallet", { headers: authHeader(token) });
  return data.data;
}

export async function getWalletTransactions(token: string): Promise<PaymentDto[]> {
  const { data } = await http.get("/api/wallet/transactions", { headers: authHeader(token) });
  return data.data;
}

export interface BonusDto {
  id: string;
  amountRwf: number;
  note: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  createdAt: string;
}

export interface BonusSummary {
  total: number;
  count: number;
  items: BonusDto[];
}

export async function getBonuses(token: string): Promise<BonusSummary> {
  const { data } = await http.get("/api/wallet/bonuses", { headers: authHeader(token) });
  return data.data;
}

export interface TransferDto {
  id: string;
  type: "TOPUP" | "WITHDRAWAL";
  amountRwf: number;
  method: string;
  phoneNumber: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  providerRef: string | null;
  /** Hosted card-checkout URL to redirect to (card top-ups only; null for mobile money). */
  redirectUrl: string | null;
  message: string | null;
  createdAt: string;
}

export async function topupWallet(
  payload: {
    amount: number;
    phoneNumber?: string;
    paymentMethod: "MTN_MOMO" | "AIRTEL_MONEY" | "VISA" | "MASTERCARD";
    notes?: string;
    /** Where XentriPay returns the browser after a hosted card payment. */
    redirectUrl?: string;
  },
  token: string,
): Promise<TransferDto> {
  const { data } = await http.post("/api/wallet/topup", payload, { headers: authHeader(token) });
  return data.data;
}

/** Poll the status of a top-up the current user initiated. */
export async function getTopupStatus(id: string, token: string): Promise<TransferDto> {
  const { data } = await http.get(`/api/wallet/topups/${id}`, { headers: authHeader(token) });
  return data.data;
}

// ── Notifications ───────────────────────────────────────────────────────────────
export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(token: string, page = 0, size = 20): Promise<Page<NotificationDto>> {
  const { data } = await http.get("/api/notifications", { params: { page, size }, headers: authHeader(token) });
  return data.data;
}

export async function getUnreadNotificationCount(token: string): Promise<number> {
  const { data } = await http.get("/api/notifications/unread-count", { headers: authHeader(token) });
  return data.data.count;
}

export async function markNotificationRead(id: string, token: string): Promise<void> {
  await http.post(`/api/notifications/${id}/read`, {}, { headers: authHeader(token) });
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await http.post("/api/notifications/read-all", {}, { headers: authHeader(token) });
}

export async function requestRefund(paymentId: string, reason: string, token: string): Promise<PaymentDto> {
  const { data } = await http.post(`/api/wallet/transactions/${paymentId}/refund`, { reason }, { headers: authHeader(token) });
  return data.data;
}

/**
 * Step 1 of a withdrawal: validate it and email the user a 6-digit confirmation code.
 * No money moves until {@link confirmWithdrawal} is called with the code.
 */
export async function requestWithdrawalOtp(
  payload: { amount: number; phoneNumber: string; paymentMethod: "MTN_MOMO" | "AIRTEL_MONEY"; notes?: string },
  token: string,
): Promise<void> {
  await http.post("/api/wallet/withdraw/otp", payload, { headers: authHeader(token) });
}

/** Step 2: confirm the emailed code and process the withdrawal. */
export async function confirmWithdrawal(code: string, token: string): Promise<TransferDto> {
  const { data } = await http.post("/api/wallet/withdraw/confirm", { code }, { headers: authHeader(token) });
  return data.data;
}

export async function completeJob(jobId: string, payload: { completionNotes?: string; feedbackOption: string; feedbackText?: string; rating: number }, token: string): Promise<JobDto> {
  const { data } = await http.post(`/api/jobs/${jobId}/complete`, payload, { headers: authHeader(token) });
  return data.data;
}

export async function verifyJobCompletion(jobId: string, payload: { badgeId: string; feedbackOption: string; feedbackText?: string; rating: number }, token: string): Promise<JobDto> {
  const { data } = await http.post(`/api/jobs/${jobId}/verify-completion`, payload, { headers: authHeader(token) });
  return data.data;
}

export interface JobUpdatePayload {
  title?: string;
  description?: string;
  requirements?: string;
  headcount?: number;
  urgency?: "IMMEDIATE" | "SAME_DAY" | "SCHEDULED";
  startTime?: string;
  durationHours?: number;
  province?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  locationNotes?: string;
  expiresAt?: string;
}

export async function updateJob(jobId: string, payload: JobUpdatePayload, token: string): Promise<JobDto> {
  const { data } = await http.patch(`/api/jobs/${jobId}`, payload, { headers: authHeader(token) });
  return data.data;
}

/** Employer: turn a job's auto-release on/off (allowed anytime). */
export async function setJobAutoRelease(jobId: string, directRelease: boolean, token: string): Promise<JobDto> {
  const { data } = await http.patch(`/api/jobs/${jobId}/auto-release`, { directRelease }, { headers: authHeader(token) });
  return data.data;
}

export async function getPendingApplicationCount(token: string): Promise<number> {
  const { data } = await http.get("/api/jobs/mine/pending-count", { headers: authHeader(token) });
  return data.data;
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export async function getJobs(params?: {
  page?: number; size?: number; category?: string; district?: string; urgency?: string;
}): Promise<Page<JobDto>> {
  const { data } = await http.get("/api/jobs", { params });
  return data.data;
}

export async function getJob(id: string): Promise<JobDto> {
  const { data } = await http.get(`/api/jobs/${id}`);
  return data.data;
}

/** Public platform charge/bonus parameters — admin-configurable (see /api/config/pricing). */
export interface PricingConfig {
  workerCommissionRate: number;       // fraction of job cost taken from the worker
  workerCommissionFixed: number;      // fixed RWF override (0 = use rate)
  employerServiceFeeRate: number;     // fraction added at posting, non-refundable
  employerServiceFeeFixed: number;    // fixed RWF override (0 = use rate)
  cancellationPenaltyRate: number;
  cancellationWorkerCompRate: number;
  referralRewardRwf: number;
}

/** Defaults matching the server's fallback so the UI still works if the call fails. */
export const DEFAULT_PRICING: PricingConfig = {
  workerCommissionRate: 0.20, workerCommissionFixed: 0,
  employerServiceFeeRate: 0.05, employerServiceFeeFixed: 0,
  cancellationPenaltyRate: 0.10, cancellationWorkerCompRate: 0.04,
  referralRewardRwf: 1000,
};

export async function getPricingConfig(): Promise<PricingConfig> {
  try {
    const { data } = await http.get("/api/config/pricing");
    return { ...DEFAULT_PRICING, ...(data.data ?? {}) };
  } catch {
    return DEFAULT_PRICING;
  }
}

/** Worker commission for a gross job cost, honouring a fixed-amount override. */
export function workerCommissionOf(baseCost: number, p: PricingConfig): number {
  return p.workerCommissionFixed > 0 ? p.workerCommissionFixed : Math.round(baseCost * p.workerCommissionRate);
}

/** Employer service fee for a gross job cost, honouring a fixed-amount override. */
export function employerServiceFeeOf(baseCost: number, p: PricingConfig): number {
  return p.employerServiceFeeFixed > 0 ? p.employerServiceFeeFixed : Math.round(baseCost * p.employerServiceFeeRate);
}

export interface JobPayload {
  category: string; title?: string; description?: string;
  province?: string; district: string;
  sector?: string; cell?: string; village?: string;
  latitude?: number; longitude?: number;
  ratePerHour: number; headcount: number;
  urgency: "IMMEDIATE" | "SAME_DAY" | "SCHEDULED";
  startTime: string; durationHours: number;
  rateType?: string; locationNotes?: string;
  /** Precise destination addressing for worker navigation. */
  street?: string; houseNumber?: string;
  /** How the escrow is paid out over time, and over how many periods. */
  paymentMode?: PaymentMode; paymentPeriods?: number; paymentInterval?: number;
  /** When true, per-period payment requests pay out immediately without manual approval. */
  directRelease?: boolean;
  /** True for Hire Now / direct Offer: don't broadcast to all workers, only the picked one. */
  direct?: boolean;
}

export async function postJob(payload: JobPayload, token: string): Promise<JobDto> {
  const { data } = await http.post("/api/jobs", payload, { headers: authHeader(token) });
  return data.data;
}

export interface GuestJobPayload {
  job: JobPayload;
  guestName: string; guestEmail: string; guestPhone: string;
  paymentMethod: "MTN_MOMO" | "AIRTEL_MONEY" | "VISA" | "MASTERCARD";
  paymentPhone?: string;
  workerIds?: string[];
  appliedVia?: string;
  /** Where XentriPay returns the browser after a hosted card payment. */
  redirectUrl?: string;
}

/**
 * Guest flow, phase 1: start a real XentriPay collection for the escrow total. Mobile money
 * pushes a USSD prompt; card returns a hosted-checkout redirectUrl. Poll getGuestPaymentStatus
 * with the returned id and, once SUCCESS, call postGuestJob to create the job.
 */
export async function initiateGuestJobPayment(payload: GuestJobPayload): Promise<TransferDto> {
  const { data } = await http.post("/api/jobs/guest/initiate", payload);
  return data.data;
}

/** Guest flow, phase 1: poll the guest payment status (public). */
export async function getGuestPaymentStatus(topupId: string): Promise<TransferDto> {
  const { data } = await http.get(`/api/jobs/guest/payment-status/${topupId}`);
  return data.data;
}

/**
 * Guest flow, phase 2: create the job once the payment has settled. The owner account is
 * found-or-created by email server-side and the escrow is frozen from the now-funded wallet;
 * any directly-hired workers are attached as accepted applications.
 */
export async function postGuestJob(payload: GuestJobPayload): Promise<JobDto> {
  const { data } = await http.post("/api/jobs/guest", payload);
  return data.data;
}

export async function getMyJobs(token: string): Promise<JobDto[]> {
  const { data } = await http.get("/api/jobs/mine", { headers: authHeader(token) });
  return data.data;
}

export async function cancelJob(id: string, token: string): Promise<void> {
  await http.delete(`/api/jobs/${id}`, { headers: authHeader(token) });
}

export async function getJobApplications(jobId: string, token: string): Promise<ApplicationDto[]> {
  const { data } = await http.get(`/api/jobs/${jobId}/applications`, { headers: authHeader(token) });
  return data.data;
}

export async function acceptAllApplications(jobId: string, token: string): Promise<ApplicationDto[]> {
  const { data } = await http.post(`/api/jobs/${jobId}/applications/accept-all`, {}, { headers: authHeader(token) });
  return data.data;
}

// ── Applications ──────────────────────────────────────────────────────────────
export async function applyForJob(
  jobId: string,
  payload: { bestFit?: string; appliedVia?: string; workerId?: string },
  token: string
): Promise<ApplicationDto> {
  const { data } = await http.post(`/api/jobs/${jobId}/apply`, payload, { headers: authHeader(token) });
  return data.data;
}

export async function getMyApplications(token: string): Promise<ApplicationDto[]> {
  const { data } = await http.get("/api/applications", { headers: authHeader(token) });
  return data.data;
}

export async function withdrawApplication(id: string, token: string): Promise<void> {
  await http.delete(`/api/applications/${id}`, { headers: authHeader(token) });
}

export async function updateApplicationStatus(
  id: string,
  payload: { status: "ACCEPTED" | "REJECTED"; responseNote?: string },
  token: string
): Promise<ApplicationDto> {
  const { data } = await http.patch(`/api/applications/${id}/status`, payload, { headers: authHeader(token) });
  return data.data;
}

// ── Workers ───────────────────────────────────────────────────────────────────
export async function getWorkers(params?: {
  page?: number; size?: number; category?: string;
}): Promise<Page<WorkerProfileDto>> {
  const { data } = await http.get("/api/workers", { params });
  return data.data;
}

export interface BadgeVerification {
  valid: boolean;
  active: boolean;
  id: string | null;
  badgeId: string;
  name: string | null;
  role: string | null;
  accountType: string | null;
  category: string | null;
  photoUrl: string | null;
  location: string | null;
  status: string | null;
  rating: number | null;
  ratingCount: number | null;
  completedJobs: number;
  memberSince: string | null;
}

export async function verifyBadge(badgeId: string): Promise<BadgeVerification> {
  const { data } = await http.get(`/api/workers/verify/${encodeURIComponent(badgeId)}`);
  return data.data;
}

export async function getWorker(id: string): Promise<WorkerProfileDto> {
  const { data } = await http.get(`/api/workers/${id}`);
  return data.data;
}

// ── Contact ───────────────────────────────────────────────────────────────────
export async function submitContact(payload: {
  name: string; email: string; subject: string; message: string;
}): Promise<void> {
  await http.post("/api/contact", payload);
}

export async function getContactThread(email: string): Promise<any[]> {
  const { data } = await http.get(`/api/contact/thread?email=${encodeURIComponent(email)}`);
  return data.data;
}

export async function sendContactTyping(email: string, typer: "USER" | "AGENT", isTyping: boolean): Promise<void> {
  await http.post(`/api/contact/typing?email=${encodeURIComponent(email)}&typer=${typer}&isTyping=${isTyping}`);
}

export async function getContactTypingStatus(email: string): Promise<{ userTyping: boolean; agentTyping: boolean }> {
  const { data } = await http.get(`/api/contact/typing?email=${encodeURIComponent(email)}`);
  return data.data;
}

/** Conversation status so the bot knows when a human agent has taken over (ESCALATED). */
export async function getContactStatus(email: string): Promise<{ status: "OPEN" | "ESCALATED" | "CLOSED"; escalated: boolean }> {
  const { data } = await http.get(`/api/contact/status?email=${encodeURIComponent(email)}`);
  return data.data;
}

export { daysAgo };
