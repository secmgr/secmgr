# Contributing to secmgr

Thanks for helping. This guide gets you from a fresh clone to a running app.

## Requirements

- Node 22.12 or newer, with the npm that ships with it
- A PostgreSQL 16 or newer database. A free hosted one such as Neon works, or run one locally with `docker compose -f docker/compose.dev.yml up -d`

## Setup

```sh
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

The app runs at `http://localhost:3000`. Put your database URL in `.env.local` first. Run the CLI from source with `npm run cli -- --help`.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js: homepage, dashboard and the `/api/v1` API |
| `apps/cli` | The CLI, published to npm as `secmgr`. No runtime dependencies |
| `packages/db` | Drizzle schema, SQL migrations and the migration runner |
| `packages/crypto` | Envelope encryption |
| `packages/api` | Request and response schemas shared by the API and its clients |
| `packages/ui` | Design tokens, foundation styles and fonts |

## Migrations

Migrations are plain SQL in `packages/db/migrations`, named with a 4 digit number and a short description:

```
0001_create_auth_tables.sql
0002_create_projects.sql
```

- Create one with `npm run db:new describe_the_change`. It picks the next number.
- See what has run with `npm run db:status`.
- Each file runs in its own transaction, so leave out `begin` and `commit`. A file that fails leaves nothing behind.
- Never edit a migration that has been merged. The runner stores a checksum of every applied file and stops if one changes. Write a new migration instead.
- Update `packages/db/src/schema` in the same pull request so the Drizzle schema matches the SQL.

## Before you open a pull request

```sh
npm run lint
npm run typecheck
npm test
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org): `feat(api): add secret history`, `fix(cli): keep the exit code of the child process`. Keep each commit to one change that builds on its own.

## Style

- Sentence case for all UI copy, digits for numbers, verbs first on buttons.
- No em dashes or en dashes, no emoji, no code comments that repeat the code.
- Technical names in UI copy go in mono: `DATABASE_URL`, `staging`.

## Security

Report vulnerabilities to security@secmgr.xyz, never in a public issue. See [SECURITY.md](SECURITY.md).
