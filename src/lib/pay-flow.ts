// Shared client-side payment flow for the post-job / hire / offer modals.
//
// Real XentriPay payments settle asynchronously, so the job may only be posted AFTER the
// payment confirms. Mobile money pushes a USSD prompt to the payer's phone; card returns a
// hosted-checkout URL we open in a new tab. Either way we then poll the status until it
// settles. Card sessions briefly report FAILED before the user finishes on the gateway page,
// so we suppress early FAILEDs inside a grace window (mirrors the connekt flow).

import {
  topupWallet, getTopupStatus,
  initiateGuestJobPayment, getGuestPaymentStatus,
  type GuestJobPayload,
} from "./api";

export type PayMethod = "MTN_MOMO" | "AIRTEL_MONEY" | "VISA" | "MASTERCARD";
export type PayOutcome = "success" | "failed" | "pending";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function isCardMethod(m: PayMethod): boolean {
  return m === "VISA" || m === "MASTERCARD";
}

async function pollStatus(
  fetchStatus: () => Promise<string>,
  opts: { graceMs: number; maxAttempts?: number; intervalMs?: number },
): Promise<PayOutcome> {
  const maxAttempts = opts.maxAttempts ?? 60;
  const intervalMs = opts.intervalMs ?? 2500;
  const startedAt = Date.now();
  for (let i = 0; i < maxAttempts; i++) {
    let raw = "PENDING";
    try { raw = (await fetchStatus()) || "PENDING"; } catch { /* transient — keep polling */ }
    const s = raw.toUpperCase();
    if (s === "SUCCESS") return "success";
    if (s === "FAILED") {
      if (Date.now() - startedAt < opts.graceMs) { await wait(intervalMs); continue; }
      return "failed";
    }
    await wait(intervalMs);
  }
  return "pending";
}

/**
 * Top up a signed-in user's wallet, then wait for it to settle.
 * For card, opens the XentriPay checkout page in a new tab first.
 */
export async function runWalletTopup(args: {
  amount: number;
  method: PayMethod;
  phone?: string;
  notes?: string;
  token: string;
}): Promise<PayOutcome> {
  const card = isCardMethod(args.method);
  const t = await topupWallet({
    amount: args.amount,
    phoneNumber: args.phone,
    paymentMethod: args.method,
    notes: args.notes,
    redirectUrl: card && typeof window !== "undefined" ? window.location.href : undefined,
  }, args.token);

  if (t.redirectUrl && typeof window !== "undefined") {
    window.open(t.redirectUrl, "_blank", "noopener,noreferrer");
  }

  return pollStatus(
    () => getTopupStatus(t.id, args.token).then((s) => s.status),
    { graceMs: card ? 25_000 : 0 },
  );
}

/**
 * Guest flow phase 1: start the escrow payment and wait for it to settle.
 * For card, opens the XentriPay checkout page in a new tab first.
 */
export async function runGuestPayment(payload: GuestJobPayload): Promise<PayOutcome> {
  const card = isCardMethod(payload.paymentMethod);
  const t = await initiateGuestJobPayment({
    ...payload,
    redirectUrl: card && typeof window !== "undefined" ? window.location.href : undefined,
  });

  if (t.redirectUrl && typeof window !== "undefined") {
    window.open(t.redirectUrl, "_blank", "noopener,noreferrer");
  }

  return pollStatus(
    () => getGuestPaymentStatus(t.id).then((s) => s.status),
    { graceMs: card ? 25_000 : 0 },
  );
}
