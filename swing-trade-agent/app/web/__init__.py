"""Thin web layer (FastAPI) over the terminal agent loop.

This is ONLY a front end over app/agent.py's tool-using loop — it reuses
`run_turn` verbatim and adds no reasoning of its own. All secrets stay here on
the server; the browser only ever sees the agent's text reply.
"""
