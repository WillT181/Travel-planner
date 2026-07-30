"""Tests for .env loading.

These cover the failure mode where the app silently ignored .env and surfaced
only a confusing "ANTHROPIC_API_KEY is not configured": the loader used to
search upward from the *current working directory*, so running the server from
anywhere but swing-trade-agent/ found no keys at all.
"""

from __future__ import annotations

import os

import pytest

from app.config import ENV_FILE, PROJECT_ROOT, _load_env_file_fallback, load_config


def test_env_file_is_anchored_to_project_root_not_cwd():
    """ENV_FILE must be an absolute path under the project, independent of CWD."""
    assert ENV_FILE.is_absolute()
    assert ENV_FILE == PROJECT_ROOT / ".env"


def test_load_config_reads_key_regardless_of_cwd(tmp_path, monkeypatch):
    """Changing directory must not change which .env the app reads."""
    monkeypatch.chdir(tmp_path)  # somewhere with no .env of its own
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-from-environment")
    assert load_config().anthropic_api_key == "sk-ant-from-environment"


class TestFallbackParser:
    """The built-in parser used when python-dotenv is missing or broken."""

    def _write(self, tmp_path, body: str):
        path = tmp_path / ".env"
        path.write_text(body, encoding="utf-8")
        return path

    def test_parses_simple_pairs(self, tmp_path, monkeypatch):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
        path = self._write(tmp_path, "ANTHROPIC_API_KEY=sk-ant-abc123\n")
        _load_env_file_fallback(path)
        assert os.environ["ANTHROPIC_API_KEY"] == "sk-ant-abc123"

    def test_skips_comments_and_blank_lines(self, tmp_path, monkeypatch):
        monkeypatch.delenv("SOME_KEY", raising=False)
        path = self._write(tmp_path, "# a comment\n\n   \nSOME_KEY=value\n")
        _load_env_file_fallback(path)
        assert os.environ["SOME_KEY"] == "value"

    def test_strips_quotes_export_prefix_and_trailing_comment(
        self, tmp_path, monkeypatch
    ):
        for name in ("QUOTED", "EXPORTED", "COMMENTED"):
            monkeypatch.delenv(name, raising=False)
        path = self._write(
            tmp_path,
            'QUOTED="Swing Agent <a@b.co>"\n'
            "export EXPORTED=exported-value\n"
            "COMMENTED=real-value  # trailing note\n",
        )
        _load_env_file_fallback(path)
        assert os.environ["QUOTED"] == "Swing Agent <a@b.co>"
        assert os.environ["EXPORTED"] == "exported-value"
        assert os.environ["COMMENTED"] == "real-value"

    def test_existing_environment_wins(self, tmp_path, monkeypatch):
        """Never clobber a real exported var (matches override=False)."""
        monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-already-set")
        path = self._write(tmp_path, "ANTHROPIC_API_KEY=sk-ant-from-file\n")
        _load_env_file_fallback(path)
        assert os.environ["ANTHROPIC_API_KEY"] == "sk-ant-already-set"

    def test_missing_file_is_not_an_error(self, tmp_path):
        _load_env_file_fallback(tmp_path / "does-not-exist")  # must not raise

    @pytest.mark.parametrize("body", ["no-equals-sign\n", "=only-value\n"])
    def test_malformed_lines_are_ignored(self, tmp_path, body):
        _load_env_file_fallback(self._write(tmp_path, body))  # must not raise
