'use strict';

const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'customer-health-intelligence.json');

function loadWorkflow() {
  return JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));
}

function getNodeJsCode(nodeName) {
  const wf = loadWorkflow();
  const node = (wf.nodes || []).find((n) => n.name === nodeName);
  if (!node) throw new Error(`Node not found in workflow JSON: ${nodeName}`);
  const code = node.parameters && node.parameters.jsCode;
  if (typeof code !== 'string' || !code.trim()) {
    throw new Error(`Node ${nodeName} has no jsCode`);
  }
  return code;
}

function getBaseConfigFromWorkflow() {
  const code = getNodeJsCode('Profile Config');
  // Extract JSON object assigned to config
  const m = code.match(/const config = (\{[\s\S]*?\});\s*return/);
  if (!m) throw new Error('Could not extract config from Profile Config node');
  return JSON.parse(m[1]);
}

function runScoreNodeCode(jsCode, account, config) {
  function $(name) {
    if (name === 'Profile Config') return { first: () => ({ json: config }) };
    throw new Error('Unknown node ' + name);
  }
  const fn = new Function('$', '$input', 'Math', 'Date', 'JSON', `'use strict';\n${jsCode}`);
  const $input = { item: { json: { ...account } } };
  const result = fn($, $input, Math, Date, JSON);
  if (!result || !result.json) throw new Error('Score node did not return { json }');
  return result.json;
}

function runSummaryNodeCode(jsCode, builders, config) {
  const byName = {
    'Build Red Risk Alert': builders.red || [],
    'Build Amber Nurture Task': builders.amber || [],
    'Flag Green Expansion': builders.green || [],
    'Profile Config': [config],
  };
  function $(nodeName) {
    if (nodeName === 'Profile Config') {
      return { first: () => ({ json: config }), all: () => [{ json: config }] };
    }
    const items = byName[nodeName];
    if (!items) throw new Error(`Unknown node ${nodeName}`);
    return { all: () => items.map((json) => ({ json })) };
  }
  const fn = new Function('$', 'Math', 'Date', 'JSON', `'use strict';\n${jsCode}`);
  const out = fn($, Math, Date, JSON);
  if (!Array.isArray(out) || !out[0] || !out[0].json) throw new Error('Summary bad return');
  return out[0].json;
}

module.exports = {
  WORKFLOW_PATH,
  loadWorkflow,
  getNodeJsCode,
  getBaseConfigFromWorkflow,
  runScoreNodeCode,
  runSummaryNodeCode,
};
