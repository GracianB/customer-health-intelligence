#!/usr/bin/env node
'use strict';
/**
 * Run the package test suite and print executed / passed / failed / skipped.
 *
 * Forces TAP reporter for stable parsing across Node 18–24, and also
 * understands the spec (ℹ) reporter if present in the output.
 *
 * Exit codes:
 *   0 — parsed successfully, zero failures, at least one test counted
 *   1 — failures, or parser saw zero tests (silent-zero guard), or runner crash
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseTestOutput, formatSummary, exitCodeForStats } = require('./lib/parse-test-output.js');

const root = path.join(__dirname, '..');

function listTestFiles() {
  const dir = path.join(root, 'tests');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join('tests', f));
}

function main() {
  const files = listTestFiles();
  if (!files.length) {
    console.error('No tests/*.test.js files found.');
    process.exit(1);
  }

  // Deterministic reporter — Node 22 defaults to TAP; forcing it keeps parsing stable.
  const args = ['--test', '--test-reporter=tap', ...files];
  const r = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });

  const out = `${r.stdout || ''}${r.stderr || ''}`;
  // Echo runner output for humans
  process.stdout.write(out);

  const stats = parseTestOutput(out);
  console.log(formatSummary(stats));

  if (r.error) {
    console.error('Failed to spawn test runner:', r.error.message);
    process.exit(1);
  }
  const code = exitCodeForStats(stats, r.status);
  if (stats.tests === 0) {
    console.error('Parser counted zero tests — refusing silent success. Check reporter output.');
  }
  process.exit(code);
}

if (require.main === module) main();
module.exports = { main };
