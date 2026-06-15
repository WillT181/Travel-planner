"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1.5rem",
          textAlign: "center",
          color: "#0f172a",
        }}
      >
        <div>
          <p style={{ fontSize: "2rem" }} aria-hidden="true">
            🧭
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: "0.5rem", color: "#475569" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              borderRadius: "0.5rem",
              backgroundColor: "#0d9488",
              color: "white",
              border: "none",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
