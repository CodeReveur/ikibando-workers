/**
 * Rwandan mobile numbers as the Motari apps accept them: digits only, exactly
 * 10, starting 07 (078/079 MTN, 072/073 Airtel). International prefixes are
 * folded back to the local form as the user types.
 */
export function formatRwPhone(input: string): string {
  let d = (input || "").replace(/\D/g, "");
  // +250 78x..., 250 78x..., or a bare 78x... all become 078x...
  if (d.startsWith("250")) d = "0" + d.slice(3);
  else if (d.startsWith("7") && !d.startsWith("07")) d = "0" + d;
  return d.slice(0, 10);
}

export function isValidRwPhone(phone: string): boolean {
  return /^07\d{8}$/.test(phone);
}
