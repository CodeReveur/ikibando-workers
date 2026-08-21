"use client";

import { useEffect } from "react";

/** Old deep link: registration is a modal on the map now. */
export default function MotariRegisterRedirect() {
  useEffect(() => { window.location.replace("/motari?register=1"); }, []);
  return null;
}
