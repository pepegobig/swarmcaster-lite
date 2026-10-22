# Swarmcaster Lite index

A Cloudflare Worker with one SQLite Durable Object. It reads the IMD API server-side (the IMD API sends no CORS
headers) and serves the Swarmcaster data with `Access-Control-Allow-Origin: *`. Routes and rules: `../SPEC.md`,
"Index API".

- A cron every 10 minutes lists the IMD jobs that changed and contain "Swarmcaster", records up to 8 finished ones,
  refreshes the seat directory and the pinned mini app manifests.
- `npm test` runs the rule tests (line parsing, the owner-or-poster check, personal_sign recovery, file and manifest
  filters).
- `npx wrangler dev --test-scheduled --var IMD_API:http://127.0.0.1:<port>` runs it against a mock IMD API.
- `npx wrangler deploy` deploys it.

It holds no keys and no funds. Poster approvals are owner signatures, checked against the seat owner on chain.
