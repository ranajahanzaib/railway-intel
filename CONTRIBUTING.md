# Contributing

Contributions are welcome through GitHub issues and pull requests. For larger changes, open an issue first to discuss the scope and approach.

## Development setup

Install Python 3.12 or newer, uv, Node.js 22, and pnpm 12. Then run:

```sh
uv sync --locked --extra dev --extra warehouse
pnpm install --frozen-lockfile
cp profiles.example.yml profiles.yml
```

Run the API and frontend with `make api` and `pnpm dev`. Run the checks with `make test`, `make lint`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.

## Contribution guidelines

- Add deterministic tests for behavior changes. Keep test fixtures separate from downloaded source data.
- When changing a metric or denominator, update `METHODOLOGY.md` and the relevant API or data dictionary documentation.
- Preserve null and missing values; do not present synthetic observations as real source data.
- Preserve source attribution and document changes to data coverage or schema handling.
- Do not commit credentials, local environment files, downloaded data, database snapshots, or generated build output.
- Use clear, descriptive commit and pull request titles and explain user-visible effects and validation results.
