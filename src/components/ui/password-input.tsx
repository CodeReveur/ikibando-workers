"use client";

/**
 * A password box with an eye on it.
 *
 * The sign-in and sign-up pages each grew their own, with their own piece of
 * state and their own aria label, and the three places that came later got
 * none: the two motari modals and the password change in settings. This is the
 * one they should all have been.
 *
 * It starts hidden, because that is what somebody looking over a shoulder
 * expects, and reveals only while asked. The button is deliberately not a
 * submit: inside a form, a bare <button> submits it, and revealing a password
 * should never send one.
 */

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguage } from "@/lib/language-context";

export function PasswordInput({
  value,
  onChange,
  style,
  placeholder,
  onEnter,
  maxLength = 100,
  autoComplete = "current-password",
  disabled,
  onFocus,
  onBlur,
  /** Room the eye needs, so long placeholders do not run underneath it. */
  padRight = 38,
  /**
   * How far in from the right the eye sits.
   *
   * A field that already shows something of its own on that side, like the
   * matching tick when a new password is confirmed, needs the eye moved along
   * so the two are not drawn on top of each other.
   */
  eyeRight = 10,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  onEnter?: () => void;
  maxLength?: number;
  autoComplete?: string;
  disabled?: boolean;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  padRight?: number;
  eyeRight?: number;
}) {
  const { t } = useLanguage();
  const [shown, setShown] = useState(false);

  const label = shown
    ? t("signin.fields.hide_password_aria") || "Hide password"
    : t("signin.fields.show_password_aria") || "Show password";

  return (
    <div style={{ position: "relative" }}>
      <input
        type={shown ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && onEnter) onEnter(); }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ ...style, paddingRight: padRight }}
      />
      <button
        type="button"
        onClick={() => setShown(s => !s)}
        aria-label={label}
        title={label}
        tabIndex={-1}
        style={{
          position: "absolute", right: eyeRight, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", padding: 4, cursor: "pointer",
          lineHeight: 0, color: shown ? "#f97316" : "#666",
        }}
      >
        {shown ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}
