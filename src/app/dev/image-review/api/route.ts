import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "src/data/destinations/images.json");

/**
 * Dev-only: persists a curation choice from /dev/image-review back into
 * images.json. Body: { key: string, selected: number | null }.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { key, selected } = (await request.json()) as {
    key?: string;
    selected?: number | null;
  };

  if (typeof key !== "string" || !key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const data = fs.existsSync(FILE)
    ? JSON.parse(fs.readFileSync(FILE, "utf8"))
    : {};

  const entry = data[key];
  if (!entry) {
    return NextResponse.json({ error: "unknown key" }, { status: 404 });
  }

  if (
    selected != null &&
    (!Number.isInteger(selected) ||
      selected < 0 ||
      selected >= (entry.candidates?.length ?? 0))
  ) {
    return NextResponse.json({ error: "bad index" }, { status: 400 });
  }

  entry.selected = selected ?? null;
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");

  return NextResponse.json({ ok: true, key, selected: entry.selected });
}
