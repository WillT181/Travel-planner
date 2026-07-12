/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Curated destination photography (see src/lib/images.ts)
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async redirects() {
    return [
      // Legacy destination-search URL. /explore is the canonical pattern;
      // the query string (?q=…) is carried over automatically, so
      // /search?q=Tokyo → /explore?q=Tokyo pre-filters the grid.
      {
        source: "/search",
        destination: "/explore",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
