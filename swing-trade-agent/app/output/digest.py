"""Render a daily digest of signal reports as Markdown or HTML."""

from __future__ import annotations

import datetime as dt
import html

from app.output.models import SignalReport
from app.signals.levels import build_trade_plan

_DISCLAIMER = (
    "Decision-support only. These are algorithmically flagged setups for review, "
    "not financial advice and not trade instructions. No orders are placed."
)


def _fmt_levels(levels: dict[str, float]) -> str:
    order = ["close", "sma_20", "sma_50", "sma_200", "bb_lower", "bb_mid", "bb_upper"]
    pairs = [f"{k}={levels[k]:.2f}" for k in order if k in levels]
    return ", ".join(pairs)


def render_markdown_digest(
    reports: list[SignalReport], date: dt.date | None = None
) -> str:
    date = date or dt.date.today()
    lines = [
        f"# Swing Signal Digest — {date.isoformat()}",
        "",
        f"_{_DISCLAIMER}_",
        "",
    ]
    if not reports:
        lines.append("No setups crossed the signal threshold today.")
        return "\n".join(lines)

    ranked = sorted(reports, key=lambda r: r.signal.composite_score, reverse=True)
    lines.append(f"**{len(ranked)} setup(s) flagged.**")
    lines.append("")
    for rep in ranked:
        sig = rep.signal
        lines.append(f"## {sig.symbol} — score {sig.composite_score:.2f} ({sig.direction})")
        lines.append("")
        lines.append(f"- **Rules:** {', '.join(sig.triggered_rule_names) or '—'}")
        if sig.suggested_stop is not None:
            lines.append(f"- **Stop context (2×ATR):** {sig.suggested_stop:.2f}")
        lines.append(f"- **Key levels:** {_fmt_levels(sig.key_levels)}")
        plan = build_trade_plan(sig)
        if plan is not None:
            lines.append(
                f"- **Entry zone:** {plan.entry_low:.2f}–{plan.entry_high:.2f} "
                f"(risk {plan.risk_per_share:.2f}/share against {plan.stop:.2f})"
            )
            ladder = ", ".join(f"{k} {v:.2f}" for k, v in plan.r_targets.items())
            lines.append(f"- **R ladder:** {ladder}")
            if plan.reward_risk is not None:
                flag = "" if plan.meets_min_reward_risk else "  ⚠ below minimum"
                lines.append(
                    f"- **Reward:risk:** {plan.reward_risk:.2f} to "
                    f"{plan.resistance_label} {plan.resistance:.2f}{flag}"
                )
            if plan.shares:
                lines.append(
                    f"- **Size at configured risk:** {plan.shares} share(s), "
                    f"{plan.notional:.2f} notional, {plan.risk_amount:.2f} at risk"
                )
            for note in plan.notes:
                lines.append(f"- _{note}_")
        lines.append("")
        lines.append(rep.rationale)
        lines.append("")
    return "\n".join(lines)


def render_html_digest(reports: list[SignalReport], date: dt.date | None = None) -> str:
    date = date or dt.date.today()
    ranked = sorted(reports, key=lambda r: r.signal.composite_score, reverse=True)

    rows = []
    for rep in ranked:
        sig = rep.signal
        rows.append(
            f"<article style='margin:0 0 24px;padding:16px;border:1px solid #e2e8f0;"
            f"border-radius:10px'>"
            f"<h2 style='margin:0 0 4px'>{html.escape(sig.symbol)} "
            f"<small style='color:#64748b'>score {sig.composite_score:.2f} · "
            f"{html.escape(sig.direction)}</small></h2>"
            f"<p style='margin:4px 0;color:#334155'><strong>Rules:</strong> "
            f"{html.escape(', '.join(sig.triggered_rule_names) or '—')}</p>"
            f"<p style='margin:4px 0;color:#334155'><strong>Levels:</strong> "
            f"{html.escape(_fmt_levels(sig.key_levels))}</p>"
            f"<p style='margin:8px 0;white-space:pre-wrap'>"
            f"{html.escape(rep.rationale)}</p>"
            f"</article>"
        )
    body = "".join(rows) or "<p>No setups crossed the signal threshold today.</p>"
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>Swing Signal Digest — {date.isoformat()}</title></head>"
        "<body style='font-family:system-ui,Segoe UI,Arial,sans-serif;"
        "max-width:720px;margin:0 auto;padding:24px;color:#0f172a'>"
        f"<h1 style='margin:0 0 4px'>Swing Signal Digest</h1>"
        f"<p style='color:#64748b;margin:0 0 16px'>{date.isoformat()}</p>"
        f"<p style='font-size:12px;color:#94a3b8;margin:0 0 20px'>{html.escape(_DISCLAIMER)}</p>"
        f"{body}"
        "</body></html>"
    )
