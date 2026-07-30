# Swing Trade Signal Agent — dev convenience targets.
# Use the project virtualenv (.venv) if `make setup` created one.
PY := $(shell [ -x .venv/bin/python ] && echo .venv/bin/python || echo python3)
BACKEND_PORT ?= 8000

.PHONY: help setup install install-web dev backend frontend test key check-key doctor run backtest scan

help:
	@echo "make setup      # one-time: create .venv, install backend + frontend, make .env"
	@echo "make key        # create .env if needed and save your ANTHROPIC_API_KEY into it"
	@echo "make check-key  # report whether the app can read your Anthropic key"
	@echo "make doctor     # check the whole setup and say what's missing"
	@echo "make scan       # screen every symbol now, incl. what did NOT trigger"
	@echo "make backtest   # replay the rules over history vs buy-and-hold"
	@echo "make run        # run the daily pipeline once and print the digest"
	@echo "make dev        # run backend + frontend together  (Ctrl-C stops both)"
	@echo "make backend    # run just the FastAPI backend on :$(BACKEND_PORT)"
	@echo "make frontend   # run just the Next.js frontend on :3000"
	@echo "make test       # run the Python test suite (no keys or network needed)"

setup:
	python3 -m venv .venv
	. .venv/bin/activate && pip install --upgrade pip && pip install -e ".[web,reasoning,prices,output,dev]"
	cd web && npm install
	[ -f .env ] || cp .env.example .env
	@echo ""
	@echo "Setup complete. Now open .env and add your ANTHROPIC_API_KEY, then run:  make dev"

install:
	$(PY) -m pip install -e ".[web,reasoning,prices,output,dev]"

install-web:
	cd web && npm install

key:
	@bash scripts/set-key.sh

doctor:
	@$(PY) -m app.run doctor

# ARGS lets you pass CLI flags through, e.g.  make backtest ARGS="--symbols AAPL MSFT"
scan:
	@$(PY) -m app.run scan $(ARGS)

backtest:
	@$(PY) -m app.run backtest $(ARGS)

run:
	@$(PY) -m app.run run $(ARGS)

check-key:
	@$(PY) -c "from app.config import load_config, ENV_FILE; k = load_config().anthropic_api_key or ''; \
	print('env file :', ENV_FILE, '(exists)' if ENV_FILE.exists() else '(MISSING)'); \
	print('key      :', 'found, length ' + str(len(k)) if k else 'NOT FOUND  ->  run: make key')"

dev:
	./scripts/dev.sh

backend:
	$(PY) -m uvicorn app.web.server:app --reload --port $(BACKEND_PORT)

frontend:
	cd web && npm run dev

test:
	$(PY) -m pytest
