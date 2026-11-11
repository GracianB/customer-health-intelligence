#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { scoreAccountWithConfig, summarizeScored } = require('../lib/scoreEngine.js');

const profileId = process.argv[2] || 'base';
const root = path.join(__dirname, '..');
const cfg = JSON.parse(
  fs.readFileSync(
    profileId === 'base' ? path.join(root, 'config/base.profile.json') : path.join(root, 'profiles', profileId, 'config.json'),
    'utf8'
  )
);
const accounts = JSON.parse(fs.readFileSync(path.join(root, 'profiles', profileId, 'accounts.json'), 'utf8')).accounts;
const scored = accounts.map((a) => scoreAccountWithConfig(a, cfg));
const summary = summarizeScored(scored, cfg);

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const rows = scored
  .map(
    (a) => `<tr class="tier-${esc(a.risk_tier)}"><td>${esc(a.account)}</td><td>${a.health_score}</td><td>${esc(a.risk_tier)}</td><td>${a.mrr}</td><td>${esc(a.csm || '')}</td><td>${esc(a.reason)}</td></tr>`
  )
  .join('\n');

const queue = summary.action_queue
  .slice(0, 10)
  .map(
    (q) =>
      `<tr><td>${q.priority_score}</td><td>${esc(q.account)}</td><td>${esc(q.risk_tier)}</td><td>${q.mrr}</td><td>${esc(q.owner)}</td><td>${esc(q.next_action)}</td><td>${q.sla_hours}h</td></tr>`
  )
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(cfg.profile_name)} — Customer Health Report (DEMO)</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#122;background:#f7f8fa}
.banner{background:#7c2d12;color:#fff;padding:12px 16px;border-radius:8px;margin-bottom:16px;font-weight:600}
h1{font-size:1.4rem;margin:0 0 8px}
.meta{color:#445;margin-bottom:20px}
.cards{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.card{background:#fff;border:1px solid #dde;border-radius:8px;padding:12px 16px;min-width:140px}
.card b{display:block;font-size:1.4rem}
table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0 24px}
th,td{border:1px solid #dde;padding:8px;text-align:left;font-size:0.9rem}
th{background:#eef2f7}
.tier-Red{background:#fef2f2}.tier-Amber{background:#fffbeb}.tier-Green{background:#f0fdf4}
.small{font-size:0.85rem;color:#556}
</style>
</head>
<body>
<div class="banner">DEMO / SAMPLE DATA — fictitious accounts. Rules-based scoring (not ML). Simulated MRR at risk is not real protected revenue. Slack delivery is NoOp (pending configuration).</div>
<h1>${esc(cfg.profile_name)}</h1>
<p class="meta">${esc(cfg.data_label)}<br/>Generated ${esc(summary.generated_at)} · Scoring: rules-based (not ML)</p>
<div class="cards">
  <div class="card">Accounts<b>${summary.total_accounts}</b></div>
  <div class="card">Red / Amber / Green<b>${summary.red_count} / ${summary.amber_count} / ${summary.green_count}</b></div>
  <div class="card">Simulated MRR at risk (sample)<b>${summary.at_risk_mrr}</b></div>
  <div class="card">Green expansion MRR (sample)<b>${summary.revenue_lens.expansion_pipeline_green.mrr}</b></div>
</div>
<h2>Prioritised action queue (MRR × risk weight)</h2>
<table><thead><tr><th>Priority</th><th>Account</th><th>Tier</th><th>MRR</th><th>Owner</th><th>Next action</th><th>SLA</th></tr></thead><tbody>
${queue}
</tbody></table>
<h2>All accounts</h2>
<table><thead><tr><th>Account</th><th>Score</th><th>Tier</th><th>MRR</th><th>CSM</th><th>Reason</th></tr></thead><tbody>
${rows}
</tbody></table>
<p class="small">Customer Health Intelligence v1.2.0 · Public MIT demo · Industry signals inspired by public product docs only.</p>
</body></html>`;

const outDir = path.join(root, 'reports');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${profileId}-health-report.html`);
fs.writeFileSync(outFile, html);
console.log('wrote', outFile);
