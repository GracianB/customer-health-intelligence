'use strict';
const eng = require('../engine/healthEngine.js');

function scoreAccountWithConfig(account, config) {
  return eng.scoreAccount(account, config);
}
function summarizeScored(scored, config) {
  return eng.summarize(scored, config);
}
module.exports = {
  scoreAccountWithConfig,
  summarizeScored,
  clamp: function (n, lo, hi) { return Math.max(lo, Math.min(hi, n)); },
  engine: eng,
};
