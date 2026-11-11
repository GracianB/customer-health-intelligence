# Import guide (n8n)

## Prerequisites

- Docker (recommended) **or** a local n8n instance you control.
- No API keys are required for the SAMPLE DATA path.
- This package was validated against **n8n 2.46.7**. `docker-compose.yml` pins `n8nio/n8n:2.46.7` and publishes the UI only on **127.0.0.1:5678**.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

Open `http://127.0.0.1:5678`, complete the first-time owner setup on **your** machine, then continue.

## Import the workflow

1. In n8n: **Workflows → Import from File**.
2. Select `workflows/customer-health-intelligence.json`.
3. Name: *Customer Health Intelligence — Rules-based Risk Detection*.
4. Leave **inactive** until you intentionally want the weekly schedule.
5. Open **Manual Trigger → Execute workflow**.

## Expected SAMPLE DATA result

- 10 accounts; **4 Red / 1 Amber / 5 Green**.
- `Weekly Health Summary.at_risk_mrr === 38600` (**simulated MRR at risk**, Red only).
- TravelSync EMEA reason contains `aggregate risk` (score 43, tier Red unchanged).
- **Send to Slack (configure)** succeeds as a **NoOp** — pending configuration; nothing is delivered.

## Replacing the placeholder delivery node

1. Disconnect the NoOp.
2. Add Slack / Email with **your** credentials in a private instance.
3. Never commit credentials, cookies, or `.n8n` database files.

## Validation

See `samples/import_validation.json` (temporary `(import test)` create → run → delete; original workflow untouched).
Behaviour of the workflow JSON is unchanged since v1.1.0; v1.1.1 is packaging/docs/compose/LICENSE/tests maintenance.
