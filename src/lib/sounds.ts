/**
 * Notification sounds for the Motari apps. Files live in /public/audio and are
 * named after the event they announce, so adding a sound is a matter of dropping
 * the file in and naming it.
 *
 * Browsers refuse to play audio before the user has interacted with the page, so
 * {@link unlockSounds} primes the elements on the first tap and every later
 * play() failure is swallowed: a missing sound must never break a ride.
 */
export type SoundKey =
  /** A new ride offer reached this motari. */
  | "incoming-ride"
  /** A delivery request reached this motari (delivery vertical, not live yet). */
  | "incoming-delivery"
  /** A motari accepted the passenger's request. */
  | "accepted"
  /** Money landed, the motari arrived, or a ride was cancelled. */
  | "payment-arrived-canceled";

const cache = new Map<SoundKey, HTMLAudioElement>();
let unlocked = false;

function element(key: SoundKey): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let el = cache.get(key);
  if (!el) {
    el = new Audio(`/audio/${key}.wav`);
    el.preload = "auto";
    el.volume = 0.9;
    cache.set(key, el);
  }
  return el;
}

/** Play a notification sound. Safe to call anywhere; never throws. */
export function playSound(key: SoundKey) {
  try {
    const el = element(key);
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch { /* audio unsupported or blocked: stay silent */ }
}

/**
 * Prime playback on the first user gesture, so the first real notification is
 * audible instead of being swallowed by the browser's autoplay policy.
 */
export function unlockSounds() {
  if (unlocked || typeof window === "undefined") return;
  unlocked = true;
  const keys: SoundKey[] = ["incoming-ride", "incoming-delivery", "accepted", "payment-arrived-canceled"];
  for (const key of keys) {
    const el = element(key);
    if (!el) continue;
    // A muted play/pause is enough to mark the element as user-activated.
    el.muted = true;
    void el.play().then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = false;
    }).catch(() => { el.muted = false; });
  }
}

/** Attaches the one-time unlock to the first tap/keypress on the page. */
export function useSoundUnlock() {
  if (typeof window === "undefined") return;
  const once = () => {
    unlockSounds();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once, { once: true });
  window.addEventListener("keydown", once, { once: true });
}
