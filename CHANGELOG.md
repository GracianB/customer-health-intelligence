# Changelog

## 1.2.3 — 2026-11-11 (Europe/Madrid) · documentation

Documentation and screenshot gallery only. No engine, scoring or Command Center feature changes versus 1.2.2.

### n8n workflow screenshots
- Real screenshots of the importable n8n workflow (`workflows/customer-health-intelligence.json`), captured inactive, with the Slack node still a NoOp pending configuration: `docs/screenshots/n8n-workflow-*.png`.
- README (EN), Spanish README and the screenshot gallery document the canvas, the scoring section and the Compute Health Score parameters/code panel (no execution output).


## 1.2.2 — 2026-11-11 (Europe/Madrid)

Packaging and test-summary reliability only. No engine, scoring or Command Center feature changes versus 1.2.1.

### Test summary
- Robust TAP + spec footer parsing (`scripts/lib/parse-test-output.js`).
- Skip reasons collected for suite-level and per-test SKIP (including indented TAP).
- `npm run test:summary` prints executed / passed / failed / skipped and skip entries.
- Non-zero exit when the parser counts zero tests (no silent success).
- Regression fixtures + tests; verified with portable **Node 22**.

### Publishing prep
- GitHub Pages-ready root `index.html` (redirects to `command-center/`) and `.nojekyll`.
- README showcase with live-demo placeholder, badges and curated screenshots.
- Full hi-res screenshot tree kept out of git (see `docs/PAGES.md`).

### Live site (same 1.2.2)
- Favicon so GitHub Pages does not log a missing-icon 404 in the console.
- Command Center honors `?profile=healthcare|realestate|pricing-saas|base` (and `#profile=`) for deep links.

### Neutral sector profiles + screenshot gallery (same 1.2.2)
- Sector profiles are generic archetypes: `healthcare` (healthcare marketplace), `realestate` (real-estate brokerage), `pricing-saas` (dynamic pricing SaaS). No real company names.
- New `docs/screenshots/` gallery and README tour captured from the real rendered Command Center (`scripts/capture-docs-screenshots.cjs`).
- No engine, scoring or dataset value changes.


## 1.2.1 — 2026-11-09 · FROZEN bugfix
Responsive overflow, portable visual tests, README/lite packaging.

## 1.2.0 — 2026-11-09 · FROZEN feature release
Healthcare marketplace, real-estate brokerage and dynamic pricing SaaS Command Center demos.
