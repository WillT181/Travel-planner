import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const country = searchParams.get("country") ?? "Travel Guide";
  const flag = searchParams.get("flag") ?? "🌍";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #065f46 100%)",
          padding: "60px",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
          }}
        />

        {/* Flag */}
        <div style={{ fontSize: 88, marginBottom: 28, lineHeight: 1 }}>
          {flag}
        </div>

        {/* Country name */}
        <div
          style={{
            fontSize: country.length > 14 ? 60 : 72,
            fontWeight: 700,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {country}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            color: "rgba(255,255,255,0.75)",
            marginTop: 20,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Travel Guide
        </div>

        {/* Wordmark */}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            right: 60,
            fontSize: 22,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 600,
          }}
        >
          Wanderly
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
