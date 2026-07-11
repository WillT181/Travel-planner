"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DestinationSearch from "@/components/DestinationSearch";

/**
 * Homepage hero search — the cream pill with an attached amber Search button
 * from the "Wanderly Home" design. Selecting a suggestion navigates to
 * /explore/{slug}; free text (button or Enter) goes to /explore?q={text}.
 */
export default function PillSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitFreeText(text: string) {
    const q = text.trim();
    router.push(q ? `/explore?q=${encodeURIComponent(q)}` : "/explore");
  }

  return (
    <div className="flex items-center gap-2.5 rounded-full border-[1.5px] border-[#E7DECB] bg-[#FDFBF7] py-1.5 pl-5 pr-1.5 shadow-[0_6px_24px_rgba(34,48,58,0.09)] transition-colors focus-within:border-[#1E8A97]">
      <span aria-hidden="true" className="flex-none text-lg text-[#17727F]">
        ◎
      </span>
      <DestinationSearch
        variant="bare"
        className="min-w-0 flex-1"
        placeholder="Where do you want to go?"
        onQueryChange={setQuery}
        onSubmitText={submitFreeText}
        onSelect={(entry) => router.push(`/explore/${entry.slug}`)}
      />
      <button
        type="button"
        onClick={() => submitFreeText(query)}
        className="min-h-[48px] flex-none rounded-full bg-[#ED9B40] px-6 py-3 text-[15.5px] font-semibold text-[#3A2408] transition-colors hover:bg-[#DE8B2F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E8A97] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF7]"
      >
        Search
      </button>
    </div>
  );
}
