"use client";

/**
 * Speaking the turns, on the web.
 *
 * A motari riding a moto cannot read a screen. A page that shows the next turn
 * without saying it is a page they will look at anyway, which is the thing
 * worth avoiding. So the route is spoken, and only when it is worth hearing:
 * once on the approach to a manoeuvre, once again at it, and never twice for
 * the same one.
 *
 * This is the browser's own voice, so there is nothing to install and nothing
 * to pay for. A browser without one still gets the written banner.
 */

import { useEffect, useRef, useState } from "react";
import { haversineM, type LatLng, type RouteResult, type RouteStep } from "./routing";

/** Far enough out to act on, close enough to be about this turn. */
const WARN_M = 180;

/** At the manoeuvre itself. */
const AT_M = 45;

/** A step of a few metres between two others is noise on a moto, not guidance. */
const WORTH_SAYING_M = 20;

const MUTED_KEY = "motari.voice.muted";

export interface NextTurn {
  step: RouteStep;
  metresAway: number;
}

function worthSaying(step: RouteStep): boolean {
  return step.type === "arrive" || step.distanceM >= WORTH_SAYING_M;
}

function speak(words: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !words) return;
  try {
    window.speechSynthesis.cancel();
    const said = new SpeechSynthesisUtterance(words);
    // A little slower than default: an instruction misheard at speed is worse
    // than one that takes half a second longer.
    said.rate = 0.95;
    window.speechSynthesis.speak(said);
  } catch {
    // A browser that will not speak is one that shows the banner instead.
  }
}

/**
 * Follow a route with a live position. Returns the manoeuvre to draw, and the
 * switch that decides whether it is also spoken.
 *
 * @param route  the road ahead, or null when there is none
 * @param at     the device's live fix
 * @param active whether there is a ride to be guided through at all
 */
export function useTurnByTurn(route: RouteResult | null, at: LatLng | null, active: boolean) {
  const [next, setNext] = useState<NextTurn | null>(null);
  const [muted, setMutedState] = useState(false);

  // Manoeuvres already announced, by index in the current route.
  const warned = useRef<Set<number>>(new Set());
  const said = useRef<Set<number>>(new Set());
  const routeKey = useRef<string>("");
  const mutedRef = useRef(false);

  // The choice outlives the page: a motari who silenced it on the way out does
  // not want it back on at the next junction.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MUTED_KEY) === "1";
      setMutedState(stored);
      mutedRef.current = stored;
    } catch {
      // A browser with storage denied simply starts unmuted every time.
    }
  }, []);

  const setMuted = (value: boolean) => {
    setMutedState(value);
    mutedRef.current = value;
    try {
      window.localStorage.setItem(MUTED_KEY, value ? "1" : "0");
    } catch {
      // Nothing to remember it with; the switch still works for this session.
    }
    if (value && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    if (!active || !route || !at || route.steps.length === 0) {
      setNext(null);
      return;
    }

    // A new road means a new set of manoeuvres; forget what was said about the
    // old one, or a turn that repeats will be swallowed as already announced.
    const key = `${route.steps.length}:${route.distanceM.toFixed(0)}:${route.steps[0]?.location.latitude.toFixed(4)}`;
    if (key !== routeKey.current) {
      routeKey.current = key;
      warned.current = new Set();
      said.current = new Set();
    }

    for (let i = 0; i < route.steps.length; i++) {
      const step = route.steps[i];
      if (!worthSaying(step) || said.current.has(i)) continue;

      const away = haversineM(at, step.location);

      // The first manoeuvre still ahead is the one to show, however far off it
      // is. The screen says it early; the voice waits until it is useful.
      setNext({ step, metresAway: away });

      // Too far to be about this turn yet, and since steps run in order,
      // nothing after it can be either.
      if (away > WARN_M) return;
      if (mutedRef.current) return;

      if (away <= AT_M) {
        said.current.add(i);
        warned.current.add(i);
        speak(step.voice);
        return;
      }

      if (!warned.current.has(i)) {
        warned.current.add(i);
        // "In 200 metres" rounds the real distance, because a motari hearing
        // "in 173 metres" learns nothing they did not already know.
        const rounded = Math.round(away / 50) * 50;
        speak(`In ${rounded} metres, ${step.voice.charAt(0).toLowerCase()}${step.voice.slice(1)}`);
        return;
      }
      return;
    }

    // Every manoeuvre is behind us.
    setNext(null);
  }, [route, at, active]);

  // Leaving the page mid-sentence should not leave the sentence running.
  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  return { next, muted, setMuted };
}
