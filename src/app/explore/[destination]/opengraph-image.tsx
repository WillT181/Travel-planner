import { ImageResponse } from "next/og";
import { DESTINATIONS, getDestination } from "@/data/destinations";

export const runtime = "edge";
export const alt = "Destination guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: { destination: string };
}

export function generateStaticParams() {
  return DESTINATIONS.map((d) => ({ destination: d.slug }));
}

export default function Image({ params }: Props) {
  const destination = getDestination(params.destination);
  const name = destination?.name ?? "Explore";
  const country = destination?.country ?? "";
  const summary = destination?.summary ?? "";
  const imageUrl = `https://picsum.photos/seed/${destination?.imageSeed ?? "travel"}/1200/630`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          width: "1200px",
          height: "630px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.10) 100%)",
          }}
        />
        {/* Content */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "48px 56px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                background: "#0d9488",
                color: "white",
                fontSize: "13px",
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: "999px",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Wanderly
            </div>
            <span
              style={{
                color: "rgba(255,255,255,0.7)",
                fontSize: "14px",
              }}
            >
              Destination guide
            </span>
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "18px",
              fontWeight: 500,
            }}
          >
            {country}
          </div>
          <div
            style={{
              color: "white",
              fontSize: "56px",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {name}
          </div>
          {summary && (
            <div
              style={{
                color: "rgba(255,255,255,0.8)",
                fontSize: "18px",
                maxWidth: "720px",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {summary}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
