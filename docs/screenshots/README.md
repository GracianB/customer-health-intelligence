# Command Center — screenshot gallery

Captured from the real rendered Command Center with `scripts/capture-docs-screenshots.cjs` (headless Chromium, 1440×900 unless noted).
**All accounts, owners and money figures are fictitious sample data.** Sector profiles are generic archetypes, not real companies.

## Executive overview — one per profile

| Profile | Screenshot |
| --- | --- |
| Healthcare marketplace | ![Overview — healthcare marketplace](./overview-healthcare.jpg) |
| Real-estate brokerage | ![Overview — real-estate brokerage](./overview-realestate.jpg) |
| Dynamic pricing SaaS | ![Overview — dynamic pricing SaaS](./overview-pricing-saas.jpg) |
| Generic B2B (base) | ![Overview — generic base](./overview-base.jpg) |

## Views

| View | Screenshot |
| --- | --- |
| Customer Portfolio | ![Customer Portfolio](./portfolio-healthcare.jpg) |
| Revenue Intelligence | ![Revenue Intelligence](./revenue-healthcare.jpg) |
| CSM Action Center | ![CSM Action Center](./actions-healthcare.jpg) |
| Account 360 | ![Account 360](./account360-healthcare.jpg) |
| CS Team Lead (real-estate brokerage) | ![CS Team Lead](./teamlead-realestate.jpg) |
| Adoption → Value → Retention (dynamic pricing SaaS) | ![Adoption, value and retention](./adoption-pricing-saas.jpg) |
| Score & glossary | ![Score and glossary](./glossary-score.jpg) |
| Mobile overview (390 px) | ![Mobile overview](./mobile-overview-healthcare.jpg) |

Regenerate: `CHROME_PATH=/path/to/chrome node scripts/capture-docs-screenshots.cjs`

## n8n workflow

Captured from the **importable** workflow (`workflows/customer-health-intelligence.json`) opened in n8n **inactive** (not executed). The Slack node is a **NoOp**, pending configuration. No execution output is shown.

| Shot | File |
| --- | --- |
| Full canvas, fit to view (1440×900) | ![n8n workflow canvas](./n8n-workflow-canvas.png) |
| Zoomed scoring and routing section | ![Scoring section](./n8n-workflow-scoring.png) |
| Compute Health Score — Parameters / JavaScript | ![Compute Health Score code](./n8n-workflow-code-node.png) |
