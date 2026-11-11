'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseTestOutput, formatSummary } = require('../scripts/lib/parse-test-output.js');

const fix = (...parts) => fs.readFileSync(path.join(__dirname, 'fixtures', 'test-summary', ...parts), 'utf8');

describe('parseTestOutput', () => {
  it('parses TAP footer with suite-level SKIP (Node 22 style, skipped visual)', () => {
    const s = parseTestOutput(fix('tap-full-footer.txt'));
    assert.equal(s.format, 'tap');
    assert.equal(s.tests, 66);
    assert.equal(s.pass, 66);
    assert.equal(s.fail, 0);
    assert.equal(s.skipped, 0); // Node omits skipped describe children from # skipped
    assert.equal(s.executed, 66);
    assert.ok(s.skipReasons.length >= 1);
    assert.match(s.skipReasons[0].reason, /Chrome|Chromium|Playwright|visual/i);
    assert.match(formatSummary(s), /skip_entries=1/);
  });

  it('parses spec footer with suite skip annotation', () => {
    const s = parseTestOutput(fix('spec-full-footer.txt'));
    assert.equal(s.format, 'spec');
    assert.equal(s.tests, 66);
    assert.equal(s.pass, 66);
    assert.equal(s.fail, 0);
    assert.ok(s.skipReasons.length >= 1);
  });

  it('parses TAP with per-test SKIP counts', () => {
    const s = parseTestOutput(fix('tap-it-skip.txt'));
    assert.equal(s.format, 'tap');
    assert.equal(s.tests, 3);
    assert.equal(s.pass, 1);
    assert.equal(s.skipped, 2);
    assert.equal(s.executed, 1);
    assert.equal(s.skipReasons.length, 2);
  });

  it('parses spec with per-test skips', () => {
    const s = parseTestOutput(fix('spec-it-skip.txt'));
    assert.equal(s.format, 'spec');
    assert.equal(s.tests, 3);
    assert.equal(s.pass, 1);
    assert.equal(s.skipped, 2);
    assert.ok(s.skipReasons.length >= 2);
  });

  it('parses TAP suite skip sample', () => {
    const s = parseTestOutput(fix('tap-suite-skip.txt'));
    assert.equal(s.pass, 1);
    assert.ok(s.skipReasons.some((r) => /Playwright|visual/i.test(r.reason)));
  });

  it('parses spec suite skip sample', () => {
    const s = parseTestOutput(fix('spec-suite-skip.txt'));
    assert.equal(s.pass, 1);
    assert.ok(s.skipReasons.length >= 1);
  });

  it('parses TAP failures', () => {
    const s = parseTestOutput(fix('tap-with-fail.txt'));
    assert.equal(s.fail, 1);
    assert.equal(s.pass, 0);
    assert.equal(s.tests, 1);
  });

  it('returns zeros for empty input (caller must reject)', () => {
    const s = parseTestOutput('');
    assert.equal(s.tests, 0);
    assert.equal(s.pass, 0);
  });

  it('treats empty/unparseable output as zero tests so the runner can exit non-zero', () => {
    const s = parseTestOutput(fix('tap-empty.txt'));
    assert.equal(s.tests, 0);
    const { exitCodeForStats } = require('../scripts/lib/parse-test-output.js');
    assert.equal(exitCodeForStats(s), 1);
  });

  it('exitCodeForStats is 1 on failures and 0 on a green parsed run', () => {
    const { exitCodeForStats } = require('../scripts/lib/parse-test-output.js');
    assert.equal(exitCodeForStats(parseTestOutput(fix('tap-with-fail.txt'))), 1);
    assert.equal(exitCodeForStats(parseTestOutput(fix('tap-it-skip.txt'))), 0);
  });
});
