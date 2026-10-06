"""Jarvis: a read-only public assistant and a local, confirmation-gated owner agent.

The two halves share the knowledge brief and the LLM layer, and nothing else.
``jarvis.public`` must never import ``jarvis.owner`` (enforced by tests/test_boundaries.py).
"""

__version__ = "0.1.0"
