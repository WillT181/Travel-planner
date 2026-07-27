// This frontend uses plain CSS (see app/globals.css) — no Tailwind/PostCSS
// plugins. This empty config exists so PostCSS stops its upward config search
// here and never picks up the parent Travel-Planner project's postcss.config
// (which requires `tailwindcss`, a package this app does not install).
/** @type {import('postcss').Config} */
const config = {
  plugins: {},
};

export default config;
