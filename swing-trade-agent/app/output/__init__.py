"""Output layer: Supabase persistence, markdown/HTML digest, email."""

from app.output.models import SignalReport
from app.output.digest import render_html_digest, render_markdown_digest
from app.output.supabase_writer import read_todays_signals, write_signals
from app.output.email import send_digest_email

__all__ = [
    "SignalReport",
    "read_todays_signals",
    "render_html_digest",
    "render_markdown_digest",
    "send_digest_email",
    "write_signals",
]
