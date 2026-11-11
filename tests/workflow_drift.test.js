'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  getNodeJsCode,
  getBaseConfigFromWorkflow,
  runScoreNodeCode,
  runSummaryNodeCode,
  loadWorkflow,
} = require('./loadWorkflowCode.js');
const { scoreAccount, summarizeFromTiers, baseConfig } = require('./score.js');

const demo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'demo_accounts.json'), 'utf8'));

describe('workflow JSON ↔ engine drift (v1.2)', () => {
  const scoreCode = getNodeJsCode('Compute Health Score');
  const summaryCode = getNodeJsCode('Weekly Health Summary');
  const wfConfig = getBaseConfigFromWorkflow();

  it('Profile Config embeds base weights identical to config/base.profile.json', () => {
    assert.deepEqual(wfConfig.weights, baseConfig.weights);
    assert.deepEqual(wfConfig.thresholds, baseConfig.thresholds);
  });

  it('workflow score matches scoreAccount for all 10 SAMPLE accounts', () => {
    for (const a of demo.accounts) {
      const fromWf = runScoreNodeCode(scoreCode, a, wfConfig);
      const fromLib = scoreAccount(a);
      assert.equal(fromWf.health_score, fromLib.health_score, a.account);
      assert.equal(fromWf.risk_tier, fromLib.risk_tier, a.account);
      assert.equal(fromWf.reason, fromLib.reason, a.account);
    }
  });

  it('summary has revenue lens and 10/4/1/5 / 38600', () => {
    const scored = demo.accounts.map(scoreAccount);
    const builders = {
      red: scored.filter((a) => a.risk_tier === 'Red').map((a) => ({
        alert_type: 'RED_RISK', account: a.account, mrr: a.mrr, health_score: a.health_score,
        assigned_csm: a.csm, playbook_action: a.playbook, reason: a.reason,
      })),
      amber: scored.filter((a) => a.risk_tier === 'Amber').map((a) => ({
        alert_type: 'AMBER_NURTURE', account: a.account, mrr: a.mrr, health_score: a.health_score,
        assigned_csm: a.csm, playbook_action: a.playbook, reason: a.reason,
      })),
      green: scored.filter((a) => a.risk_tier === 'Green').map((a) => ({
        alert_type: 'GREEN_EXPANSION', account: a.account, mrr: a.mrr, health_score: a.health_score,
        assigned_csm: a.csm, playbook_action: a.playbook, reason: a.reason,
      })),
    };
    const summary = runSummaryNodeCode(summaryCode, builders, wfConfig);
    assert.equal(summary.total_accounts, 10);
    assert.equal(summary.red_count, 4);
    assert.equal(summary.amber_count, 1);
    assert.equal(summary.green_count, 5);
    assert.equal(summary.at_risk_mrr, 38600);
    assert.ok(summary.revenue_lens);
    assert.equal(summary.revenue_lens.simulated_mrr_at_risk_sample_data, 38600);
    assert.ok(Array.isArray(summary.action_queue));
    assert.equal(summary.action_queue.length, 10);
  });

  it('workflow name is rules-based v1.2 and inactive', () => {
    const wf = loadWorkflow();
    assert.match(wf.name, /Rules-based/i);
    assert.match(wf.name, /v1\.2/);
    assert.equal(wf.active, false);
  });
});
