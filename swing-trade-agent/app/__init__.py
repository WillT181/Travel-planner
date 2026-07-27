"""Swing Trade Signal Agent.

A decision-support tool that identifies swing-trading setups across a
Trading 212 portfolio and outputs plain-English rationales.

Core principle: all indicator math and signal rules are deterministic Python.
The LLM is used ONLY to translate already-computed structured signal data into
readable explanations. This package never places trades.
"""

__version__ = "0.1.0"
