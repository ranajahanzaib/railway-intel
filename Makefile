export PATH := $(PWD)/.venv/bin:$(PATH)

.PHONY: setup doctor api data-discover data-bootstrap data-download data-normalize data-build data-validate dev test lint format build clean
setup:
	uv sync --locked --extra dev --extra warehouse
	pnpm install --frozen-lockfile

doctor:
	@python --version; uv --version; node --version; (pnpm --version 2>/dev/null || node -e "console.log('pnpm lockfile installed')")

api:
	uv run uvicorn railway_intel.api:app --host 127.0.0.1 --port 8000 --reload

data-discover:
	uv run python -m railway_intel.cli discover

data-download:
	@test -n "$(MONTH)" || (echo 'Set MONTH=YYYY-MM' && exit 2)
	uv run python -m railway_intel.cli download --month $(MONTH)

data-bootstrap:
	uv run python -m railway_intel.cli download --month 2024-07

data-normalize:
	@test -n "$(MONTH)" || (echo 'Set MONTH=YYYY-MM' && exit 2)
	uv run python -m railway_intel.cli normalize --month $(MONTH)

data-build:
	uv run --extra warehouse dbt build --project-dir . --profiles-dir . --profile railway_intel

data-validate:
	uv run python -c "from railway_intel.analytics import summary; print(summary())"

dev:
	@uv run uvicorn railway_intel.api:app --host 127.0.0.1 --port 8000 --reload & API_PID=$$!; trap 'kill $$API_PID 2>/dev/null || true' EXIT INT TERM; NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 pnpm dev --hostname 127.0.0.1

test:
	uv run --extra dev pytest

lint:
	uv run --extra dev ruff check railway_intel tests

format:
	uv run --extra dev ruff format railway_intel tests

build:
	pnpm build

clean:
	rm -rf .next target dbt_packages
