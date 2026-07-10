/** @type {import('next').NextConfig} */
const nextConfig = {
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
