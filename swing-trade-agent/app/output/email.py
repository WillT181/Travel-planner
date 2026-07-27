"""Optional email delivery of the digest via the Resend REST API.

No SDK dependency — a single POST. No-op (returns False) when unconfigured.
"""

from __future__ import annotations

import datetime as dt

import requests

from app.config import Config, load_config
from app.output.digest import render_html_digest
from app.output.models import SignalReport

RESEND_ENDPOINT = "https://api.resend.com/emails"


def send_digest_email(
    reports: list[SignalReport],
    config: Config | None = None,
    date: dt.date | None = None,
) -> bool:
    """Send the HTML digest by email. Returns True if a send was attempted OK."""
    config = config or load_config()
    if not (config.resend_api_key and config.digest_from and config.digest_to):
        return False

    date = date or dt.date.today()
    html_body = render_html_digest(reports, date=date)
    payload = {
        "from": config.digest_from,
        "to": [config.digest_to],
        "subject": f"Swing Signal Digest — {date.isoformat()} "
        f"({len(reports)} setup(s))",
        "html": html_body,
    }
    try:
        resp = requests.post(
            RESEND_ENDPOINT,
            json=payload,
            headers={"Authorization": f"Bearer {config.resend_api_key}"},
            timeout=20,
        )
        return resp.status_code < 300
    except requests.RequestException:  # pragma: no cover - network dependent
        return False
