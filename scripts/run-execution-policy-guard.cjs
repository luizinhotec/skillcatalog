'use strict';

const { readState, writeState } = require('../lib/skill-state-store.cjs');
const { run } = require('../skills/execution-policy-guard/index.cjs');

function main() {
  const state = readState();

  const result = run({
    state,
    route: 'hbtc_to_btc_l1'
  });

  if (!result?.ok) {
    console.error('execution-policy-guard failed');
    process.exit(1);
  }

  writeState(result.state);

  console.log(JSON.stringify({
    ok: true,
    skill: result.skill,
    route: result.route,
    decision: result.decision,
    reason: result.reason
  }, null, 2));
}

main();