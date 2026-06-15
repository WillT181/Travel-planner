/**
 * Minimal, consent-gated analytics shim. No third-party scripts are loaded and
 * no events are recorded until the user explicitly accepts cookies (GDPR). Swap
 * the `dispatch` body for a real provider (Plausible, GA, PostHog…) later — the
 * consent gate stays the same.
 */

export type ConsentValue = "accepted" | "declined";

export const CONSENT_KEY = "wl_consent";
export const CONSENT_EVENT = "wl-consent-change";

export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CONSENT_KEY);
  return value === "accepted" || value === "declined" ? value : null;
}

export function setConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "accepted";
}

/** Record a pageview — a no-op unless analytics consent has been granted. */
export function trackPageview(url: string): void {
  if (!hasAnalyticsConsent()) return;
  // Placeholder for a real analytics provider.
  if (process.env.NODE_ENV !== "production") {
    console.debug("[analytics] pageview", url);
  }
}
