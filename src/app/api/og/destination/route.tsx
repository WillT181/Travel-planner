import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { resolveImage, slugKeys, unsplashSrc } from "@/lib/images";

export const runtime = "edge";

/**
 * OpenGraph image (1200×630) for destination + guide pages.
 *
 * With a curated photo: the destination's selected Unsplash image as the
 * background, a dark gradient scrim for legibility, the destination name in
 * the brand display font, and the photographer credit.
 * Without one: the brand teal gradient (never a wrong or random photo).
 *
 * Query: ?name=Lisbon&country=Portugal&slug=lisbon
 */

const SIZE = { width: 1200, height: 630 };

// Bricolage Grotesque ExtraBold for the display type; fetched once per
// isolate and reused. Falls back to system sans if the fetch fails.
let fontPromise: Promise<ArrayBuffer | null> | null = null;
function loadDisplayFont(): Promise<ArrayBuffer | null> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        const css = await (
          await fetch(
            "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&display=swap",
            { headers: { "User-Agent": "Mozilla/5.0" } }
          )
        ).text();
        const url = css.match(
          /src: url\((.+?)\) format\('(woff2?|truetype|opentype)'\)/
        )?.[1];
        if (!url) return null;
        return await (await fetch(url)).arrayBuffer();
      } catch {
        return null;
      }
    })();
  }
  return fontPromise;
}

async function loadPhoto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get("content-type") ?? "image/jpeg";
    let binary = "";
    const bytes = new Uint8Array(buf);
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunk))
      );
    }
    return `data:${type};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name =
    searchParams.get("name") ?? searchParams.get("country") ?? "Wanderly";
  const country = searchParams.get("country") ?? "";
  const slug = searchParams.get("slug") ?? "";
  const flag = searchParams.get("flag") ?? "";

  const image = slug ? resolveImage(...slugKeys(slug)) : null;
  const [photo, fontData] = await Promise.all([
    image ? loadPhoto(unsplashSrc(image, 1200)) : Promise.resolve(null),
    loadDisplayFont(),
  ]);

  const display = fontData
    ? [{ name: "Bricolage", data: fontData, weight: 800 as const }]
    : undefined;
  const fontFamily = fontData ? "Bricolage" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background:
            "linear-gradient(135deg, #0d9488 0%, #145C6B 50%, #0F1C21 100%)",
          fontFamily,
        }}
      >
        {/* Photo background */}
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        {/* Legibility scrim */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: photo
              ? "linear-gradient(to top, rgba(15,28,33,0.85) 0%, rgba(15,28,33,0.25) 45%, rgba(15,28,33,0) 70%)"
              : "radial-gradient(100% 100% at 80% 0%, rgba(237,155,64,0.25) 0%, rgba(237,155,64,0) 60%)",
          }}
        />

        {/* Text block */}
        <div
          style={{
            position: "absolute",
            left: 64,
            right: 64,
            bottom: 56,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {country && country !== name && (
            <div
              style={{
                fontSize: 28,
                color: "rgba(253,251,247,0.85)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              {flag ? `${flag} ` : ""}
              {country}
            </div>
          )}
          <div
            style={{
              fontSize: name.length > 16 ? 72 : 88,
              fontWeight: 800,
              color: "#FDFBF7",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: "rgba(253,251,247,0.75)",
                display: "flex",
              }}
            >
              wanderly.travel
            </div>
            {image && (
              <div
                style={{
                  fontSize: 18,
                  color: "rgba(253,251,247,0.6)",
                  display: "flex",
                }}
              >
                Photo: {image.photographer} / Unsplash
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: display,
    }
  );
}
