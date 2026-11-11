'use strict';
/**
 * Parse Node.js test runner output (TAP and/or spec reporters).
 * Supports Node 18/20/22/24 footer styles.
 */

function num(re, text, fallback = 0) {
  const m = text.match(re);
  return m ? Number(m[1]) : fallback;
}

/**
 * Collect skip reasons from TAP (`ok N - name # SKIP reason`)
 * and spec (`﹣ name (…ms) # reason` or `# SKIP` markers).
 */
function collectSkipReasons(text) {
  const reasons = [];
  const seen = new Set();
  const push = (name, reason) => {
    const key = `${name}||${reason}`;
    if (seen.has(key)) return;
    seen.add(key);
    reasons.push({ name: name.trim(), reason: (reason || '').trim() });
  };

  // TAP: ok 1 - title # SKIP reason   (also indented)
  const tapSkip = /^\s*(?:ok|not ok)\s+\d+\s+-\s+(.+?)\s+#\s*SKIP\s*(.*)$/gim;
  let m;
  while ((m = tapSkip.exec(text))) push(m[1], m[2] || 'skipped');

  // Spec skipped test/suite line: leading ﹣ or '-' variant with # reason
  // Examples: "﹣ visual (skipped) (0.36ms) # Playwright module not found"
  const specSkip = /^\s*[﹣\-]\s+(.+?)\s+\([^)]*\)\s+#\s*(.+)$/gim;
  while ((m = specSkip.exec(text))) push(m[1], m[2]);

  return reasons;
}

/**
 * @param {string} text combined stdout+stderr from node --test
 * @returns {{tests:number,pass:number,fail:number,skipped:number,cancelled:number,todo:number,suites:number|null,executed:number,skipReasons:Array<{name:string,reason:string}>,format:string}}
 */
function parseTestOutput(text) {
  const raw = String(text || '');
  const skipReasons = collectSkipReasons(raw);

  // Prefer TAP footers (# tests N) — used when --test-reporter=tap
  const hasTapFooter = /#\s*tests\s+\d+/i.test(raw);
  // Spec / info footers (ℹ tests N) — default on some Node builds
  const hasSpecFooter = /(?:ℹ|ℹ\s*|info\s+)?tests\s+\d+/i.test(raw) && /ℹ\s+pass\s+\d+/i.test(raw)
    || /^\s*ℹ\s+tests\s+\d+/m.test(raw);

  let format = 'unknown';
  let tests = 0;
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  let cancelled = 0;
  let todo = 0;
  let suites = null;

  if (hasTapFooter) {
    format = 'tap';
    // Use last occurrence (final summary), not nested plan noise
    const tapBlock = raw.match(/(?:^|\n)(#\s*tests\s+\d+[\s\S]*)$/i);
    const block = tapBlock ? tapBlock[1] : raw;
    tests = num(/#\s*tests\s+(\d+)/i, block);
    pass = num(/#\s*pass\s+(\d+)/i, block);
    fail = num(/#\s*fail\s+(\d+)/i, block);
    skipped = num(/#\s*skipped\s+(\d+)/i, block);
    cancelled = num(/#\s*cancelled\s+(\d+)/i, block);
    todo = num(/#\s*todo\s+(\d+)/i, block);
    if (/#\s*suites\s+(\d+)/i.test(block)) suites = num(/#\s*suites\s+(\d+)/i, block);
  } else if (/ℹ\s+tests\s+\d+/m.test(raw) || /ℹ\s+pass\s+\d+/m.test(raw)) {
    format = 'spec';
    // Last ℹ block
    const lines = raw.split(/\r?\n/);
    const info = lines.filter((l) => /ℹ\s+(tests|pass|fail|skipped|cancelled|todo|suites)\b/i.test(l)).join('\n');
    const src = info || raw;
    tests = num(/ℹ\s+tests\s+(\d+)/i, src);
    pass = num(/ℹ\s+pass\s+(\d+)/i, src);
    fail = num(/ℹ\s+fail\s+(\d+)/i, src);
    skipped = num(/ℹ\s+skipped\s+(\d+)/i, src);
    cancelled = num(/ℹ\s+cancelled\s+(\d+)/i, src);
    todo = num(/ℹ\s+todo\s+(\d+)/i, src);
    if (/ℹ\s+suites\s+(\d+)/i.test(src)) suites = num(/ℹ\s+suites\s+(\d+)/i, src);
  } else if (/#\s*pass\s+\d+/i.test(raw) || /#\s*fail\s+\d+/i.test(raw)) {
    // Partial TAP without tests line
    format = 'tap-partial';
    tests = num(/#\s*tests\s+(\d+)/i, raw, NaN);
    pass = num(/#\s*pass\s+(\d+)/i, raw);
    fail = num(/#\s*fail\s+(\d+)/i, raw);
    skipped = num(/#\s*skipped\s+(\d+)/i, raw);
    cancelled = num(/#\s*cancelled\s+(\d+)/i, raw);
    todo = num(/#\s*todo\s+(\d+)/i, raw);
    if (!Number.isFinite(tests)) tests = pass + fail + skipped + cancelled + todo;
  }

  // Suite-level SKIP: Node often reports # skipped 0 even when a describe(...) is skipped.
  // Surface those via skipReasons; optionally bump a separate counter for reporting.
  const suiteSkips = skipReasons.length;
  const executed = pass + fail;

  return {
    tests,
    pass,
    fail,
    skipped,
    cancelled,
    todo,
    suites,
    executed,
    skipReasons,
    suiteSkipsReported: suiteSkips,
    format,
  };
}

function formatSummary(stats) {
  const lines = [
    '',
    '=== TEST SUMMARY ===',
    `format=${stats.format}`,
    `tests_declared=${stats.tests}`,
    `executed=${stats.executed}`,
    `passed=${stats.pass}`,
    `failed=${stats.fail}`,
    `skipped=${stats.skipped}`,
    `cancelled=${stats.cancelled}`,
    `todo=${stats.todo}`,
  ];
  if (stats.suites != null) lines.push(`suites=${stats.suites}`);
  if (stats.skipReasons && stats.skipReasons.length) {
    lines.push(`skip_entries=${stats.skipReasons.length}`);
    for (const s of stats.skipReasons) {
      lines.push(`  - SKIP ${s.name}: ${s.reason || '(no reason)'}`);
    }
  } else {
    lines.push('skip_entries=0');
  }
  lines.push('====================');
  return lines.join('\n');
}

function exitCodeForStats(stats, runnerStatus) {
  if (!stats || stats.tests === 0) return 1;
  if (stats.fail > 0) return 1;
  if (runnerStatus != null && runnerStatus !== 0 && stats.fail === 0 && stats.tests > 0) {
    return typeof runnerStatus === 'number' ? runnerStatus : 1;
  }
  return 0;
}

module.exports = { parseTestOutput, formatSummary, collectSkipReasons, exitCodeForStats };

