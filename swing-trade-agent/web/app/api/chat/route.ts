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
    const data = await upstream.json().catch(() => ({
      error: "Agent backend returned a non-JSON response.",
    }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the agent backend. Is the Python API running?" },
      { status: 502 },
    );
  }
}
