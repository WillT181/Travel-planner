import Hero from "@/components/home/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import TrendingDestinations from "@/components/home/TrendingDestinations";
import SocialProof from "@/components/home/SocialProof";
import UpgradeCta from "@/components/home/UpgradeCta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <TrendingDestinations />
      <SocialProof />
      <UpgradeCta />
    </>
  );
}
