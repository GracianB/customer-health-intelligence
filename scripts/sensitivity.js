#!/usr/bin/env node
'use strict';
/**
 * Weight/threshold sensitivity sweep (rules-based). Reports tier stability.
 * Usage: node scripts/sensitivity.js [profile_id=base]
 */
const fs = require('fs');
const path = require('path');
const { scoreAccountWithConfig, summarizeScored } = require('../lib/scoreEngine.js');

const profileId = process.argv[2] || 'base';
const root = path.join(__dirname, '..');
const cfgPath =
  profileId === 'base'
    ? path.join(root, 'config/base.profile.json')
    : path.join(root, 'profiles', profileId, 'config.json');
const accountsPath = path.join(root, 'profiles', profileId, 'accounts.json');
const baseCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8')).accounts;

function run(cfg) {
  const scored = accounts.map((a) => scoreAccountWithConfig(a, cfg));
  return summarizeScored(scored, cfg);
}

const baseline = run(baseCfg);
const rows = [];

function clone(c) {
  return JSON.parse(JSON.stringify(c));
}

// Weight ±20% on each weight key (renormalize not required — demo inspectability)
for (const key of Object.keys(baseCfg.weights)) {
  for (const factor of [0.8, 1.2]) {
    const cfg = clone(baseCfg);
    cfg.weights[key] = Math.round(baseCfg.weights[key] * factor);
    const s = run(cfg);
    rows.push({
      change: `weight.${key}*${factor}`,
      red: s.red_count,
      amber: s.amber_count,
      green: s.green_count,
      at_risk_mrr: s.at_risk_mrr,
      red_delta: s.red_count - baseline.red_count,
    });
  }
}
for (const thr of [
  { red: 40, amber: 70 },
  { red: 50, amber: 70 },
  { red: 45, amber: 65 },
  { red: 45, amber: 75 },
]) {
  const cfg = clone(baseCfg);
  cfg.thresholds = thr;
  const s = run(cfg);
  rows.push({
    change: `thresholds red<${thr.red} amber<${thr.amber}`,
    red: s.red_count,
    amber: s.amber_count,
    green: s.green_count,
    at_risk_mrr: s.at_risk_mrr,
    red_delta: s.red_count - baseline.red_count,
  });
}

const out = {
  profile_id: baseCfg.profile_id,
  data_label: baseCfg.data_label,
  baseline: {
    red: baseline.red_count,
    amber: baseline.amber_count,
    green: baseline.green_count,
    at_risk_mrr: baseline.at_risk_mrr,
  },
  sweeps: rows,
  note: 'Rules-based sensitivity only. Not calibrated on real churn. SAMPLE/FICTITIOUS data.',
};
const outPath = path.join(root, 'profiles', profileId, 'sensitivity.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.baseline), '→ wrote', outPath);
console.log('max |red_delta|', Math.max(...rows.map((r) => Math.abs(r.red_delta))));
