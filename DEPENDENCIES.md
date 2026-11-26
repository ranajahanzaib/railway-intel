# Dependency compatibility

Manifests use compatible release ranges; `uv.lock` and `pnpm-lock.yaml` preserve resolved graphs for reproducible installs.

- dbt is installed as the optional `warehouse` extra for local transformation and CI work. The API container installs only API/runtime dependencies.
- `dbt-duckdb` is currently constrained to dbt Core 1.11 to avoid pulling in the separately named `dbt-core-experimental-parser` package through dbt Core 1.12. The lockfile records the tested compatible stable versions.
- TypeScript resolves within the 6.0 line because current Next ESLint peer dependencies do not support TypeScript 7 yet.
- ESLint resolves within the 9.x line because current Next.js lint plugin peer dependencies do not support ESLint 10 yet.

No beta, alpha, release-candidate, nightly, or experimental dependency is intentionally requested.
