"use client";

import { useState } from "react";
import Button, { buttonVariants } from "@/components/ui/Button";

export default function ReferralShare({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  const message =
    "I'm planning my trips with Wanderly — join me and we both get rewards:";
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`;
  const email = `mailto:?subject=${encodeURIComponent(
    "Plan your next trip with Wanderly"
  )}&body=${encodeURIComponent(`${message}\n\n${link}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <label htmlFor="referral-link" className="sr-only">
        Your referral link
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="referral-link"
          type="text"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-full flex-1 rounded-lg border border-neutral-300 bg-neutral-50 px-3.5 text-sm text-neutral-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Button onClick={copy} className="shrink-0">
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Share on WhatsApp
        </a>
        <a
          href={email}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Share by email
        </a>
      </div>
    </div>
  );
}
