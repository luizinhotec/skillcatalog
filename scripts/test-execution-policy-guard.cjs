'use strict';

const { readState } = require('../lib/skill-state-store.cjs');
const { run } = require('../skills/execution-policy-guard/index.cjs');

function main() {
  const state = readState();

  const result = run({
    state,
    route: 'hbtc_to_btc_l1'
  });

  console.log('=== EXECUTION POLICY RESULT ===');
  console.log(JSON.stringify(result, null, 2));
}

main();