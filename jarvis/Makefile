.PHONY: install lint typecheck test check eval-dry eval serve owner

install:
	pip install -e '.[dev]'

lint:
	ruff check src tests
	ruff format --check src tests

typecheck:
	mypy

test:
	pytest

check: lint typecheck test

eval-dry:
	jarvis-eval --backend fake --min-pass-rate 0

eval:
	jarvis-eval --json eval-results.json

serve:
	jarvis-public

owner:
	jarvis-owner
