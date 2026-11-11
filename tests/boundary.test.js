'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const eng = require('../engine/healthEngine.js');
const base = require('../config/base.profile.json');

describe('boundary and extreme cases', () => {
  it('all zeros → low score Red', () => {
    const a = eng.scoreAccount({
      account: 'Zero Co', mrr: 1000, last_login_days: 999, active_users_pct: 0, open_tickets: 99, nps: 0, onboarding_completed: false, tenure_days: 100,
    }, base);
    assert.equal(a.risk_tier, 'Red');
    assert.ok(a.health_score < 45);
  });

  it('all max healthy → Green', () => {
    const a = eng.scoreAccount({
      account: 'Max Co', mrr: 1000, last_login_days: 0, active_users_pct: 100, open_tickets: 0, nps: 100, onboarding_completed: true, tenure_days: 100,
    }, base);
    assert.equal(a.risk_tier, 'Green');
    assert.equal(a.health_score, 100);
  });

  it('missing fields use safe defaults without throwing', () => {
    const a = eng.scoreAccount({ account: 'Sparse', mrr: 500, tenure_days: 100 }, base);
    assert.ok(['Red', 'Amber', 'Green'].includes(a.risk_tier));
    assert.equal(typeof a.reason, 'string');
  });

  it('null numeric-ish fields coerced via defaults', () => {
    const a = eng.scoreAccount({
      account: 'Nullish', mrr: 500, last_login_days: null, active_users_pct: null, open_tickets: null, nps: null, onboarding_completed: null, tenure_days: 100,
    }, base);
    assert.ok(a.risk_tier);
  });

  it('new customer under min_tenure gets Onboarding – insufficient data', () => {
    const cfg = { ...base, min_tenure_days: 30, playbooks: { ...base.playbooks, onboarding: 'activate' } };
    const a = eng.scoreAccount({
      account: 'Newbie', mrr: 2000, last_login_days: 100, active_users_pct: 0, open_tickets: 10, nps: 0, onboarding_completed: false, tenure_days: 5,
    }, cfg);
    assert.equal(a.risk_tier, 'Onboarding');
    assert.equal(a.health_score, null);
    assert.match(a.reason, /insufficient data/i);
    assert.equal(a.insufficient_history, true);
  });

  it('renewal today boosts priority vs same MRR without renewal', () => {
    const cfg = { ...base, renewal_alert_days: 45 };
    const scored = [
      eng.scoreAccount({ account: 'A', mrr: 5000, last_login_days: 40, active_users_pct: 10, open_tickets: 8, nps: 10, onboarding_completed: false, tenure_days: 100, days_to_renewal: 1, csm: 'X' }, cfg),
      eng.scoreAccount({ account: 'B', mrr: 5000, last_login_days: 40, active_users_pct: 10, open_tickets: 8, nps: 10, onboarding_completed: false, tenure_days: 100, days_to_renewal: 200, csm: 'X' }, cfg),
    ];
    const summary = eng.summarize(scored, cfg);
    assert.equal(summary.action_queue[0].account, 'A');
    assert.ok(summary.action_queue[0].priority_score > summary.action_queue[1].priority_score);
  });
});
