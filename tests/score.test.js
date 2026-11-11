/**
 * node --test tests/score.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  scoreAccount,
  summarize,
  summarizeFromTiers,
  summarizeFromAlertBuilders,
} = require('./score.js');

const root = path.join(__dirname, '..');
const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demo_accounts.json'), 'utf8'));
const expectedExec = JSON.parse(fs.readFileSync(path.join(root, 'samples/execution_output.json'), 'utf8'));

const EXPECTED_SCORES = {
  'Acme Retail EU': { health_score: 83, risk_tier: 'Green' },
  'Nordic Pricing Co': { health_score: 40, risk_tier: 'Red' },
  'Iberia SaaS Labs': { health_score: 84, risk_tier: 'Green' },
  'MedTech Hub': { health_score: 6, risk_tier: 'Red' },
  'Commerce Pulse': { health_score: 91, risk_tier: 'Green' },
  'Hotel Ops Pro': { health_score: 63, risk_tier: 'Amber' },
  'FinServe Analytics': { health_score: 96, risk_tier: 'Green' },
  'EduLearn Cloud': { health_score: 20, risk_tier: 'Red' },
  'GreenSupply Chain': { health_score: 75, risk_tier: 'Green' },
  'TravelSync EMEA': { health_score: 43, risk_tier: 'Red' },
};

describe('demo data labelling', () => {
  it('marks accounts as SAMPLE DATA', () => {
    assert.match(demo.label, /SAMPLE DATA/i);
    for (const a of demo.accounts) assert.match(a.data_source, /SAMPLE DATA/i);
  });
  it('has exactly 10 synthetic accounts', () => {
    assert.equal(demo.accounts.length, 10);
  });
});

describe('hand-formula scores for each demo account', () => {
  for (const a of demo.accounts) {
    it(`${a.account} matches expected score/tier`, () => {
      const scored = scoreAccount(a);
      const exp = EXPECTED_SCORES[a.account];
      let loginPts = 0;
      if (a.last_login_days <= 7) loginPts = 25;
      else if (a.last_login_days <= 14) loginPts = 18;
      else if (a.last_login_days <= 30) loginPts = 8;
      const adoptPts = Math.round(Math.min(100, Math.max(0, a.active_users_pct)) / 100 * 25);
      let ticketPts = 20;
      if (a.open_tickets === 0) ticketPts = 20;
      else if (a.open_tickets <= 2) ticketPts = 14;
      else if (a.open_tickets <= 4) ticketPts = 7;
      else ticketPts = 0;
      const npsPts = Math.round(Math.min(100, Math.max(0, a.nps)) / 100 * 20);
      const onboardingPts = a.onboarding_completed ? 10 : 0;
      const hand = Math.max(0, Math.min(100, loginPts + adoptPts + ticketPts + npsPts + onboardingPts));
      assert.equal(hand, exp.health_score);
      assert.equal(scored.health_score, exp.health_score);
      assert.equal(scored.risk_tier, exp.risk_tier);
    });
  }
});

describe('tier thresholds and boundaries', () => {
  function tierFromScore(score) {
    if (score < 45) return 'Red';
    if (score < 70) return 'Amber';
    return 'Green';
  }
  it('44 → Red, 45 → Amber, 69 → Amber, 70 → Green', () => {
    assert.equal(tierFromScore(44), 'Red');
    assert.equal(tierFromScore(45), 'Amber');
    assert.equal(tierFromScore(69), 'Amber');
    assert.equal(tierFromScore(70), 'Green');
  });
});

describe('summary counts and simulated MRR at risk (Red only)', () => {
  const scored = demo.accounts.map(scoreAccount);
  const summary = summarize(scored);

  it('counts 4 Red / 1 Amber / 5 Green', () => {
    assert.equal(summary.red_count, 4);
    assert.equal(summary.amber_count, 1);
    assert.equal(summary.green_count, 5);
    assert.equal(summary.total_accounts, 10);
  });

  it('at_risk_mrr = 38600 simulated Red MRR only (Amber excluded)', () => {
    assert.equal(8900 + 12500 + 2200 + 15000, 38600);
    assert.equal(summary.at_risk_mrr, 38600);
    assert.equal(scored.find((a) => a.account === 'Hotel Ops Pro').mrr, 7400);
  });

  it('matches archived execution_output.json counts (SAMPLE DATA)', () => {
    assert.equal(summary.red_count, expectedExec.summary.red_count);
    assert.equal(summary.amber_count, expectedExec.summary.amber_count);
    assert.equal(summary.green_count, expectedExec.summary.green_count);
    assert.equal(summary.at_risk_mrr, expectedExec.summary.at_risk_mrr);
  });
});

describe('regression: aggregate reason for no-flag Red/Amber', () => {
  it('TravelSync EMEA keeps score 43 Red with aggregate-risk reason', () => {
    const t = scoreAccount(demo.accounts.find((a) => a.account === 'TravelSync EMEA'));
    assert.equal(t.health_score, 43);
    assert.equal(t.risk_tier, 'Red');
    assert.match(t.reason, /aggregate risk: score 43 below Red threshold 45/);
    assert.match(t.reason, /adoption 40%/);
    assert.match(t.reason, /NPS 40/);
    assert.doesNotMatch(t.reason, /mixed mid-range signals/);
  });

  it('synthetic Amber with no hard flags also gets aggregate-risk reason', () => {
    // Craft inputs that land Amber without tripping <40 adoption/NPS or other flags
    // login 8d → 18, adopt 50% → 13, tickets 0 → 20, nps 50 → 10, onboard → 10 = 71 too high
    // login 12 → 18, adopt 50 → 13, tickets 2 → 14, nps 50 → 10, onboard 10 = 65 Amber
    const a = {
      account: 'Boundary Amber',
      mrr: 1000,
      last_login_days: 12,
      active_users_pct: 50,
      open_tickets: 2,
      nps: 50,
      onboarding_completed: true,
      csm: 'Test',
    };
    const s = scoreAccount(a);
    assert.equal(s.health_score, 65);
    assert.equal(s.risk_tier, 'Amber');
    assert.match(s.reason, /aggregate risk: score 65 below Amber threshold 70/);
  });
});

describe('regression: summary robust to tier arrival order (exec #1 class bug)', () => {
  const scored = demo.accounts.map(scoreAccount);

  it('summarizeFromTiers with only Green still reports partial — full builders required', () => {
    const greenOnly = summarizeFromTiers({
      red: [],
      amber: [],
      green: scored.filter((a) => a.risk_tier === 'Green'),
    });
    assert.equal(greenOnly.total_accounts, 5);
    assert.equal(greenOnly.at_risk_mrr, 0);
  });

  it('reading all three builders yields 10 / 4/1/5 / 38600 even if Green arrives first', () => {
    const summary = summarizeFromAlertBuilders(scored);
    assert.equal(summary.total_accounts, 10);
    assert.equal(summary.red_count, 4);
    assert.equal(summary.amber_count, 1);
    assert.equal(summary.green_count, 5);
    assert.equal(summary.at_risk_mrr, 38600);
  });

  it('permuting tier array order does not change totals', () => {
    const red = scored.filter((a) => a.risk_tier === 'Red');
    const amber = scored.filter((a) => a.risk_tier === 'Amber');
    const green = scored.filter((a) => a.risk_tier === 'Green');
    const orders = [
      summarizeFromTiers({ red, amber, green }),
      summarizeFromTiers({ green, amber, red }),
      summarizeFromTiers({ amber, red, green }),
    ];
    for (const s of orders) {
      assert.equal(s.total_accounts, 10);
      assert.equal(s.red_count, 4);
      assert.equal(s.amber_count, 1);
      assert.equal(s.green_count, 5);
      assert.equal(s.at_risk_mrr, 38600);
    }
  });
});
