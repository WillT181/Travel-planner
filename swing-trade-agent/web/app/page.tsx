"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = { role: "user" | "agent"; content: string };

const BRIEFING_PROMPT =
  "Give me today's daily briefing — what's worth looking at, leading with what changed or is unusual.";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: message }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = data?.detail || data?.error || `Request failed (${res.status}).`;
        setMessages((m) => [...m, { role: "agent", content: `⚠️ ${err}` }]);
        return;
      }
      setSessionId(data.session_id);
      // The server returns the full renderable history — use it as the source of truth.
      setMessages(data.history as Message[]);
    } catch {
      setMessages((m) => [...m, { role: "agent", content: "⚠️ Could not reach the agent." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Swing Trade Signal Agent</h1>
        <span className="env">screening only · not financial advice</span>
      </header>

      <div className="messages">
        {messages.length === 0 && !loading && (
          <div className="empty">
            Ask about your holdings, today&apos;s signals, a symbol&apos;s rationale, news, or a
            backtest — or hit <strong>Daily briefing</strong>.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "agent" ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            ) : (
              m.content
            )}
          </div>
        ))}
        {loading && <div className="msg agent">…thinking</div>}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <button
          className="secondary"
          onClick={() => send(BRIEFING_PROMPT)}
          disabled={loading}
          title="Ask for today's daily briefing"
        >
          Daily briefing
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="Message the agent…"
          disabled={loading}
        />
        <button onClick={() => send(input)} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>

      <footer>
        Decision-support / screening only. Reasons only from tool data; does not place trades and
        does not give financial advice.
      </footer>
    </div>
  );
}
