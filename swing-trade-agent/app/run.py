"""CLI entrypoint: ``python -m app.run`` (and the ``swing-agent`` script).

Subcommands
-----------
run       Run the daily pipeline and print/emit the digest.
backtest  Replay the rules over history and print per-rule stats.
"""

from __future__ import annotations

import argparse
import logging
import sys

from app.config import load_config


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _cmd_run(args: argparse.Namespace) -> int:
    from app.output.digest import render_html_digest, render_markdown_digest
    from app.pipeline import run_pipeline

    config = load_config()
    reports = run_pipeline(
        config=config,
        symbols=args.symbols or None,
        use_cache=not args.no_cache,
        write=not args.dry_run,
    )

    if args.html:
        output = render_html_digest(reports)
    else:
        output = render_markdown_digest(reports)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(output)
        print(f"Wrote digest to {args.out} ({len(reports)} setup(s)).")
    else:
        print(output)
    return 0


def _cmd_backtest(args: argparse.Namespace) -> int:
    from app.backtest import format_report, run_backtest
    from app.prices import get_price_provider

    from app.symbols import SymbolSourceError, resolve_symbols

    config = load_config()
    try:
        universe = resolve_symbols(config, args.symbols or None)
    except SymbolSourceError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    symbols = universe.symbols
    print(f"Backtesting {len(symbols)} symbol(s) from {universe.source}.", file=sys.stderr)

    provider = get_price_provider(config, use_cache=not args.no_cache)
    price_data = {}
    for sym in symbols:
        try:
            price_data[sym] = provider.get_history(sym, lookback_days=args.history)
        except Exception as exc:  # noqa: BLE001
            print(f"skip {sym}: {exc}", file=sys.stderr)

    if not price_data:
        print("No price data available to backtest.", file=sys.stderr)
        return 1

    report = run_backtest(price_data, horizons=tuple(args.horizons))
    print(format_report(report))
    return 0


def _cmd_doctor(args: argparse.Namespace) -> int:
    from app.doctor import format_checks, run_checks

    checks = run_checks(load_config())
    print(format_checks(checks))
    return 1 if any(c.required for c in checks) else 0


SUBCOMMANDS = {"run", "backtest", "doctor"}


def build_parser() -> argparse.ArgumentParser:
    # -v/--verbose is shared by both subcommands via a parent parser so it works
    # in any position (including the default-to-run path below).
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("-v", "--verbose", action="store_true")

    parser = argparse.ArgumentParser(
        prog="swing-agent",
        description="Swing-trade signal decision-support tool (does not trade).",
    )
    sub = parser.add_subparsers(dest="command")

    p_run = sub.add_parser("run", parents=[common], help="run the daily signal pipeline")
    p_run.add_argument("--symbols", nargs="*", help="override portfolio symbols")
    p_run.add_argument("--html", action="store_true", help="emit HTML instead of markdown")
    p_run.add_argument("--out", help="write digest to a file instead of stdout")
    p_run.add_argument("--no-cache", action="store_true", help="bypass the price cache")
    p_run.add_argument(
        "--dry-run", action="store_true", help="do not write to Supabase / send email"
    )
    p_run.set_defaults(func=_cmd_run)

    p_bt = sub.add_parser("backtest", parents=[common], help="backtest the rules over history")
    p_bt.add_argument("--symbols", nargs="*", help="symbols (default: portfolio)")
    p_bt.add_argument(
        "--horizons", type=int, nargs="+", default=[5, 10, 20],
        help="forward-return windows in trading days",
    )
    p_bt.add_argument("--history", type=int, default=750, help="lookback days to fetch")
    p_bt.add_argument("--no-cache", action="store_true")
    p_bt.set_defaults(func=_cmd_backtest)

    p_doc = sub.add_parser(
        "doctor", parents=[common], help="check the setup and report what's missing"
    )
    p_doc.set_defaults(func=_cmd_doctor)

    return parser


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:]) if argv is None else list(argv)
    # `python -m app.run` (and `... --out x`) default to the `run` subcommand,
    # so scheduled runs need no explicit subcommand. Help still works.
    if not argv or (argv[0] not in SUBCOMMANDS and argv[0] not in ("-h", "--help")):
        argv = ["run", *argv]

    parser = build_parser()
    args = parser.parse_args(argv)
    _setup_logging(getattr(args, "verbose", False))
    return args.func(args)


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
