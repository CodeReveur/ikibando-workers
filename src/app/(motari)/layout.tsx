/**
 * The motari (driver) app shell. Deliberately bare: the driver surface is a
 * full-screen map app like the passenger page, with no site navbar or footer.
 * Session handling lives in the page itself: tokens persist in localStorage and
 * refresh automatically, so a motari stays signed in until they log out.
 */
export default function MotariLayout({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#000", minHeight: "100dvh" }}>{children}</div>;
}
