import { NextResponse } from "next/server";

/**
 * What there is to download.
 *
 * The page asks this before offering a button, so a missing build reads as
 * "not up yet" rather than as a link that fails when someone taps it.
 */
const BACKEND = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088")
  .replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/app/info`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ data: { android: false, ios: false } });
    return NextResponse.json(await res.json());
  } catch {
    // The backend being unreachable is not a reason for the page to break.
    return NextResponse.json({ data: { android: false, ios: false } });
  }
}
