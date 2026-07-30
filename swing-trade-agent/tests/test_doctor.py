"""Tests for the setup diagnostics (`python -m app.run doctor`).

The app degrades gracefully everywhere, so a misconfiguration surfaces as bland
empty output rather than an error. These tests pin the behaviour that makes a
setup mistake *visible*: the right status, and a fix the user can act on.
"""

from __future__ import annotations

import pytest

from app.config import Config
from app.doctor import FAIL, OK, WARN, Check, format_checks, run_checks
from app.output.supabase_writer import check_supabase

_ENV_VARS = (
    "ANTHROPIC_API_KEY",
    "WATCHLIST",
    "T212_API_KEY",
    "T212_BASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEWS_API_KEY",
    "FINNHUB_API_KEY",
    "RESEND_API_KEY",
    "DIGEST_TO",
)


@pytest.fixture
def clean_env(monkeypatch):
    for name in _ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def _named(checks: list[Check], name: str) -> Check:
    return next(c for c in checks if c.name == name)


class TestAnthropicCheck:
    def test_missing_key_is_blocking_with_a_fix(self, clean_env):
        check = _named(run_checks(Config()), "Anthropic API key")
        assert check.status == FAIL
        assert "set-key.sh" in check.fix

    def test_valid_key_passes(self, clean_env):
        clean_env.setenv("ANTHROPIC_API_KEY", "sk-ant-" + "a" * 100)
        assert _named(run_checks(Config()), "Anthropic API key").status == OK

    def test_doubled_key_is_flagged(self, clean_env):
        """The real bug we hit: a key pasted twice is found but rejected upstream."""
        clean_env.setenv("ANTHROPIC_API_KEY", "sk-ant-" + "a" * 210)
        check = _named(run_checks(Config()), "Anthropic API key")
        assert check.status == WARN
        assert "twice" in check.detail

    def test_wrong_shaped_key_is_blocking(self, clean_env):
        clean_env.setenv("ANTHROPIC_API_KEY", "not-an-anthropic-key")
        assert _named(run_checks(Config()), "Anthropic API key").status == FAIL


class TestSymbolsCheck:
    def test_no_symbols_is_blocking(self, clean_env):
        check = _named(run_checks(Config()), "Symbols to screen")
        assert check.status == FAIL
        assert "WATCHLIST" in check.fix

    def test_watchlist_passes_and_is_named(self, clean_env):
        clean_env.setenv("WATCHLIST", "AAPL,MSFT")
        check = _named(run_checks(Config()), "Symbols to screen")
        assert check.status == OK
        assert "watchlist" in check.detail
        assert "AAPL" in check.detail


class TestOptionalChecks:
    def test_unconfigured_optionals_never_block(self, clean_env):
        clean_env.setenv("ANTHROPIC_API_KEY", "sk-ant-" + "a" * 100)
        clean_env.setenv("WATCHLIST", "AAPL")
        for name in ("Memory (Supabase)", "Trading 212", "News / events", "Email digest"):
            assert _named(run_checks(Config()), name).status == WARN

    def test_non_demo_trading212_is_flagged(self, clean_env):
        clean_env.setenv("T212_API_KEY", "key")
        clean_env.setenv("T212_BASE_URL", "https://live.trading212.com/api/v0")
        check = _named(run_checks(Config()), "Trading 212")
        assert check.status == WARN
        assert "NON-DEMO" in check.detail


class TestReport:
    def test_a_broken_check_becomes_a_row_not_a_crash(self, clean_env, monkeypatch):
        monkeypatch.setattr(
            "app.doctor._check_prices",
            lambda cfg: (_ for _ in ()).throw(RuntimeError("boom")),
        )
        checks = run_checks(Config())
        assert any(c.status == FAIL and "boom" in c.detail for c in checks)

    def test_format_lists_fixes_for_failures_only(self):
        text = format_checks(
            [
                Check("Good", OK, "fine", "unused fix"),
                Check("Bad", FAIL, "broken", "do the thing"),
            ]
        )
        assert "do the thing" in text
        assert "unused fix" not in text
        assert "1 blocking issue" in text

    def test_format_reports_all_clear(self):
        text = format_checks([Check("Good", OK, "fine")])
        assert "No blocking issues" in text


class TestCheckSupabase:
    def test_unconfigured_names_the_missing_vars(self, clean_env):
        result = check_supabase(Config())
        assert result["ok"] is False
        assert "SUPABASE_URL" in result["detail"]

    def test_missing_table_gives_the_migration_fix(self, clean_env, monkeypatch):
        clean_env.setenv("SUPABASE_URL", "https://x.supabase.co")
        clean_env.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")

        class _FakeSupabase:
            @staticmethod
            def create_client(url, key):
                raise RuntimeError('relation "public.signals" does not exist')

        monkeypatch.setitem(__import__("sys").modules, "supabase", _FakeSupabase)
        result = check_supabase(Config())
        assert result["ok"] is False
        assert "0001_signals.sql" in result["fix"]

    def test_bad_credentials_are_distinguished(self, clean_env, monkeypatch):
        clean_env.setenv("SUPABASE_URL", "https://x.supabase.co")
        clean_env.setenv("SUPABASE_SERVICE_ROLE_KEY", "wrong")

        class _FakeSupabase:
            @staticmethod
            def create_client(url, key):
                raise RuntimeError("Invalid API key / JWT")

        monkeypatch.setitem(__import__("sys").modules, "supabase", _FakeSupabase)
        result = check_supabase(Config())
        assert "service_role" in result["fix"]

    def test_connected_and_empty_is_reported_as_ok(self, clean_env, monkeypatch):
        clean_env.setenv("SUPABASE_URL", "https://x.supabase.co")
        clean_env.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")

        class _Resp:
            data: list = []

        class _Query:
            def select(self, *a, **k):
                return self

            def order(self, *a, **k):
                return self

            def limit(self, *a, **k):
                return self

            def execute(self):
                return _Resp()

        class _Client:
            def table(self, name):
                assert name == "signals"
                return _Query()

        class _FakeSupabase:
            @staticmethod
            def create_client(url, key):
                return _Client()

        monkeypatch.setitem(__import__("sys").modules, "supabase", _FakeSupabase)
        result = check_supabase(Config())
        assert result["ok"] is True
        assert "empty" in result["detail"]
