# Taskflow Next.js Monolith

This app consolidates the old split architecture (`frontend` + `backend`) into one Next.js project.

Legacy code is preserved at:

- `../deprecated/frontend`
- `../deprecated/backend`

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 16+

## Environment

Copy `.env.example` to `.env` and adjust values:

```bash
cp .env.example .env
```

Required env vars:

- `DATABASE_URL`
- `JWT_SECRET`
- `TOKEN_EXPIRE_TIME`
- `NEXT_PUBLIC_BACKEND_URL` (keep empty to use same-origin `/api`)

## Install dependencies

```bash
npm install --legacy-peer-deps
```

## Initialize database

```bash
npx prisma generate
npx prisma db push
```

## Run locally

```bash
npm run dev
```

## Available scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - lint
- `npm run typecheck` - TypeScript check
- `npm run test` - run Vitest
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - create/apply local migration

## CI

GitHub Actions workflow is at `../.github/workflows/ci.yml` and runs:

- install
- Prisma generate + db push (against Postgres service)
- lint
- typecheck
- build
- test
