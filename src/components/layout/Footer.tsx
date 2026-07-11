import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/help", label: "Help Centre" },
  { href: "/privacy", label: "Privacy" },
  { href: "/design-system", label: "Design system" },
] as const;

function CompassIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 text-accent-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold text-primary-700 transition-colors hover:text-primary-800"
          >
            <CompassIcon />
            Wanderly
          </Link>

          {/* Links */}
          <nav aria-label="Footer navigation">
            <ul
              className="flex flex-wrap justify-center gap-x-6 gap-y-2"
              role="list"
            >
              {FOOTER_LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-neutral-400">
            © {new Date().getFullYear()} Wanderly, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
