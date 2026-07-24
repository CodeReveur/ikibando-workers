"use client";

import { Eye, EyeOff } from "lucide-react";
import { useHideBalance, MASKED } from "@/lib/use-hide-balance";
import { fmt } from "@/lib/dashboard-data";

/**
 * A wallet-balance value that respects the shared hide/show preference (default hidden). Pass
 * `toggle` on the primary display to render the eye button; every other balance on the page just
 * follows the same state, so flipping one flips them all.
 */
export function Balance({ amount, toggle: withToggle = false, style, className }: {
  amount: number;
  toggle?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  const { hidden, toggle } = useHideBalance();
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}>
      {hidden ? MASKED : fmt(amount)}
      {withToggle && (
        <button
          type="button"
          onClick={toggle}
          aria-label={hidden ? "Show balance" : "Hide balance"}
          title={hidden ? "Show balance" : "Hide balance"}
          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, display: "flex", padding: 0 }}
        >
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </span>
  );
}
