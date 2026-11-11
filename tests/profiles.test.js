'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scoreAccountWithConfig, summarizeScored } = require('../lib/scoreEngine.js');

const root = path.join(__dirname, '..');

for (const id of ['base', 'healthcare', 'realestate', 'pricing-saas']) {
  describe(`profile ${id}`, () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, id === 'base' ? 'config/base.profile.json' : `profiles/${id}/config.json`), 'utf8'));
    const raw = JSON.parse(fs.readFileSync(path.join(root, `profiles/${id}/accounts.json`), 'utf8'));
    const expected = JSON.parse(fs.readFileSync(path.join(root, `profiles/${id}/expected.json`), 'utf8'));
    const accounts = raw.accounts || raw;

    it('is labelled fictitious/sample data', () => {
      assert.match(cfg.data_label, /SAMPLE|FICTITIOUS/i);
    });

    it('matches expected fixture totals', () => {
      const scored = accounts.map((a) => scoreAccountWithConfig(a, cfg));
      const summary = summarizeScored(scored, cfg);
      assert.equal(summary.total_accounts, expected.total_accounts);
      assert.equal(summary.red_count, expected.red_count);
      assert.equal(summary.amber_count, expected.amber_count);
      assert.equal(summary.green_count, expected.green_count);
      assert.equal(summary.at_risk_mrr, expected.at_risk_mrr);
      if (expected.onboarding_count != null) {
        assert.equal(summary.onboarding_count, expected.onboarding_count);
      }
    });

    if (id === 'base') {
      it('base regression: 10 / 4-1-5 / 38600', () => {
        assert.equal(expected.total_accounts, 10);
        assert.equal(expected.red_count, 4);
        assert.equal(expected.amber_count, 1);
        assert.equal(expected.green_count, 5);
        assert.equal(expected.at_risk_mrr, 38600);
      });
    }

    if (id === 'realestate') {
      it('realestate regression: 13 / 1-3-6-3 / 14900', () => {
        assert.equal(expected.total_accounts, 13);
        assert.equal(expected.red_count, 1);
        assert.equal(expected.amber_count, 3);
        assert.equal(expected.green_count, 6);
        assert.equal(expected.onboarding_count, 3);
        assert.equal(expected.at_risk_mrr, 14900);
      });
    }

    if (id === 'pricing-saas') {
      it('pricing-saas regression: 14 accounts, Red at_risk 61600, has onboarding', () => {
        assert.equal(expected.total_accounts, 14);
        assert.equal(expected.at_risk_mrr, 61600);
        assert.ok(expected.onboarding_count >= 1);
        assert.equal(expected.red_count, 4);
      });
    }
  });
}
