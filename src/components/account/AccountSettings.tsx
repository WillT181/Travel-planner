"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { CURRENCIES } from "@/lib/currency";
import {
  updateDisplayName,
  updateEmail,
  updatePassword,
  updateCurrency,
  deleteAccount,
  type AccountResult,
} from "@/lib/account/actions";

type Feedback = { kind: "error" | "success"; text: string } | null;

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      role={feedback.kind === "error" ? "alert" : "status"}
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        feedback.kind === "error"
          ? "bg-red-50 text-red-700"
          : "bg-primary-50 text-primary-800"
      }`}
    >
      {feedback.text}
    </p>
  );
}

function toFeedback(result: AccountResult): Feedback {
  if (result.error) return { kind: "error", text: result.error };
  if (result.message) return { kind: "success", text: result.message };
  return null;
}

const fieldClass =
  "h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AccountSettings({
  initialName,
  email,
  initialCurrency,
}: {
  initialName: string;
  email: string;
  initialCurrency: string;
}) {
  // Name
  const [name, setName] = useState(initialName);
  const [nameFb, setNameFb] = useState<Feedback>(null);
  const [namePending, startName] = useTransition();

  // Email
  const [emailValue, setEmailValue] = useState(email);
  const [emailFb, setEmailFb] = useState<Feedback>(null);
  const [emailPending, startEmail] = useTransition();

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwFb, setPwFb] = useState<Feedback>(null);
  const [pwPending, startPw] = useTransition();

  // Currency
  const [currency, setCurrency] = useState(initialCurrency);
  const [currencyFb, setCurrencyFb] = useState<Feedback>(null);
  const [currencyPending, startCurrency] = useTransition();

  // Delete
  const [confirmText, setConfirmText] = useState("");
  const [deleteFb, setDeleteFb] = useState<Feedback>(null);
  const [deletePending, startDelete] = useTransition();

  return (
    <div className="space-y-6">
      {/* Name */}
      <Section
        title="Your name"
        description="How we greet you across Wanderly."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startName(async () =>
              setNameFb(toFeedback(await updateDisplayName(name)))
            );
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="display-name" className="sr-only">
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Rivera"
            className={fieldClass}
          />
          <Button type="submit" disabled={namePending} className="shrink-0">
            {namePending ? "Saving…" : "Save name"}
          </Button>
        </form>
        <FeedbackLine feedback={nameFb} />
      </Section>

      {/* Email */}
      <Section
        title="Email address"
        description="Changing this sends a confirmation link to the new address."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startEmail(async () =>
              setEmailFb(toFeedback(await updateEmail(emailValue)))
            );
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="account-email" className="sr-only">
            Email address
          </label>
          <input
            id="account-email"
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            autoComplete="email"
            className={fieldClass}
          />
          <Button type="submit" disabled={emailPending} className="shrink-0">
            {emailPending ? "Saving…" : "Update email"}
          </Button>
        </form>
        <FeedbackLine feedback={emailFb} />
      </Section>

      {/* Password */}
      <Section
        title="Password"
        description="Use at least 8 characters. We'll confirm your current password first."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startPw(async () => {
              const result = await updatePassword(currentPw, newPw);
              setPwFb(toFeedback(result));
              if (!result.error) {
                setCurrentPw("");
                setNewPw("");
              }
            });
          }}
          className="space-y-3"
        >
          <div>
            <label
              htmlFor="current-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className={fieldClass}
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-sm font-medium text-neutral-700"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className={fieldClass}
            />
          </div>
          <Button type="submit" disabled={pwPending}>
            {pwPending ? "Updating…" : "Change password"}
          </Button>
        </form>
        <FeedbackLine feedback={pwFb} />
      </Section>

      {/* Currency */}
      <Section
        title="Default currency"
        description="Used as the default when adding budgets and expenses."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startCurrency(async () =>
              setCurrencyFb(toFeedback(await updateCurrency(currency)))
            );
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="currency" className="sr-only">
            Default currency
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className={fieldClass}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} {c.code} — {c.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={currencyPending} className="shrink-0">
            {currencyPending ? "Saving…" : "Save currency"}
          </Button>
        </form>
        <FeedbackLine feedback={currencyFb} />
      </Section>

      {/* Danger zone */}
      <section className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-6">
        <h2 className="text-lg font-bold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Permanently delete your account and all of your trips, itineraries,
          and budgets. This cannot be undone. Type{" "}
          <span className="font-mono font-semibold">DELETE</span> to confirm.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startDelete(async () => {
              const result = await deleteAccount(confirmText);
              // On success the action redirects; only errors return here.
              if (result?.error) setDeleteFb(toFeedback(result));
            });
          }}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <label htmlFor="delete-confirm" className="sr-only">
            Type DELETE to confirm
          </label>
          <input
            id="delete-confirm"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className={fieldClass}
          />
          <Button
            type="submit"
            variant="danger"
            disabled={deletePending || confirmText.trim() !== "DELETE"}
            className="shrink-0"
          >
            {deletePending ? "Deleting…" : "Delete account"}
          </Button>
        </form>
        <FeedbackLine feedback={deleteFb} />
      </section>
    </div>
  );
}
