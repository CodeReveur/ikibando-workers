import { NextRequest, NextResponse } from "next/server";

/**
 * Place search proxy for the Motari pickup/destination fields.
 *
 * The browser cannot set a User-Agent, and Nominatim throttles anonymous
 * browser traffic hard, so type-ahead from the client is unreliable. Going
 * through the server lets us send a proper identifying header, bias results to
 * where the passenger actually is, and cache repeats so a fast typist does not
 * fire a request per keystroke.
 */
const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (q.length < 2) return NextResponse.json([]);

  const key = `${q}|${lat ?? ""}|${lng ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  const params = new URLSearchParams({
    format: "jsonv2",
    limit: "6",
    countrycodes: "rw",
    addressdetails: "1",
    q,
  });
  // Bias toward a box roughly 25 km around the passenger, without excluding
  // matches outside it: a nearby street should outrank a namesake far away.
  if (lat && lng) {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (Number.isFinite(la) && Number.isFinite(ln)) {
      const d = 0.22;
      params.set("viewbox", `${ln - d},${la + d},${ln + d},${la - d}`);
      params.set("bounded", "0");
    }
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "MpahMapu/1.0 (https://www.mpahmapu.com; support@mpahmapu.com)",
        "Accept-Language": "en",
      },
      // Nominatim is slow enough that a hung request would freeze type-ahead.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json([]);
    const raw = (await res.json()) as any[];
    const out = (Array.isArray(raw) ? raw : []).map(d => ({
      latitude: parseFloat(d.lat),
      longitude: parseFloat(d.lon),
      label: String(d.display_name || "").split(",").slice(0, 2).join(",").trim(),
      fullName: String(d.display_name || ""),
    })).filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude) && s.label);

    cache.set(key, { at: Date.now(), body: out });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
