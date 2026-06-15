"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, trackPageview } from "@/lib/analytics";

/**
 * Fires consent-gated pageviews on route change and re-fires the current view
 * the moment consent is granted. Loads nothing until the user opts in.
 */
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);

  useEffect(() => {
    function onConsent() {
      trackPageview(window.location.pathname);
    }
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  return null;
}
