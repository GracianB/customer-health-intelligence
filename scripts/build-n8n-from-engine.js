#!/usr/bin/env node
'use strict';
/**
 * Rebuilds Profile Config jsCode from config/base.profile.json (single config source for base).
 * Scoring/summary jsCode stays template that reads Profile Config — behaviour proven by drift tests vs engine/.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const baseConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/base.profile.json'), 'utf8'));
const wfPath = path.join(root, 'workflows/customer-health-intelligence.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const configCode = `// AUTO-BUILT from config/base.profile.json — do not hand-edit; run scripts/build-n8n-from-engine.js
// Rules-based config (NOT ML). SAMPLE DATA profile.
const config = ${JSON.stringify(baseConfig, null, 2)};
return [{ json: config }];
`;

for (const n of wf.nodes) {
  if (n.name === 'Profile Config') n.parameters.jsCode = configCode;
}
wf.name = 'Customer Health Intelligence — Rules-based Risk Detection (v1.2)';
wf.description =
  'Customer Intelligence, Revenue Protection & Growth Automation. SAMPLE DATA. Rules-based (not ML). Slack NoOp pending configuration.';

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2) + '\n');
const test = JSON.parse(JSON.stringify(wf));
test.name = wf.name + ' (import test)';
fs.writeFileSync(path.join(root, 'samples/customer-health-intelligence.import-test.json'), JSON.stringify(test, null, 2) + '\n');
console.log('n8n Profile Config rebuilt from base.profile.json');
