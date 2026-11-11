'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { scoreAccountWithConfig, summarizeScored } = require('../lib/scoreEngine.js');

const baseConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'base.profile.json'), 'utf8')
);

function scoreAccount(a) {
  return scoreAccountWithConfig(a, baseConfig);
}

function summarize(scored) {
  return summarizeScored(scored, baseConfig);
}

function summarizeFromTiers({ red = [], amber = [], green = [] } = {}) {
  // Used by older tests — reconstruct from tier arrays of scored/alert-like objects
  const scored = [...red, ...amber, ...green].map((a) => {
    if (a.risk_tier) return a;
    // alert payload → minimal
    const tier =
      a.alert_type === 'RED_RISK' ? 'Red' : a.alert_type === 'AMBER_NURTURE' ? 'Amber' : 'Green';
    return { ...a, risk_tier: tier };
  });
  return summarizeScored(scored, baseConfig);
}

function summarizeFromAlertBuilders(scored) {
  const red = scored.filter((a) => a.risk_tier === 'Red');
  const amber = scored.filter((a) => a.risk_tier === 'Amber');
  const green = scored.filter((a) => a.risk_tier === 'Green');
  return summarizeFromTiers({ red, amber, green: [...green].reverse() });
}

module.exports = {
  scoreAccount,
  summarize,
  summarizeFromTiers,
  summarizeFromAlertBuilders,
  baseConfig,
  scoreAccountWithConfig,
  summarizeScored,
};
