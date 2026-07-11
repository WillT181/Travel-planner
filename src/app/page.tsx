import Link from "next/link";
import Hero from "@/components/home/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import TrendingDestinations from "@/components/home/TrendingDestinations";
import ProductShowcase from "@/components/home/ProductShowcase";
import SocialProof from "@/components/home/SocialProof";
import UpgradeCta from "@/components/home/UpgradeCta";

export default function HomePage() {
  return (
    // Full-bleed breakout from the layout's max-w-7xl container so the
    // redesign's cream sections run edge to edge (body has overflow-x: clip
    // to absorb the scrollbar-width sliver from w-screen).
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 bg-[#FAF6EF] font-instrument text-[#22303A]">
      {/* Announcement */}
      <Link
        href="/itinerary"
        className="block bg-[#145C6B] px-4 py-[9px] text-center text-[13.5px] font-medium text-[#DFF1F2] transition-colors hover:bg-[#0F4B57] hover:text-white"
      >
        Summer planning is open — build your first trip free, no account needed
        ✈
      </Link>

      <Hero />
      <HowItWorks />
      <TrendingDestinations />
      <ProductShowcase />
      <SocialProof />
      <UpgradeCta />
    </div>
  );
}
