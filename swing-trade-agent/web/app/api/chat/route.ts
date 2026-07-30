// Server-side proxy to the FastAPI agent backend.
//
// The browser calls this same-origin route; it forwards to the Python service
// (which holds every secret and runs app/agent.py's loop). AGENT_API_URL is a
// server-only env var — it is never sent to the browser.

import { NextResponse } from "next/server";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${AGENT_API_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    // Read as text first: a crashed backend replies with a plain-text
    // "Internal Server Error", and blindly calling .json() threw away the only
    // clue about what actually went wrong.
    const raw = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      const snippet = raw.trim().slice(0, 400);
      return NextResponse.json(
        {
          error:
            `Agent backend returned HTTP ${upstream.status} with a non-JSON body` +
            (snippet ? `: ${snippet}` : " (empty response)") +
            ". Check the terminal running the backend for the full traceback.",
        },
        { status: upstream.status === 200 ? 502 : upstream.status },
      );
    }
    // FastAPI reports errors as {detail: "..."}; the UI renders {error: "..."}.
    if (!upstream.ok && data && typeof data === "object" && !("error" in data)) {
      const detail = (data as { detail?: unknown }).detail;
      if (typeof detail === "string") {
        return NextResponse.json({ error: detail }, { status: upstream.status });
      }
    }
    return NextResponse.json(data as object, { status: upstream.status });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error:
          "Cannot reach the agent backend. Is the Python API running on " +
          `${AGENT_API_URL}? (${reason})`,
      },
      { status: 502 },
    );
  }
}
