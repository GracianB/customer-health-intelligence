#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const eng = require('../engine/healthEngine.js');
const root = path.join(__dirname, '..');
const DEMO_AS_OF = '2026-11-10'; // fixed demo date for reproducible due dates

function addBusinessDays(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00Z');
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

function enrichDueDates(summary, scored) {
  const map = { Red: 1, Amber: 3, Green: 7, Onboarding: 5 };
  scored.forEach((a) => {
    const bd = map[a.risk_tier] || 7;
    a.due_date = addBusinessDays(DEMO_AS_OF, bd);
  });
  summary.action_queue.forEach((q) => {
    const bd = map[q.risk_tier] || 7;
    q.due_date = addBusinessDays(DEMO_AS_OF, bd);
  });
  summary.demo_as_of = DEMO_AS_OF;
}

function pack(profileDir, cfgPath) {
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const raw = JSON.parse(fs.readFileSync(path.join(profileDir, 'accounts.json'), 'utf8'));
  const { scored, summary } = eng.runPortfolio(raw.accounts, cfg);
  enrichDueDates(summary, scored);
  let weeks = null;
  const weeksPath = path.join(profileDir, 'weeks.json');
  if (fs.existsSync(weeksPath)) weeks = JSON.parse(fs.readFileSync(weeksPath, 'utf8'));
  return {
    config: {
      profile_id: cfg.profile_id,
      profile_name: cfg.profile_name,
      data_label: cfg.data_label,
      subtitle: cfg.subtitle || 'Customer Intelligence, Revenue Protection & Growth Automation',
      industry: cfg.industry || null,
      inspired_by_public_product: cfg.inspired_by_public_product || null,
      weights: cfg.weights,
      thresholds: cfg.thresholds,
      signal_glossary: cfg.signal_glossary || null,
      metric_groups: cfg.metric_groups || null,
      product_value_chain: cfg.product_value_chain || null,
      metric_glossary: cfg.metric_glossary || cfg.signal_glossary || null,
      scoring_explanation: cfg.scoring_explanation || null,
      demo_as_of: DEMO_AS_OF,
    },
    summary,
    accounts: scored,
    weeks,
  };
}

const catalog = [
  { id: 'base', label: 'Generic B2B SaaS (SAMPLE)', path: 'profiles/base', cfg: 'config/base.profile.json' },
  { id: 'healthcare', label: 'Healthcare marketplace (FICTITIOUS)', path: 'profiles/healthcare', cfg: 'profiles/healthcare/config.json' },
  { id: 'realestate', label: 'Real-estate brokerage (FICTITIOUS)', path: 'profiles/realestate', cfg: 'profiles/realestate/config.json' },
  { id: 'pricing-saas', label: 'Dynamic pricing SaaS (FICTITIOUS)', path: 'profiles/pricing-saas', cfg: 'profiles/pricing-saas/config.json' },
];
for (const c of catalog) {
  const b = pack(path.join(root, c.path), path.join(root, c.cfg));
  fs.writeFileSync(path.join(root, 'command-center/data', c.id + '.json'), JSON.stringify(b, null, 2) + '\n');
}
fs.writeFileSync(path.join(root, 'command-center/data/catalog.json'), JSON.stringify({
  version: '1.2.2',
  subtitle: 'Customer Intelligence, Revenue Protection & Growth Automation',
  demo_badge: 'Demo data – fictitious',
  demo_as_of: DEMO_AS_OF,
  profiles: catalog.map((c) => ({ id: c.id, label: c.label })),
  note: 'Generic sector archetypes with fictitious accounts. Not based on any real company.',
}, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'engine/healthEngine.js'), path.join(root, 'command-center/js/healthEngine.js'));
console.log('exported', catalog.map((c) => c.id).join(', '));

// Embed for file:// demos (no fetch)
const emb = {
  catalog: JSON.parse(fs.readFileSync(path.join(root, 'command-center/data/catalog.json'), 'utf8')),
  profiles: {},
};
for (const c of catalog) {
  emb.profiles[c.id] = JSON.parse(fs.readFileSync(path.join(root, 'command-center/data', c.id + '.json'), 'utf8'));
}
fs.writeFileSync(
  path.join(root, 'command-center/js/embedded-data.js'),
  '/* Auto-generated — file:// safe. */\nwindow.CHI_DATA = ' + JSON.stringify(emb) + ';\n'
);
console.log('embedded-data.js written');
