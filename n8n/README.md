# n8n Workflow Automation — Mighty Verse

Workflow definitions live here as JSON. They are imported into n8n on startup.

## Workflows

| File | Trigger | Purpose |
|---|---|---|
| `01-consumption-signal-attribution.json` | Supabase webhook → n8n | ConsumptionSignal → POST /api/economic/events |
| `02-ownership-transfer.json` | External trigger → n8n | Collectible transfer + secondary economic event |

## Constitutional boundary (A14)

n8n **does not write directly to the database**. All writes go through the
application API (`/api/*`). AuthorityRecord validation is enforced at the
application layer. n8n is orchestration only.

## Deploying the runtime

```bash
docker run -it --rm \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=<your-password> \
  -e MIGHTY_VERSE_API_URL=https://your-vercel-url.vercel.app \
  -v $(pwd)/n8n/workflows:/home/node/.n8n/workflows \
  n8nio/n8n:2.34.6
```

Workflows are imported automatically from the mounted directory.

## Required n8n credentials

- `httpHeaderAuth` credential named `mighty-verse-api-key` with header
  `Authorization: Bearer <service-role-key>` — used by all HTTP Request nodes.

## Environment variables

| Variable | Description |
|---|---|
| `MIGHTY_VERSE_API_URL` | Base URL of the deployed Next.js app |
