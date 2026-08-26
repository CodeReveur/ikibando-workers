import { NextResponse } from "next/server";

/**
 * The Android build, streamed through this origin.
 *
 * It is proxied rather than redirected so the backend's address stays out of
 * the browser, the same reason every other call goes through the gateway. A
 * download is rare enough that passing the bytes through costs nothing worth
 * counting.
 */
const BACKEND = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8088")
  .replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export async function GET() {
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/app/android`, { cache: "no-store" });
  } catch {
    return NextResponse.json(
      { success: false, message: "The download is unavailable right now." },
      { status: 502 },
    );
  }

  if (!res.ok || !res.body) {
    return NextResponse.json(
      { success: false, message: "The Android app is not available for download yet." },
      { status: res.status === 404 ? 404 : 502 },
    );
  }

  // The headers are what make a phone install it rather than display it.
  const headers = new Headers();
  headers.set("Content-Type", "application/vnd.android.package-archive");
  headers.set("Content-Disposition", 'attachment; filename="Motari.apk"');
  const length = res.headers.get("content-length");
  if (length) headers.set("Content-Length", length);

  return new NextResponse(res.body, { status: 200, headers });
}
