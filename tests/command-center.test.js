'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'command-center', 'data');
const ccRoot = path.join(root, 'command-center');

describe('command-center catalog', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(dataDir, 'catalog.json'), 'utf8'));

  it('includes base, healthcare, realestate, pricing-saas', () => {
    const ids = catalog.profiles.map((p) => p.id).sort();
    assert.deepEqual(ids, ['base', 'healthcare', 'pricing-saas', 'realestate']);
  });

  it('has fixed demo_as_of and fictitious badge', () => {
    assert.equal(catalog.demo_as_of, '2026-11-10');
    assert.match(catalog.demo_badge, /fictitious|Demo/i);
    assert.match(catalog.version, /^1\.2\./);
  });
});

for (const id of ['healthcare', 'realestate', 'pricing-saas']) {
  describe(`command-center data ${id}`, () => {
    const data = JSON.parse(fs.readFileSync(path.join(dataDir, `${id}.json`), 'utf8'));

    it('labels fictitious data and demo_as_of', () => {
      assert.match(data.config.data_label, /SAMPLE|FICTITIOUS/i);
      assert.equal(data.summary.demo_as_of, '2026-11-10');
    });

    it('action queue due dates are ISO dates', () => {
      for (const q of data.summary.action_queue.slice(0, 5)) {
        assert.match(q.due_date, /^\d{4}-\d{2}-\d{2}$/);
        assert.ok(typeof q.priority_score === 'number');
      }
    });

    it('revenue_lens by_tier includes Onboarding key', () => {
      assert.ok(data.summary.revenue_lens.by_tier.Onboarding);
      assert.ok('mrr' in data.summary.revenue_lens.by_tier.Onboarding);
    });
  });
}

describe('realestate Team Lead fixtures', () => {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'realestate.json'), 'utf8'));
  it('matches expected totals 13 / 1-3-6-3 / 14900', () => {
    assert.equal(data.summary.total_accounts, 13);
    assert.equal(data.summary.red_count, 1);
    assert.equal(data.summary.amber_count, 3);
    assert.equal(data.summary.green_count, 6);
    assert.equal(data.summary.onboarding_count, 3);
    assert.equal(data.summary.at_risk_mrr, 14900);
  });
});

describe('pricing-saas fixtures', () => {
  const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'pricing-saas.json'), 'utf8'));
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'profiles/pricing-saas/expected.json'), 'utf8'));

  it('matches expected totals and Red-only at_risk_mrr', () => {
    assert.equal(data.summary.total_accounts, expected.total_accounts);
    assert.equal(data.summary.red_count, expected.red_count);
    assert.equal(data.summary.amber_count, expected.amber_count);
    assert.equal(data.summary.green_count, expected.green_count);
    assert.equal(data.summary.onboarding_count, expected.onboarding_count);
    assert.equal(data.summary.at_risk_mrr, expected.at_risk_mrr);
    assert.equal(data.summary.at_risk_mrr, 61600);
  });

  it('exposes product metric fields on accounts', () => {
    const a = data.accounts.find((x) => x.account === 'Mountain Mock Cabins');
    assert.ok(a);
    assert.equal(typeof a.listings_with_autopush_pct, 'number');
    assert.equal(typeof a.recommendation_accept_pct, 'number');
    assert.equal(typeof a.support_friction_flags, 'number');
    assert.ok('pms_integration_healthy' in a);
  });

  it('has weeks + simulated interventions', () => {
    assert.ok(data.weeks.weeks.length >= 4);
    assert.ok(data.weeks.interventions_simulated.length >= 1);
  });

  it('config declares metric_groups product vs commercial', () => {
    assert.ok(Array.isArray(data.config.metric_groups.product));
    assert.ok(Array.isArray(data.config.metric_groups.commercial));
  });
});

describe('command-center UI polish', () => {
  const js = fs.readFileSync(path.join(ccRoot, 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ccRoot, 'css/app.css'), 'utf8');
  const html = fs.readFileSync(path.join(ccRoot, 'index.html'), 'utf8');

  it('puts priority reason under account (acct-why), keeps # narrow', () => {
    assert.match(js, /acct-why/);
    assert.match(css, /\.acct-why/);
    assert.doesNotMatch(js, /prio-reason/);
    assert.match(js, /#\$\{i \+ 1\}/);
  });

  it('concentration denominator includes Onboarding and states it', () => {
    assert.match(js, /Onboarding =/);
    assert.match(js, /euro\(onb\)/);
    assert.match(js, /Red \+ Amber \+ Green \+ Onboarding/);
  });

  it('Team Lead + Adoption views exist', () => {
    assert.match(html, /navTeamLead/);
    assert.match(html, /navAdoption/);
    assert.match(js, /function renderTeamLead/);
    assert.match(js, /function renderAdoption/);
    assert.match(js, /Adoption → Value → Retention|Adoption/);
    assert.match(js, /tag-product/);
    assert.match(js, /tag-commercial/);
  });

  it('footer marks simulated money and version', () => {
    assert.match(html, /simulated/i);
    assert.match(html, /v1.2.2/);
  });
});
