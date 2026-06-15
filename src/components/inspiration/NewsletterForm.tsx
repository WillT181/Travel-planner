"use client";

export default function NewsletterForm() {
  return (
    <form
      className="mx-auto mt-6 flex max-w-md gap-2"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="email"
        placeholder="your@email.com"
        className="flex-1 rounded-xl border-0 bg-white/10 px-4 py-2.5 text-white placeholder-primary-200 ring-1 ring-white/20 focus:outline-none focus:ring-2 focus:ring-white"
      />
      <button
        type="submit"
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
      >
        Subscribe
      </button>
    </form>
  );
}
