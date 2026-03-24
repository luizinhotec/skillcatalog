'use strict';

const { readState, writeState } = require('../lib/skill-state-store.cjs');
const operator = require('../skills/btc-l1-route-operator/index.cjs');

function applyPatch(state, patch) {
  if (!patch) return state;

  return {
    ...state,
    ...patch
  };
}

function main() {
  const state = readState();

  const result = operator.evaluate({
    route: 'hbtc_to_btc_l1',
    state
  });

  console.log('--- RESULT ---');
  console.log(JSON.stringify(result, null, 2));

  const newState = applyPatch(state, result.statePatch);

  writeState(newState);

  console.log('--- STATE UPDATED ---');
}

main();