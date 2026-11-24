# LokaTalenta Sprint Planner

Dedicated Sprint capacity planning (per 6 divisions / 24 canonical agents `#0..#23`), Backlog item pulling (`BACKLOG_API_URL=http://localhost:4102`), ceremony notes, velocity/burndown tracking, and real-time telemetry emission (`API: 4103`, `Dev UI: 4113`) via [`lokatalenta-event-gateway`](https://github.com/zixew/lokatalenta-event-gateway).

## Repository Layout

- `server/` — Node 25 + Express 5 + `node:sqlite` REST API, canonical contracts, Backlog sync, and fail-open Event Gateway emitter
- `client/` — Vite + React 19 + TypeScript + Tailwind CSS v4 UI with Unified Ecosystem Switcher
- `api/` & `vercel.json` — Vercel serverless Express entrypoint (`/api/*` + `client/dist` SPA fallback + `/tmp` SQLite fallback when `VERCEL=1`)
- `tests/` — Vitest unit & ephemeral-port API integration suite

## Commands

```bash
npm install
npm --prefix client install
npm run dev        # API on 4103 + Vite dev UI on 4113
npm run build      # Build server (dist-server/) + client (client/dist/)
npm start          # Serve built API + client/dist on PORT (default 4103)
npm run typecheck  # Type-check server, api, tests, and client
npm run lint       # Oxlint across server, api, tests, and client
npm test           # Run Vitest unit & integration suite
```
